import { Repository } from "typeorm"
import { Signalement } from "../Database/Entites_PostGreSQL/signalement_POSTGRE.js"
import { User } from "../Database/Entites_PostGreSQL/user_POSTGRE.js"

export class SignalementUsecase {
    constructor(
        private signalementRepository: Repository<Signalement>,
        private userRepository: Repository<User>
    ) {}

    async createSignalement(data: { cible_type: string; cible_id: string; motif?: string }, userId: number): Promise<Signalement> {
        const user = await this.userRepository.findOneBy({ id_user: userId })

        const signalement = this.signalementRepository.create({
            cible_type: data.cible_type,
            cible_id: data.cible_id,
            statut: "ouvert",
            ...(data.motif ? { motif: data.motif } : {}),
            ...(user ? { signaleur: user } : {})
        })
        return await this.signalementRepository.save(signalement)
    }

    async getAllSignalements(statut?: string): Promise<Signalement[]> {
        const query = this.signalementRepository
            .createQueryBuilder("signalement")
            .leftJoinAndSelect("signalement.signaleur", "signaleur")

        if (statut) {
            query.where("signalement.statut = :statut", { statut })
        }

        return await query.getMany()
    }

    // reserve aux moderateurs/admins (verifie dans le handler)
    async traiterSignalement(id: number, statut: string): Promise<Signalement | null> {
        const signalement = await this.signalementRepository.findOneBy({ id_signalement: id })
        if (!signalement) return null

        signalement.statut = statut
        return await this.signalementRepository.save(signalement)
    }
}
