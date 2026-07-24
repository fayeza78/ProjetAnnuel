import { Request, Response } from "express"
import { LoginValidator, RefreshTokenValidator, SsoExchangeValidator, MfaVerifyValidator, ChangePasswordValidator, ChangeEmailValidator, ChangePhoneValidator, ForgotPasswordValidator, ResetPasswordValidator } from "./Validators/user-validators.js"
import { generateValidationErrorMessage } from "./Validators/utils.js"
import { repondreErreur, t } from "../I18n/i18n.js"
import { AuthUsecase, SensitiveChangeResult } from "../Usecases/auth-usecase.js"
import { AppDataSource_PostgreSQL } from "../Database/database.js"
import { User } from "../Database/Entites_PostGreSQL/user_POSTGRE.js"
import { Token } from "../Database/Entites_PostGreSQL/token_POSTGRE.js"

const getAuthUsecase = () =>
    new AuthUsecase(
        AppDataSource_PostgreSQL.getRepository(User),
        AppDataSource_PostgreSQL.getRepository(Token)
    )

export const Login = async (req: Request, res: Response) => {
    const validation = LoginValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }

    try {
        const result = await getAuthUsecase().login(validation.value)
        if (!result) {
            return repondreErreur(req, res, 401, "LOGIN_INVALID")
        }
        return res.status(200).json(result)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const Refresh = async (req: Request, res: Response) => {
    const validation = RefreshTokenValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }

    try {
        const result = await getAuthUsecase().refresh(validation.value.refresh_token)
        if (!result) {
            return repondreErreur(req, res, 401, "REFRESH_INVALID")
        }
        return res.status(200).json(result)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const Logout = async (req: Request, res: Response) => {
    const validation = RefreshTokenValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }

    try {
        await getAuthUsecase().logout(validation.value.refresh_token)
        return res.status(200).json({ message: "Déconnexion réussie" })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const Me = async (req: Request, res: Response) => {
    const userId = req.user!.userId

    try {
        const user = await getAuthUsecase().getMe(userId)
        if (!user) {
            return res.status(404).json({ error: "Utilisateur introuvable" })
        }
        return res.status(200).json({
            id_user: user.id_user,
            email: user.email,
            role: user.role,
            adresse: user.adresse,
            ville: user.ville,
            cp: user.cp,
            quartier: user.quartier ?? null,
            mfa_enabled: user.mfa_enabled,
            vote_blocked: user.vote_blocked,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

// POST /auth/mfa/setup : genere le secret TOTP (a scanner dans Google Authenticator ou autre)
export const SetupMfa = async (req: Request, res: Response) => {
    try {
        const result = await getAuthUsecase().setupMfa(req.user!.userId)
        if (!result) return res.status(404).json({ error: "Utilisateur introuvable" })
        return res.status(200).json(result)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

// POST /auth/mfa/disable : desactive la MFA du compte connecte
export const DisableMfa = async (req: Request, res: Response) => {
    try {
        const ok = await getAuthUsecase().disableMfa(req.user!.userId)
        if (!ok) return res.status(404).json({ error: "Utilisateur introuvable" })
        return res.status(200).json({ message: "MFA désactivée" })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

// POST /auth/mfa/verify : verifie un premier code TOTP et active la MFA
export const VerifyMfa = async (req: Request, res: Response) => {
    const validation = MfaVerifyValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }

    try {
        const ok = await getAuthUsecase().verifyMfa(req.user!.userId, validation.value.code)
        if (!ok) return res.status(400).json({ error: "Code MFA invalide" })
        return res.status(200).json({ message: "MFA activée" })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

// traduit le resultat d'une action sensible en reponse HTTP (commun aux 3 changements)
// reponses { code, error }, voir src/I18n/i18n.ts
const repondreChangement = (req: Request, res: Response, result: SensitiveChangeResult, messageSucces: string) => {
    if (result.ok) return res.status(200).json({ message: messageSucces })
    switch (result.reason) {
        case "not_found":          return repondreErreur(req, res, 404, "USER_NOT_FOUND")
        case "wrong_password":     return repondreErreur(req, res, 401, "WRONG_PASSWORD")
        case "mfa_required":       return repondreErreur(req, res, 401, "MFA_REQUIRED", { mfa_required: true })
        case "mfa_invalid":        return repondreErreur(req, res, 401, "MFA_INVALID")
        // le compte doit d'abord activer la MFA avant ces actions
        case "mfa_setup_required": return repondreErreur(req, res, 403, "MFA_SETUP_REQUIRED", { mfa_setup_required: true })
        case "email_taken":        return repondreErreur(req, res, 409, "EMAIL_TAKEN")
    }
}

// POST /auth/change-password : change le mot de passe (mot de passe actuel + MFA)
export const ChangePassword = async (req: Request, res: Response) => {
    const validation = ChangePasswordValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }
    try {
        const result = await getAuthUsecase().changePassword(
            req.user!.userId, validation.value.current_password, validation.value.new_password, validation.value.code
        )
        return repondreChangement(req, res, result, t(req, "PASSWORD_CHANGED"))
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

// POST /auth/change-email : change l'email (mot de passe + MFA)
export const ChangeEmail = async (req: Request, res: Response) => {
    const validation = ChangeEmailValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }
    try {
        const result = await getAuthUsecase().changeEmail(
            req.user!.userId, validation.value.password, validation.value.new_email, validation.value.code
        )
        return repondreChangement(req, res, result, "E-mail modifié")
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

// POST /auth/change-phone : change le telephone (mot de passe + MFA)
export const ChangePhone = async (req: Request, res: Response) => {
    const validation = ChangePhoneValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }
    try {
        const result = await getAuthUsecase().changePhone(
            req.user!.userId, validation.value.password, validation.value.telephone, validation.value.code
        )
        return repondreChangement(req, res, result, "Téléphone modifié")
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

// POST /auth/sso/ticket : le user connecte au site genere un ticket SSO a usage unique
export const SsoTicket = async (req: Request, res: Response) => {
    try {
        const code = await getAuthUsecase().createSsoTicket(req.user!.userId)
        if (!code) return res.status(404).json({ error: "Utilisateur introuvable" })
        return res.status(200).json({ sso_ticket: code, expires_in: 120 })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

// POST /auth/sso/exchange : le client Java echange le ticket contre des tokens (sans mot de passe)
export const SsoExchange = async (req: Request, res: Response) => {
    const validation = SsoExchangeValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }
    try {
        const result = await getAuthUsecase().exchangeSsoTicket(validation.value.sso_ticket)
        if (!result) return res.status(401).json({ error: "Ticket SSO invalide ou expiré" })
        return res.status(200).json(result)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

// POST /auth/forgot-password : genere un ticket de reinitialisation (usage unique, 15 min)
// route publique. la reponse est la meme que l'email existe ou non, pour ne pas
// reveler quels comptes existent
// note : pas de serveur mail dans le projet, donc le ticket est renvoye dans la
// reponse (reset_token). en vraie prod il partirait par mail
export const ForgotPassword = async (req: Request, res: Response) => {
    const validation = ForgotPasswordValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }
    try {
        const token = await getAuthUsecase().forgotPassword(validation.value.email)
        // le ticket ne doit PAS fuiter dans la reponse : sinon connaitre l'email d'un
        // voisin suffit a reinitialiser son mot de passe. En prod reelle il partirait
        // par mail. EXPOSE_RESET_TOKEN=true le renvoie quand meme, uniquement pour une
        // demo (pas de serveur mail dans le perimetre du projet).
        const exposerTicket = process.env.EXPOSE_RESET_TOKEN === "true"
        return res.status(200).json({
            message: t(req, "FORGOT_PASSWORD_OK"),
            ...(token && exposerTicket ? { reset_token: token, expires_in: 900 } : {})
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

// POST /auth/reset-password : consomme le ticket et remplace le mot de passe
// revoque toutes les sessions du compte (refresh tokens)
export const ResetPassword = async (req: Request, res: Response) => {
    const validation = ResetPasswordValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }
    try {
        const ok = await getAuthUsecase().resetPassword(validation.value.token, validation.value.new_password)
        if (!ok) return repondreErreur(req, res, 401, "RESET_TOKEN_INVALID")
        return res.status(200).json({ message: t(req, "PASSWORD_CHANGED") })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}
