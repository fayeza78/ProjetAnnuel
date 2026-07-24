import Joi from "joi"
import { mediaUrlRule } from "./utils.js"
import type {
    CreateEvenementRequest, UpdateEvenementRequest, ParticiperRequest,
    CommentaireRequest, PhotoRequest, TagRequest
} from "../Requests/evenement-request.js"

// Validators Joi - domaine EVENEMENTS (types sur les interfaces Requests).

export const CreateEvenementValidator = Joi.object<CreateEvenementRequest>({
    titre: Joi.string().max(50).required(),
    date_: Joi.date().iso().optional(),
    type: Joi.string().max(50).optional(),
    description: Joi.string().max(1000).allow("").optional(),
    // memes regles que les centres d'interet de l'habitant (trim + minuscules, 2-30)
    interests: Joi.array().items(Joi.string().trim().lowercase().min(2).max(30)).max(20).unique().optional(),
    lieu: Joi.string().max(200).allow("").optional(),
    heure: Joi.string().max(20).allow("").optional(),
    duree: Joi.string().max(50).allow("").optional(),
    ageRecommande: Joi.string().max(30).allow("").optional(),
    // plafond a 100 points pour eviter qu'un evenement en donne un nombre absurde
    points: Joi.number().integer().min(0).max(100).optional()
}).options({ abortEarly: false })

export const UpdateEvenementValidator = Joi.object<UpdateEvenementRequest>({
    titre: Joi.string().max(50),
    date_: Joi.date().iso(),
    type: Joi.string().max(50),
    statut: Joi.string().valid("actif", "annule", "termine")
}).min(1).options({ abortEarly: false })

export const ParticiperValidator = Joi.object<ParticiperRequest>({
    status: Joi.string().valid("interested", "confirmed", "declined").required()
}).options({ abortEarly: false })

// -- Enrichissement du detail (MongoDB) ----------------------------------------
export const CommentaireValidator = Joi.object<CommentaireRequest>({
    content: Joi.string().min(1).max(500).required()
}).options({ abortEarly: false })

// URL de photo : URI absolue ou chemin /uploads/... (fichiers de POST /upload).
export const PhotoValidator = Joi.object<PhotoRequest>({
    url: mediaUrlRule().required()
}).options({ abortEarly: false })

export const TagValidator = Joi.object<TagRequest>({
    tag: Joi.string().trim().lowercase().min(2).max(30).required()
}).options({ abortEarly: false })
