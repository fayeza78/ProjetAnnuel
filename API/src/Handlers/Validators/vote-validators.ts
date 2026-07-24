import Joi from "joi"
import type { CreateVoteRequest, CastVoteRequest } from "../Requests/vote-request.js"

// Validators Joi - domaine VOTES (types sur les interfaces Requests).

export const CreateVoteValidator = Joi.object<CreateVoteRequest>({
    question: Joi.string().max(255).required(),
    description: Joi.string().max(1000).optional(),
    type: Joi.string().valid("single", "multiple", "yesno").required(),
    options: Joi.array().items(Joi.string().max(200)).min(2).required(),
    isAnonymous: Joi.boolean().default(false),
    deadline: Joi.date().iso().optional(),
    targetQuartier_postgres_id: Joi.string().optional()
}).options({ abortEarly: false })

export const CastVoteValidator = Joi.object<CastVoteRequest>({
    optionIds: Joi.array().items(Joi.string()).min(1).required()
}).options({ abortEarly: false })
