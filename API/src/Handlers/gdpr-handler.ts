import { Request, Response } from "express"
import { ConsentementValidator } from "./Validators/gdpr-validators.js"
import { generateValidationErrorMessage } from "./Validators/utils.js"
import { AppDataSource_PostgreSQL } from "../Database/database.js"
import { User } from "../Database/Entites_PostGreSQL/user_POSTGRE.js"
import { Competence } from "../Database/Entites_PostGreSQL/competence_POSTGRE.js"
import { Evenement } from "../Database/Entites_PostGreSQL/evenement_POSTGRE.js"
import { Incident } from "../Database/Entites_PostGreSQL/incident_POSTGRE.js"
import { EffectueDemande } from "../Database/Entites_PostGreSQL/effectueDemande_POSTGRE.js"
import { Contrat } from "../Database/Entites_PostGreSQL/contrat_POSTGRE.js"
import { Token } from "../Database/Entites_PostGreSQL/token_POSTGRE.js"
import { GdprUsecase } from "../Usecases/gdpr-usecase.js"

const getUsecase = () => new GdprUsecase(
    AppDataSource_PostgreSQL.getRepository(User),
    AppDataSource_PostgreSQL.getRepository(Competence),
    AppDataSource_PostgreSQL.getRepository(Evenement),
    AppDataSource_PostgreSQL.getRepository(Incident),
    AppDataSource_PostgreSQL.getRepository(EffectueDemande),
    AppDataSource_PostgreSQL.getRepository(Contrat),
    AppDataSource_PostgreSQL.getRepository(Token)
)

// art. 15 + art. 20 RGPD : droit d'acces et portabilite
// exporte toutes les donnees perso du user connecte (JSON)
export const ExporterDonnees = async (req: Request, res: Response) => {
    try {
        const data = await getUsecase().exportData(req.user!.userId)

        // en-tete pour proposer le telechargement en fichier
        res.setHeader("Content-Type", "application/json")
        res.setHeader("Content-Disposition", `attachment; filename="mes-donnees-rgpd-${req.user!.userId}.json"`)

        return res.status(200).json(data)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

// art. 7 RGPD : donner ou retirer son consentement
export const EnregistrerConsentement = async (req: Request, res: Response) => {
    const validation = ConsentementValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }
    const { consentement } = validation.value

    try {
        const ok = await getUsecase().enregistrerConsentement(req.user!.userId, consentement)
        if (!ok) return res.status(404).json({ error: "Profil introuvable" })

        return res.status(200).json({
            message: consentement
                ? "Consentement enregistré"
                : "Consentement retiré — votre compte sera traité pour suppression"
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

// art. 7 RGPD : consulter le statut de son consentement
export const ConsulterConsentement = async (req: Request, res: Response) => {
    try {
        const result = await getUsecase().getConsentement(req.user!.userId)
        if (!result) return res.status(404).json({ error: "Profil introuvable" })

        return res.status(200).json(result)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

// art. 17 RGPD : droit a l'effacement (droit a l'oubli)
// anonymise les donnees perso sur les 3 bases. on anonymise au lieu de supprimer
// pour ne pas casser les relations entre les tables
export const AnonymiserCompte = async (req: Request, res: Response) => {
    try {
        const ok = await getUsecase().anonymiserCompte(req.user!.userId)
        if (!ok) return res.status(404).json({ error: "Utilisateur introuvable" })

        return res.status(200).json({
            message: "Vos données ont été anonymisées sur l'ensemble des systèmes (PostgreSQL, MongoDB, Neo4j). Conformément à l'article 17 du RGPD."
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}
