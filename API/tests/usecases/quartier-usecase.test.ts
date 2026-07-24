import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { QuartierUsecase } from "../../src/Usecases/quartier-usecase.js"
import { createMockRepository } from "../helpers/mockRepository.js"

// Deux carres GeoJSON : A et B se chevauchent ; C est loin (aucun contact).
const carreA = JSON.stringify({ type: "Polygon", coordinates: [[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]] });
const carreB = JSON.stringify({ type: "Polygon", coordinates: [[[5, 5], [5, 15], [15, 15], [15, 5], [5, 5]]] });
const carreC = JSON.stringify({ type: "Polygon", coordinates: [[[100, 100], [100, 110], [110, 110], [110, 100], [100, 100]]] });

describe("QuartierUsecase", () => {
    test("createQuartier crée et sauvegarde (sans limite)", async () => {
        const repo = createMockRepository()
        const usecase = new QuartierUsecase(repo as any)
        const res = await usecase.createQuartier({ nom_quartier: "Montmartre" })
        assert.equal(res.ok, true)
        assert.equal((res as any).quartier.nom_quartier, "Montmartre")
    })

    test("createQuartier refuse un chevauchement de limites", async () => {
        const repo = createMockRepository({
            find: async () => [{ id_quartier: 1, nom_quartier: "Centre", limite_geo: carreA }],
        })
        const usecase = new QuartierUsecase(repo as any)
        const res = await usecase.createQuartier({ nom_quartier: "Nord", limite_geo: carreB })
        assert.equal(res.ok, false)
        assert.equal((res as any).reason, "overlap")
        assert.equal((res as any).conflict, "Centre")
    })

    test("createQuartier accepte une limite sans chevauchement", async () => {
        const repo = createMockRepository({
            find: async () => [{ id_quartier: 1, nom_quartier: "Centre", limite_geo: carreA }],
        })
        const usecase = new QuartierUsecase(repo as any)
        const res = await usecase.createQuartier({ nom_quartier: "Sud", limite_geo: carreC })
        assert.equal(res.ok, true)
    })

    test("getQuartierById renvoie null si absent", async () => {
        const repo = createMockRepository({ findOneBy: async () => null })
        const usecase = new QuartierUsecase(repo as any)
        assert.equal(await usecase.getQuartierById(1), null)
    })

    test("updateQuartier renvoie not_found si absent", async () => {
        const repo = createMockRepository({ findOneBy: async () => null })
        const usecase = new QuartierUsecase(repo as any)
        const res = await usecase.updateQuartier(1, { nom_quartier: "X" })
        assert.equal(res.ok, false)
        assert.equal((res as any).reason, "not_found")
    })

    test("updateQuartier applique les changements", async () => {
        const repo = createMockRepository({ findOneBy: async () => ({ id_quartier: 1, nom_quartier: "Ancien" }) })
        const usecase = new QuartierUsecase(repo as any)
        const res = await usecase.updateQuartier(1, { nom_quartier: "Nouveau" })
        assert.equal(res.ok, true)
        assert.equal((res as any).quartier.nom_quartier, "Nouveau")
    })

    test("deleteQuartier renvoie false si absent, true si présent", async () => {
        const absent = new QuartierUsecase(createMockRepository({ findOneBy: async () => null }) as any)
        assert.equal(await absent.deleteQuartier(1), false)

        const present = new QuartierUsecase(createMockRepository({ findOneBy: async () => ({ id_quartier: 1 }) }) as any)
        assert.equal(await present.deleteQuartier(1), true)
    })
})
