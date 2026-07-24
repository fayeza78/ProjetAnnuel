import { test, describe, beforeEach, afterEach, mock } from "node:test"
import assert from "node:assert/strict"
import { EvenementUsecase } from "../../src/Usecases/evenement-usecase.js"
import { AppDataSource_MongoDB } from "../../src/Database/database.js"
import { createMockRepository } from "../helpers/mockRepository.js"

/**
 * EvenementUsecase synchronise vers MongoDB via le singleton AppDataSource_MongoDB.
 * On remplace `getRepository` par un faux repo pour rester en test unitaire (pas de vraie BDD).
 */
let mongoRepo: ReturnType<typeof createMockRepository>

beforeEach(() => {
    mongoRepo = createMockRepository()
    mock.method(AppDataSource_MongoDB, "getRepository", () => mongoRepo as any)
})

afterEach(() => {
    mock.restoreAll()
})

function build(evtRepo?: any, userRepo?: any) {
    return new EvenementUsecase(
        (evtRepo ?? createMockRepository()) as any,
        (userRepo ?? createMockRepository()) as any
    )
}

describe("EvenementUsecase.createEvenement", () => {
    test("crée l'événement au statut 'actif' avec son créateur", async () => {
        const evtRepo = createMockRepository({ save: async (x: any) => ({ ...x, id_evenement: 1 }) })
        const usecase = build(evtRepo, createMockRepository({ findOneBy: async () => ({ id_user: 3 }) }))
        const evt = await usecase.createEvenement({ titre: "Repas de quartier" }, 3)
        assert.equal((evt as any).statut, "actif")
        assert.equal((evt as any).titre, "Repas de quartier")
    })

    test("initialise un document MongoDB associé", async () => {
        const evtRepo = createMockRepository({ save: async (x: any) => ({ ...x, id_evenement: 10 }) })
        let mongoSave = 0
        mongoRepo.save = (async (x: any) => { mongoSave++; return x }) as any
        const usecase = build(evtRepo, createMockRepository({ findOneBy: async () => ({ id_user: 1 }) }))
        await usecase.createEvenement({ titre: "X" }, 1)
        assert.equal(mongoSave, 1, "le document EventMongo doit être sauvegardé")
    })
})

describe("EvenementUsecase.updateEvenement (permissions)", () => {
    test("renvoie null si introuvable", async () => {
        const usecase = build(createMockRepository({ findOne: async () => null }))
        assert.equal(await usecase.updateEvenement(1, 1, "user", { titre: "X" }), null)
    })

    test("refuse un user non auteur", async () => {
        const usecase = build(createMockRepository({ findOne: async () => ({ id_evenement: 1, user: { id_user: 2 } }) }))
        assert.equal(await usecase.updateEvenement(1, 999, "user", { titre: "X" }), null)
    })

    test("autorise l'auteur", async () => {
        const usecase = build(createMockRepository({ findOne: async () => ({ id_evenement: 1, user: { id_user: 7 }, titre: "Ancien" }) }))
        const res = await usecase.updateEvenement(1, 7, "user", { titre: "Nouveau" })
        assert.equal(res?.titre, "Nouveau")
    })

    test("autorise un admin non auteur", async () => {
        const usecase = build(createMockRepository({ findOne: async () => ({ id_evenement: 1, user: { id_user: 2 }, titre: "A" }) }))
        const res = await usecase.updateEvenement(1, 999, "admin", { titre: "B" })
        assert.equal(res?.titre, "B")
    })
})

describe("EvenementUsecase.deleteEvenement (permissions)", () => {
    test("refuse un user non auteur", async () => {
        const usecase = build(createMockRepository({ findOne: async () => ({ id_evenement: 1, user: { id_user: 2 } }) }))
        assert.equal(await usecase.deleteEvenement(1, 999, "user"), false)
    })

    test("autorise un moderateur", async () => {
        const usecase = build(createMockRepository({ findOne: async () => ({ id_evenement: 1, user: { id_user: 2 } }) }))
        assert.equal(await usecase.deleteEvenement(1, 999, "moderateur"), true)
    })
})

describe("EvenementUsecase.participerEvenement", () => {
    test("renvoie false si l'événement PostgreSQL n'existe pas", async () => {
        const usecase = build(createMockRepository({ findOneBy: async () => null }))
        assert.equal(await usecase.participerEvenement(1, 1, "confirmed"), false)
    })

    test("renvoie false si le document MongoDB n'existe pas", async () => {
        mongoRepo.findOne = (async () => null) as any
        const usecase = build(createMockRepository({ findOneBy: async () => ({ id_evenement: 1 }) }))
        assert.equal(await usecase.participerEvenement(1, 1, "confirmed"), false)
    })

    test("ajoute un participant et renvoie true", async () => {
        const doc: any = { participants: [] }
        mongoRepo.findOne = (async () => doc) as any
        mongoRepo.save = (async (x: any) => x) as any
        const usecase = build(createMockRepository({ findOneBy: async () => ({ id_evenement: 1 }) }))
        const ok = await usecase.participerEvenement(1, 42, "confirmed")
        assert.equal(ok, true)
        assert.equal(doc.participants.length, 1)
        assert.equal(doc.participants[0].inhabitant_postgres_id, "42")
        assert.equal(doc.participants[0].status, "confirmed")
    })

    test("met à jour le statut d'un participant existant (pas de doublon)", async () => {
        const doc: any = { participants: [{ inhabitant_postgres_id: "42", status: "interested", firstName: "", joinedAt: new Date() }] }
        mongoRepo.findOne = (async () => doc) as any
        mongoRepo.save = (async (x: any) => x) as any
        const usecase = build(createMockRepository({ findOneBy: async () => ({ id_evenement: 1 }) }))
        await usecase.participerEvenement(1, 42, "confirmed")
        assert.equal(doc.participants.length, 1)
        assert.equal(doc.participants[0].status, "confirmed")
    })
})
