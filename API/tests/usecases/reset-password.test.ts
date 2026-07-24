import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { compare, hash } from "bcrypt"
import { AuthUsecase } from "../../src/Usecases/auth-usecase.js"
import { createMockRepository } from "../helpers/mockRepository.js"

process.env.JWT_SECRET = "test-secret"

// Flux " mot de passe oublie " : ticket a usage unique (TokenType.RESET_PASSWORD,
// 15 min) puis remplacement du mot de passe + revocation des sessions.
describe("AuthUsecase — mot de passe oublié", () => {
    test("forgotPassword renvoie null si l'e-mail est inconnu (anti-énumération côté handler)", async () => {
        const userRepo = createMockRepository({ findOneBy: async () => null })
        const usecase = new AuthUsecase(userRepo as any, createMockRepository() as any)
        assert.equal(await usecase.forgotPassword("inconnu@x.fr"), null)
    })

    test("forgotPassword crée un ticket reset_password avec expiration", async () => {
        let saved: any = null
        const tokenRepo = createMockRepository({ save: async (t: any) => { saved = t; return t } })
        const userRepo = createMockRepository({ findOneBy: async () => ({ id_user: 4, email: "a@b.fr" }) })
        const usecase = new AuthUsecase(userRepo as any, tokenRepo as any)

        const token = await usecase.forgotPassword("a@b.fr")
        assert.ok(token, "un ticket doit être généré")
        assert.equal(saved.token, token)
        assert.equal(saved.type, "reset_password")
        assert.ok(saved.expireA > new Date(), "le ticket doit expirer dans le futur")
    })

    test("resetPassword refuse un ticket inconnu", async () => {
        const tokenRepo = createMockRepository({ findOne: async () => null })
        const usecase = new AuthUsecase(createMockRepository() as any, tokenRepo as any)
        assert.equal(await usecase.resetPassword("inconnu", "NouveauMdp123"), false)
    })

    test("resetPassword refuse (et consomme) un ticket expiré", async () => {
        let softDeleteAppele = false
        const tokenRepo = createMockRepository({
            findOne: async () => ({ id_token: 9, expireA: new Date(Date.now() - 1000), user: { id_user: 4 } }),
            softDelete: async () => { softDeleteAppele = true; return { affected: 1 } }
        })
        const usecase = new AuthUsecase(createMockRepository() as any, tokenRepo as any)
        assert.equal(await usecase.resetPassword("expire", "NouveauMdp123"), false)
        assert.equal(softDeleteAppele, true)
    })

    test("resetPassword remplace le mot de passe (hashé) et consomme le ticket", async () => {
        const ancienHash = await hash("AncienMdp123", 10)
        const utilisateur: any = { id_user: 4, email: "a@b.fr", password: ancienHash }
        let ticketConsomme = false

        const tokenRepo = createMockRepository({
            findOne: async () => ({ id_token: 9, expireA: new Date(Date.now() + 60_000), user: utilisateur }),
            softDelete: async () => { ticketConsomme = true; return { affected: 1 } },
            // resetPassword revoque aussi les refresh tokens via un query builder
            createQueryBuilder: () => {
                const qb: any = {
                    softDelete: () => qb,
                    where: () => qb,
                    execute: async () => ({ affected: 1 })
                }
                return qb
            }
        })
        const userRepo = createMockRepository({ save: async (u: any) => u })
        const usecase = new AuthUsecase(userRepo as any, tokenRepo as any)

        assert.equal(await usecase.resetPassword("valide", "NouveauMdp123"), true)
        assert.equal(ticketConsomme, true, "le ticket doit être à usage unique")
        assert.notEqual(utilisateur.password, ancienHash, "le mot de passe doit changer")
        assert.ok(await compare("NouveauMdp123", utilisateur.password), "le nouveau hash doit correspondre")
    })
})
