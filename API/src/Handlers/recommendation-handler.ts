import { Request, Response } from "express"
import { AppDataSource_Neo4j } from "../Database/database.js"
import { UserNeo4jRepository } from "../Database/Entites_NEO4J/user_NEO4J.js"

const getUserNeo4j = () => new UserNeo4jRepository(AppDataSource_Neo4j.getDriver())

export const RecommanderVoisins = async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10

    try {
        const ids = await getUserNeo4j().getVoisinsFiables(req.user!.userId.toString(), limit)
        return res.status(200).json({ voisins: ids })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const RecommanderEvenements = async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10

    try {
        const ids = await getUserNeo4j().getEvenementsRecommandes(req.user!.userId.toString(), limit)
        return res.status(200).json({ evenements: ids })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const RecommanderServices = async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10

    try {
        const ids = await getUserNeo4j().getServicesRecommandes(req.user!.userId.toString(), limit)
        return res.status(200).json({ services: ids })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}
