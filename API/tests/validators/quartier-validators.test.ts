import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { CreateQuartierValidator, UpdateQuartierValidator } from "../../src/Handlers/Validators/quartier-validators.js"

describe("CreateQuartierValidator", () => {
    test("accepte un nom seul", () => {
        const { error } = CreateQuartierValidator.validate({ nom_quartier: "Montmartre" })
        assert.equal(error, undefined)
    })

    test("rejette un nom absent", () => {
        const { error } = CreateQuartierValidator.validate({ limite_geo: "POLYGON(...)" })
        assert.ok(error)
    })

    test("rejette un nom > 100 caractères", () => {
        const { error } = CreateQuartierValidator.validate({ nom_quartier: "x".repeat(101) })
        assert.ok(error)
    })
})

describe("UpdateQuartierValidator", () => {
    test("accepte une mise à jour partielle", () => {
        const { error } = UpdateQuartierValidator.validate({ nom_quartier: "Belleville" })
        assert.equal(error, undefined)
    })

    test("rejette un corps vide", () => {
        const { error } = UpdateQuartierValidator.validate({})
        assert.ok(error)
    })
})
