import { Request, Response } from "express"
import { SyncPushValidator } from "./Validators/sync-validators.js"
import { generateValidationErrorMessage } from "./Validators/utils.js"
import { AppDataSource_PostgreSQL } from "../Database/database.js"
import { Incident } from "../Database/Entites_PostGreSQL/incident_POSTGRE.js"
import { SyncUsecase } from "../Usecases/sync-usecase.js"

const getUsecase = () => new SyncUsecase(AppDataSource_PostgreSQL.getRepository(Incident))

// GET /sync?since=2025-06-01T00:00:00Z : tout ce qui a change depuis "since"
export const SyncPull = async (req: Request, res: Response) => {
    const since = req.query.since as string | undefined

    try {
        const data = await getUsecase().pull(since)
        return res.status(200).json(data)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

// POST /sync { "incidents": [ ... ] } : remontee hors-ligne (conflits : last-write-wins)
export const SyncPush = async (req: Request, res: Response) => {
    const validation = SyncPushValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }

    try {
        const results = await getUsecase().push(validation.value.incidents)
        return res.status(200).json({ serverTime: new Date().toISOString(), results })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}
