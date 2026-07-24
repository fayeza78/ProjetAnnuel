import { test, describe, before } from "node:test"
import assert from "node:assert/strict"
import express, { type Express } from "express"
import request from "supertest"
import jwt from "jsonwebtoken"

// Tests d'integration de la couche HTTP (routing + middleware + validation),
// sans base de donnees : on n'exerce que les chemins qui repondent AVANT d'atteindre une BDD
// (401 token manquant, 403 mauvais role, 400 validation, route publique).
process.env.JWT_SECRET = "test-secret"

let app: Express

before(async () => {
    const { initHandlers } = await import("../../src/Handlers/routes.js")
    app = express()
    app.use(express.json())
    initHandlers(app)
})

describe("Intégration HTTP (sans BDD)", () => {
    test("GET / → 200 (route publique)", async () => {
        const res = await request(app).get("/")
        assert.equal(res.status, 200)
    })

    test("GET /services sans token → 401", async () => {
        const res = await request(app).get("/services")
        assert.equal(res.status, 401)
    })

    test("POST /quartiers avec rôle 'user' → 403", async () => {
        const token = jwt.sign({ userId: 1, email: "a@b.fr", role: "user" }, "test-secret")
        const res = await request(app).post("/quartiers").set("Authorization", `Bearer ${token}`).send({ nom_quartier: "X" })
        assert.equal(res.status, 403)
    })

    test("POST /auth/login corps invalide → 400", async () => {
        const res = await request(app).post("/auth/login").send({ email: "pas-un-email" })
        assert.equal(res.status, 400)
    })

    test("POST /query sans token → 401", async () => {
        const res = await request(app).post("/query").send({ query: "FIND events" })
        assert.equal(res.status, 401)
    })

    test("POST /signalements sans token → 401", async () => {
        const res = await request(app).post("/signalements").send({ cible_type: "message", cible_id: "m1" })
        assert.equal(res.status, 401)
    })
})
