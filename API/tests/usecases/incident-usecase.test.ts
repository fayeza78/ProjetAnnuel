import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { IncidentUsecase } from "../../src/Usecases/incident-usecase.js"
import { createMockRepository } from "../helpers/mockRepository.js"

function build(incidentRepo?: any, userRepo?: any) {
    return new IncidentUsecase(
        (incidentRepo ?? createMockRepository()) as any,
        (userRepo ?? createMockRepository()) as any
    )
}

describe("IncidentUsecase.createIncident", () => {
    test("crée un incident au statut 'ouvert' rattaché à l'utilisateur", async () => {
        const usecase = build(
            createMockRepository(),
            createMockRepository({ findOneBy: async () => ({ id_user: 3 }) })
        )
        const incident = await usecase.createIncident({ description: "Lampadaire cassé" }, 3)
        assert.equal((incident as any).statut, "ouvert")
        assert.equal((incident as any).description, "Lampadaire cassé")
        assert.equal((incident as any).user.id_user, 3)
    })

    test("prend en compte type et gravité quand fournis", async () => {
        const usecase = build(
            createMockRepository(),
            createMockRepository({ findOneBy: async () => ({ id_user: 1 }) })
        )
        const incident = await usecase.createIncident({ description: "Fuite de gaz", type: "alerte", gravite: "critique" }, 1)
        assert.equal((incident as any).type, "alerte")
        assert.equal((incident as any).gravite, "critique")
    })

    test("crée l'incident même si l'utilisateur est introuvable (sans relation)", async () => {
        const usecase = build(
            createMockRepository(),
            createMockRepository({ findOneBy: async () => null })
        )
        const incident = await usecase.createIncident({ description: "X" }, 99)
        assert.equal((incident as any).statut, "ouvert")
        assert.equal((incident as any).user, undefined)
    })
})

describe("IncidentUsecase.updateIncidentStatut", () => {
    test("renvoie null si l'incident est introuvable", async () => {
        const usecase = build(createMockRepository({ findOneBy: async () => null }))
        assert.equal(await usecase.updateIncidentStatut(1, "resolu"), null)
    })

    test("met à jour le statut si trouvé", async () => {
        const usecase = build(createMockRepository({ findOneBy: async () => ({ id_incident: 1, statut: "ouvert" }) }))
        const res = await usecase.updateIncidentStatut(1, "resolu")
        assert.equal(res?.statut, "resolu")
    })
})
