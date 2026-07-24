import { Request, Response } from "express"
import { CreateSignalementValidator, TraiterSignalementValidator } from "./Validators/signalement-validators.js"
import { generateValidationErrorMessage } from "./Validators/utils.js"
import { AppDataSource_PostgreSQL } from "../Database/database.js"
import { Signalement } from "../Database/Entites_PostGreSQL/signalement_POSTGRE.js"
import { User } from "../Database/Entites_PostGreSQL/user_POSTGRE.js"
import { SignalementUsecase } from "../Usecases/signalement-usecase.js"

const getUsecase = () => new SignalementUsecase(
    AppDataSource_PostgreSQL.getRepository(Signalement),
    AppDataSource_PostgreSQL.getRepository(User)
)

export const CreateSignalement = async (req: Request, res: Response) => {
    const validation = CreateSignalementValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }

    try {
        const signalement = await getUsecase().createSignalement(validation.value, req.user!.userId)
        return res.status(201).json(signalement)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const GetAllSignalements = async (req: Request, res: Response) => {
    const { statut } = req.query as { statut?: string }

    try {
        const signalements = await getUsecase().getAllSignalements(statut)
        return res.status(200).json(signalements)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const TraiterSignalement = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" })

    const validation = TraiterSignalementValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }

    try {
        const signalement = await getUsecase().traiterSignalement(id, validation.value.statut)
        if (!signalement) return res.status(404).json({ error: "Signalement introuvable" })
        return res.status(200).json(signalement)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}
