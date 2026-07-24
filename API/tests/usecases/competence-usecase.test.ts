import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { CompetenceUsecase } from "../../src/Usecases/competence-usecase.js"
import { createMockRepository } from "../helpers/mockRepository.js"

function build(compRepo?: any, userRepo?: any) {
    return new CompetenceUsecase(
        (compRepo ?? createMockRepository()) as any,
        (userRepo ?? createMockRepository()) as any
    )
}

describe("CompetenceUsecase.createCompetence", () => {
    test("renvoie null si l'utilisateur n'existe pas", async () => {
        const usecase = build(createMockRepository(), createMockRepository({ findOneBy: async () => null }))
        assert.equal(await usecase.createCompetence("Plomberie", 1), null)
    })

    test("crée la compétence rattachée à l'utilisateur", async () => {
        const usecase = build(
            createMockRepository(),
            createMockRepository({ findOneBy: async () => ({ id_user: 1 }) })
        )
        const c = await usecase.createCompetence("Plomberie", 1)
        assert.equal((c as any).libelle, "Plomberie")
        assert.equal((c as any).user.id_user, 1)
    })
})

describe("CompetenceUsecase.deleteCompetence", () => {
    test("renvoie false si introuvable", async () => {
        const usecase = build(createMockRepository({ findOne: async () => null }))
        assert.equal(await usecase.deleteCompetence(1, 1, "user"), false)
    })

    test("refuse si l'utilisateur n'est ni propriétaire ni admin", async () => {
        const usecase = build(createMockRepository({ findOne: async () => ({ id_comp: 1, user: { id_user: 2 } }) }))
        assert.equal(await usecase.deleteCompetence(1, 999, "user"), false)
    })

    test("autorise le propriétaire", async () => {
        let softDeleteAppele = false
        const usecase = build(createMockRepository({
            findOne: async () => ({ id_comp: 1, user: { id_user: 5 } }),
            softDelete: async () => { softDeleteAppele = true; return { affected: 1 } }
        }))
        assert.equal(await usecase.deleteCompetence(1, 5, "user"), true)
        assert.equal(softDeleteAppele, true)
    })

    test("autorise un admin même s'il n'est pas propriétaire", async () => {
        const usecase = build(createMockRepository({ findOne: async () => ({ id_comp: 1, user: { id_user: 2 } }) }))
        assert.equal(await usecase.deleteCompetence(1, 999, "admin"), true)
    })
})
