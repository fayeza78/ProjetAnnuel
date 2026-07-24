import { Request, Response } from "express"
import { AppDataSource_PostgreSQL } from "../Database/database.js"
import { Incident } from "../Database/Entites_PostGreSQL/incident_POSTGRE.js"
import { StatsUsecase } from "../Usecases/stats-usecase.js"

const getUsecase = () => new StatsUsecase(AppDataSource_PostgreSQL.getRepository(Incident))

export const StatistiquesIncidents = async (_req: Request, res: Response) => {
    try {
        const stats = await getUsecase().getIncidentsStats()
        return res.status(200).json(stats)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const StatistiquesParticipations = async (_req: Request, res: Response) => {
    try {
        const stats = await getUsecase().getParticipationsStats()
        return res.status(200).json(stats)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}
