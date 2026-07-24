import { Request, Response } from "express"
import { CreateQuartierValidator, UpdateQuartierValidator } from "./Validators/quartier-validators.js"
import { generateValidationErrorMessage } from "./Validators/utils.js"
import { AppDataSource_PostgreSQL, AppDataSource_MongoDB, AppDataSource_Neo4j } from "../Database/database.js"
import { Quartier } from "../Database/Entites_PostGreSQL/quartier_POSTGRE.js"
import { NeighborhoodMongo } from "../Database/Entites_MongoDB/neighborhood_MONGO.js"
import { QuartierNeo4jRepository } from "../Database/Entites_NEO4J/quartier_NEO4J.js"
import { QuartierUsecase } from "../Usecases/quartier-usecase.js"

const getUsecase = () => new QuartierUsecase(AppDataSource_PostgreSQL.getRepository(Quartier))

export const CreateQuartier = async (req: Request, res: Response) => {
    const validation = CreateQuartierValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }

    try {
        const result = await getUsecase().createQuartier(validation.value)
        if (!result.ok) {
            // seul refus possible ici : chevauchement de limites
            return res.status(409).json({
                error: `La limite dessinée chevauche le quartier « ${result.conflict} ». Modifiez le tracé.`
            })
        }

        // synchro MongoDB : fiche du quartier (description + stats), sinon
        // GET /quartiers renverrait des champs null pour ce quartier
        try {
            const mongoRepo = AppDataSource_MongoDB.getRepository(NeighborhoodMongo)
            const neighborhood = mongoRepo.create({
                postgres_id: result.quartier.id_quartier.toString(),
                description: "",
                photos: [],
                stats: { inhabitants_count: 0, events_count: 0, services_count: 0, active_votes: 0 }
            })
            await mongoRepo.save(neighborhood)
        } catch (err) {
            console.error("Erreur sync MongoDB quartier:", err)
        }

        // synchro Neo4j : noeud :Quartier (sinon il n'apparaitrait dans le graphe
        // qu'au premier habitant inscrit dedans)
        try {
            await new QuartierNeo4jRepository(AppDataSource_Neo4j.getDriver()).merge({
                postgres_id: result.quartier.id_quartier.toString(),
                nom_quartier: result.quartier.nom_quartier
            })
        } catch (err) {
            console.error("Erreur sync Neo4j quartier:", err)
        }

        return res.status(201).json(result.quartier)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const GetAllQuartiers = async (_req: Request, res: Response) => {
    try {
        const quartiers = await getUsecase().getAllQuartiers()

        // enrichissement avec la fiche MongoDB (description + stats du quartier)
        let byId = new Map<string, NeighborhoodMongo>()
        try {
            const neighborhoods = await AppDataSource_MongoDB.getRepository(NeighborhoodMongo).find()
            byId = new Map(neighborhoods.map(n => [n.postgres_id, n]))
        } catch (err) {
            console.error("Enrichissement quartiers (Mongo) indisponible:", err)
        }

        const enriched = quartiers.map(q => {
            const n = byId.get(q.id_quartier.toString())
            return {
                ...q,
                description: n?.description ?? null,
                stats: n?.stats ?? null
            }
        })
        return res.status(200).json(enriched)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const GetQuartier = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" })

    try {
        const quartier = await getUsecase().getQuartierById(id)
        if (!quartier) return res.status(404).json({ error: "Quartier introuvable" })
        return res.status(200).json(quartier)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const UpdateQuartier = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" })

    const validation = UpdateQuartierValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }

    try {
        const result = await getUsecase().updateQuartier(id, validation.value)
        if (!result.ok) {
            if (result.reason === "overlap") {
                return res.status(409).json({
                    error: `La limite dessinée chevauche le quartier « ${result.conflict} ». Modifiez le tracé.`
                })
            }
            return res.status(404).json({ error: "Quartier introuvable" })
        }
        return res.status(200).json(result.quartier)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const DeleteQuartier = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" })

    try {
        const deleted = await getUsecase().deleteQuartier(id)
        if (!deleted) return res.status(404).json({ error: "Quartier introuvable" })
        return res.status(200).json({ message: "Quartier supprimé" })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}
