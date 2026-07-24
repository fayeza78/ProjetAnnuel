import Joi from "joi"
import type { CreateIncidentRequest, UpdateIncidentStatutRequest } from "../Requests/incident-request.js"

// Validators Joi - domaine INCIDENTS (types sur les interfaces Requests).

export const CreateIncidentValidator = Joi.object<CreateIncidentRequest>({
    description: Joi.string().max(1000).required(),
    type: Joi.string().valid("incident", "alerte"),
    gravite: Joi.string().valid("faible", "moyenne", "haute", "critique")
}).options({ abortEarly: false })

export const UpdateIncidentValidator = Joi.object<UpdateIncidentStatutRequest>({
    statut: Joi.string().valid("ouvert", "en_cours", "resolu", "ferme").required()
}).options({ abortEarly: false })
