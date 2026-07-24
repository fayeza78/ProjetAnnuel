import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { compare } from "bcrypt"
import { UserUsecase } from "../../src/Usecases/user-usecase.js"
import { createMockRepository } from "../helpers/mockRepository.js"

describe("UserUsecase.createUser", () => {
    test("hashe le mot de passe avant de sauvegarder", async () => {
        const repo = createMockRepository()
        const usecase = new UserUsecase(repo as any, createMockRepository() as any)

        const created = await usecase.createUser({
            email: "a@b.fr",
            password: "motdepasse123",
            role: "user",
            adresse: "1 rue X",
            ville: "Paris",
            cp: "75000",
            nom_quartier: "Q"
        })

        assert.notEqual(created.password, "motdepasse123", "le mot de passe ne doit pas être en clair")
        assert.ok(await compare("motdepasse123", created.password), "le hash bcrypt doit correspondre")
    })

    test("rattache le quartier par son nom", async () => {
        const repo = createMockRepository()
        const usecase = new UserUsecase(repo as any, createMockRepository() as any)
        const created = await usecase.createUser({
            email: "a@b.fr", password: "motdepasse123", role: "user",
            adresse: "1 rue X", ville: "Paris", cp: "75000", nom_quartier: "Montmartre"
        })
        assert.equal((created.quartier as any).nom_quartier, "Montmartre")
    })
})

describe("UserUsecase.getUserById", () => {
    test("renvoie l'utilisateur trouvé", async () => {
        const fakeUser = { id_user: 1, email: "a@b.fr" }
        const repo = createMockRepository({ findOne: async () => fakeUser })
        const usecase = new UserUsecase(repo as any, createMockRepository() as any)
        const user = await usecase.getUserById(1)
        assert.deepEqual(user, fakeUser)
    })
})

describe("UserUsecase.updateUser", () => {
    test("renvoie null si l'utilisateur n'existe pas", async () => {
        const repo = createMockRepository({ findOneBy: async () => null })
        const usecase = new UserUsecase(repo as any, createMockRepository() as any)
        const res = await usecase.updateUser(99, { ville: "Lyon" })
        assert.equal(res, null)
    })

    test("applique les modifications et sauvegarde", async () => {
        const existing = { id_user: 1, ville: "Paris", adresse: "X" }
        const repo = createMockRepository({ findOneBy: async () => existing })
        const usecase = new UserUsecase(repo as any, createMockRepository() as any)
        const res = await usecase.updateUser(1, { ville: "Lyon" })
        assert.equal(res?.ville, "Lyon")
    })
})

describe("UserUsecase.deleteUser", () => {
    test("renvoie false si introuvable", async () => {
        const repo = createMockRepository({ findOneBy: async () => null })
        const usecase = new UserUsecase(repo as any, createMockRepository() as any)
        assert.equal(await usecase.deleteUser(1), false)
    })

    test("renvoie true et soft-delete si trouvé", async () => {
        let softDeleteAppele = false
        const repo = createMockRepository({
            findOneBy: async () => ({ id_user: 1 }),
            softDelete: async () => { softDeleteAppele = true; return { affected: 1 } }
        })
        const usecase = new UserUsecase(repo as any, createMockRepository() as any)
        assert.equal(await usecase.deleteUser(1), true)
        assert.equal(softDeleteAppele, true)
    })
})
