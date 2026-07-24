import Joi from "joi"
import type { CreateContratRequest, SignerContratRequest } from "../Requests/contrat-request.js"

// Validators Joi - domaine CONTRATS (types sur les interfaces Requests).

export const CreateContratValidator = Joi.object<CreateContratRequest>({
    id_service: Joi.number().integer().required(),
    pdfUrl: Joi.string().max(500).required(),
    signatureZones: Joi.array().items(
        Joi.object({
            page: Joi.number().integer().required(),
            x: Joi.number().required(),
            y: Joi.number().required(),
            width: Joi.number().required(),
            height: Joi.number().required(),
            type: Joi.string().valid("signature", "initials").required(),
            assignedTo_postgres_id: Joi.string().required(),
            label: Joi.string().required()
        })
    ).optional().default([])
}).options({ abortEarly: false })

// la signature est l'image du trace, envoyee en data URI (ce que rend
// canvas.toDataURL()). deux gardes : le format, pour ne pas stocker n'importe
// quelle chaine dans le contrat, et la taille, parce que l'image finit dans le
// document MongoDB du contrat (limite 16 Mo par document, et le PDF plus les
// autres signatures sont dedans aussi). 2 Mo laisse large : un trace de
// signature fait quelques dizaines de Ko.
export const SignerContratValidator = Joi.object<SignerContratRequest>({
    signatureImage: Joi.string()
        .pattern(/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/]+=*$/)
        .max(2_000_000)
        .required()
        .messages({
            "string.pattern.base": "signatureImage doit être une image en data URI (data:image/png;base64,...)",
            "string.max": "Signature trop lourde (2 Mo maximum)."
        })
    // stripUnknown : l'ancien champ `code` (MFA, retiree de la signature) est tolere et
    // ignore pour ne pas casser les clients qui l'enverraient encore.
}).options({ abortEarly: false, stripUnknown: true })
