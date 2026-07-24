import { Repository } from "typeorm"
import { Incident } from "../Database/Entites_PostGreSQL/incident_POSTGRE.js"
import { User } from "../Database/Entites_PostGreSQL/user_POSTGRE.js"

export class IncidentUsecase {
    constructor(
        private incidentRepository: Repository<Incident>,
        private userRepository: Repository<User>
    ) {}

    async createIncident(data: { description: string; type?: string; gravite?: string }, userId: number): Promise<Incident> {
        const user = await this.userRepository.findOneBy({ id_user: userId })

        const incident = this.incidentRepository.create({
            description: data.description,
            statut: "ouvert",
            ...(data.type ? { type: data.type } : {}),
            ...(data.gravite ? { gravite: data.gravite } : {}),
            ...(user ? { user } : {})
        })
        return await this.incidentRepository.save(incident) as Incident
    }

    async getAllIncidents(statut?: string): Promise<Incident[]> {
        const query = this.incidentRepository
            .createQueryBuilder("incident")
            .leftJoinAndSelect("incident.user", "user")

        if (statut) {
            query.where("incident.statut = :statut", { statut })
        }

        return await query.getMany()
    }

    async getIncidentById(id: number): Promise<Incident | null> {
        return await this.incidentRepository.findOne({
            where: { id_incident: id },
            relations: ["user"]
        })
    }

    async updateIncidentStatut(id: number, statut: string): Promise<Incident | null> {
        const incident = await this.incidentRepository.findOneBy({ id_incident: id })
        if (!incident) return null

        incident.statut = statut
        return await this.incidentRepository.save(incident)
    }
}
