import { Request, Response } from "express";
import {
  AppDataSource_MongoDB,
  AppDataSource_Neo4j,
  AppDataSource_PostgreSQL,
} from "../Database/database.js";
import { ServiceMongo } from "../Database/Entites_MongoDB/service_MONGO.js";
import { ServiceNeo4jRepository } from "../Database/Entites_NEO4J/service_NEO4J.js";
import { UserNeo4jRepository } from "../Database/Entites_NEO4J/user_NEO4J.js";
import { Contrat } from "../Database/Entites_PostGreSQL/contrat_POSTGRE.js";
import { EffectueDemande } from "../Database/Entites_PostGreSQL/effectueDemande_POSTGRE.js";
import { PointTransaction } from "../Database/Entites_PostGreSQL/pointTransaction_POSTGRE.js";
import { Service } from "../Database/Entites_PostGreSQL/service_POSTGRE.js";
import { User } from "../Database/Entites_PostGreSQL/user_POSTGRE.js";
import { ContratUsecase } from "../Usecases/contrat-usecase.js";
import { ServiceUsecase } from "../Usecases/service-usecase.js";
import {
  CreateServiceValidator,
  TerminerServiceValidator,
  UpdateServiceValidator,
} from "./Validators/service-validators.js";
import { generateValidationErrorMessage } from "./Validators/utils.js";

const getUsecase = () =>
  new ServiceUsecase(
    AppDataSource_PostgreSQL.getRepository(Service),
    AppDataSource_PostgreSQL.getRepository(EffectueDemande),
    AppDataSource_PostgreSQL.getRepository(User),
    AppDataSource_PostgreSQL.getRepository(PointTransaction),
  );

const getContratUsecase = () =>
  new ContratUsecase(
    AppDataSource_PostgreSQL.getRepository(Contrat),
    AppDataSource_PostgreSQL.getRepository(Service),
    AppDataSource_PostgreSQL.getRepository(User),
  );

export const CreateService = async (req: Request, res: Response) => {
  const validation = CreateServiceValidator.validate(req.body);
  if (validation.error) {
    return res
      .status(400)
      .send(generateValidationErrorMessage(validation.error.details));
  }

  try {
    // il faut avoir des points pour proposer un service
    const points = await getUsecase().getPoints(req.user!.userId);
    if (points <= 0) {
      return res
        .status(400)
        .json({
          error:
            "Vous n'avez pas de points : impossible de proposer un service.",
        });
    }

    const service = await getUsecase().createService(
      validation.value,
      req.user!.userId,
    );

    // si c'est une offre on synchronise avec Neo4j : noeud :Service, relation
    // PROPOSE_SERVICE et tag de categorie (A_TAG) pour les recommandations
    if (service.type === "offre") {
      try {
        const driver = AppDataSource_Neo4j.getDriver();
        // ensure : le prestataire doit exister comme noeud :User, sinon le
        // MATCH de PROPOSE_SERVICE echoue en silence (comptes d'avant la synchro)
        await new UserNeo4jRepository(driver).ensure(
          req.user!.userId.toString(),
          req.user!.email,
          req.user!.role,
        );
        const serviceNeo4j = new ServiceNeo4jRepository(driver);
        await serviceNeo4j.merge({
          postgres_id: service.id_service.toString(),
          type: service.type,
          categorie: service.categorie ?? undefined,
          prix: service.prix ?? undefined,
        });
        await serviceNeo4j.setPrestataire(
          service.id_service.toString(),
          req.user!.userId.toString(),
        );
        if (service.categorie) {
          await serviceNeo4j.addTag(
            service.id_service.toString(),
            service.categorie.toLowerCase(),
          );
        }
      } catch (err) {
        console.error("Erreur sync Neo4j service:", err);
      }
    }

    return res.status(201).json(service);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const GetAllServices = async (req: Request, res: Response) => {
  const { type, statut } = req.query as { type?: string; statut?: string };

  try {
    const services = await getUsecase().getAllServices({
      ...(type !== undefined ? { type } : {}),
      ...(statut !== undefined ? { statut } : {}),
    });
    return res.status(200).json(services);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const GetService = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

  try {
    const service = await getUsecase().getServiceById(id);
    if (!service) return res.status(404).json({ error: "Service introuvable" });

    // fiche detaillee MongoDB (description, disponibilites, avis)
    // lecture best-effort, ajoutee sous detail (memes champs PG qu'avant)
    let detail: ServiceMongo | null = null;
    try {
      detail = await AppDataSource_MongoDB.getRepository(ServiceMongo).findOne({
        where: { postgres_id: id.toString() },
      });
    } catch (err) {
      console.error("Erreur lecture MongoDB service:", err);
    }

    return res.status(200).json({ ...service, detail });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const UpdateService = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

  const validation = UpdateServiceValidator.validate(req.body);
  if (validation.error) {
    return res
      .status(400)
      .send(generateValidationErrorMessage(validation.error.details));
  }

  try {
    const result = await getUsecase().updateService(
      id,
      req.user!.userId,
      req.user!.role,
      validation.value,
    );
    if (!result.ok) {
      switch (result.reason) {
        case "not_found":
          return res.status(404).json({ error: "Service introuvable" });
        case "forbidden":
          return res.status(403).json({
            error:
              "Seul l'auteur de l'annonce (ou un admin/modérateur) peut la modifier.",
          });
        case "statut_reserve":
          return res.status(403).json({
            error:
              "Le statut évolue via les actions du service (demander, terminer) : seul un admin/modérateur peut le forcer.",
          });
        case "prix_verrouille":
          return res.status(409).json({
            error:
              "Le prix ne peut plus changer : un contrat a déjà été généré avec l'ancien montant.",
          });
      }
    }
    return res.status(200).json(result.service);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const DeleteService = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

  try {
    const result = await getUsecase().deleteService(
      id,
      req.user!.userId,
      req.user!.role,
    );
    if (!result.ok) {
      switch (result.reason) {
        case "not_found":
          return res.status(404).json({ error: "Service introuvable" });
        case "forbidden":
          return res.status(403).json({
            error:
              "Seul l'auteur de l'annonce (ou un admin/modérateur) peut la supprimer.",
          });
        case "contrat_existant":
          return res.status(409).json({
            error:
              "Ce service porte un contrat : il ne peut plus être supprimé.",
          });
      }
    }

    // synchro Neo4j : sans ce DETACH DELETE le noeud :Service resterait dans le
    // graphe et un service supprime pourrait encore etre recommande
    try {
      await new ServiceNeo4jRepository(AppDataSource_Neo4j.getDriver()).delete(
        id.toString(),
      );
    } catch (err) {
      console.error("Erreur suppression Neo4j service:", err);
    }

    return res.status(200).json({ message: "Service supprimé" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const DemanderService = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

  try {
    const demande = await getUsecase().demanderService(id, req.user!.userId);
    if (!demande) return res.status(404).json({ error: "Service introuvable" });

    // service payant : on cree automatiquement le contrat entre le prestataire
    // et le demandeur (le sujet demande un contrat pour tout service payant)
    let contrat = null;
    const service = await getUsecase().getServiceById(id);
    const prestataireId = service?.prestataire?.id_user;
    if (
      service &&
      service.prix &&
      service.prix > 0 &&
      prestataireId &&
      prestataireId !== req.user!.userId
    ) {
      try {
        contrat = await getContratUsecase().creerContratAutomatique(
          id,
          prestataireId,
          req.user!.userId,
        );
      } catch (err) {
        console.error("Erreur création contrat automatique:", err);
      }
    }

    return res
      .status(201)
      .json({
        message: "Demande enregistrée",
        demande,
        ...(contrat ? { contrat } : {}),
      });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const ListerDemandesService = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

  try {
    const demandes = await getUsecase().getDemandesForService(id);
    return res.status(200).json(demandes);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// DELETE /services/:id/demander : le user connecte retire sa propre demande
export const RetirerDemande = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

  try {
    const result = await getUsecase().retirerDemande(id, req.user!.userId);
    if (!result.ok) {
      switch (result.reason) {
        case "service_not_found":
          return res.status(404).json({ error: "Service introuvable" });
        case "no_demande":
          return res
            .status(404)
            .json({
              error: "Vous n'avez aucune demande à retirer pour ce service.",
            });
        case "service_termine":
          return res
            .status(409)
            .json({
              error:
                "Impossible de retirer une demande sur un service terminé.",
            });
      }
    }
    return res.status(200).json({ message: "Demande retirée" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// POST /services/:id/terminer : cloture le service et transfere les points (si payant)
export const TerminerService = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

  const validation = TerminerServiceValidator.validate(req.body ?? {});
  if (validation.error) {
    return res
      .status(400)
      .send(generateValidationErrorMessage(validation.error.details));
  }

  try {
    const result = await getUsecase().terminerService(
      id,
      req.user!.userId,
      req.user!.role,
      validation.value.id_demandeur,
    );
    if (!result.ok) {
      if (result.reason === "forbidden") {
        return res
          .status(403)
          .json({
            error:
              "Seul le prestataire (ou un admin/modérateur) peut terminer ce service.",
          });
      }
      if (result.reason === "insufficient_points") {
        return res
          .status(400)
          .json({
            error:
              "Le demandeur n'a pas assez de points pour payer ce service.",
          });
      }
      if (result.reason === "transfer_failed") {
        return res
          .status(500)
          .json({
            error:
              "Le transfert de points a échoué : le service n'a pas été clôturé, réessayez.",
          });
      }
      return res.status(404).json({ error: "Service introuvable" });
    }

    // synchro Neo4j : le prestataire A_AIDE le demandeur
    // ensure des deux noeuds d'abord (repare les comptes d'avant la synchro)
    if (result.transaction && result.prestataireId && result.demandeurId) {
      try {
        const userNeo4j = new UserNeo4jRepository(
          AppDataSource_Neo4j.getDriver(),
        );
        await userNeo4j.ensure(result.prestataireId.toString());
        await userNeo4j.ensure(result.demandeurId.toString());
        await userNeo4j.aAide(
          result.prestataireId.toString(),
          result.demandeurId.toString(),
          {
            service_postgres_id: id.toString(),
            points: result.transaction.montant,
            date: new Date().toISOString(),
          },
        );
      } catch (err) {
        console.error("Erreur sync Neo4j A_AIDE:", err);
      }
    }

    return res.status(200).json({
      message: "Service terminé",
      service: result.service,
      transaction: result.transaction,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// GET /me/points : solde de points du user connecte
export const ConsulterMesPoints = async (req: Request, res: Response) => {
  try {
    const points = await getUsecase().getPoints(req.user!.userId);
    return res.status(200).json({ points });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
