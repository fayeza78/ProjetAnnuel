import { Request, Response } from "express"
import { CreateVoteValidator, CastVoteValidator } from "./Validators/vote-validators.js"
import { generateValidationErrorMessage } from "./Validators/utils.js"
import { VoteUsecase } from "../Usecases/vote-usecase.js"
import { AppDataSource_PostgreSQL } from "../Database/database.js"
import { User } from "../Database/Entites_PostGreSQL/user_POSTGRE.js"
import { repondreErreur } from "../I18n/i18n.js"

const getUsecase = () => new VoteUsecase()

export const CreateVote = async (req: Request, res: Response) => {
    const validation = CreateVoteValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }

    // une deadline deja passee creerait un vote mort-ne
    const { deadline } = validation.value
    if (deadline && new Date(deadline).getTime() <= Date.now()) {
        return repondreErreur(req, res, 400, "VOTE_DEADLINE_PAST")
    }

    try {
        const vote = await getUsecase().createVote(validation.value, req.user!.userId)
        return res.status(201).json(vote)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const GetAllVotes = async (_req: Request, res: Response) => {
    try {
        const votes = await getUsecase().getAllVotes()
        return res.status(200).json(votes)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const GetVote = async (req: Request, res: Response) => {
    const id = req.params.id as string

    try {
        const vote = await getUsecase().getVoteById(id)
        if (!vote) return res.status(404).json({ error: "Vote introuvable" })
        return res.status(200).json(vote)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const Voter = async (req: Request, res: Response) => {
    const id = req.params.id as string

    const validation = CastVoteValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }

    try {
        // un user bloque par un moderateur ne peut pas voter
        const voter = await AppDataSource_PostgreSQL.getRepository(User).findOneBy({ id_user: req.user!.userId })
        if (voter?.vote_blocked) {
            return repondreErreur(req, res, 403, "VOTE_BLOCKED")
        }

        const result = await getUsecase().castVote(id, req.user!.userId, validation.value.optionIds)
        if (!result.ok) {
            switch (result.reason) {
                case "not_found":
                    return repondreErreur(req, res, 404, "VOTE_NOT_FOUND")
                case "closed":
                    return repondreErreur(req, res, 409, "VOTE_CLOSED")
                case "already_voted":
                    return repondreErreur(req, res, 409, "VOTE_ALREADY_CAST")
                case "invalid_option":
                    return repondreErreur(req, res, 400, "VOTE_OPTION_INVALID")
            }
        }
        return res.status(200).json(result.vote)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const CloturerVote = async (req: Request, res: Response) => {
    const id = req.params.id as string

    try {
        const vote = await getUsecase().closeVote(id, req.user!.userId, req.user!.role)
        if (!vote) return repondreErreur(req, res, 403, "VOTE_FORBIDDEN")
        return res.status(200).json({ message: "Vote clôturé", vote })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}
