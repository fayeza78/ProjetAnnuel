import { Repository } from "typeorm"
import { Incident } from "../Database/Entites_PostGreSQL/incident_POSTGRE.js"
import { AppDataSource_MongoDB } from "../Database/database.js"
import { EventMongo } from "../Database/Entites_MongoDB/event_MONGO.js"

export class StatsUsecase {
    constructor(private incidentRepository: Repository<Incident>) {}

    // stats d'incidents (pour le client Java)
    async getIncidentsStats(): Promise<Record<string, any>> {
        const incidents = await this.incidentRepository.find()

        const parStatut: Record<string, number> = {}
        const parGravite: Record<string, number> = {}
        const parType: Record<string, number> = {}

        for (const i of incidents) {
            const statut = i.statut ?? "inconnu"
            const gravite = i.gravite ?? "inconnue"
            const type = i.type ?? "incident"
            parStatut[statut] = (parStatut[statut] ?? 0) + 1
            parGravite[gravite] = (parGravite[gravite] ?? 0) + 1
            parType[type] = (parType[type] ?? 0) + 1
        }

        return { total: incidents.length, parStatut, parGravite, parType }
    }

    // stats de participation des voisins aux evenements (pour le client Java)
    async getParticipationsStats(): Promise<Record<string, any>> {
        const repo = AppDataSource_MongoDB.getRepository(EventMongo)
        const events = await repo.find()

        let interested = 0
        let confirmed = 0
        let declined = 0
        const parUtilisateur: Record<string, number> = {}

        for (const e of events) {
            for (const p of e.participants ?? []) {
                if (p.status === "interested") interested++
                else if (p.status === "confirmed") confirmed++
                else if (p.status === "declined") declined++

                if (p.status !== "declined") {
                    const id = p.inhabitant_postgres_id
                    parUtilisateur[id] = (parUtilisateur[id] ?? 0) + 1
                }
            }
        }

        return {
            totalEvenements: events.length,
            participations: { interested, confirmed, declined },
            parUtilisateur
        }
    }
}
