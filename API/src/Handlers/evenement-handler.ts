import { Request, Response } from "express"
import { CreateEvenementValidator, UpdateEvenementValidator, ParticiperValidator, CommentaireValidator, PhotoValidator, TagValidator } from "./Validators/evenement-validators.js"
import { generateValidationErrorMessage } from "./Validators/utils.js"
import { AppDataSource_PostgreSQL, AppDataSource_Neo4j } from "../Database/database.js"
import { Evenement } from "../Database/Entites_PostGreSQL/evenement_POSTGRE.js"
import { User } from "../Database/Entites_PostGreSQL/user_POSTGRE.js"
import { EvenementUsecase } from "../Usecases/evenement-usecase.js"
import { UserNeo4jRepository } from "../Database/Entites_NEO4J/user_NEO4J.js"
import { EventNeo4jRepository } from "../Database/Entites_NEO4J/event_NEO4J.js"

const getUsecase = () => new EvenementUsecase(
    AppDataSource_PostgreSQL.getRepository(Evenement),
    AppDataSource_PostgreSQL.getRepository(User)
)

export const CreateEvenement = async (req: Request, res: Response) => {
    const validation = CreateEvenementValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }

    try {
        const evenement = await getUsecase().createEvenement(validation.value, req.user!.userId)

        // synchro Neo4j : noeud :Event + tag de categorie (A_TAG) pour que
        // l'evenement soit recommandable via les centres d'interet des habitants
        try {
            const eventNeo4j = new EventNeo4jRepository(AppDataSource_Neo4j.getDriver())
            await eventNeo4j.merge({
                postgres_id: evenement.id_evenement.toString(),
                titre: evenement.titre,
                type: evenement.type ?? undefined,
                date_: evenement.date_?.toISOString()
            })
            // chaque interet selectionne devient un tag A_TAG (recommandations) ;
            // a defaut d'interet on retombe sur le type comme avant
            const interets = validation.value.interests ?? []
            const tags = interets.length > 0
                ? interets
                : (evenement.type ? [evenement.type.toLowerCase()] : [])
            for (const tag of tags) {
                await eventNeo4j.addTag(evenement.id_evenement.toString(), tag)
            }
        } catch (err) {
            console.error("Erreur sync Neo4j evenement:", err)
        }

        return res.status(201).json(evenement)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const GetAllEvenements = async (_req: Request, res: Response) => {
    try {
        const evenements = await getUsecase().getAllEvenements()
        return res.status(200).json(evenements)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const GetEvenement = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" })

    try {
        const result = await getUsecase().getEvenementById(id)
        if (!result) return res.status(404).json({ error: "Evenement introuvable" })
        return res.status(200).json(result)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const UpdateEvenement = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" })

    const validation = UpdateEvenementValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }

    try {
        const evenement = await getUsecase().updateEvenement(id, req.user!.userId, req.user!.role, validation.value)
        if (!evenement) return res.status(403).json({ error: "Evenement introuvable ou permissions insuffisantes" })
        return res.status(200).json(evenement)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const DeleteEvenement = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" })

    try {
        const deleted = await getUsecase().deleteEvenement(id, req.user!.userId, req.user!.role)
        if (!deleted) return res.status(403).json({ error: "Evenement introuvable ou permissions insuffisantes" })

        // synchro Neo4j : sans ce DETACH DELETE le noeud :Event resterait dans le
        // graphe et un evenement supprime pourrait encore etre recommande
        try {
            await new EventNeo4jRepository(AppDataSource_Neo4j.getDriver()).delete(id.toString())
        } catch (err) {
            console.error("Erreur suppression Neo4j evenement:", err)
        }

        return res.status(200).json({ message: "Evenement supprimé" })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const ParticiperEvenement = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" })

    const validation = ParticiperValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }

    const { status } = validation.value

    try {
        const ok = await getUsecase().participerEvenement(id, req.user!.userId, status)
        if (!ok) return res.status(404).json({ error: "Evenement introuvable" })

        // synchro Neo4j, ensure d'abord : sans noeud :User le MATCH de la relation
        // A_PARTICIPE echouerait en silence (comptes crees avant la synchro)
        try {
            const userNeo4j = new UserNeo4jRepository(AppDataSource_Neo4j.getDriver())
            await userNeo4j.ensure(req.user!.userId.toString(), req.user!.email, req.user!.role)
            await userNeo4j.participer(
                req.user!.userId.toString(),
                id.toString(),
                { status, joinedAt: new Date().toISOString() }
            )
        } catch (err) {
            console.error("Erreur sync Neo4j participation:", err)
        }

        return res.status(200).json({ message: `Participation enregistrée: ${status}` })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

// --- enrichissement du detail MongoDB (commentaires / photos / tags) ---

// POST /evenements/:id/commentaires : tout habitant authentifie peut commenter
export const CommenterEvenement = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" })

    const validation = CommentaireValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }

    try {
        const eventMongo = await getUsecase().ajouterCommentaire(id, req.user!.userId, validation.value.content)
        if (!eventMongo) return res.status(404).json({ error: "Evenement introuvable" })
        return res.status(201).json({ message: "Commentaire ajouté", comments: eventMongo.comments })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

// POST /evenements/:id/photos : reserve au createur (ou admin/moderateur)
// l'URL vient en general de POST /upload (/uploads/<uuid>.jpg)
export const AjouterPhotoEvenement = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" })

    const validation = PhotoValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }

    try {
        const result = await getUsecase().ajouterPhoto(id, req.user!.userId, req.user!.role, validation.value.url)
        if (!result.ok) {
            if (result.reason === "forbidden") {
                return res.status(403).json({ error: "Seul le créateur (ou un modérateur) peut ajouter des photos" })
            }
            return res.status(404).json({ error: "Evenement introuvable" })
        }
        return res.status(201).json({ message: "Photo ajoutée", photos: result.eventMongo.photos })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

// POST /evenements/:id/tags : reserve au createur (ou admin/moderateur)
// ajoute le tag au detail MongoDB et au graphe Neo4j (A_TAG, pour les recos)
export const AjouterTagEvenement = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" })

    const validation = TagValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }

    try {
        const result = await getUsecase().ajouterTag(id, req.user!.userId, req.user!.role, validation.value.tag)
        if (!result.ok) {
            if (result.reason === "forbidden") {
                return res.status(403).json({ error: "Seul le créateur (ou un modérateur) peut taguer l'événement" })
            }
            return res.status(404).json({ error: "Evenement introuvable" })
        }

        // synchro Neo4j (best-effort) : le tag alimente les recommandations
        try {
            const eventNeo4j = new EventNeo4jRepository(AppDataSource_Neo4j.getDriver())
            await eventNeo4j.addTag(id.toString(), validation.value.tag)
        } catch (err) {
            console.error("Erreur sync Neo4j tag:", err)
        }

        return res.status(201).json({ message: "Tag ajouté", tags: result.eventMongo.tags })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}
