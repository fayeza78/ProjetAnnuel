import { Repository } from "typeorm"
import { User } from "../Database/Entites_PostGreSQL/user_POSTGRE.js"
import { Competence } from "../Database/Entites_PostGreSQL/competence_POSTGRE.js"
import { Evenement } from "../Database/Entites_PostGreSQL/evenement_POSTGRE.js"
import { Incident } from "../Database/Entites_PostGreSQL/incident_POSTGRE.js"
import { EffectueDemande } from "../Database/Entites_PostGreSQL/effectueDemande_POSTGRE.js"
import { Contrat } from "../Database/Entites_PostGreSQL/contrat_POSTGRE.js"
import { Token } from "../Database/Entites_PostGreSQL/token_POSTGRE.js"
import { AppDataSource_MongoDB, AppDataSource_Neo4j } from "../Database/database.js"
import { InhabitantMongo } from "../Database/Entites_MongoDB/inhabitants_MONGO.js"
import { MessageMongo } from "../Database/Entites_MongoDB/message_MONGO.js"
import { ContratMongo } from "../Database/Entites_MongoDB/contrat_MONGO.js"
import { VoteMongo } from "../Database/Entites_MongoDB/vote_MONGO.js"
import { randomUUID } from "crypto"

export class GdprUsecase {
    constructor(
        private userRepository: Repository<User>,
        private competenceRepository: Repository<Competence>,
        private evenementRepository: Repository<Evenement>,
        private incidentRepository: Repository<Incident>,
        private effectueDemandeRepository: Repository<EffectueDemande>,
        private contratRepository: Repository<Contrat>,
        private tokenRepository: Repository<Token>
    ) {}

    // --- art. 15 + art. 20 : acces et portabilite ---
    // renvoie toutes les donnees perso du user au format JSON
    async exportData(userId: number): Promise<Record<string, any>> {
        const userStr = userId.toString()

        // PostgreSQL
        const user = await this.userRepository.findOne({
            where: { id_user: userId },
            relations: ["quartier"]
        })
        if (!user) return {}

        const competences = await this.competenceRepository.find({
            where: { user: { id_user: userId } }
        })
        const evenements = await this.evenementRepository.find({
            where: { user: { id_user: userId } }
        })
        const incidents = await this.incidentRepository.find({
            where: { user: { id_user: userId } }
        })
        const demandes = await this.effectueDemandeRepository.find({
            where: { id_user: userId },
            relations: ["service"]
        })
        const contrats = await this.contratRepository.find({
            where: { users: { id_user: userId } },
            relations: ["service"]
        })

        // MongoDB
        let inhabitant = null
        let messagesEnvoyes: any[] = []
        let messagesRecus: any[] = []
        let contratsDoc: any[] = []
        let votes: any[] = []

        try {
            const inhabitantRepo = AppDataSource_MongoDB.getRepository(InhabitantMongo)
            const msgRepo = AppDataSource_MongoDB.getRepository(MessageMongo)
            const contratMongoRepo = AppDataSource_MongoDB.getRepository(ContratMongo)
            const voteRepo = AppDataSource_MongoDB.getRepository(VoteMongo)

            inhabitant = await inhabitantRepo.findOne({ where: { postgres_id: userStr } })

            const allMessages = await msgRepo.find()
            messagesEnvoyes = allMessages.filter(m => m.sender_postgres_id === userStr)
            messagesRecus = allMessages.filter(m =>
                (m.recipient_postgres_ids ?? []).includes(userStr) && m.sender_postgres_id !== userStr
            )

            const allContrats = await contratMongoRepo.find()
            contratsDoc = allContrats.filter(c =>
                (c.signatures ?? []).some(s => s.user_postgres_id === userStr) ||
                (c.signatureZones ?? []).some(z => z.assignedTo_postgres_id === userStr)
            )

            const allVotes = await voteRepo.find()
            votes = allVotes
                .filter(v => (v.votes ?? []).some(vote => vote.user_postgres_id === userStr))
                .map(v => ({
                    question: v.question,
                    type: v.type,
                    monVote: (v.votes ?? []).find(vote => vote.user_postgres_id === userStr)
                }))
        } catch (err) {
            console.error("Erreur export MongoDB:", err)
        }

        // Neo4j
        let neo4jData: Record<string, any> = {}
        try {
            const session = AppDataSource_Neo4j.session()
            try {
                const result = await session.run(
                    `MATCH (u:User {postgres_id: $id})
                     OPTIONAL MATCH (u)-[aide:A_AIDE]->(other:User)
                     OPTIONAL MATCH (u)-[participe:A_PARTICIPE]->(e:Event)
                     OPTIONAL MATCH (u)-[note:A_NOTE]->(noted:User)
                     OPTIONAL MATCH (u)-[:INTERESSE_PAR]->(t:Tag)
                     RETURN
                       collect(DISTINCT other.postgres_id) AS usersAides,
                       collect(DISTINCT {event: e.postgres_id, status: participe.status}) AS participations,
                       collect(DISTINCT {user: noted.postgres_id, rating: note.rating}) AS notes,
                       collect(DISTINCT t.name) AS interests`,
                    { id: userStr }
                )
                if (result.records.length > 0) {
                    const rec = result.records[0]!
                    neo4jData = {
                        usersAides: rec.get("usersAides"),
                        participationsEvenements: rec.get("participations"),
                        notesAttribuees: rec.get("notes"),
                        interets: rec.get("interests")
                    }
                }
            } finally {
                await session.close()
            }
        } catch (err) {
            console.error("Erreur export Neo4j:", err)
        }

        // assemblage de l'export RGPD
        return {
            meta: {
                exportDate: new Date().toISOString(),
                userId,
                notice: "Export de vos données personnelles conformément à l'article 15 et 20 du RGPD."
            },
            donnees_personnelles: {
                email: user.email,
                role: user.role,
                adresse: user.adresse,
                ville: user.ville,
                cp: user.cp,
                quartier: user.quartier?.nom_quartier ?? null,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            },
            profil_mongo: inhabitant ? {
                bio: inhabitant.bio,
                avatarUrl: inhabitant.avatarUrl,
                points: inhabitant.points,
                interets: inhabitant.interests,
                consentement: inhabitant.gdpr
            } : null,
            competences: competences.map(c => ({ libelle: c.libelle })),
            evenements_crees: evenements.map(e => ({ titre: e.titre, date: e.date_, type: e.type })),
            demandes_services: demandes.map(d => ({ id_service: d.id_service })),
            contrats: contrats.map(c => ({ id: c.id_contrat, statut: c.statut })),
            contrats_documents: contratsDoc.map(c => ({ id: c.postgres_id, statut: c.status })),
            incidents_signales: incidents.map(i => ({ description: i.description, statut: i.statut })),
            messages_envoyes: messagesEnvoyes.map(m => ({
                conversationId: m.conversationId,
                contenu: m.content,
                date: m.createdAt
            })),
            messages_recus_count: messagesRecus.length,
            votes: votes,
            graphe_social: neo4jData
        }
    }

    // --- art. 7 : consentement ---
    async enregistrerConsentement(userId: number, consentement: boolean): Promise<boolean> {
        try {
            const inhabitantRepo = AppDataSource_MongoDB.getRepository(InhabitantMongo)
            const inhabitant = await inhabitantRepo.findOne({ where: { postgres_id: userId.toString() } })
            if (!inhabitant) return false

            if (consentement) {
                inhabitant.gdpr = {
                    consentDate: new Date(),
                    exportRequestedAt: inhabitant.gdpr?.exportRequestedAt ?? null,
                    deletionRequestedAt: inhabitant.gdpr?.deletionRequestedAt ?? null
                }
            } else {
                // retrait du consentement : on marque la date de retrait
                inhabitant.gdpr = {
                    consentDate: new Date(0), // epoch = consentement retire
                    exportRequestedAt: inhabitant.gdpr?.exportRequestedAt ?? null,
                    deletionRequestedAt: new Date()
                }
            }
            await inhabitantRepo.save(inhabitant)
            return true
        } catch (err) {
            console.error("Erreur consentement MongoDB:", err)
            return false
        }
    }

    async getConsentement(userId: number): Promise<{ consentDonne: boolean; date: Date | null } | null> {
        try {
            const inhabitantRepo = AppDataSource_MongoDB.getRepository(InhabitantMongo)
            const inhabitant = await inhabitantRepo.findOne({ where: { postgres_id: userId.toString() } })
            if (!inhabitant) return null

            const gdpr = inhabitant.gdpr
            if (!gdpr) return { consentDonne: false, date: null }

            const consentDonne = gdpr.consentDate && gdpr.consentDate.getTime() > 0
            return { consentDonne: !!consentDonne, date: consentDonne ? gdpr.consentDate : null }
        } catch {
            return null
        }
    }

    // --- art. 17 : droit a l'effacement (anonymisation complete) ---
    // anonymise toutes les donnees sur les 3 bases sans casser les relations
    async anonymiserCompte(userId: number): Promise<boolean> {
        const userStr = userId.toString()
        const anonEmail = `supprime_${randomUUID().substring(0, 8)}@anonymise.rgpd`
        const anonPassword = `SUPPRIME_${randomUUID()}`

        // 1. PostgreSQL : anonymiser les champs perso (soft delete + effacement)
        const user = await this.userRepository.findOneBy({ id_user: userId })
        if (!user) return false

        user.email = anonEmail
        user.password = anonPassword
        user.adresse = "SUPPRIMÉ"
        user.ville = "SUPPRIMÉ"
        user.cp = "00000"
        await this.userRepository.save(user)
        await this.userRepository.softDelete(userId)

        // revoque tous les refresh tokens : un compte efface ne doit plus pouvoir
        // ouvrir ou rafraichir une session
        await this.tokenRepository
            .createQueryBuilder()
            .softDelete()
            .where("id_user = :id", { id: userId })
            .execute()

        // 2. MongoDB : vider le profil et anonymiser les messages
        // (les messages ne vivent que dans MongoDB)
        try {
            const inhabitantRepo = AppDataSource_MongoDB.getRepository(InhabitantMongo)
            const inhabitant = await inhabitantRepo.findOne({ where: { postgres_id: userStr } })
            if (inhabitant) {
                inhabitant.bio = "Compte supprimé"
                inhabitant.avatarUrl = ""
                inhabitant.interests = []
                inhabitant.gdpr = {
                    consentDate: new Date(0),
                    exportRequestedAt: null,
                    deletionRequestedAt: new Date()
                }
                await inhabitantRepo.save(inhabitant)
            }

            // anonymiser les messages envoyes
            const msgRepo = AppDataSource_MongoDB.getRepository(MessageMongo)
            const allMessages = await msgRepo.find()
            const sentMessages = allMessages.filter(m => m.sender_postgres_id === userStr)
            for (const msg of sentMessages) {
                msg.content = "[Message supprimé]"
                msg.mediaAttachments = []
                await msgRepo.save(msg)
            }

            // retirer les bulletins du user dans les votes
            const voteRepo = AppDataSource_MongoDB.getRepository(VoteMongo)
            const allVotes = await voteRepo.find()
            for (const vote of allVotes) {
                if ((vote.votes ?? []).some(v => v.user_postgres_id === userStr) && vote.isAnonymous) {
                    // vote anonyme : on ne touche pas aux resultats
                    continue
                }
                // vote non anonyme : on retire le vote du user
                vote.votes = (vote.votes ?? []).filter(v => v.user_postgres_id !== userStr)
                await voteRepo.save(vote)
            }
        } catch (err) {
            console.error("Erreur anonymisation MongoDB:", err)
        }

        // 3. Neo4j : supprimer le noeud et toutes ses relations
        try {
            const session = AppDataSource_Neo4j.session()
            try {
                await session.run(
                    `MATCH (u:User {postgres_id: $id}) DETACH DELETE u`,
                    { id: userStr }
                )
            } finally {
                await session.close()
            }
        } catch (err) {
            console.error("Erreur anonymisation Neo4j:", err)
        }

        return true
    }
}
