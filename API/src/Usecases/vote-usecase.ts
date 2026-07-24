import { AppDataSource_MongoDB } from "../Database/database.js"
import { VoteMongo } from "../Database/Entites_MongoDB/vote_MONGO.js"
import { randomUUID } from "crypto"

// resultat d'un vote : ok ou refus type
// (introuvable / ferme / deja vote / option inexistante)
export type CastVoteResult =
    | { ok: true; vote: VoteMongo }
    | { ok: false; reason: "not_found" | "closed" | "already_voted" | "invalid_option" }

export class VoteUsecase {
    private get repo() {
        return AppDataSource_MongoDB.getRepository(VoteMongo)
    }

    async createVote(data: {
        question: string
        description?: string
        type: "single" | "multiple" | "yesno"
        options: string[]
        isAnonymous?: boolean
        deadline?: Date
        targetQuartier_postgres_id?: string
    }, userId: number): Promise<VoteMongo> {
        const formattedOptions = data.options.map(label => ({
            id: randomUUID(),
            label,
            votesCount: 0
        }))

        const vote = this.repo.create({
            postgres_id: randomUUID(),
            question: data.question,
            description: data.description ?? "",
            type: data.type,
            options: formattedOptions,
            votes: [],
            isAnonymous: data.isAnonymous ?? false,
            deadline: data.deadline ?? null,
            createdBy_postgres_id: userId.toString(),
            targetQuartier_postgres_id: data.targetQuartier_postgres_id ?? null,
            status: "active"
        })

        return await this.repo.save(vote)
    }

    async getAllVotes(): Promise<VoteMongo[]> {
        return await this.repo.find()
    }

    async getVoteById(postgres_id: string): Promise<VoteMongo | null> {
        return await this.repo.findOne({ where: { postgres_id } })
    }

    // un user ne peut voter qu'une seule fois par sondage (pas de modification)
    async castVote(postgres_id: string, userId: number, optionIds: string[]): Promise<CastVoteResult> {
        const vote = await this.getVoteById(postgres_id)
        if (!vote) return { ok: false, reason: "not_found" }
        if (vote.status !== "active" || (vote.deadline && vote.deadline < new Date())) {
            return { ok: false, reason: "closed" }
        }

        const votes = vote.votes ?? []

        // deja vote ? refus (un seul vote autorise)
        if (votes.some(v => v.user_postgres_id === userId.toString())) {
            return { ok: false, reason: "already_voted" }
        }

        // toutes les options envoyees doivent exister dans le sondage
        // (sinon on enregistrerait un vote fantome qui n'incremente aucun compteur)
        const validIds = new Set(vote.options.map(o => o.id))
        if (optionIds.length === 0 || optionIds.some(id => !validIds.has(id))) {
            return { ok: false, reason: "invalid_option" }
        }

        // pour le type "single" (et "yesno") on n'autorise qu'une seule option
        const finalOptionIds: string[] = vote.type === "multiple"
            ? Array.from(new Set(optionIds))
            : (optionIds[0] !== undefined ? [optionIds[0]] : [])

        votes.push({
            user_postgres_id: userId.toString(),
            optionIds: finalOptionIds,
            votedAt: new Date()
        })

        vote.options = vote.options.map(opt => ({
            ...opt,
            votesCount: finalOptionIds.includes(opt.id) ? opt.votesCount + 1 : opt.votesCount
        }))

        vote.votes = votes
        const saved = await this.repo.save(vote)
        return { ok: true, vote: saved }
    }

    // le createur peut cloturer son vote, un admin/moderateur peut cloturer
    // n'importe quel vote (moderation)
    async closeVote(postgres_id: string, userId: number, role?: string): Promise<VoteMongo | null> {
        const vote = await this.getVoteById(postgres_id)
        if (!vote) return null

        const isOwner = vote.createdBy_postgres_id === userId.toString()
        const isModerator = role === "admin" || role === "moderateur"
        if (!isOwner && !isModerator) return null

        vote.status = "closed"
        return await this.repo.save(vote)
    }
}
