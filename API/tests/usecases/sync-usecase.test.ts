import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { SyncUsecase } from "../../src/Usecases/sync-usecase.js"
import { createMockRepository } from "../helpers/mockRepository.js"

describe("SyncUsecase.pull", () => {
    test("retourne les incidents modifiés depuis 'since' + serverTime", async () => {
        const repo = createMockRepository({
            createQueryBuilder: () => {
                const qb: any = { leftJoinAndSelect: () => qb, where: () => qb, getMany: async () => [{ id_incident: 1 }] }
                return qb
            }
        })
        const usecase = new SyncUsecase(repo as any)
        const res = await usecase.pull("2025-01-01T00:00:00Z")
        assert.equal(res.incidents.length, 1)
        assert.ok(res.serverTime)
    })
})

describe("SyncUsecase.push", () => {
    test("crée un nouvel incident (sans id)", async () => {
        const repo = createMockRepository({ create: (x: any) => x, save: async (x: any) => ({ ...x, id_incident: 10 }) })
        const usecase = new SyncUsecase(repo as any)
        const res = await usecase.push([{ description: "Nouveau" }])
        assert.equal(res[0]!.status, "created")
        assert.equal(res[0]!.id, 10)
    })

    test("recrée si l'id n'existe plus côté serveur", async () => {
        const repo = createMockRepository({ findOneBy: async () => null, create: (x: any) => x, save: async (x: any) => ({ ...x, id_incident: 5 }) })
        const usecase = new SyncUsecase(repo as any)
        const res = await usecase.push([{ id_incident: 99, description: "X" }])
        assert.equal(res[0]!.status, "recreated")
    })

    test("met à jour si le client est plus récent (last-write-wins)", async () => {
        const repo = createMockRepository({
            findOneBy: async () => ({ id_incident: 1, description: "old", statut: "ouvert", updatedAt: new Date("2025-01-01T00:00:00Z") }),
            save: async (x: any) => x
        })
        const usecase = new SyncUsecase(repo as any)
        const res = await usecase.push([{ id_incident: 1, description: "new", updatedAt: "2025-06-01T00:00:00Z" }])
        assert.equal(res[0]!.status, "updated")
    })

    test("garde la version serveur si elle est plus récente", async () => {
        const repo = createMockRepository({
            findOneBy: async () => ({ id_incident: 1, description: "server", statut: "ouvert", updatedAt: new Date("2025-06-01T00:00:00Z") }),
            save: async (x: any) => x
        })
        const usecase = new SyncUsecase(repo as any)
        const res = await usecase.push([{ id_incident: 1, description: "client", updatedAt: "2025-01-01T00:00:00Z" }])
        assert.equal(res[0]!.status, "kept_server")
    })
})
