import Joi from "joi"
import type { SyncPushRequest } from "../Requests/sync-request.js"

// Validators Joi - domaine SYNC (client Java offline-first).
// Volontairement permissif : `.unknown(true)` tolere les champs additionnels du client Java.

export const SyncPushValidator = Joi.object<SyncPushRequest>({
    incidents: Joi.array().items(
        Joi.object({
            id_incident: Joi.number().integer(),
            description: Joi.string().max(1000).allow(""),
            statut: Joi.string().max(50),
            type: Joi.string().max(30),
            gravite: Joi.string().max(20),
            updatedAt: Joi.string().max(40),   // ISO 8601 (compare cote usecase)
            id_user: Joi.number().integer()
        }).unknown(true)
    ).required()
}).options({ abortEarly: false })
