import Joi from "joi"
import type { CreateServiceRequest, UpdateServiceRequest, TerminerServiceRequest } from "../Requests/service-request.js"

// Validators Joi - domaine SERVICES (types sur les interfaces Requests).

// un prix n'a de sens que sur une offre : c'est celui qui rend le service qui
// fixe son tarif. sur une demande le prix doit rester a 0, sinon le transfert
// de points partirait a l'envers a la cloture (voir terminerService)
export const CreateServiceValidator = Joi.object<CreateServiceRequest>({
    type: Joi.string().valid("offre", "demande").required(),
    categorie: Joi.string().max(50).optional(),
    date_: Joi.date().iso().optional(),
    prix: Joi.number().integer().min(0).optional()
        .when("type", {
            is: "demande",
            then: Joi.valid(0).messages({
                "any.only": "Une demande ne peut pas etre payante : le prix doit rester a 0."
            })
        }),
    description: Joi.string().max(1000).optional()   // fiche MongoDB
}).options({ abortEarly: false })

export const UpdateServiceValidator = Joi.object<UpdateServiceRequest>({
    categorie: Joi.string().max(50),
    date_: Joi.date().iso(),
    prix: Joi.number().integer().min(0),
    statut: Joi.string().valid("disponible", "en_cours", "termine", "annule")
}).min(1).options({ abortEarly: false })

// Cloture d'un service : `id_demandeur` optionnel (sinon premiere demande).
export const TerminerServiceValidator = Joi.object<TerminerServiceRequest>({
    id_demandeur: Joi.number().integer().optional()
}).options({ abortEarly: false })
