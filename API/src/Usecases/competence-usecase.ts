import { Repository } from "typeorm"
import { Competence } from "../Database/Entites_PostGreSQL/competence_POSTGRE.js"
import { User } from "../Database/Entites_PostGreSQL/user_POSTGRE.js"

export class CompetenceUsecase {
    constructor(
        private competenceRepository: Repository<Competence>,
        private userRepository: Repository<User>
    ) {}

    async createCompetence(libelle: string, userId: number): Promise<Competence | null> {
        const user = await this.userRepository.findOneBy({ id_user: userId })
        if (!user) return null

        const competence = this.competenceRepository.create({ libelle, user })
        return await this.competenceRepository.save(competence)
    }

    async getCompetencesByUser(userId: number): Promise<Competence[]> {
        return await this.competenceRepository.find({
            where: { user: { id_user: userId } },
            relations: ["user"]
        })
    }

    async deleteCompetence(id: number, userId: number, role: string): Promise<boolean> {
        const competence = await this.competenceRepository.findOne({
            where: { id_comp: id },
            relations: ["user"]
        })
        if (!competence) return false

        if (competence.user.id_user !== userId && role !== "admin") return false

        await this.competenceRepository.softDelete(id)
        return true
    }
}
