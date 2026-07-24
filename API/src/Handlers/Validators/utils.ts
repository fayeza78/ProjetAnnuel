import Joi from "joi"

export interface ValidationError {
    [key: string]: string
}

export const generateValidationErrorMessage = (
    errorDetails: Joi.ValidationErrorItem[]
): ValidationError => {
    const formattedErrors: ValidationError = {}
    errorDetails.forEach((detail) => {
        const key = detail.path.join(".")

        formattedErrors[key] = detail.message
    })
    return formattedErrors
}

// Regle partagee pour les URL de medias (pieces jointes, photos d'evenements) :
// une URI absolue (https://...) OU un chemin local `/uploads/...` (les fichiers
// televerses via POST /upload sont servis en URL relative). Tout le reste
// (" pas-une-url ") est rejete.
export const mediaUrlRule = () => Joi.alternatives().try(
    Joi.string().uri().max(500),
    Joi.string().pattern(/^\/uploads\//).max(500)
)