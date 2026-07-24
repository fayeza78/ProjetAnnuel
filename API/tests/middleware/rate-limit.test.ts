import { test, describe } from "node:test"
import assert from "node:assert/strict"
import express from "express"
import request from "supertest"
import rateLimit from "express-rate-limit"

describe("Rate limiting", () => {
    test("renvoie 429 une fois la limite dépassée", async () => {
        const app = express()
        const limiter = rateLimit({ windowMs: 60_000, limit: 2, legacyHeaders: false })
        app.use(limiter)
        app.get("/ping", (_req, res) => { res.json({ ok: true }) })

        assert.equal((await request(app).get("/ping")).status, 200)
        assert.equal((await request(app).get("/ping")).status, 200)
        assert.equal((await request(app).get("/ping")).status, 429)
    })
})
