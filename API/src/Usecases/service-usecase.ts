import { Repository } from 'typeorm';
import { Service } from '../Database/Entites_PostGreSQL/service_POSTGRE.js';
import { EffectueDemande } from '../Database/Entites_PostGreSQL/effectueDemande_POSTGRE.js';
import { User } from '../Database/Entites_PostGreSQL/user_POSTGRE.js';
import { PointTransaction } from '../Database/Entites_PostGreSQL/pointTransaction_POSTGRE.js';
import { AppDataSource_MongoDB } from '../Database/database.js';
import { InhabitantMongo } from '../Database/Entites_MongoDB/inhabitants_MONGO.js';
import { ServiceMongo } from '../Database/Entites_MongoDB/service_MONGO.js';

// resultat de la cloture d'un service : ok ou refus type
// (introuvable / pas autorise / pas assez de points)
export type TerminerServiceResult =
  | {
      ok: true;
      service: Service;
      transaction: PointTransaction | null;
      prestataireId: number | null;
      demandeurId: number | null;
    }
  | {
      ok: false;
      reason: 'not_found' | 'forbidden' | 'insufficient_points' | 'transfer_failed';
    };

// resultat de la modification d'un service : ok ou refus type
export type UpdateServiceResult =
  | { ok: true; service: Service }
  | {
      ok: false;
      reason: 'not_found' | 'forbidden' | 'statut_reserve' | 'prix_verrouille';
    };

// resultat de la suppression d'un service
export type DeleteServiceResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'forbidden' | 'contrat_existant' };

// resultat du retrait d'une demande de service
export type RetirerDemandeResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'service_not_found' | 'no_demande' | 'service_termine';
    };

export class ServiceUsecase {
  constructor(
    private serviceRepository: Repository<Service>,
    private effectueDemandeRepository: Repository<EffectueDemande>,
    private userRepository: Repository<User>,
    private pointTransactionRepository: Repository<PointTransaction>,
  ) {}

  async createService(
    data: {
      type: string;
      categorie?: string;
      date_?: Date;
      prix?: number;
      description?: string; // ce champ ne vit que dans MongoDB (pas de colonne PG)
    },
    userId: number,
  ): Promise<Service> {
    const { description, ...pgData } = data;
    const service = this.serviceRepository.create({
      ...pgData,
      statut: 'disponible',
      prestataire: { id_user: userId } as any,
    });
    const saved = await this.serviceRepository.save(service);

    // synchro MongoDB : la fiche detaillee de l'annonce (description,
    // disponibilites, avis), meme principe best-effort que pour les evenements
    try {
      const mongoRepo = AppDataSource_MongoDB.getRepository(ServiceMongo);
      const serviceMongo = mongoRepo.create({
        postgres_id: saved.id_service.toString(),
        description: description ?? '',
        location: null,
        availabilities: [],
        reviews: [],
        averageRating: 0,
        reviewsCount: 0,
      });
      await mongoRepo.save(serviceMongo);
    } catch (err) {
      console.error('Erreur sync MongoDB service:', err);
    }

    return saved;
  }

  async getAllServices(filters?: {
    type?: string;
    statut?: string;
  }): Promise<Service[]> {
    const query = this.serviceRepository.createQueryBuilder('service');

    if (filters?.type) {
      query.andWhere('service.type = :type', { type: filters.type });
    }
    if (filters?.statut) {
      query.andWhere('service.statut = :statut', { statut: filters.statut });
    }

    return await query.getMany();
  }

  async getServiceById(id: number): Promise<Service | null> {
    return await this.serviceRepository.findOne({
      where: { id_service: id },
      relations: ['contrat', 'effectueDemandes', 'prestataire'],
    });
  }

  // modification d'une annonce : le createur peut modifier la sienne, admin/mod
  // peuvent tout modifier. avant, seuls admin/mod pouvaient : un voisin ne pouvait
  // plus corriger son propre prix ou sa date une fois l'annonce publiee
  async updateService(
    id: number,
    userId: number,
    role: string,
    data: {
      categorie?: string;
      date_?: Date;
      prix?: number;
      statut?: string;
    },
  ): Promise<UpdateServiceResult> {
    const service = await this.serviceRepository.findOne({
      where: { id_service: id },
      relations: ['prestataire', 'contrat'],
    });
    if (!service) return { ok: false, reason: 'not_found' };

    const estPrivilegie = role === 'admin' || role === 'moderateur';
    if (!estPrivilegie && service.prestataire?.id_user !== userId) {
      return { ok: false, reason: 'forbidden' };
    }

    // le statut suit le cycle de vie du service (demander / terminer), on ne le
    // laisse pas changer a la main : sinon le createur pourrait passer son service
    // en "termine" et court-circuiter le transfert de points
    if (data.statut !== undefined && !estPrivilegie) {
      return { ok: false, reason: 'statut_reserve' };
    }

    // le prix est fige des qu'un contrat existe : le PDF deja genere affiche
    // l'ancien montant, les deux ne doivent pas se contredire
    if (
      data.prix !== undefined &&
      data.prix !== service.prix &&
      service.contrat
    ) {
      return { ok: false, reason: 'prix_verrouille' };
    }

    Object.assign(service, data);
    return { ok: true, service: await this.serviceRepository.save(service) };
  }

  // suppression (soft-delete) : createur ou admin/mod, sauf si un contrat est deja
  // rattache au service (le contrat et son PDF doivent rester consultables)
  async deleteService(
    id: number,
    userId: number,
    role: string,
  ): Promise<DeleteServiceResult> {
    const service = await this.serviceRepository.findOne({
      where: { id_service: id },
      relations: ['prestataire', 'contrat'],
    });
    if (!service) return { ok: false, reason: 'not_found' };

    const estPrivilegie = role === 'admin' || role === 'moderateur';
    if (!estPrivilegie && service.prestataire?.id_user !== userId) {
      return { ok: false, reason: 'forbidden' };
    }

    if (service.contrat) return { ok: false, reason: 'contrat_existant' };

    await this.serviceRepository.softDelete(id);
    return { ok: true };
  }

  async demanderService(
    id_service: number,
    id_user: number,
  ): Promise<EffectueDemande | null> {
    const service = await this.serviceRepository.findOneBy({ id_service });
    if (!service) return null;

    const user = await this.userRepository.findOneBy({ id_user });
    if (!user) return null;

    const existing = await this.effectueDemandeRepository.findOneBy({
      id_user,
      id_service,
    });
    if (existing) return existing;

    const demande = this.effectueDemandeRepository.create({
      id_user,
      id_service,
      user,
      service,
    });
    return await this.effectueDemandeRepository.save(demande);
  }

  async getDemandesForService(id_service: number): Promise<EffectueDemande[]> {
    return await this.effectueDemandeRepository.find({
      where: { id_service },
      relations: ['user'],
    });
  }

  // retire la demande du user connecte pour un service
  // on ne peut retirer que sa propre demande, et pas sur un service deja termine
  // (l'echange a eu lieu). ici on fait un vrai delete (pas un soft-delete) : la
  // table effectue_demande a une cle composite (id_user, id_service), si on
  // gardait la ligne soft-supprimee elle bloquerait une re-demande plus tard
  async retirerDemande(
    id_service: number,
    id_user: number,
  ): Promise<RetirerDemandeResult> {
    const service = await this.serviceRepository.findOneBy({ id_service });
    if (!service) return { ok: false, reason: 'service_not_found' };

    if (service.statut === 'termine')
      return { ok: false, reason: 'service_termine' };

    const existing = await this.effectueDemandeRepository.findOneBy({
      id_user,
      id_service,
    });
    if (!existing) return { ok: false, reason: 'no_demande' };

    await this.effectueDemandeRepository.delete({ id_user, id_service });
    return { ok: true };
  }

  // solde de points du user (stocke sur le profil MongoDB)
  async getPoints(userId: number): Promise<number> {
    try {
      const inhabitantRepo =
        AppDataSource_MongoDB.getRepository(InhabitantMongo);
      const inhabitant = await inhabitantRepo.findOne({
        where: { postgres_id: userId.toString() },
      });
      return inhabitant?.points ?? 0;
    } catch {
      return 0;
    }
  }

  // termine un service : si payant, transfert des points demandeur -> prestataire
  // + trace de la transaction. renvoie aussi prestataire/demandeur pour la synchro
  // Neo4j faite dans le handler
  //
  // securite : seul le prestataire du service (ou un admin/mod) peut terminer,
  // et le demandeur doit etre un vrai demandeur du service. on ne fait pas
  // confiance a un id_demandeur envoye dans la requete, sinon n'importe qui
  // pourrait declencher un transfert de points entre les comptes qu'il veut
  async terminerService(
    id_service: number,
    userId: number,
    role: string,
    id_demandeur?: number,
  ): Promise<TerminerServiceResult> {
    const service = await this.serviceRepository.findOne({
      where: { id_service },
      relations: ['prestataire', 'effectueDemandes'],
    });
    if (!service) return { ok: false, reason: 'not_found' };

    const prestataireId = service.prestataire?.id_user ?? null;

    // autorisation : prestataire du service, ou admin/moderateur
    const estPrivilegie = role === 'admin' || role === 'moderateur';
    if (!estPrivilegie && userId !== prestataireId) {
      return { ok: false, reason: 'forbidden' };
    }

    // le demandeur doit faire partie des vraies demandes du service
    const demandeursValides = (service.effectueDemandes ?? []).map(
      (d) => d.id_user,
    );
    let demandeurId: number | null;
    if (id_demandeur !== undefined) {
      demandeurId = demandeursValides.includes(id_demandeur)
        ? id_demandeur
        : null;
    } else {
      demandeurId = demandeursValides[0] ?? null;
    }

    // transfert seulement sur une offre payante. le type est reverifie ici et pas
    // seulement dans le validator : le createur du service est toujours range dans
    // la colonne prestataire, donc sur une demande le sens du transfert serait
    // inverse (celui qui aide paierait celui qu'il a aide). une vieille ligne en
    // base avec type=demande et prix>0 se cloture donc sans mouvement de points
    let transaction: PointTransaction | null = null;
    if (
      service.statut !== 'termine' &&
      service.type !== 'demande' &&
      service.prix &&
      service.prix > 0 &&
      prestataireId &&
      demandeurId
    ) {
      const prix = service.prix;
      const inhabitantRepo =
        AppDataSource_MongoDB.getRepository(InhabitantMongo);
      const demandeur = await inhabitantRepo.findOne({
        where: { postgres_id: demandeurId.toString() },
      });
      const prestataire = await inhabitantRepo.findOne({
        where: { postgres_id: prestataireId.toString() },
      });

      // les deux profils MongoDB doivent exister pour transferer. sinon on ne cloture
      // pas : tracer une transaction alors que les points n'ont pas bouge fausserait
      // la comptabilite
      if (!demandeur || !prestataire) {
        return { ok: false, reason: 'transfer_failed' };
      }

      // le demandeur doit avoir assez de points, on refuse un solde negatif
      if ((demandeur.points ?? 0) < prix) {
        return { ok: false, reason: 'insufficient_points' };
      }

      // transfert du solde (MongoDB), le solde du demandeur reste >= 0. si l'ecriture
      // echoue on NE cloture PAS et on ne trace aucune transaction (voir plus bas)
      try {
        demandeur.points = (demandeur.points ?? 0) - prix;
        await inhabitantRepo.save(demandeur);
        prestataire.points = (prestataire.points ?? 0) + prix;
        await inhabitantRepo.save(prestataire);
      } catch (err) {
        console.error('Erreur transfert points MongoDB:', err);
        return { ok: false, reason: 'transfer_failed' };
      }

      // trace de la transaction (PostgreSQL)
      const tx = this.pointTransactionRepository.create({
        id_emetteur: demandeurId,
        id_recepteur: prestataireId,
        id_service,
        montant: prix,
        motif: `Service #${id_service} terminé`,
      });
      transaction = await this.pointTransactionRepository.save(tx);
    }

    service.statut = 'termine';
    await this.serviceRepository.save(service);
    return { ok: true, service, transaction, prestataireId, demandeurId };
  }
}
