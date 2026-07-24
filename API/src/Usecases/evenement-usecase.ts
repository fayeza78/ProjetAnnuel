import { Repository } from "typeorm"
import { Evenement } from "../Database/Entites_PostGreSQL/evenement_POSTGRE.js"
import { User } from "../Database/Entites_PostGreSQL/user_POSTGRE.js"
import { AppDataSource_MongoDB } from "../Database/database.js"
import { EventMongo } from "../Database/Entites_MongoDB/event_MONGO.js"
import { InhabitantMongo } from "../Database/Entites_MongoDB/inhabitants_MONGO.js"

export class EvenementUsecase {
    constructor(
        private evenementRepository: Repository<Evenement>,
        private userRepository: Repository<User>
    ) {}

    async createEvenement(data: { titre: string; date_?: Date; type?: string; description?: string; interests?: string[]; lieu?: string; heure?: string; duree?: string; ageRecommande?: string; points?: number }, userId: number): Promise<Evenement> {
        const user = await this.userRepository.findOneBy({ id_user: userId })

        // le premier interet sert de "type" (categorie affichee), tous deviennent des tags
        const interets = data.interests ?? []
        const typeAffiche = data.type ?? interets[0]

        const evenement = this.evenementRepository.create({
            titre: data.titre,
            ...(data.date_ ? { date_: data.date_ } : {}),
            ...(typeAffiche ? { type: typeAffiche } : {}),
            statut: "actif",
            ...(user ? { user } : {})
        })
        const saved = await this.evenementRepository.save(evenement) as Evenement

        // synchro MongoDB pour les donnees riches (description, interets, participants...)
        try {
            const mongoRepo = AppDataSource_MongoDB.getRepository(EventMongo)
            const eventMongo = mongoRepo.create({
                postgres_id: saved.id_evenement.toString(),
                title_event: saved.titre,
                description: data.description ?? "",
                photos: [],
                tags: interets,
                lieu: data.lieu ?? "",
                heure: data.heure ?? "",
                duree: data.duree ?? "",
                ageRecommande: data.ageRecommande ?? "",
                points: data.points ?? 0,
                participants: [],
                comments: [],
                creator: {
                    postgres_id: userId.toString(),
                    firstName: "",
                    lastName: "",
                    avatarUrl: ""
                }
            })
            await mongoRepo.save(eventMongo)
        } catch (err) {
            console.error("Erreur sync MongoDB evenement:", err)
        }

        return saved as Evenement
    }

    async getAllEvenements(): Promise<Evenement[]> {
        return await this.evenementRepository.find({ relations: ["user"] })
    }

    async getEvenementById(id: number): Promise<{ evenement: Evenement; detail: EventMongo | null } | null> {
        const evenement = await this.evenementRepository.findOne({
            where: { id_evenement: id },
            relations: ["user"]
        })
        if (!evenement) return null

        let detail: EventMongo | null = null
        try {
            const mongoRepo = AppDataSource_MongoDB.getRepository(EventMongo)
            detail = await mongoRepo.findOne({ where: { postgres_id: id.toString() } })
        } catch (err) {
            console.error("Erreur lecture MongoDB evenement:", err)
        }

        return { evenement, detail }
    }

    async updateEvenement(id: number, userId: number, role: string, data: {
        titre?: string
        date_?: Date
        type?: string
        statut?: string
    }): Promise<Evenement | null> {
        const evenement = await this.evenementRepository.findOne({
            where: { id_evenement: id },
            relations: ["user"]
        })
        if (!evenement) return null

        if (evenement.user?.id_user !== userId && role !== "admin" && role !== "moderateur") {
            return null
        }

        Object.assign(evenement, data)
        return await this.evenementRepository.save(evenement)
    }

    async deleteEvenement(id: number, userId: number, role: string): Promise<boolean> {
        const evenement = await this.evenementRepository.findOne({
            where: { id_evenement: id },
            relations: ["user"]
        })
        if (!evenement) return false

        if (evenement.user?.id_user !== userId && role !== "admin" && role !== "moderateur") {
            return false
        }

        await this.evenementRepository.softDelete(id)
        return true
    }

    async participerEvenement(id: number, userId: number, status: "interested" | "confirmed" | "declined"): Promise<boolean> {
        const evenement = await this.evenementRepository.findOneBy({ id_evenement: id })
        if (!evenement) return false

        try {
            const mongoRepo = AppDataSource_MongoDB.getRepository(EventMongo)
            const eventMongo = await mongoRepo.findOne({ where: { postgres_id: id.toString() } })
            if (!eventMongo) return false

            const participants = eventMongo.participants ?? []
            let participant = participants.find(p => p.inhabitant_postgres_id === userId.toString())
            if (participant) {
                participant.status = status
            } else {
                participant = { inhabitant_postgres_id: userId.toString(), firstName: "", status, joinedAt: new Date() }
                participants.push(participant)
            }

            // credit de points : uniquement a la 1re confirmation de presence. le flag
            // pointsAwarded empeche qu'un aller-retour confirmer/annuler recredite a l'infini
            const pointsEvent = eventMongo.points ?? 0
            if (status === "confirmed" && !participant.pointsAwarded && pointsEvent > 0) {
                try {
                    const inhabitantRepo = AppDataSource_MongoDB.getRepository(InhabitantMongo)
                    const inhabitant = await inhabitantRepo.findOne({ where: { postgres_id: userId.toString() } })
                    if (inhabitant) {
                        inhabitant.points = (inhabitant.points ?? 0) + pointsEvent
                        await inhabitantRepo.save(inhabitant)
                        participant.pointsAwarded = true
                    }
                } catch (err) {
                    console.error("Erreur credit points evenement:", err)
                }
            }

            eventMongo.participants = participants
            await mongoRepo.save(eventMongo)
        } catch (err) {
            console.error("Erreur participation MongoDB:", err)
            return false
        }

        return true
    }

    // --- enrichissement du detail MongoDB (commentaires / photos / tags) ---

    // commenter : ouvert a tout habitant authentifie
    async ajouterCommentaire(id: number, userId: number, content: string): Promise<EventMongo | null> {
        const evenement = await this.evenementRepository.findOneBy({ id_evenement: id })
        if (!evenement) return null

        const mongoRepo = AppDataSource_MongoDB.getRepository(EventMongo)
        const eventMongo = await mongoRepo.findOne({ where: { postgres_id: id.toString() } })
        if (!eventMongo) return null

        const comments = eventMongo.comments ?? []
        comments.push({
            inhabitant_postgres_id: userId.toString(),
            firstName: "",
            content,
            createdAt: new Date()
        })
        eventMongo.comments = comments
        return await mongoRepo.save(eventMongo)
    }

    // photos et tags : reserves au createur de l'evenement (ou admin/moderateur)
    private async chargerSiGestionnaire(id: number, userId: number, role: string):
        Promise<{ ok: true; eventMongo: EventMongo } | { ok: false; reason: "not_found" | "forbidden" }> {
        const evenement = await this.evenementRepository.findOne({
            where: { id_evenement: id },
            relations: ["user"]
        })
        if (!evenement) return { ok: false, reason: "not_found" }

        const estGestionnaire = evenement.user?.id_user === userId || role === "admin" || role === "moderateur"
        if (!estGestionnaire) return { ok: false, reason: "forbidden" }

        const mongoRepo = AppDataSource_MongoDB.getRepository(EventMongo)
        const eventMongo = await mongoRepo.findOne({ where: { postgres_id: id.toString() } })
        if (!eventMongo) return { ok: false, reason: "not_found" }

        return { ok: true, eventMongo }
    }

    async ajouterPhoto(id: number, userId: number, role: string, url: string):
        Promise<{ ok: true; eventMongo: EventMongo } | { ok: false; reason: "not_found" | "forbidden" }> {
        const charge = await this.chargerSiGestionnaire(id, userId, role)
        if (!charge.ok) return charge

        const photos = charge.eventMongo.photos ?? []
        if (!photos.includes(url)) photos.push(url)
        charge.eventMongo.photos = photos

        const mongoRepo = AppDataSource_MongoDB.getRepository(EventMongo)
        return { ok: true, eventMongo: await mongoRepo.save(charge.eventMongo) }
    }

    async ajouterTag(id: number, userId: number, role: string, tag: string):
        Promise<{ ok: true; eventMongo: EventMongo } | { ok: false; reason: "not_found" | "forbidden" }> {
        const charge = await this.chargerSiGestionnaire(id, userId, role)
        if (!charge.ok) return charge

        const tags = charge.eventMongo.tags ?? []
        if (!tags.includes(tag)) tags.push(tag)
        charge.eventMongo.tags = tags

        const mongoRepo = AppDataSource_MongoDB.getRepository(EventMongo)
        return { ok: true, eventMongo: await mongoRepo.save(charge.eventMongo) }
    }
}
