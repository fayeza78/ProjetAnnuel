import { Request, Response } from "express"
import { CreateCompetenceValidator } from "./Validators/competence-validators.js"
import { generateValidationErrorMessage } from "./Validators/utils.js"
import { AppDataSource_PostgreSQL } from "../Database/database.js"
import { Competence } from "../Database/Entites_PostGreSQL/competence_POSTGRE.js"
import { User } from "../Database/Entites_PostGreSQL/user_POSTGRE.js"
import { CompetenceUsecase } from "../Usecases/competence-usecase.js"

const getUsecase = () => new CompetenceUsecase(
    AppDataSource_PostgreSQL.getRepository(Competence),
    AppDataSource_PostgreSQL.getRepository(User)
)

export const CreateCompetence = async (req: Request, res: Response) => {
    const validation = CreateCompetenceValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }

    try {
        const competence = await getUsecase().createCompetence(validation.value.libelle, req.user!.userId)
        if (!competence) return res.status(404).json({ error: "Utilisateur introuvable" })
        return res.status(201).json(competence)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const GetCompetences = async (req: Request, res: Response) => {
    const userId = parseInt(req.params.userId as string)
    if (isNaN(userId)) return res.status(400).json({ error: "ID invalide" })

    try {
        const competences = await getUsecase().getCompetencesByUser(userId)
        return res.status(200).json(competences)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const DeleteCompetence = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" })

    try {
        const deleted = await getUsecase().deleteCompetence(id, req.user!.userId, req.user!.role)
        if (!deleted) return res.status(403).json({ error: "Compétence introuvable ou permissions insuffisantes" })
        return res.status(200).json({ message: "Compétence supprimée" })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}
