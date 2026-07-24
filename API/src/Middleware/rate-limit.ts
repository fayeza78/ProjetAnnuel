import rateLimit from "express-rate-limit"
import type { Request } from "express"
import { t } from "../I18n/i18n.js"

// message 429 traduit selon Accept-Language, meme format { code, error } que le reste
const message429 = (code: string) => (req: Request) => ({ code, error: t(req, code) })

// rate limiting par IP sur une fenetre de 15 min. globalLimiter est deja applique
// a toutes les routes dans index.ts, les limiteurs en dessous s'ajoutent par dessus
// sur les routes qui en ont besoin

const WINDOW_MS = 15 * 60 * 1000

const base = {
    windowMs: WINDOW_MS,
    standardHeaders: "draft-7" as const,
    legacyHeaders: false
}

// les plafonds sont modifiables via les variables RL_* (les tests E2E s'en servent)
const lim = (envVar: string | undefined, parDefaut: number): number =>
    envVar && Number(envVar) > 0 ? Number(envVar) : parDefaut

// plafond global anti abus, applique a toute l'API
// le plafond est large parce que le front eclate chaque page en beaucoup d'appels
// (la liste des services recharge le detail de chaque service), donc un simple
// rafraichissement peut faire 40 requetes
// skip : les routes de sante ne comptent pas, sinon le healthcheck du deploiement
// peut se retrouver bloque et faire echouer une mise en production
export const globalLimiter = rateLimit({
    ...base,
    limit: lim(process.env.RL_GLOBAL, 3000),
    skip: (req: Request) => req.path === "/" || req.path === "/Status",
    message: message429("RATE_LIMITED")
})

// anti brute-force sur login / register / refresh
// skipSuccessfulRequests : seuls les echecs comptent, un login reussi ou un refresh
// auto du front ne consomme rien. 20 echecs par 15 min ca suffit a bloquer le
// brute-force sans gener quelqu'un qui se trompe de mot de passe
export const authLimiter = rateLimit({
    ...base,
    limit: lim(process.env.RL_AUTH, 20),
    skipSuccessfulRequests: true,
    message: message429("RATE_LIMITED_AUTH")
})

// actions sensibles : MFA, signature de contrat, effacement RGPD, moderation
export const sensitiveLimiter = rateLimit({
    ...base,
    limit: lim(process.env.RL_SENSITIVE, 30),
    message: message429("RATE_LIMITED")
})

// ecritures classiques (creation/modif de contenu, votes, messages...)
export const writeLimiter = rateLimit({
    ...base,
    limit: lim(process.env.RL_WRITE, 150),
    message: message429("RATE_LIMITED")
})

// upload de fichiers
export const uploadLimiter = rateLimit({
    ...base,
    limit: lim(process.env.RL_UPLOAD, 40),
    message: message429("RATE_LIMITED")
})

// langage de requete mongo (admin/mod), les requetes peuvent etre lourdes
export const queryLimiter = rateLimit({
    ...base,
    limit: lim(process.env.RL_QUERY, 60),
    message: message429("RATE_LIMITED")
})
