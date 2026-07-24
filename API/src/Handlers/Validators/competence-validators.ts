import Joi from "joi"
import type { CreateCompetenceRequest } from "../Requests/competence-request.js"

// Validators Joi - domaine COMPETENCES.

export const CreateCompetenceValidator = Joi.object<CreateCompetenceRequest>({
    libelle: Joi.string().max(50).required()
}).options({ abortEarly: false })
