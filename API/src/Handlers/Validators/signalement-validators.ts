import Joi from "joi"
import type { CreateSignalementRequest, TraiterSignalementRequest } from "../Requests/signalement-request.js"

// Validators Joi - domaine SIGNALEMENTS (types sur les interfaces Requests).

export const CreateSignalementValidator = Joi.object<CreateSignalementRequest>({
    cible_type: Joi.string().valid("message", "service", "evenement", "user").required(),
    cible_id: Joi.string().max(100).required(),
    motif: Joi.string().max(1000)
}).options({ abortEarly: false })

export const TraiterSignalementValidator = Joi.object<TraiterSignalementRequest>({
    statut: Joi.string().valid("ouvert", "traite", "rejete").required()
}).options({ abortEarly: false })
