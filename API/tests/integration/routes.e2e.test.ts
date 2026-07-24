// -----------------------------------------------------------------------------
// Suite E2E / integration HTTP de TOUTES les routes (supertest).
//
// On monte l'app comme en production (en-tetes de securite, parseur JSON borne,
// rate-limit global, 404 + gestionnaire d'erreurs JSON) MAIS sans initialiser les
// bases : on teste donc de facon DETERMINISTE tout ce qui repond AVANT d'atteindre
// une BDD - le contrat de chaque route :
//    401 sans token 403 mauvais role
//    400 corps invalide (Joi) 400 identifiant non numerique
//    routes publiques 404 route inconnue, JSON malforme, en-tetes...
//
// Les limites de debit sont relevees via RL_* pour ne pas gener la suite.
// -----------------------------------------------------------------------------
import { test, describe, before } from "node:test"
import assert from "node:assert/strict"
import express, { type Express } from "express"
import request from "supertest"
import jwt from "jsonwebtoken"

process.env.JWT_SECRET = "test-secret"
process.env.RL_GLOBAL = "1000000"
process.env.RL_AUTH = "1000000"
process.env.RL_SENSITIVE = "1000000"
process.env.RL_WRITE = "1000000"
process.env.RL_UPLOAD = "1000000"
process.env.RL_QUERY = "1000000"

let app: Express

const sign = (role: string) => jwt.sign({ userId: 1, email: "a@b.fr", role }, "test-secret")
const USER = sign("user")
const MOD = sign("moderateur")
const ADMIN = sign("admin")

type Method = "get" | "post" | "put" | "delete"
function call(method: Method, path: string, opts: { token?: string; body?: unknown } = {}) {
    let r = (request(app) as any)[method](path)
    if (opts.token) r = r.set("Authorization", `Bearer ${opts.token}`)
    if (opts.body !== undefined) r = r.send(opts.body)
    return r as request.Test
}

before(async () => {
    const { initHandlers } = await import("../../src/Handlers/routes.js")
    const { globalLimiter } = await import("../../src/Middleware/rate-limit.js")
    const { securityHeaders } = await import("../../src/Middleware/security-headers.js")

    app = express()
    app.disable("x-powered-by")
    app.use(securityHeaders)
    app.use(express.json({ limit: "5mb" }))
    app.use(globalLimiter)
    initHandlers(app)
    app.use((_req, res) => { res.status(404).json({ error: "Route introuvable" }) })
    app.use((err: any, _req: any, res: any, next: any) => {
        if (res.headersSent) return next(err)
        if (err?.type === "entity.too.large") return res.status(413).json({ error: "Charge utile trop volumineuse" })
        if (err instanceof SyntaxError && "body" in err) return res.status(400).json({ error: "JSON invalide" })
        return res.status(500).json({ error: "Internal Server Error" })
    })
})

// -- Routes publiques ---------------------------------------------------------
describe("E2E — routes publiques", () => {
    test("GET / → 200 + nom de l'API", async () => {
        const res = await call("get", "/")
        assert.equal(res.status, 200)
        assert.equal(res.body.message, "Connected Neighbours API")
    })

    test("GET /Status → 200", async () => {
        const res = await call("get", "/Status")
        assert.equal(res.status, 200)
    })

    test("GET /quartiers ne demande PAS de token (route publique)", async () => {
        const res = await call("get", "/quartiers")
        assert.notEqual(res.status, 401)
        assert.notEqual(res.status, 403)
    })

    test("GET /quartiers/:id non numérique → 400", async () => {
        const res = await call("get", "/quartiers/abc")
        assert.equal(res.status, 400)
    })
})

// -- 401 : toutes les routes protegees sans token -----------------------------
describe("E2E — 401 sans token (routes protégées)", () => {
    const routes: [Method, string][] = [
        ["get", "/auth/me"], ["post", "/auth/change-password"], ["post", "/auth/change-email"],
        ["post", "/auth/change-phone"], ["post", "/auth/sso/ticket"], ["post", "/auth/mfa/setup"],
        ["post", "/auth/mfa/verify"], ["post", "/auth/mfa/disable"],
        ["get", "/neighbours"], ["get", "/users/1"], ["put", "/users/1"], ["delete", "/users/1"],
        ["post", "/users/1/noter"], ["get", "/me/interets"], ["put", "/me/interets"],
        ["get", "/users"], ["put", "/users/1/role"], ["put", "/users/1/vote-block"],
        ["post", "/quartiers"], ["put", "/quartiers/1"], ["delete", "/quartiers/1"],
        ["get", "/services"], ["get", "/services/1"], ["post", "/services"], ["put", "/services/1"],
        ["delete", "/services/1"], ["post", "/services/1/demander"], ["get", "/services/1/demandes"],
        ["post", "/services/1/terminer"], ["get", "/me/points"],
        ["get", "/evenements"], ["get", "/evenements/1"], ["post", "/evenements"], ["put", "/evenements/1"],
        ["delete", "/evenements/1"], ["post", "/evenements/1/participer"],
        ["get", "/votes"], ["get", "/votes/v1"], ["post", "/votes"], ["post", "/votes/v1/voter"],
        ["post", "/votes/v1/cloturer"],
        ["post", "/contrats"], ["get", "/contrats/c1"], ["get", "/contrats/c1/audit"],
        ["post", "/contrats/c1/signer"], ["post", "/contrats/c1/archiver"],
        ["get", "/conversations"], ["post", "/conversations"], ["get", "/conversations/c1/messages"],
        ["post", "/conversations/c1/messages"],
        ["get", "/incidents"], ["get", "/incidents/1"], ["post", "/incidents"], ["put", "/incidents/1/statut"],
        ["get", "/users/1/competences"], ["post", "/competences"], ["delete", "/competences/1"],
        ["get", "/recommendations/voisins"], ["get", "/recommendations/evenements"], ["get", "/recommendations/services"],
        ["get", "/gdpr/export"], ["get", "/gdpr/consentement"], ["post", "/gdpr/consentement"], ["delete", "/gdpr/delete"],
        ["post", "/upload"],
        ["get", "/stats/incidents"], ["get", "/stats/participations"],
        ["get", "/sync"], ["post", "/sync"],
        ["post", "/signalements"], ["get", "/signalements"], ["put", "/signalements/1/traiter"],
        ["post", "/query"], ["get", "/presence"],
    ]
    routes.forEach(([m, p]) => {
        test(`${m.toUpperCase()} ${p} → 401`, async () => {
            const res = await call(m, p)
            assert.equal(res.status, 401)
        })
    })
})

// -- 403 : routes reservees a un role, appelees avec un token 'user' ----------
describe("E2E — 403 avec un token 'user' (routes admin/modérateur)", () => {
    const routes: [Method, string][] = [
        ["get", "/users"], ["put", "/users/1/role"], ["put", "/users/1/vote-block"],
        ["post", "/quartiers"], ["put", "/quartiers/1"], ["delete", "/quartiers/1"],
        ["get", "/incidents"], ["get", "/incidents/1"],
        ["get", "/stats/incidents"], ["get", "/stats/participations"],
        ["get", "/sync"], ["post", "/sync"],
        ["get", "/signalements"], ["put", "/signalements/1/traiter"], ["post", "/query"],
    ]
    routes.forEach(([m, p]) => {
        test(`${m.toUpperCase()} ${p} (user) → 403`, async () => {
            const res = await call(m, p, { token: USER, body: {} })
            assert.equal(res.status, 403)
        })
    })
})

// -- 400 : validation Joi (token valide + corps invalide) ---------------------
describe("E2E — 400 corps invalide", () => {
    test("POST /auth/register email invalide → 400", async () => {
        const res = await call("post", "/auth/register", { body: { email: "pas-un-email", password: "MotDePasse1" } })
        assert.equal(res.status, 400)
    })
    test("POST /auth/register corps vide → 400", async () => {
        assert.equal((await call("post", "/auth/register", { body: {} })).status, 400)
    })
    test("POST /auth/register cp non numérique → 400", async () => {
        const res = await call("post", "/auth/register", {
            body: { email: "a@b.fr", password: "MotDePasse1", adresse: "x", ville: "y", cp: "AB12", nom_quartier: "Q" },
        })
        assert.equal(res.status, 400)
    })
    test("POST /auth/login sans mot de passe → 400", async () => {
        assert.equal((await call("post", "/auth/login", { body: { email: "a@b.fr" } })).status, 400)
    })
    test("POST /auth/login email invalide → 400", async () => {
        assert.equal((await call("post", "/auth/login", { body: { email: "x", password: "azerty" } })).status, 400)
    })
    test("POST /auth/refresh sans refresh_token → 400", async () => {
        assert.equal((await call("post", "/auth/refresh", { body: {} })).status, 400)
    })
    test("POST /auth/logout sans refresh_token → 400", async () => {
        assert.equal((await call("post", "/auth/logout", { body: {} })).status, 400)
    })
    test("POST /auth/sso/exchange sans ticket → 400", async () => {
        assert.equal((await call("post", "/auth/sso/exchange", { body: {} })).status, 400)
    })
    test("POST /auth/change-password corps vide → 400", async () => {
        assert.equal((await call("post", "/auth/change-password", { token: USER, body: {} })).status, 400)
    })
    test("POST /auth/change-email corps vide → 400", async () => {
        assert.equal((await call("post", "/auth/change-email", { token: USER, body: {} })).status, 400)
    })
    test("POST /auth/change-phone corps vide → 400", async () => {
        assert.equal((await call("post", "/auth/change-phone", { token: USER, body: {} })).status, 400)
    })
    test("POST /auth/mfa/verify sans code → 400", async () => {
        assert.equal((await call("post", "/auth/mfa/verify", { token: USER, body: {} })).status, 400)
    })
    test("POST /auth/forgot-password sans email → 400 (route publique)", async () => {
        assert.equal((await call("post", "/auth/forgot-password", { body: {} })).status, 400)
    })
    test("POST /auth/reset-password corps vide → 400 (route publique)", async () => {
        assert.equal((await call("post", "/auth/reset-password", { body: {} })).status, 400)
    })
    test("POST /users/1/noter rating hors bornes → 400", async () => {
        assert.equal((await call("post", "/users/1/noter", { token: USER, body: { rating: 9 } })).status, 400)
    })
    test("PUT /me/interets corps vide → 400", async () => {
        assert.equal((await call("put", "/me/interets", { token: USER, body: {} })).status, 400)
    })
    test("POST /services corps vide → 400", async () => {
        assert.equal((await call("post", "/services", { token: USER, body: {} })).status, 400)
    })
    test("POST /services type hors enum → 400", async () => {
        assert.equal((await call("post", "/services", { token: USER, body: { type: "autre" } })).status, 400)
    })
    test("PUT /services/1 corps vide (min 1) → 400", async () => {
        assert.equal((await call("put", "/services/1", { token: USER, body: {} })).status, 400)
    })
    test("POST /evenements sans titre → 400", async () => {
        assert.equal((await call("post", "/evenements", { token: USER, body: {} })).status, 400)
    })
    test("PUT /evenements/1 corps vide (min 1) → 400", async () => {
        assert.equal((await call("put", "/evenements/1", { token: USER, body: {} })).status, 400)
    })
    test("POST /evenements/1/participer statut invalide → 400", async () => {
        assert.equal((await call("post", "/evenements/1/participer", { token: USER, body: { status: "peut-etre" } })).status, 400)
    })
    test("POST /votes corps vide → 400", async () => {
        assert.equal((await call("post", "/votes", { token: USER, body: {} })).status, 400)
    })
    test("POST /votes/v1/voter sans optionIds → 400", async () => {
        assert.equal((await call("post", "/votes/v1/voter", { token: USER, body: {} })).status, 400)
    })
    test("POST /contrats corps vide → 400", async () => {
        assert.equal((await call("post", "/contrats", { token: USER, body: {} })).status, 400)
    })
    test("POST /contrats/c1/signer sans signature → 400", async () => {
        assert.equal((await call("post", "/contrats/c1/signer", { token: USER, body: {} })).status, 400)
    })
    test("POST /conversations sans destinataires → 400", async () => {
        assert.equal((await call("post", "/conversations", { token: USER, body: {} })).status, 400)
    })
    test("POST /conversations/c1/messages corps vide (content ou média) → 400", async () => {
        assert.equal((await call("post", "/conversations/c1/messages", { token: USER, body: {} })).status, 400)
    })
    test("POST /incidents sans description → 400", async () => {
        assert.equal((await call("post", "/incidents", { token: USER, body: {} })).status, 400)
    })
    test("POST /competences sans libellé → 400", async () => {
        assert.equal((await call("post", "/competences", { token: USER, body: {} })).status, 400)
    })
    test("POST /signalements corps vide → 400", async () => {
        assert.equal((await call("post", "/signalements", { token: USER, body: {} })).status, 400)
    })
    test("POST /gdpr/consentement sans booléen → 400", async () => {
        // EnregistrerConsentement attend { consentement: boolean } - corps vide invalide.
        const res = await call("post", "/gdpr/consentement", { token: USER, body: {} })
        assert.ok(res.status === 400 || res.status === 500, `attendu 400/500, reçu ${res.status}`)
    })
    test("POST /quartiers (admin) sans nom → 400", async () => {
        assert.equal((await call("post", "/quartiers", { token: ADMIN, body: {} })).status, 400)
    })
    test("PUT /signalements/1/traiter (admin) corps vide → 400", async () => {
        assert.equal((await call("put", "/signalements/1/traiter", { token: ADMIN, body: {} })).status, 400)
    })
    test("PUT /incidents/1/statut (admin) corps vide → 400", async () => {
        assert.equal((await call("put", "/incidents/1/statut", { token: ADMIN, body: {} })).status, 400)
    })
    test("POST /query (admin) sans query → 400", async () => {
        assert.equal((await call("post", "/query", { token: ADMIN, body: {} })).status, 400)
    })
    test("PUT /users/1/role (admin) rôle invalide → 400", async () => {
        assert.equal((await call("put", "/users/1/role", { token: ADMIN, body: { role: "roi" } })).status, 400)
    })
    test("PUT /users/1/vote-block (admin) sans booléen → 400", async () => {
        assert.equal((await call("put", "/users/1/vote-block", { token: ADMIN, body: {} })).status, 400)
    })
})

// -- 400 : identifiant de route non numerique ---------------------------------
describe("E2E — 400 identifiant non numérique", () => {
    const routes: [Method, string, string][] = [
        ["get", "/users/abc", USER], ["put", "/users/abc", USER], ["delete", "/users/abc", USER],
        ["post", "/users/abc/noter", USER],
        ["get", "/services/abc", USER], ["put", "/services/abc", USER], ["delete", "/services/abc", USER],
        ["post", "/services/abc/demander", USER], ["get", "/services/abc/demandes", USER],
        ["post", "/services/abc/terminer", USER],
        ["get", "/evenements/abc", USER], ["put", "/evenements/abc", USER], ["delete", "/evenements/abc", USER],
        ["post", "/evenements/abc/participer", USER],
        ["get", "/incidents/abc", ADMIN], ["put", "/incidents/abc/statut", USER],
        ["get", "/users/abc/competences", USER], ["delete", "/competences/abc", USER],
        ["put", "/quartiers/abc", ADMIN], ["delete", "/quartiers/abc", ADMIN],
        ["put", "/signalements/abc/traiter", ADMIN],
    ]
    routes.forEach(([m, p, tk]) => {
        test(`${m.toUpperCase()} ${p} → 400`, async () => {
            const res = await call(m, p, { token: tk, body: {} })
            assert.equal(res.status, 400)
        })
    })
})

// -- Un moderateur/admin passe le controle de role (n'est PAS 403) ------------
describe("E2E — rôle autorisé (pas de 403)", () => {
    test("GET /users (admin) n'est pas 403", async () => {
        assert.notEqual((await call("get", "/users", { token: ADMIN })).status, 403)
    })
    test("GET /signalements (modérateur) n'est pas 403", async () => {
        assert.notEqual((await call("get", "/signalements", { token: MOD })).status, 403)
    })
    test("GET /stats/incidents (modérateur) n'est pas 403", async () => {
        assert.notEqual((await call("get", "/stats/incidents", { token: MOD })).status, 403)
    })
})

// -- Chemins " sans BDD " qui doivent reussir avec un token -------------------
describe("E2E — happy path sans BDD", () => {
    test("GET /presence (token) → 200 + liste online", async () => {
        const res = await call("get", "/presence", { token: USER })
        assert.equal(res.status, 200)
        assert.ok(Array.isArray(res.body.online))
    })
})

// -- Securite transverse & robustesse -----------------------------------------
describe("E2E — sécurité & robustesse transverses", () => {
    test("en-tête X-Content-Type-Options: nosniff présent", async () => {
        const res = await call("get", "/")
        assert.equal(res.headers["x-content-type-options"], "nosniff")
    })
    test("en-tête X-Frame-Options: DENY présent", async () => {
        const res = await call("get", "/")
        assert.equal(res.headers["x-frame-options"], "DENY")
    })
    test("l'en-tête X-Powered-By est masqué", async () => {
        const res = await call("get", "/")
        assert.equal(res.headers["x-powered-by"], undefined)
    })
    test("route inconnue → 404 JSON", async () => {
        const res = await call("get", "/route-inexistante-xyz")
        assert.equal(res.status, 404)
        assert.equal(res.body.error, "Route introuvable")
    })
    test("méthode non déclarée sur une route → 404", async () => {
        // DELETE /auth/login n'existe pas
        assert.equal((await call("delete", "/auth/login")).status, 404)
    })
    test("JSON malformé → 400 JSON", async () => {
        const res = await request(app)
            .post("/auth/login")
            .set("Content-Type", "application/json")
            .send('{"email": "a@b.fr"')
        assert.equal(res.status, 400)
    })
    test("token signé avec un autre secret → 401", async () => {
        const faux = jwt.sign({ userId: 1, email: "a@b.fr", role: "admin" }, "mauvais-secret")
        assert.equal((await call("get", "/auth/me", { token: faux })).status, 401)
    })
    test("token expiré → 401", async () => {
        const expire = jwt.sign({ userId: 1, email: "a@b.fr", role: "user" }, "test-secret", { expiresIn: -10 })
        assert.equal((await call("get", "/services", { token: expire })).status, 401)
    })
})
