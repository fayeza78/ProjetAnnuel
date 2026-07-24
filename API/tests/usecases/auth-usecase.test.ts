import { test, describe } from "node:test"
import assert from "node:assert/strict"
import jwt from "jsonwebtoken"
import { hash } from "bcrypt"
import { AuthUsecase } from "../../src/Usecases/auth-usecase.js"
import { createMockRepository } from "../helpers/mockRepository.js"

process.env.JWT_SECRET = "test-secret"

describe("AuthUsecase.login", () => {
    test("renvoie null si l'utilisateur est introuvable", async () => {
        const userRepo = createMockRepository({ findOneBy: async () => null })
        const tokenRepo = createMockRepository()
        const usecase = new AuthUsecase(userRepo as any, tokenRepo as any)
        const res = await usecase.login({ email: "x@y.fr", password: "motdepasse" })
        assert.equal(res, null)
    })

    test("renvoie null si le mot de passe est incorrect", async () => {
        const hashed = await hash("lebonmotdepasse", 10)
        const userRepo = createMockRepository({
            findOneBy: async () => ({ id_user: 1, email: "x@y.fr", role: "user", password: hashed })
        })
        const tokenRepo = createMockRepository()
        const usecase = new AuthUsecase(userRepo as any, tokenRepo as any)
        const res = await usecase.login({ email: "x@y.fr", password: "mauvais" })
        assert.equal(res, null)
    })

    test("renvoie des tokens valides si les identifiants sont corrects", async () => {
        const hashed = await hash("motdepasse123", 10)
        const userRepo = createMockRepository({
            findOneBy: async () => ({ id_user: 42, email: "x@y.fr", role: "admin", password: hashed })
        })
        const tokenRepo = createMockRepository({
            create: (x: unknown) => x,
            save: async (x: any) => x
        })
        const usecase = new AuthUsecase(userRepo as any, tokenRepo as any)
        const res = await usecase.login({ email: "x@y.fr", password: "motdepasse123" })

        assert.ok(res)
        assert.equal(res!.token_type, "Bearer")
        assert.equal(res!.expires_in, 3600)
        assert.equal(res!.user.id_user, 42)

        const decoded = jwt.verify(res!.access_token, "test-secret") as any
        assert.equal(decoded.userId, 42)
        assert.equal(decoded.role, "admin")
        assert.ok(res!.refresh_token, "un refresh token doit être généré")
    })
})

describe("AuthUsecase.refresh", () => {
    test("renvoie null si le refresh token est inconnu", async () => {
        const tokenRepo = createMockRepository({ findOne: async () => null })
        const usecase = new AuthUsecase(createMockRepository() as any, tokenRepo as any)
        assert.equal(await usecase.refresh("inconnu"), null)
    })

    test("renvoie null et supprime le token s'il est expiré", async () => {
        let softDeleteAppele = false
        const tokenRepo = createMockRepository({
            findOne: async () => ({ id_token: 1, expireA: new Date(Date.now() - 1000), user: { id_user: 1 } }),
            softDelete: async () => { softDeleteAppele = true; return { affected: 1 } }
        })
        const usecase = new AuthUsecase(createMockRepository() as any, tokenRepo as any)
        const res = await usecase.refresh("expire")
        assert.equal(res, null)
        assert.equal(softDeleteAppele, true)
    })

    test("renvoie un nouvel access token si le refresh est valide", async () => {
        const tokenRepo = createMockRepository({
            findOne: async () => ({
                id_token: 1,
                expireA: new Date(Date.now() + 100000),
                user: { id_user: 5, email: "a@b.fr", role: "user" }
            })
        })
        const usecase = new AuthUsecase(createMockRepository() as any, tokenRepo as any)
        const res = await usecase.refresh("valide")
        assert.ok(res)
        assert.equal(res!.expires_in, 3600)
        const decoded = jwt.verify(res!.access_token, "test-secret") as any
        assert.equal(decoded.userId, 5)
    })
})

describe("AuthUsecase.logout", () => {
    test("renvoie false si le token n'existe pas", async () => {
        const tokenRepo = createMockRepository({ findOneBy: async () => null })
        const usecase = new AuthUsecase(createMockRepository() as any, tokenRepo as any)
        assert.equal(await usecase.logout("x"), false)
    })

    test("renvoie true et révoque le token existant", async () => {
        let softDeleteAppele = false
        const tokenRepo = createMockRepository({
            findOneBy: async () => ({ id_token: 9 }),
            softDelete: async () => { softDeleteAppele = true; return { affected: 1 } }
        })
        const usecase = new AuthUsecase(createMockRepository() as any, tokenRepo as any)
        assert.equal(await usecase.logout("x"), true)
        assert.equal(softDeleteAppele, true)
    })
})
