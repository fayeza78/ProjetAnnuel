import Joi from "joi"
import type { CreateQuartierRequest, UpdateQuartierRequest } from "../Requests/quartier-request.js"

// Validators Joi - domaine QUARTIERS (types sur les interfaces Requests).

export const CreateQuartierValidator = Joi.object<CreateQuartierRequest>({
    nom_quartier: Joi.string().max(100).required(),
    limite_geo: Joi.string().max(2000).optional()
}).options({ abortEarly: false })

export const UpdateQuartierValidator = Joi.object<UpdateQuartierRequest>({
    nom_quartier: Joi.string().max(100),
    limite_geo: Joi.string().max(2000)
}).min(1).options({ abortEarly: false })
