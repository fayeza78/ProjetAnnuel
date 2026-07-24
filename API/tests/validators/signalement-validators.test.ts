import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { CreateSignalementValidator, TraiterSignalementValidator } from "../../src/Handlers/Validators/signalement-validators.js"

describe("CreateSignalementValidator", () => {
    test("accepte un signalement valide", () => {
        const { error } = CreateSignalementValidator.validate({ cible_type: "message", cible_id: "m1", motif: "spam" })
        assert.equal(error, undefined)
    })

    test("rejette un cible_type hors enum", () => {
        const { error } = CreateSignalementValidator.validate({ cible_type: "photo", cible_id: "x" })
        assert.ok(error)
    })

    test("rejette l'absence de cible_id", () => {
        const { error } = CreateSignalementValidator.validate({ cible_type: "user" })
        assert.ok(error)
    })
})

describe("TraiterSignalementValidator", () => {
    test("accepte un statut valide", () => {
        const { error } = TraiterSignalementValidator.validate({ statut: "traite" })
        assert.equal(error, undefined)
    })

    test("rejette un statut hors enum", () => {
        const { error } = TraiterSignalementValidator.validate({ statut: "ferme" })
        assert.ok(error)
    })
})
