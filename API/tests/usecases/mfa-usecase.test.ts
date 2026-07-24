import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { hash } from "bcrypt"
import { authenticator } from "otplib"
import { AuthUsecase } from "../../src/Usecases/auth-usecase.js"
import { createMockRepository } from "../helpers/mockRepository.js"

process.env.JWT_SECRET = "test-secret"

describe("AuthUsecase — MFA", () => {
    test("setupMfa génère un secret et une URL otpauth", async () => {
        let saved: any = null
        const userRepo = createMockRepository({
            findOneBy: async () => ({ id_user: 1, email: "a@b.fr", mfa_secret: "", mfa_enabled: false }),
            save: async (u: any) => { saved = u; return u }
        })
        const usecase = new AuthUsecase(userRepo as any, createMockRepository() as any)
        const res = await usecase.setupMfa(1)
        assert.ok(res!.secret)
        assert.match(res!.otpauthUrl, /^otpauth:\/\/totp\//)
        // Le secret est desormais CHIFFRE au repos (AES-256-GCM) : ce qui est stocke
        // ne doit PAS etre le secret en clair, et doit porter le prefixe de format.
        assert.notEqual(saved.mfa_secret, res!.secret, "le secret ne doit pas être stocké en clair")
        assert.ok((saved.mfa_secret as string).startsWith("enc:v1:"), "format chiffré enc:v1: attendu")
    })

    test("verifyMfa active la MFA avec un code TOTP valide", async () => {
        const secret = authenticator.generateSecret()
        let saved: any = null
        const userRepo = createMockRepository({
            findOneBy: async () => ({ id_user: 1, mfa_secret: secret, mfa_enabled: false }),
            save: async (u: any) => { saved = u; return u }
        })
        const usecase = new AuthUsecase(userRepo as any, createMockRepository() as any)
        assert.equal(await usecase.verifyMfa(1, authenticator.generate(secret)), true)
        assert.equal(saved.mfa_enabled, true)
    })

    test("verifyMfa refuse un code invalide", async () => {
        const secret = authenticator.generateSecret()
        const userRepo = createMockRepository({ findOneBy: async () => ({ id_user: 1, mfa_secret: secret, mfa_enabled: false }) })
        const usecase = new AuthUsecase(userRepo as any, createMockRepository() as any)
        assert.equal(await usecase.verifyMfa(1, "000000"), false)
    })

    test("login exige un code si MFA activée (mfa_required)", async () => {
        const hashed = await hash("motdepasse123", 10)
        const secret = authenticator.generateSecret()
        const userRepo = createMockRepository({
            findOneBy: async () => ({ id_user: 1, email: "a@b.fr", role: "user", password: hashed, mfa_enabled: true, mfa_secret: secret })
        })
        const usecase = new AuthUsecase(userRepo as any, createMockRepository({ save: async (x: any) => x }) as any)
        const res = await usecase.login({ email: "a@b.fr", password: "motdepasse123" })
        assert.deepEqual(res, { mfa_required: true })
    })

    test("login réussit avec un code TOTP valide", async () => {
        const hashed = await hash("motdepasse123", 10)
        const secret = authenticator.generateSecret()
        const userRepo = createMockRepository({
            findOneBy: async () => ({ id_user: 1, email: "a@b.fr", role: "user", password: hashed, mfa_enabled: true, mfa_secret: secret })
        })
        const tokenRepo = createMockRepository({ create: (x: any) => x, save: async (x: any) => x })
        const usecase = new AuthUsecase(userRepo as any, tokenRepo as any)
        const res = await usecase.login({ email: "a@b.fr", password: "motdepasse123", code: authenticator.generate(secret) })
        assert.ok(res && "access_token" in res)
    })
})
