import { Repository } from "typeorm"
import { Incident } from "../Database/Entites_PostGreSQL/incident_POSTGRE.js"

// donnee d'incident telle qu'envoyee par le client Java (offline-first)
// description optionnelle : une maj peut ne porter que le statut
// (le code fait deja inc.description ?? existing.description)
export interface IncidentSyncDTO {
    id_incident?: number
    description?: string
    statut?: string
    type?: string
    gravite?: string
    updatedAt?: string
    id_user?: number
}

export class SyncUsecase {
    constructor(private incidentRepository: Repository<Incident>) {}

    // --- PULL : tout ce qui a change cote serveur depuis "since" ---
    async pull(since?: string): Promise<{ serverTime: string; incidents: Incident[] }> {
        const sinceDate = since ? new Date(since) : new Date(0)

        const incidents = await this.incidentRepository
            .createQueryBuilder("incident")
            .leftJoinAndSelect("incident.user", "user")
            .where("incident.updatedAt > :since", { since: sinceDate })
            .getMany()

        return { serverTime: new Date().toISOString(), incidents }
    }

    // --- PUSH : remontee des incidents crees/modifies hors-ligne ---
    // resolution de conflits : last-write-wins sur updatedAt
    async push(incidents: IncidentSyncDTO[]): Promise<Array<Record<string, any>>> {
        const results: Array<Record<string, any>> = []

        for (const inc of incidents) {
            if (inc.id_incident) {
                const existing = await this.incidentRepository.findOneBy({ id_incident: inc.id_incident })

                if (!existing) {
                    // existait cote client mais plus cote serveur : on recree
                    const created = this.incidentRepository.create({
                        ...(inc.description !== undefined ? { description: inc.description } : {}),
                        statut: inc.statut ?? "ouvert",
                        ...(inc.type ? { type: inc.type } : {}),
                        ...(inc.gravite ? { gravite: inc.gravite } : {})
                    })
                    const saved = await this.incidentRepository.save(created)
                    results.push({ clientId: inc.id_incident, status: "recreated", id: saved.id_incident })
                    continue
                }

                const clientUpdated = inc.updatedAt ? new Date(inc.updatedAt) : new Date(0)
                if (clientUpdated > existing.updatedAt) {
                    existing.description = inc.description ?? existing.description
                    existing.statut = inc.statut ?? existing.statut
                    if (inc.type) existing.type = inc.type
                    if (inc.gravite) existing.gravite = inc.gravite
                    const saved = await this.incidentRepository.save(existing)
                    results.push({ clientId: inc.id_incident, status: "updated", id: saved.id_incident })
                } else {
                    // le serveur est plus recent : on garde la version serveur
                    results.push({ clientId: inc.id_incident, status: "kept_server", id: existing.id_incident })
                }
            } else {
                // nouvel incident cree hors-ligne
                const created = this.incidentRepository.create({
                    ...(inc.description !== undefined ? { description: inc.description } : {}),
                    statut: inc.statut ?? "ouvert",
                    ...(inc.type ? { type: inc.type } : {}),
                    ...(inc.gravite ? { gravite: inc.gravite } : {}),
                    ...(inc.id_user ? { user: { id_user: inc.id_user } as any } : {})
                })
                const saved = await this.incidentRepository.save(created)
                results.push({ status: "created", id: saved.id_incident })
            }
        }

        return results
    }
}
