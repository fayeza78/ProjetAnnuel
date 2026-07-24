import { Request, Response } from "express"
import { CreateContratValidator, SignerContratValidator } from "./Validators/contrat-validators.js"
import { generateValidationErrorMessage } from "./Validators/utils.js"
import { AppDataSource_PostgreSQL, AppDataSource_MongoDB } from "../Database/database.js"
import { Contrat } from "../Database/Entites_PostGreSQL/contrat_POSTGRE.js"
import { Service } from "../Database/Entites_PostGreSQL/service_POSTGRE.js"
import { User } from "../Database/Entites_PostGreSQL/user_POSTGRE.js"
import { InhabitantMongo } from "../Database/Entites_MongoDB/inhabitants_MONGO.js"
import { ContratUsecase } from "../Usecases/contrat-usecase.js"
import { repondreErreur } from "../I18n/i18n.js"

// solde de points (profil MongoDB)
const getPoints = async (userId: number): Promise<number> => {
    try {
        const inhabitant = await AppDataSource_MongoDB.getRepository(InhabitantMongo)
            .findOne({ where: { postgres_id: userId.toString() } })
        return inhabitant?.points ?? 0
    } catch {
        return 0
    }
}

const getUsecase = () => new ContratUsecase(
    AppDataSource_PostgreSQL.getRepository(Contrat),
    AppDataSource_PostgreSQL.getRepository(Service),
    AppDataSource_PostgreSQL.getRepository(User)
)

export const CreateContrat = async (req: Request, res: Response) => {
    const validation = CreateContratValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }

    try {
        // il faut avoir des points pour creer un contrat
        if (await getPoints(req.user!.userId) <= 0) {
            return res.status(400).json({ error: "Vous n'avez pas de points : impossible de créer un contrat." })
        }

        const result = await getUsecase().createContrat(validation.value, req.user!.userId)
        if (!result) return res.status(404).json({ error: "Service introuvable" })
        return res.status(201).json(result)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const GetContrat = async (req: Request, res: Response) => {
    const id = req.params.id as string

    try {
        const contrat = await getUsecase().getContratById(id)
        if (!contrat) return res.status(404).json({ error: "Contrat introuvable" })
        // un contrat (PDF + signatures base64) ne doit etre lu que par ses parties
        if (!(await getUsecase().peutConsulter(id, req.user!.userId, req.user!.role))) {
            return res.status(403).json({ error: "Vous n'êtes pas partie à ce contrat" })
        }
        return res.status(200).json(contrat)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const ConsulterAuditContrat = async (req: Request, res: Response) => {
    const id = req.params.id as string

    try {
        const contrat = await getUsecase().getContratById(id)
        if (!contrat) return res.status(404).json({ error: "Contrat introuvable" })
        if (!(await getUsecase().peutConsulter(id, req.user!.userId, req.user!.role))) {
            return res.status(403).json({ error: "Vous n'êtes pas partie à ce contrat" })
        }
        return res.status(200).json({ auditTrail: contrat.auditTrail ?? [] })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const SignerContrat = async (req: Request, res: Response) => {
    const id = req.params.id as string

    const validation = SignerContratValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }

    // IP reelle du signataire (X-Forwarded-For via trust proxy), preuve de signature
    const ip = req.ip ?? ""

    try {
        const result = await getUsecase().signerContrat(
            id, req.user!.userId, validation.value.signatureImage, ip
        )
        if (!result.ok) {
            switch (result.reason) {
                case "not_found":
                    return repondreErreur(req, res, 404, "CONTRAT_NOT_FOUND")
                case "forbidden":
                    return repondreErreur(req, res, 403, "CONTRAT_FORBIDDEN")
                case "closed":
                    return repondreErreur(req, res, 409, "CONTRAT_CLOSED")
                case "already_signed":
                    return repondreErreur(req, res, 409, "CONTRAT_ALREADY_SIGNED")
            }
        }
        return res.status(200).json({ message: "Signature enregistrée", contrat: result.contrat })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

// POST /contrats/:id/archiver : archive un contrat signe (parties au contrat ou admin/mod)
export const ArchiverContrat = async (req: Request, res: Response) => {
    const id = req.params.id as string

    try {
        const result = await getUsecase().archiverContrat(id, req.user!.userId, req.user!.role)
        if (!result.ok) {
            switch (result.reason) {
                case "not_found":
                    return res.status(404).json({ error: "Contrat introuvable" })
                case "forbidden":
                    return res.status(403).json({ error: "Vous n'êtes pas autorisé à archiver ce contrat" })
                case "not_signed":
                    return res.status(409).json({ error: "Seul un contrat entièrement signé peut être archivé." })
            }
        }
        return res.status(200).json({ message: "Contrat archivé", contrat: result.contrat })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}
