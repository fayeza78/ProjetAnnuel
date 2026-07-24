import { test, describe, beforeEach, afterEach, mock } from "node:test"
import assert from "node:assert/strict"
import { StatsUsecase } from "../../src/Usecases/stats-usecase.js"
import { AppDataSource_MongoDB } from "../../src/Database/database.js"
import { createMockRepository } from "../helpers/mockRepository.js"

let mongoRepo: ReturnType<typeof createMockRepository>
beforeEach(() => {
    mongoRepo = createMockRepository()
    mock.method(AppDataSource_MongoDB, "getRepository", () => mongoRepo as any)
})
afterEach(() => {
    mock.restoreAll()
})

describe("StatsUsecase.getIncidentsStats", () => {
    test("agrège par statut / gravité / type", async () => {
        const repo = createMockRepository({
            find: async () => [
                { statut: "ouvert", gravite: "haute", type: "incident" },
                { statut: "ouvert", gravite: "faible", type: "alerte" },
                { statut: "resolu", gravite: "haute", type: "incident" }
            ]
        })
        const usecase = new StatsUsecase(repo as any)
        const stats = await usecase.getIncidentsStats()
        assert.equal(stats.total, 3)
        assert.equal(stats.parStatut.ouvert, 2)
        assert.equal(stats.parGravite.haute, 2)
        assert.equal(stats.parType.alerte, 1)
    })
})

describe("StatsUsecase.getParticipationsStats", () => {
    test("compte les participations par statut et par utilisateur ('declined' exclu)", async () => {
        mongoRepo.find = (async () => [
            { participants: [
                { inhabitant_postgres_id: "1", status: "confirmed" },
                { inhabitant_postgres_id: "2", status: "interested" }
            ] },
            { participants: [
                { inhabitant_postgres_id: "1", status: "declined" }
            ] }
        ]) as any
        const usecase = new StatsUsecase(createMockRepository() as any)
        const stats = await usecase.getParticipationsStats()
        assert.equal(stats.totalEvenements, 2)
        assert.equal(stats.participations.confirmed, 1)
        assert.equal(stats.participations.interested, 1)
        assert.equal(stats.participations.declined, 1)
        assert.equal(stats.parUtilisateur["1"], 1)
        assert.equal(stats.parUtilisateur["2"], 1)
    })
})
