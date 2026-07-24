import { Request, Response } from "express";

export type Lang = "fr" | "en";

const MESSAGES: Record<string, Record<Lang, string>> = {
  // --- transverse ---
  INTERNAL_ERROR: {
    fr: "Erreur interne du serveur",
    en: "Internal server error",
  },
  NOT_FOUND_ROUTE: { fr: "Route introuvable", en: "Route not found" },
  INVALID_JSON: { fr: "JSON invalide", en: "Invalid JSON" },
  PAYLOAD_TOO_LARGE: {
    fr: "Charge utile trop volumineuse",
    en: "Payload too large",
  },
  FILE_TYPE_NOT_ALLOWED: {
    fr: "Type de fichier non autorisé",
    en: "File type not allowed",
  },
  RATE_LIMITED: {
    fr: "Trop de requêtes, réessayez plus tard.",
    en: "Too many requests, try again later.",
  },
  RATE_LIMITED_AUTH: {
    fr: "Trop de tentatives d'authentification, réessayez dans quelques minutes.",
    en: "Too many authentication attempts, try again in a few minutes.",
  },

  // --- authentification / session ---
  AUTH_TOKEN_REQUIRED: {
    fr: "Token d'accès requis",
    en: "Access token required",
  },
  AUTH_TOKEN_INVALID: {
    fr: "Token invalide ou expiré",
    en: "Invalid or expired token",
  },
  AUTH_REQUIRED: {
    fr: "Authentification requise",
    en: "Authentication required",
  },
  FORBIDDEN_ROLE: {
    fr: "Permissions insuffisantes",
    en: "Insufficient permissions",
  },
  LOGIN_INVALID: {
    fr: "Email ou mot de passe invalide",
    en: "Invalid email or password",
  },
  REFRESH_INVALID: {
    fr: "Refresh token invalide ou expiré",
    en: "Invalid or expired refresh token",
  },
  USER_NOT_FOUND: { fr: "Utilisateur introuvable", en: "User not found" },
  WRONG_PASSWORD: { fr: "Mot de passe invalide", en: "Invalid password" },
  EMAIL_TAKEN: { fr: "E-mail déjà utilisé", en: "Email already in use" },

  // --- MFA ---
  MFA_REQUIRED: { fr: "Code MFA requis.", en: "MFA code required." },
  MFA_INVALID: { fr: "Code MFA invalide.", en: "Invalid MFA code." },
  MFA_SETUP_REQUIRED: {
    fr: "MFA obligatoire : activez la double authentification (POST /auth/mfa/setup puis /verify) avant cette action sensible.",
    en: "MFA required: enable two-factor authentication (POST /auth/mfa/setup then /verify) before this sensitive action.",
  },

  // --- mot de passe oublie ---
  RESET_TOKEN_INVALID: {
    fr: "Ticket de réinitialisation invalide ou expiré",
    en: "Invalid or expired reset token",
  },
  FORGOT_PASSWORD_OK: {
    fr: "Si ce compte existe, un lien de réinitialisation a été généré.",
    en: "If this account exists, a reset link has been generated.",
  },
  PASSWORD_CHANGED: { fr: "Mot de passe modifié", en: "Password changed" },

  // --- votes ---
  VOTE_NOT_FOUND: { fr: "Vote introuvable", en: "Poll not found" },
  VOTE_CLOSED: {
    fr: "Ce vote est clôturé ou la date limite est dépassée.",
    en: "This poll is closed or past its deadline.",
  },
  VOTE_ALREADY_CAST: {
    fr: "Vous avez déjà voté à ce sondage.",
    en: "You have already voted in this poll.",
  },
  VOTE_OPTION_INVALID: {
    fr: "Une ou plusieurs options de vote sont invalides.",
    en: "One or more poll options are invalid.",
  },
  VOTE_BLOCKED: {
    fr: "Vous avez été bloqué par un modérateur et ne pouvez pas voter.",
    en: "You have been blocked by a moderator and cannot vote.",
  },
  VOTE_DEADLINE_PAST: {
    fr: "La date limite (deadline) doit être dans le futur.",
    en: "The deadline must be in the future.",
  },
  VOTE_FORBIDDEN: {
    fr: "Vote introuvable ou permissions insuffisantes",
    en: "Poll not found or insufficient permissions",
  },

  // --- contrats ---
  CONTRAT_NOT_FOUND: { fr: "Contrat introuvable", en: "Contract not found" },
  CONTRAT_FORBIDDEN: {
    fr: "Vous n'êtes pas partie à ce contrat",
    en: "You are not a party to this contract",
  },
  CONTRAT_CLOSED: {
    fr: "Ce contrat est déjà signé ou archivé.",
    en: "This contract is already signed or archived.",
  },
  CONTRAT_ALREADY_SIGNED: {
    fr: "Vous avez déjà signé ce contrat.",
    en: "You have already signed this contract.",
  },
  CONTRAT_NOT_SIGNED: {
    fr: "Seul un contrat entièrement signé peut être archivé.",
    en: "Only a fully signed contract can be archived.",
  },

  // --- notation / interets ---
  SELF_RATING: {
    fr: "Vous ne pouvez pas vous noter vous-même.",
    en: "You cannot rate yourself.",
  },
  RATED: { fr: "Note enregistrée", en: "Rating saved" },
  INTERESTS_UPDATED: {
    fr: "Centres d'intérêt mis à jour",
    en: "Interests updated",
  },
};

// langue demandee via Accept-Language (acces defensif : les tests passent des Request partielles)
export function langueDe(req: Request): Lang {
  const header = (req?.headers?.["accept-language"] ?? "") as string;
  return header.trim().toLowerCase().startsWith("en") ? "en" : "fr";
}

// traduit un code d'erreur (si le code est inconnu on le renvoie tel quel)
export function t(req: Request, code: string): string {
  return MESSAGES[code]?.[langueDe(req)] ?? code;
}

// reponse d'erreur standard : { code, error } (+ champs en plus si besoin)
export function repondreErreur(
  req: Request,
  res: Response,
  status: number,
  code: string,
  extra: Record<string, unknown> = {},
): Response {
  return res.status(status).json({ code, error: t(req, code), ...extra });
}
