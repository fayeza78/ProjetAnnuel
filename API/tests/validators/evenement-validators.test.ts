import { test, describe } from "node:test"
import assert from "node:assert/strict"
import {
    CreateEvenementValidator,
    UpdateEvenementValidator,
    ParticiperValidator
} from "../../src/Handlers/Validators/evenement-validators.js"

describe("CreateEvenementValidator", () => {
    test("accepte un titre seul", () => {
        const { error } = CreateEvenementValidator.validate({ titre: "Vide-grenier" })
        assert.equal(error, undefined)
    })

    test("rejette un titre absent", () => {
        const { error } = CreateEvenementValidator.validate({ type: "social" })
        assert.ok(error)
    })

    test("rejette un titre > 50 caractères", () => {
        const { error } = CreateEvenementValidator.validate({ titre: "x".repeat(51) })
        assert.ok(error)
    })
})

describe("UpdateEvenementValidator", () => {
    test("accepte un statut valide", () => {
        const { error } = UpdateEvenementValidator.validate({ statut: "annule" })
        assert.equal(error, undefined)
    })

    test("rejette un statut hors enum", () => {
        const { error } = UpdateEvenementValidator.validate({ statut: "reporte" })
        assert.ok(error)
    })

    test("rejette un corps vide", () => {
        const { error } = UpdateEvenementValidator.validate({})
        assert.ok(error)
    })
})

describe("ParticiperValidator", () => {
    test("accepte un status valide", () => {
        const { error } = ParticiperValidator.validate({ status: "confirmed" })
        assert.equal(error, undefined)
    })

    test("rejette un status hors enum", () => {
        const { error } = ParticiperValidator.validate({ status: "maybe" })
        assert.ok(error)
    })
})
