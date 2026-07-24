import { Request, Response } from "express"
import { CreateIncidentValidator, UpdateIncidentValidator } from "./Validators/incident-validators.js"
import { generateValidationErrorMessage } from "./Validators/utils.js"
import { AppDataSource_PostgreSQL } from "../Database/database.js"
import { Incident } from "../Database/Entites_PostGreSQL/incident_POSTGRE.js"
import { User } from "../Database/Entites_PostGreSQL/user_POSTGRE.js"
import { IncidentUsecase } from "../Usecases/incident-usecase.js"

const getUsecase = () => new IncidentUsecase(
    AppDataSource_PostgreSQL.getRepository(Incident),
    AppDataSource_PostgreSQL.getRepository(User)
)

export const CreateIncident = async (req: Request, res: Response) => {
    const validation = CreateIncidentValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }

    try {
        const incident = await getUsecase().createIncident(validation.value, req.user!.userId)
        return res.status(201).json(incident)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const GetAllIncidents = async (req: Request, res: Response) => {
    const { statut } = req.query as { statut?: string }

    try {
        const incidents = await getUsecase().getAllIncidents(statut)
        return res.status(200).json(incidents)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const GetIncident = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" })

    try {
        const incident = await getUsecase().getIncidentById(id)
        if (!incident) return res.status(404).json({ error: "Incident introuvable" })
        return res.status(200).json(incident)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const ChangerStatutIncident = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" })

    if (req.user!.role !== "admin" && req.user!.role !== "moderateur") {
        return res.status(403).json({ error: "Permissions insuffisantes" })
    }

    const validation = UpdateIncidentValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }

    try {
        const incident = await getUsecase().updateIncidentStatut(id, validation.value.statut)
        if (!incident) return res.status(404).json({ error: "Incident introuvable" })
        return res.status(200).json(incident)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}
