// -----------------------------------------------------------------------------
// Interfaces des corps de requetes - domaine AUTH.
// Contrat TypeScript de chaque route : le validator Joi correspondant est type
// `Joi.object<Interface>(...)`, donc `validation.value` est automatiquement type
// dans le handler. Un champ ajoute ici sans regle Joi (ou l'inverse) se voit.
// -----------------------------------------------------------------------------

export interface LoginRequest {
    email: string
    password: string
    code?: string              // TOTP, exige si la MFA du compte est activee
}

export interface RefreshTokenRequest {
    refresh_token: string      // utilise par /auth/refresh ET /auth/logout
}

export interface SsoExchangeRequest {
    sso_ticket: string         // ticket a usage unique genere par /auth/sso/ticket
}

export interface MfaVerifyRequest {
    code: string               // 6 chiffres TOTP
}

export interface ChangePasswordRequest {
    current_password: string
    new_password: string
    code?: string
}

export interface ChangeEmailRequest {
    password: string
    new_email: string
    code?: string
}

export interface ChangePhoneRequest {
    password: string
    telephone: string
    code?: string
}

export interface ForgotPasswordRequest {
    email: string
}

export interface ResetPasswordRequest {
    token: string
    new_password: string
}
