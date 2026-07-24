import { Request, Response } from "express"
import { QueryValidator } from "./Validators/query-validators.js"
import { generateValidationErrorMessage } from "./Validators/utils.js"
import { QueryUsecase } from "../Usecases/query-usecase.js"

const getUsecase = () => new QueryUsecase()

// POST /query { "query": "FIND events WHERE tags CONTAINS \"musique\" LIMIT 5" }
export const ExecuterRequete = async (req: Request, res: Response) => {
    const validation = QueryValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }

    try {
        const resultat = await getUsecase().executerRequete(validation.value.query)
        return res.status(200).json(resultat)
    } catch (error) {
        // erreur de syntaxe / collection inconnue : 400 (faute du client)
        return res.status(400).json({ error: (error as Error).message })
    }
}
