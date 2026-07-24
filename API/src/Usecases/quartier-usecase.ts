import { Repository } from "typeorm"
import { Quartier } from "../Database/Entites_PostGreSQL/quartier_POSTGRE.js"
import { lirePolygoneGeoJson, polygonesSeChevauchent } from "../Geo/geo.js"

// resultats d'enregistrement d'un quartier : ok ou refus type
// overlap = la limite dessinee chevauche un quartier existant
export type QuartierOverlap = { ok: false; reason: "overlap"; conflict: string }
export type CreateQuartierResult = { ok: true; quartier: Quartier } | QuartierOverlap
export type UpdateQuartierResult =
    | { ok: true; quartier: Quartier }
    | { ok: false; reason: "not_found" }
    | QuartierOverlap

export class QuartierUsecase {
    constructor(private quartierRepository: Repository<Quartier>) {}

    // cherche un quartier existant dont la limite chevauche limiteGeo
    // renvoie son nom, ou null si pas de chevauchement (ou limite pas exploitable)
    private async trouverChevauchement(limiteGeo: string | undefined, excludeId?: number): Promise<string | null> {
        const nouveau = lirePolygoneGeoJson(limiteGeo)
        if (!nouveau) return null // pas de polygone lisible, rien a verifier

        const autres = await this.quartierRepository.find()
        for (const q of autres) {
            if (excludeId !== undefined && q.id_quartier === excludeId) continue
            const existant = lirePolygoneGeoJson(q.limite_geo)
            if (existant && polygonesSeChevauchent(nouveau, existant)) return q.nom_quartier
        }
        return null
    }

    async createQuartier(data: { nom_quartier: string; limite_geo?: string }): Promise<CreateQuartierResult> {
        const conflict = await this.trouverChevauchement(data.limite_geo)
        if (conflict) return { ok: false, reason: "overlap", conflict }

        const quartier = this.quartierRepository.create(data)
        return { ok: true, quartier: await this.quartierRepository.save(quartier) }
    }

    async getAllQuartiers(): Promise<Quartier[]> {
        return await this.quartierRepository.find()
    }

    async getQuartierById(id: number): Promise<Quartier | null> {
        // endpoint public : on ne charge pas la liste des habitants (users), sinon
        // l'annuaire complet du quartier (emails inclus) serait expose sans auth
        return await this.quartierRepository.findOneBy({ id_quartier: id })
    }

    async updateQuartier(id: number, data: { nom_quartier?: string; limite_geo?: string }): Promise<UpdateQuartierResult> {
        const quartier = await this.quartierRepository.findOneBy({ id_quartier: id })
        if (!quartier) return { ok: false, reason: "not_found" }

        // si on change la limite, on verifie qu'elle ne chevauche pas un autre quartier
        if (data.limite_geo !== undefined) {
            const conflict = await this.trouverChevauchement(data.limite_geo, id)
            if (conflict) return { ok: false, reason: "overlap", conflict }
        }

        Object.assign(quartier, data)
        return { ok: true, quartier: await this.quartierRepository.save(quartier) }
    }

    async deleteQuartier(id: number): Promise<boolean> {
        const quartier = await this.quartierRepository.findOneBy({ id_quartier: id })
        if (!quartier) return false
        await this.quartierRepository.softDelete(id)
        return true
    }
}
