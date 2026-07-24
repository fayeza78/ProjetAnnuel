// -----------------------------------------------------------------------------
// E2E full-stack "A -> Z" : execute l'application COMPLETE contre les VRAIES
// bases Docker (PostgreSQL + MongoDB + Neo4j de docker-compose).
//
// Ce que cette suite prouve, dans l'ordre du parcours utilisateur :
//   inscription -> login -> quartiers (limites geo + chevauchement 409) -> interets
//    -> offre de service -> recommandations Neo4j -> demande + CONTRAT AUTOMATIQUE
//    -> activation MFA (TOTP reel) -> signature (sans code) -> archivage -> transfert de POINTS
//    -> notation d'un voisin -> evenement (participer/commenter/photo/tag)
//    -> votes (1 seul vote, cloture, blocage moderation) -> messagerie (acces)
//    -> incidents + SYNC offline-first (pull/push/conflits) + stats
//    -> i18n (fr/en) -> SSO (ticket usage unique) -> mot de passe oublie -> RGPD
//    -> langage de requete maison.
//
// ISOLATION (ne casse PAS les donnees de demo) :
//    PostgreSQL : base dediee `connected_neighbours_e2e` (creee si absente).
//    MongoDB : base dediee `Neighbours_e2e`.
//    Neo4j : PAS de multi-base en edition community -> on isole par PLAGE
//     D'IDS : les sequences PG du schema e2e demarrent a 900000, et le nettoyage
//     supprime uniquement les noeuds postgres_id >= 900000 et les tags `e2e*`.
//
// Si les bases Docker sont injoignables, la suite se marque SKIPPED (elle ne
// fait pas echouer `npm test` sur une machine sans Docker).
//
// Lancement (VPS) : docker compose up -d puis npm test
// -----------------------------------------------------------------------------

// AVANT tout import de src/ : on aiguille vers les bases de test.
process.env.POSTGRES_DB = "connected_neighbours_e2e"
process.env.MONGO_DB = "Neighbours_e2e"
process.env.MFA_ENFORCE = "true"       // MFA obligatoire (defaut prod) - actions sensibles du compte
process.env.EXPOSE_RESET_TOKEN = "true" // la suite lit reset_token dans la reponse (pas de serveur mail)
process.env.RL_GLOBAL = "1000000"      // rate-limits releves pour la suite
process.env.RL_AUTH = "1000000"
process.env.RL_SENSITIVE = "1000000"
process.env.RL_WRITE = "1000000"
process.env.RL_UPLOAD = "1000000"
process.env.RL_QUERY = "1000000"

import { test, describe, before, after } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import express, { type Express } from "express"
import request from "supertest"
// @ts-expect-error - `pg` (dependance de prod) n'embarque pas ses declarations TS
// et @types/pg n'est pas installe ; on ne l'utilise que pour CREATE DATABASE.
import pg from "pg"
import { authenticator } from "otplib"

// Seuil d'isolation Neo4j : tout postgres_id e2e est >= a cette valeur.
const ID_BASE = 900000
const PWD = "MotDePasseE2E1!"

let dbOk = false
let raison = "non initialisé"
let app: Express

// Sources de donnees (importees dynamiquement APRES le reglage des env)
let AppDataSource_PostgreSQL: any
let AppDataSource_MongoDB: any
let AppDataSource_Neo4j: any

// Etat partage du parcours (les tests s'executent dans l'ordre du fichier)
const admin = { email: "e2e.admin@test.fr", id: 0, token: "" }
const alice = { email: "e2e.alice@test.fr", id: 0, token: "", mfaSecret: "" }
const bob = { email: "e2e.bob@test.fr", id: 0, token: "" }
const charlie = { email: "e2e.charlie@test.fr", id: 0, token: "" }
let quartierId = 0
let serviceId = 0
let contratId = ""
let evenementId = 0
let voteId = ""
let vote2Id = ""
let convId = ""
let incidentId = 0
let resetToken = ""

// Polygones GeoJSON pour les tests de limites (coordonnees volontairement
// exotiques : aucun risque de chevaucher un quartier reel).
const poly = (x0: number, y0: number, x1: number, y1: number) => JSON.stringify({
    type: "Polygon",
    coordinates: [[[x0, y0], [x0, y1], [x1, y1], [x1, y0], [x0, y0]]]
})

const api = () => request(app)
const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

async function login(email: string, password: string, code?: string) {
    return api().post("/auth/login").send({ email, password, ...(code ? { code } : {}) })
}

// Inscrit + connecte un utilisateur, renvoie { id, token }.
async function registerAndLogin(email: string, nom_quartier: string) {
    const reg = await api().post("/auth/register").send({
        email, password: PWD, adresse: "1 rue E2E", ville: "Paris", cp: "75000", nom_quartier
    })
    assert.equal(reg.status, 201, `register ${email}: ${JSON.stringify(reg.body)}`)
    const log = await login(email, PWD)
    assert.equal(log.status, 200, `login ${email}: ${JSON.stringify(log.body)}`)
    return { id: reg.body.id_user as number, token: log.body.access_token as string }
}

before(async () => {
    try {
        // 1) La base PostgreSQL e2e doit exister (CREATE DATABASE ne peut pas etre
        //    fait par TypeORM) - on passe par le driver pg sur la base d'admin.
        const client = new pg.Client({
            host: process.env.POSTGRES_HOST || "localhost",
            port: 5432,
            user: process.env.POSTGRES_USER || "admin",
            password: process.env.POSTGRES_PASSWORD || "admin",
            database: "postgres"
        })
        await client.connect()
        try {
            await client.query(`CREATE DATABASE ${process.env.POSTGRES_DB}`)
        } catch (e: any) {
            if (e?.code !== "42P04") throw e // 42P04 = existe deja -> OK
        } finally {
            await client.end()
        }

        // 2) Import des sources APRES les env -> elles pointent sur les bases e2e.
        const db = await import("../../src/Database/database.js")
        AppDataSource_PostgreSQL = db.AppDataSource_PostgreSQL
        AppDataSource_MongoDB = db.AppDataSource_MongoDB
        AppDataSource_Neo4j = db.AppDataSource_Neo4j

        await AppDataSource_PostgreSQL.initialize()   // synchronize cree le schema e2e
        await AppDataSource_MongoDB.initialize()
        await AppDataSource_Neo4j.initialize()

        // 3) Nettoyage pour une execution idempotente.
        await AppDataSource_PostgreSQL.query(
            `TRUNCATE TABLE token, effectue_demande, "Asso_5", competence,
             incident, evenement, contrat, point_transaction, signalement, "user", service, quartier
             RESTART IDENTITY CASCADE`
        )
        // Vidage MongoDB (meme pattern que le seed : deleteMany par entite).
        const [inh, ngh, evt, msg, vot, ctr, svc, cnv] = await Promise.all([
            import("../../src/Database/Entites_MongoDB/inhabitants_MONGO.js"),
            import("../../src/Database/Entites_MongoDB/neighborhood_MONGO.js"),
            import("../../src/Database/Entites_MongoDB/event_MONGO.js"),
            import("../../src/Database/Entites_MongoDB/message_MONGO.js"),
            import("../../src/Database/Entites_MongoDB/vote_MONGO.js"),
            import("../../src/Database/Entites_MongoDB/contrat_MONGO.js"),
            import("../../src/Database/Entites_MongoDB/service_MONGO.js"),
            import("../../src/Database/Entites_MongoDB/conversation_MONGO.js"),
        ])
        const mongoEntites = [
            inh.InhabitantMongo, ngh.NeighborhoodMongo, evt.EventMongo, msg.MessageMongo,
            vot.VoteMongo, ctr.ContratMongo, svc.ServiceMongo, cnv.ConversationMongo
        ]
        for (const E of mongoEntites) {
            await AppDataSource_MongoDB.getMongoRepository(E).deleteMany({})
        }

        // 4) Isolation Neo4j : sequences PG >= 900000 (les postgres_id e2e ne peuvent
        //    pas entrer en collision avec ceux de la base de demo), puis purge des
        //    restes d'une execution precedente.
        const sequences = [
            "user_id_user_seq", "quartier_id_quartier_seq", "service_id_service_seq",
            "evenement_id_evenement_seq", "incident_id_incident_seq"
        ]
        for (const s of sequences) {
            await AppDataSource_PostgreSQL.query(`ALTER SEQUENCE IF EXISTS ${s} RESTART WITH ${ID_BASE + 1}`)
        }
        const session = AppDataSource_Neo4j.session()
        try {
            await session.run(
                `MATCH (n) WHERE n.postgres_id IS NOT NULL AND toInteger(n.postgres_id) >= $base DETACH DELETE n`,
                { base: ID_BASE }
            )
            await session.run(`MATCH (t:Tag) WHERE t.name STARTS WITH 'e2e' DETACH DELETE t`)
        } finally {
            await session.close()
        }

        // 5) L'application, montee EXACTEMENT comme en production (index.ts).
        const { initHandlers } = await import("../../src/Handlers/routes.js")
        const { globalLimiter } = await import("../../src/Middleware/rate-limit.js")
        const { securityHeaders } = await import("../../src/Middleware/security-headers.js")
        const { repondreErreur } = await import("../../src/I18n/i18n.js")

        app = express()
        app.disable("x-powered-by")
        app.use(securityHeaders)
        app.use(express.json({ limit: "5mb" }))
        app.use(globalLimiter)
        initHandlers(app)
        app.use((req: any, res: any) => repondreErreur(req, res, 404, "NOT_FOUND_ROUTE"))
        app.use((err: any, req: any, res: any, next: any) => {
            if (res.headersSent) return next(err)
            if (err?.type === "entity.too.large") return repondreErreur(req, res, 413, "PAYLOAD_TOO_LARGE")
            if (err instanceof SyntaxError && "body" in err) return repondreErreur(req, res, 400, "INVALID_JSON")
            if (err?.message === "TYPE_FICHIER_NON_AUTORISE") return repondreErreur(req, res, 415, "FILE_TYPE_NOT_ALLOWED")
            console.error(err)
            return repondreErreur(req, res, 500, "INTERNAL_ERROR")
        })

        dbOk = true
    } catch (e: any) {
        raison = `Bases Docker injoignables (${e?.message ?? e}) — suite E2E full-stack ignorée`
        console.warn("⚠️ ", raison)
    }
})

after(async () => {
    if (!dbOk) return
    // Nettoyage Neo4j (base partagee) : uniquement la plage e2e + tags e2e*.
    try {
        const session = AppDataSource_Neo4j.session()
        try {
            await session.run(
                `MATCH (n) WHERE n.postgres_id IS NOT NULL AND toInteger(n.postgres_id) >= $base DETACH DELETE n`,
                { base: ID_BASE }
            )
            await session.run(`MATCH (t:Tag) WHERE t.name STARTS WITH 'e2e' DETACH DELETE t`)
        } finally {
            await session.close()
        }
    } catch { /* best effort */ }
    try { await AppDataSource_PostgreSQL.destroy() } catch { /* déjà fermé */ }
    try { await AppDataSource_MongoDB.destroy() } catch { /* déjà fermé */ }
    try { await AppDataSource_Neo4j.getDriver().close() } catch { /* déjà fermé */ }
})

// Chaque test se saute proprement si Docker est eteint.
const quand = (nom: string, fn: (t: any) => Promise<void>) =>
    test(nom, async (t) => {
        if (!dbOk) return t.skip(raison)
        await fn(t)
    })

// -----------------------------------------------------------------------------
describe("E2E A→Z — santé & comptes", () => {
    quand("GET / répond (app démarrée sur les 3 bases)", async () => {
        const res = await api().get("/")
        assert.equal(res.status, 200)
        assert.equal(res.body.message, "Connected Neighbours API")
    })

    quand("inscription admin + promotion (SQL direct) + re-login = token admin", async () => {
        const a = await registerAndLogin(admin.email, "E2E-Base")
        admin.id = a.id
        assert.ok(admin.id >= ID_BASE, `id_user attendu ≥ ${ID_BASE} (isolation Neo4j), reçu ${admin.id}`)
        await AppDataSource_PostgreSQL.query(`UPDATE "user" SET role = 'admin' WHERE id_user = $1`, [admin.id])
        const log = await login(admin.email, PWD)
        assert.equal(log.status, 200)
        assert.equal(log.body.user.role, "admin")
        admin.token = log.body.access_token
    })
})

describe("E2E A→Z — quartiers : limites géographiques (sujet)", () => {
    quand("l'admin crée un quartier avec un polygone GeoJSON → 201", async () => {
        const res = await api().post("/quartiers").set(auth(admin.token))
            .send({ nom_quartier: "E2E-Quartier", limite_geo: poly(100, 0, 100.1, 0.1) })
        assert.equal(res.status, 201, JSON.stringify(res.body))
        quartierId = res.body.id_quartier
    })

    quand("un polygone qui CHEVAUCHE un quartier existant → 409", async () => {
        const res = await api().post("/quartiers").set(auth(admin.token))
            .send({ nom_quartier: "E2E-Chevauche", limite_geo: poly(100.05, 0.05, 100.15, 0.15) })
        assert.equal(res.status, 409)
        assert.match(res.body.error, /chevauche/i)
    })

    quand("un polygone disjoint → 201 (pas de faux positif)", async () => {
        const res = await api().post("/quartiers").set(auth(admin.token))
            .send({ nom_quartier: "E2E-Loin", limite_geo: poly(120, 20, 120.1, 20.1) })
        assert.equal(res.status, 201)
    })

    quand("inscription d'alice/bob/charlie dans E2E-Quartier (→ HABITE_DANS Neo4j)", async () => {
        const a = await registerAndLogin(alice.email, "E2E-Quartier"); alice.id = a.id; alice.token = a.token
        const b = await registerAndLogin(bob.email, "E2E-Quartier"); bob.id = b.id; bob.token = b.token
        const c = await registerAndLogin(charlie.email, "E2E-Quartier"); charlie.id = c.id; charlie.token = c.token
        assert.ok(alice.id > 0 && bob.id > 0 && charlie.id > 0)
    })
})

describe("E2E A→Z — intérêts, service, recommandations (Neo4j vivant)", () => {
    quand("alice déclare ses centres d'intérêt (Mongo + INTERESSE_PAR)", async () => {
        const res = await api().put("/me/interets").set(auth(alice.token))
            .send({ interests: ["e2e-jardinage", "e2e-cuisine"] })
        assert.equal(res.status, 200, JSON.stringify(res.body))
        const relu = await api().get("/me/interets").set(auth(alice.token))
        assert.deepEqual(relu.body.interests, ["e2e-jardinage", "e2e-cuisine"])
    })

    quand("bob publie une OFFRE payante (2 points) taguée e2e-jardinage", async () => {
        const res = await api().post("/services").set(auth(bob.token))
            .send({ type: "offre", categorie: "e2e-jardinage", prix: 2 })
        assert.equal(res.status, 201, JSON.stringify(res.body))
        serviceId = res.body.id_service
    })

    quand("RECOMMANDATION : le service de bob est recommandé à alice (tag ∩ intérêt)", async () => {
        const res = await api().get("/recommendations/services").set(auth(alice.token))
        assert.equal(res.status, 200)
        assert.ok(
            (res.body.services as string[]).includes(serviceId.toString()),
            `le service ${serviceId} devrait être recommandé — reçu : ${JSON.stringify(res.body.services)}`
        )
    })

    quand("RECOMMANDATION : bob apparaît dans les voisins d'alice (même quartier)", async () => {
        const res = await api().get("/recommendations/voisins").set(auth(alice.token))
        assert.equal(res.status, 200)
        assert.ok((res.body.voisins as string[]).includes(bob.id.toString()))
    })
})

describe("E2E A→Z — contrat automatique, signature, points", () => {
    quand("alice demande le service payant → contrat créé AUTOMATIQUEMENT", async () => {
        const res = await api().post(`/services/${serviceId}/demander`).set(auth(alice.token)).send({})
        assert.equal(res.status, 201, JSON.stringify(res.body))
        assert.ok(res.body.contrat?.id_contrat, "le contrat obligatoire doit être joint à la réponse")
        contratId = res.body.contrat.id_contrat
    })

    quand("le PDF du contrat a été GÉNÉRÉ par l'API (gabarit HTML + PDF maison)", async () => {
        // Le contrat auto reference un PDF genere, stocke dans uploads/contrats/.
        const res = await api().get(`/contrats/${contratId}`).set(auth(alice.token))
        assert.equal(res.status, 200)
        assert.equal(res.body.pdfUrl, `/uploads/contrats/contrat-${contratId}.pdf`)
        // Le fichier existe reellement sur disque et est un vrai PDF.
        const pdf = readFileSync(`uploads/contrats/contrat-${contratId}.pdf`)
        assert.equal(pdf.subarray(0, 5).toString(), "%PDF-", "fichier PDF valide attendu")
        // Le HTML rempli (gabarit a balises) est stocke a cote.
        const html = readFileSync(`uploads/contrats/contrat-${contratId}.html`, "utf-8")
        assert.equal(/\{\{[A-Z_]+\}\}/.test(html), false, "toutes les balises doivent être remplies")
        // L'empreinte SHA-256 du PDF original est tracee dans l'audit des la creation.
        assert.ok(String(res.body.auditTrail?.[0]?.details).includes("PDF SHA-256 :"),
            "l'audit de création doit contenir l'empreinte du PDF généré")
    })

    quand("un tiers (charlie) ne peut PAS lire le contrat → 403", async () => {
        const res = await api().get(`/contrats/${contratId}`).set(auth(charlie.token))
        assert.equal(res.status, 403)
    })

    // La MFA reste couverte en e2e (setup + verify avec un vrai TOTP), mais elle
    // n'est plus liee a la signature : elle protege le compte (login, mdp/e-mail/tel).
    quand("alice active la MFA (setup + verify TOTP réel)", async () => {
        const setup = await api().post("/auth/mfa/setup").set(auth(alice.token)).send({})
        assert.equal(setup.status, 200)
        alice.mfaSecret = setup.body.secret
        const verify = await api().post("/auth/mfa/verify").set(auth(alice.token))
            .send({ code: authenticator.generate(alice.mfaSecret) })
        assert.equal(verify.status, 200, JSON.stringify(verify.body))
    })

    quand("alice signe SANS code TOTP (même MFA activée) → 200 partially_signed", async () => {
        const res = await api().post(`/contrats/${contratId}/signer`).set(auth(alice.token))
            .send({ signatureImage: "data:image/png;base64,AAA" })
        assert.equal(res.status, 200, JSON.stringify(res.body))
        assert.equal(res.body.contrat.status, "partially_signed")
    })

    quand("alice ne peut pas signer DEUX fois → 409", async () => {
        const res = await api().post(`/contrats/${contratId}/signer`).set(auth(alice.token))
            .send({ signatureImage: "data:image/png;base64,AAA" })
        assert.equal(res.status, 409)
    })

    quand("bob (sans MFA) signe → contrat SIGNED + audit trail complet", async () => {
        const res = await api().post(`/contrats/${contratId}/signer`).set(auth(bob.token))
            .send({ signatureImage: "data:image/png;base64,BBB" })
        assert.equal(res.status, 200, JSON.stringify(res.body))
        assert.equal(res.body.contrat.status, "signed")
        assert.ok(res.body.contrat.auditTrail.length >= 3, "created + 2 signatures attendues dans l'audit")
        assert.ok(res.body.contrat.signatures.every((s: any) => s.checksum?.length === 64), "checksum SHA-256 attendu")
    })

    quand("archivage du contrat signé → 200 archived", async () => {
        const res = await api().post(`/contrats/${contratId}/archiver`).set(auth(bob.token)).send({})
        assert.equal(res.status, 200)
        assert.equal(res.body.contrat.status, "archived")
    })

    quand("un tiers ne peut pas TERMINER le service → 403", async () => {
        const res = await api().post(`/services/${serviceId}/terminer`).set(auth(charlie.token))
            .send({ id_demandeur: alice.id })
        assert.equal(res.status, 403)
    })

    quand("bob termine le service → transfert de POINTS (alice 998 / bob 1002)", async () => {
        const res = await api().post(`/services/${serviceId}/terminer`).set(auth(bob.token))
            .send({ id_demandeur: alice.id })
        assert.equal(res.status, 200, JSON.stringify(res.body))
        assert.equal(res.body.transaction.montant, 2)

        const pAlice = await api().get("/me/points").set(auth(alice.token))
        const pBob = await api().get("/me/points").set(auth(bob.token))
        assert.equal(pAlice.body.points, 998)
        assert.equal(pBob.body.points, 1002)
    })

    quand("alice note bob 5/5 (A_NOTE) ; l'auto-notation est refusée", async () => {
        const ok = await api().post(`/users/${bob.id}/noter`).set(auth(alice.token)).send({ rating: 5 })
        assert.equal(ok.status, 200)
        const self = await api().post(`/users/${alice.id}/noter`).set(auth(alice.token)).send({ rating: 5 })
        assert.equal(self.status, 400)
        assert.equal(self.body.code, "SELF_RATING")
    })
})

describe("E2E A→Z — événements (swipe, commentaires, photos, tags)", () => {
    quand("alice crée un événement typé e2e-atelier", async () => {
        const res = await api().post("/evenements").set(auth(alice.token))
            .send({ titre: "E2E Atelier", type: "e2e-atelier" })
        assert.equal(res.status, 201)
        evenementId = res.body.id_evenement
    })

    quand("bob participe (swipe confirmed) → visible dans le détail Mongo", async () => {
        const p = await api().post(`/evenements/${evenementId}/participer`).set(auth(bob.token))
            .send({ status: "confirmed" })
        assert.equal(p.status, 200)
        const detail = await api().get(`/evenements/${evenementId}`).set(auth(alice.token))
        assert.ok(detail.body.detail.participants.some((x: any) => x.inhabitant_postgres_id === bob.id.toString()))
    })

    quand("charlie commente ; alice ajoute une photo ; bob (non créateur) refusé pour la photo", async () => {
        const com = await api().post(`/evenements/${evenementId}/commentaires`).set(auth(charlie.token))
            .send({ content: "Super initiative E2E !" })
        assert.equal(com.status, 201)

        const photoRefusee = await api().post(`/evenements/${evenementId}/photos`).set(auth(bob.token))
            .send({ url: "/uploads/e2e.jpg" })
        assert.equal(photoRefusee.status, 403)

        const photo = await api().post(`/evenements/${evenementId}/photos`).set(auth(alice.token))
            .send({ url: "/uploads/e2e.jpg" })
        assert.equal(photo.status, 201)

        const tag = await api().post(`/evenements/${evenementId}/tags`).set(auth(alice.token))
            .send({ tag: "e2e-tagx" })
        assert.equal(tag.status, 201)

        const detail = await api().get(`/evenements/${evenementId}`).set(auth(alice.token))
        assert.ok(detail.body.detail.comments.some((c: any) => c.content.includes("E2E")))
        assert.ok(detail.body.detail.photos.includes("/uploads/e2e.jpg"))
        assert.ok(detail.body.detail.tags.includes("e2e-tagx"))
    })

    quand("RECOMMANDATION : l'événement remonte pour charlie (intérêt e2e-atelier)", async () => {
        await api().put("/me/interets").set(auth(charlie.token)).send({ interests: ["e2e-atelier"] })
        const res = await api().get("/recommendations/evenements").set(auth(charlie.token))
        assert.equal(res.status, 200)
        assert.ok(
            (res.body.evenements as string[]).includes(evenementId.toString()),
            `événement ${evenementId} attendu — reçu ${JSON.stringify(res.body.evenements)}`
        )
    })
})

describe("E2E A→Z — retrait d'une demande de service", () => {
    let svcGratuit = 0

    quand("bob publie un service gratuit ; charlie le demande", async () => {
        const s = await api().post("/services").set(auth(bob.token))
            .send({ type: "offre", categorie: "e2e-aide", prix: 0 })
        assert.equal(s.status, 201)
        svcGratuit = s.body.id_service
        const d = await api().post(`/services/${svcGratuit}/demander`).set(auth(charlie.token)).send({})
        assert.equal(d.status, 201)
    })

    quand("charlie retire SA demande → 200 ; la re-retirer → 404 (plus rien)", async () => {
        const del1 = await api().delete(`/services/${svcGratuit}/demander`).set(auth(charlie.token))
        assert.equal(del1.status, 200)
        const del2 = await api().delete(`/services/${svcGratuit}/demander`).set(auth(charlie.token))
        assert.equal(del2.status, 404)
    })

    quand("après retrait, charlie peut RE-demander (hard delete, pas de collision de PK)", async () => {
        const again = await api().post(`/services/${svcGratuit}/demander`).set(auth(charlie.token)).send({})
        assert.equal(again.status, 201, JSON.stringify(again.body))
    })
})

describe("E2E A→Z — votes (1 seul vote, clôture, modération)", () => {
    let optionA = ""

    quand("alice crée un vote single (deadline future)", async () => {
        const res = await api().post("/votes").set(auth(alice.token)).send({
            question: "E2E : valider la démo ?", type: "single", options: ["Oui", "Non"],
            deadline: new Date(Date.now() + 3_600_000).toISOString()
        })
        assert.equal(res.status, 201, JSON.stringify(res.body))
        voteId = res.body.postgres_id
        optionA = res.body.options[0].id
    })

    quand("bob vote ; re-voter → 409 VOTE_ALREADY_CAST ; option fantôme → 400", async () => {
        assert.equal((await api().post(`/votes/${voteId}/voter`).set(auth(bob.token)).send({ optionIds: [optionA] })).status, 200)
        const deux = await api().post(`/votes/${voteId}/voter`).set(auth(bob.token)).send({ optionIds: [optionA] })
        assert.equal(deux.status, 409)
        assert.equal(deux.body.code, "VOTE_ALREADY_CAST")
        const fantome = await api().post(`/votes/${voteId}/voter`).set(auth(charlie.token)).send({ optionIds: ["option-inexistante"] })
        assert.equal(fantome.status, 400)
        assert.equal(fantome.body.code, "VOTE_OPTION_INVALID")
    })

    quand("clôture par la créatrice → voter ensuite → 409 VOTE_CLOSED", async () => {
        assert.equal((await api().post(`/votes/${voteId}/cloturer`).set(auth(alice.token)).send({})).status, 200)
        const tard = await api().post(`/votes/${voteId}/voter`).set(auth(charlie.token)).send({ optionIds: [optionA] })
        assert.equal(tard.status, 409)
        assert.equal(tard.body.code, "VOTE_CLOSED")
    })

    quand("modération : charlie bloqué pour les votes → 403 VOTE_BLOCKED, puis débloqué", async () => {
        const v2 = await api().post("/votes").set(auth(alice.token))
            .send({ question: "E2E vote 2 ?", type: "yesno", options: ["Oui", "Non"] })
        vote2Id = v2.body.postgres_id
        const opt = v2.body.options[0].id

        assert.equal((await api().put(`/users/${charlie.id}/vote-block`).set(auth(admin.token)).send({ blocked: true })).status, 200)
        const bloque = await api().post(`/votes/${vote2Id}/voter`).set(auth(charlie.token)).send({ optionIds: [opt] })
        assert.equal(bloque.status, 403)
        assert.equal(bloque.body.code, "VOTE_BLOCKED")

        await api().put(`/users/${charlie.id}/vote-block`).set(auth(admin.token)).send({ blocked: false })
        assert.equal((await api().post(`/votes/${vote2Id}/voter`).set(auth(charlie.token)).send({ optionIds: [opt] })).status, 200)
    })
})

describe("E2E A→Z — messagerie sécurisée", () => {
    quand("alice ouvre une conversation avec bob et envoie un message", async () => {
        const conv = await api().post("/conversations").set(auth(alice.token))
            .send({ recipient_postgres_ids: [bob.id.toString()] })
        assert.equal(conv.status, 201)
        convId = conv.body.postgres_id

        const msg = await api().post(`/conversations/${convId}/messages`).set(auth(alice.token))
            .send({ content: "Salut bob — test E2E" })
        assert.equal(msg.status, 201)
    })

    quand("bob lit la conversation ; charlie (non membre) → 403", async () => {
        const lecture = await api().get(`/conversations/${convId}/messages`).set(auth(bob.token))
        assert.equal(lecture.status, 200)
        assert.ok(lecture.body.some((m: any) => m.content.includes("test E2E")))

        const intrus = await api().get(`/conversations/${convId}/messages`).set(auth(charlie.token))
        assert.equal(intrus.status, 403)

        const liste = await api().get("/conversations").set(auth(alice.token))
        assert.ok(liste.body.length >= 1 && liste.body[0].lastMessage)
    })
})

describe("E2E A→Z — incidents + SYNC offline-first + stats (client Java)", () => {
    quand("charlie signale un incident ; un habitant ne peut PAS lister (admin/mod only)", async () => {
        const res = await api().post("/incidents").set(auth(charlie.token))
            .send({ description: "E2E : lampadaire cassé", type: "incident", gravite: "haute" })
        assert.equal(res.status, 201)
        incidentId = res.body.id_incident
        assert.equal((await api().get("/incidents").set(auth(charlie.token))).status, 403)
    })

    quand("SYNC pull : l'admin récupère le delta (incident + serverTime)", async () => {
        const res = await api().get("/sync").set(auth(admin.token))
        assert.equal(res.status, 200)
        assert.ok(typeof res.body.serverTime === "string")
        assert.ok(res.body.incidents.some((i: any) => i.id_incident === incidentId))
    })

    quand("SYNC push : création offline → created ; MàJ plus récente → updated", async () => {
        const res = await api().post("/sync").set(auth(admin.token)).send({
            incidents: [
                { description: "E2E : créé hors-ligne", statut: "ouvert", type: "alerte", gravite: "moyenne" },
                { id_incident: incidentId, description: "E2E : lampadaire cassé", statut: "resolu",
                  updatedAt: new Date(Date.now() + 60_000).toISOString() }
            ]
        })
        assert.equal(res.status, 200, JSON.stringify(res.body))
        const statuses = res.body.results.map((r: any) => r.status)
        assert.deepEqual(statuses, ["created", "updated"])
    })

    quand("SYNC conflit : une version PLUS ANCIENNE est rejetée (kept_server)", async () => {
        const res = await api().post("/sync").set(auth(admin.token)).send({
            incidents: [{ id_incident: incidentId, description: "version périmée", statut: "ouvert",
                          updatedAt: "2000-01-01T00:00:00Z" }]
        })
        assert.equal(res.body.results[0].status, "kept_server")
        // La version serveur (resolu) a bien survecu au conflit :
        const relu = await api().get(`/incidents/${incidentId}`).set(auth(admin.token))
        assert.equal(relu.body.statut, "resolu")
    })

    quand("stats incidents/participations (client Java) → agrégats cohérents", async () => {
        const inc = await api().get("/stats/incidents").set(auth(admin.token))
        assert.equal(inc.status, 200)
        assert.ok(inc.body.total >= 2)
        const part = await api().get("/stats/participations").set(auth(admin.token))
        assert.equal(part.status, 200)
    })
})

describe("E2E A→Z — i18n, SSO, mot de passe oublié, RGPD, query", () => {
    quand("i18n : même code d'erreur, message traduit selon Accept-Language", async () => {
        const fr = await api().get("/services")
        assert.equal(fr.status, 401)
        assert.equal(fr.body.code, "AUTH_TOKEN_REQUIRED")
        assert.equal(fr.body.error, "Token d'accès requis")

        const en = await api().get("/services").set({ "Accept-Language": "en" })
        assert.equal(en.body.code, "AUTH_TOKEN_REQUIRED")
        assert.equal(en.body.error, "Access token required")

        const notFound = await api().get("/route-inconnue").set({ "Accept-Language": "en" })
        assert.equal(notFound.status, 404)
        assert.equal(notFound.body.error, "Route not found")
    })

    quand("SSO : ticket à usage unique — 1er échange OK, rejeu → 401", async () => {
        const t1 = await api().post("/auth/sso/ticket").set(auth(alice.token)).send({})
        assert.equal(t1.status, 200)
        const ech1 = await api().post("/auth/sso/exchange").send({ sso_ticket: t1.body.sso_ticket })
        assert.equal(ech1.status, 200)
        assert.ok(ech1.body.access_token)
        const rejeu = await api().post("/auth/sso/exchange").send({ sso_ticket: t1.body.sso_ticket })
        assert.equal(rejeu.status, 401)
    })

    quand("mot de passe oublié : ticket 15 min, usage unique, sessions révoquées", async () => {
        const forgot = await api().post("/auth/forgot-password").send({ email: charlie.email })
        assert.equal(forgot.status, 200)
        assert.ok(forgot.body.reset_token, "reset_token attendu (pas de serveur mail dans le périmètre)")
        resetToken = forgot.body.reset_token

        const reset = await api().post("/auth/reset-password")
            .send({ token: resetToken, new_password: "NouveauMdpE2E1!" })
        assert.equal(reset.status, 200)

        assert.equal((await login(charlie.email, PWD)).status, 401, "l'ancien mot de passe ne doit plus marcher")
        const relog = await login(charlie.email, "NouveauMdpE2E1!")
        assert.equal(relog.status, 200)
        charlie.token = relog.body.access_token

        const rejeu = await api().post("/auth/reset-password")
            .send({ token: resetToken, new_password: "EncoreUnAutre1!" })
        assert.equal(rejeu.status, 401, "le ticket est à usage unique")
    })

    quand("RGPD : export complet puis effacement → le compte ne peut plus se connecter", async () => {
        const exp = await api().get("/gdpr/export").set(auth(charlie.token))
        assert.equal(exp.status, 200)
        assert.equal(exp.body.donnees_personnelles.email, charlie.email)

        assert.equal((await api().delete("/gdpr/delete").set(auth(charlie.token))).status, 200)
        assert.equal((await login(charlie.email, "NouveauMdpE2E1!")).status, 401, "compte anonymisé → login impossible")
    })

    quand("langage de requête maison (admin) : FIND events LIMIT 5", async () => {
        const res = await api().post("/query").set(auth(admin.token)).send({ query: "FIND events LIMIT 5" })
        assert.equal(res.status, 200)
        assert.ok(res.body.count <= 5)
        assert.equal(res.body.collection, "events")
    })

    quand("upload : PDF accepté (201), HTML refusé (415)", async () => {
        const ok = await api().post("/upload").set(auth(alice.token))
            .attach("file", Buffer.from("%PDF-1.4 e2e"), { filename: "e2e.pdf", contentType: "application/pdf" })
        assert.equal(ok.status, 201)
        assert.match(ok.body.url, /^\/uploads\//)

        const ko = await api().post("/upload").set(auth(alice.token))
            .attach("file", Buffer.from("<script>alert(1)</script>"), { filename: "e2e.html", contentType: "text/html" })
        assert.equal(ko.status, 415)
    })
})
