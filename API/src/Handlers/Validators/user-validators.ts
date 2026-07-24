import Joi from "joi"
import type {
    LoginRequest, RefreshTokenRequest, SsoExchangeRequest, MfaVerifyRequest,
    ChangePasswordRequest, ChangeEmailRequest, ChangePhoneRequest,
    ForgotPasswordRequest, ResetPasswordRequest
} from "../Requests/auth-request.js"
import type {
    CreateUserRequest, UpdateUserRequest, UpdateRoleRequest,
    VoteBlockRequest, NoterVoisinRequest, SetInteretsRequest
} from "../Requests/user-request.js"

// Validators Joi - domaines USERS + AUTH. Chaque validator est type sur son
// interface Requests : `validation.value` est donc type dans le handler.

// -- Comptes -------------------------------------------------------------------

export const CreateUserValidator = Joi.object<CreateUserRequest>({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    adresse: Joi.string().max(255).required(),
    ville: Joi.string().max(100).required(),
    cp: Joi.string().length(5).pattern(/^[0-9]+$/).required(),
    nom_quartier: Joi.string().max(100).required()
}).options({ abortEarly: false })

export const UpdateUserValidator = Joi.object<UpdateUserRequest>({
    adresse: Joi.string().max(255),
    ville: Joi.string().max(100),
    cp: Joi.string().length(5).pattern(/^[0-9]+$/),
    telephone: Joi.string().max(20),
    langue: Joi.string().max(5)
}).min(1).options({ abortEarly: false })

export const UpdateRoleValidator = Joi.object<UpdateRoleRequest>({
    role: Joi.string().valid("user", "moderateur", "admin").required()
}).options({ abortEarly: false })

// Blocage des votes (moderation) : booleen strict (pas de "true" en chaine).
export const VoteBlockValidator = Joi.object<VoteBlockRequest>({
    blocked: Joi.boolean().strict().required()
}).options({ abortEarly: false })

// -- Authentification ----------------------------------------------------------

export const LoginValidator = Joi.object<LoginRequest>({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),          // login : min 6 (compte admin "compaq"). L'inscription publique reste a min 8.
    code: Joi.string().length(6).pattern(/^[0-9]+$/)   // code MFA (TOTP), si MFA activee
}).options({ abortEarly: false })

// Utilise par /auth/refresh ET /auth/logout (meme corps).
export const RefreshTokenValidator = Joi.object<RefreshTokenRequest>({
    refresh_token: Joi.string().max(100).required()
}).options({ abortEarly: false })

// Echange d'un ticket SSO (client Java) contre des tokens.
export const SsoExchangeValidator = Joi.object<SsoExchangeRequest>({
    sso_ticket: Joi.string().max(100).required()
}).options({ abortEarly: false })

export const MfaVerifyValidator = Joi.object<MfaVerifyRequest>({
    code: Joi.string().length(6).pattern(/^[0-9]+$/).required()
}).options({ abortEarly: false })

// -- Changements d'informations sensibles (mot de passe / e-mail / telephone) --
// Le `code` (TOTP) n'est requis que si l'utilisateur a active la MFA (verifie cote usecase).
export const ChangePasswordValidator = Joi.object<ChangePasswordRequest>({
    current_password: Joi.string().required(),
    new_password: Joi.string().min(8).required(),
    code: Joi.string().length(6).pattern(/^[0-9]+$/)
}).options({ abortEarly: false })

export const ChangeEmailValidator = Joi.object<ChangeEmailRequest>({
    password: Joi.string().required(),
    new_email: Joi.string().email().required(),
    code: Joi.string().length(6).pattern(/^[0-9]+$/)
}).options({ abortEarly: false })

export const ChangePhoneValidator = Joi.object<ChangePhoneRequest>({
    password: Joi.string().required(),
    telephone: Joi.string().max(20).required(),
    code: Joi.string().length(6).pattern(/^[0-9]+$/)
}).options({ abortEarly: false })

// -- Mot de passe oublie (ticket a usage unique, 15 min) -----------------------
export const ForgotPasswordValidator = Joi.object<ForgotPasswordRequest>({
    email: Joi.string().email().required()
}).options({ abortEarly: false })

export const ResetPasswordValidator = Joi.object<ResetPasswordRequest>({
    token: Joi.string().required(),
    new_password: Joi.string().min(8).required()
}).options({ abortEarly: false })

// -- Notation d'un voisin (alimente le graphe Neo4j / recommandations) ---------
export const NoterVoisinValidator = Joi.object<NoterVoisinRequest>({
    rating: Joi.number().integer().min(1).max(5).required()
}).options({ abortEarly: false })

// -- Centres d'interet (INTERESSE_PAR dans Neo4j + profil MongoDB) -------------
export const SetInteretsValidator = Joi.object<SetInteretsRequest>({
    interests: Joi.array().items(Joi.string().trim().lowercase().min(2).max(30)).max(10).unique().required()
}).options({ abortEarly: false })
