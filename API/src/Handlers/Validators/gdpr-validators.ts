import Joi from "joi"
import type { ConsentementRequest } from "../Requests/gdpr-request.js"

// Validators Joi - domaine RGPD.

export const ConsentementValidator = Joi.object<ConsentementRequest>({
    consentement: Joi.boolean().strict().required()   // vrai booleen JSON exige
}).options({ abortEarly: false })
