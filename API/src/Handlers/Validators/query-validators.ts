import Joi from "joi"
import type { QueryRequest } from "../Requests/query-request.js"

// Validators Joi - domaine QUERY (langage d'interrogation maison).

export const QueryValidator = Joi.object<QueryRequest>({
    query: Joi.string().min(1).max(2000).required()
}).options({ abortEarly: false })
