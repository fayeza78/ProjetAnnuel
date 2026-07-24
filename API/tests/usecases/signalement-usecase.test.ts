import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { SignalementUsecase } from "../../src/Usecases/signalement-usecase.js"
import { createMockRepository } from "../helpers/mockRepository.js"

function build(sigRepo?: any, userRepo?: any) {
    return new SignalementUsecase(
        (sigRepo ?? createMockRepository()) as any,
        (userRepo ?? createMockRepository()) as any
    )
}

describe("SignalementUsecase.createSignalement", () => {
    test("crée un signalement au statut 'ouvert' rattaché au signaleur", async () => {
        const usecase = build(createMockRepository(), createMockRepository({ findOneBy: async () => ({ id_user: 4 }) }))
        const s = await usecase.createSignalement({ cible_type: "message", cible_id: "m1", motif: "spam" }, 4)
        assert.equal((s as any).statut, "ouvert")
        assert.equal((s as any).cible_type, "message")
        assert.equal((s as any).signaleur.id_user, 4)
    })
})

describe("SignalementUsecase.traiterSignalement", () => {
    test("renvoie null si introuvable", async () => {
        const usecase = build(createMockRepository({ findOneBy: async () => null }))
        assert.equal(await usecase.traiterSignalement(1, "traite"), null)
    })

    test("met à jour le statut si trouvé", async () => {
        const usecase = build(createMockRepository({ findOneBy: async () => ({ id_signalement: 1, statut: "ouvert" }) }))
        const res = await usecase.traiterSignalement(1, "rejete")
        assert.equal(res?.statut, "rejete")
    })
})
