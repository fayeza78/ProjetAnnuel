import { test, describe, beforeEach } from "node:test"
import assert from "node:assert/strict"
import jwt from "jsonwebtoken"
import type { Request, Response, NextFunction } from "express"
import { authenticateToken, requireRole } from "../../src/Middleware/auth-middleware.js"

// On fixe le secret pour signer des tokens deterministes dans les tests
const SECRET = "test-secret"
process.env.JWT_SECRET = SECRET

/** Fabrique une fausse Response capturant le status et le body. */
function mockResponse() {
    const res: Partial<Response> & { statusCode?: number; body?: unknown } = {}
    res.status = ((code: number) => { res.statusCode = code; return res as Response }) as Response["status"]
    res.json = ((payload: unknown) => { res.body = payload; return res as Response }) as Response["json"]
    return res as Response & { statusCode?: number; body?: unknown }
}

describe("authenticateToken", () => {
    test("rejette (401) si aucun header Authorization", () => {
        const req = { headers: {} } as Request
        const res = mockResponse()
        let nextAppele = false
        authenticateToken(req, res, (() => { nextAppele = true }) as NextFunction)

        assert.equal(res.statusCode, 401)
        assert.equal(nextAppele, false)
    })

    test("rejette (401) si le token est invalide", () => {
        const req = { headers: { authorization: "Bearer pas.un.jwt" } } as Request
        const res = mockResponse()
        let nextAppele = false
        authenticateToken(req, res, (() => { nextAppele = true }) as NextFunction)

        assert.equal(res.statusCode, 401)
        assert.equal(nextAppele, false)
    })

    test("accepte un token valide et peuple req.user", () => {
        const token = jwt.sign({ userId: 7, email: "a@b.fr", role: "user" }, SECRET)
        const req = { headers: { authorization: `Bearer ${token}` } } as Request
        const res = mockResponse()
        let nextAppele = false
        authenticateToken(req, res, (() => { nextAppele = true }) as NextFunction)

        assert.equal(nextAppele, true)
        assert.equal(req.user?.userId, 7)
        assert.equal(req.user?.role, "user")
    })

    test("rejette (401) un token signé avec un autre secret", () => {
        const token = jwt.sign({ userId: 1, email: "a@b.fr", role: "user" }, "autre-secret")
        const req = { headers: { authorization: `Bearer ${token}` } } as Request
        const res = mockResponse()
        let nextAppele = false
        authenticateToken(req, res, (() => { nextAppele = true }) as NextFunction)

        assert.equal(res.statusCode, 401)
        assert.equal(nextAppele, false)
    })
})

describe("requireRole", () => {
    test("401 si non authentifié", () => {
        const req = {} as Request
        const res = mockResponse()
        let nextAppele = false
        requireRole("admin")(req, res, (() => { nextAppele = true }) as NextFunction)
        assert.equal(res.statusCode, 401)
        assert.equal(nextAppele, false)
    })

    test("403 si le rôle ne correspond pas", () => {
        const req = { user: { userId: 1, email: "a@b.fr", role: "user" } } as Request
        const res = mockResponse()
        let nextAppele = false
        requireRole("admin")(req, res, (() => { nextAppele = true }) as NextFunction)
        assert.equal(res.statusCode, 403)
        assert.equal(nextAppele, false)
    })

    test("passe si le rôle correspond", () => {
        const req = { user: { userId: 1, email: "a@b.fr", role: "admin" } } as Request
        const res = mockResponse()
        let nextAppele = false
        requireRole("admin", "moderateur")(req, res, (() => { nextAppele = true }) as NextFunction)
        assert.equal(nextAppele, true)
    })
})
