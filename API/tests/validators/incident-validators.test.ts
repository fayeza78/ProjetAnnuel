import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { CreateIncidentValidator, UpdateIncidentValidator } from "../../src/Handlers/Validators/incident-validators.js"

describe("CreateIncidentValidator", () => {
    test("accepte une description", () => {
        const { error } = CreateIncidentValidator.validate({ description: "Lampadaire cassé" })
        assert.equal(error, undefined)
    })

    test("accepte type et gravité valides", () => {
        const { error } = CreateIncidentValidator.validate({ description: "Fuite", type: "alerte", gravite: "critique" })
        assert.equal(error, undefined)
    })

    test("rejette une description absente", () => {
        const { error } = CreateIncidentValidator.validate({})
        assert.ok(error)
    })

    test("rejette une description > 1000 caractères", () => {
        const { error } = CreateIncidentValidator.validate({ description: "x".repeat(1001) })
        assert.ok(error)
    })

    test("rejette un type hors enum", () => {
        const { error } = CreateIncidentValidator.validate({ description: "x", type: "bug" })
        assert.ok(error)
    })

    test("rejette une gravité hors enum", () => {
        const { error } = CreateIncidentValidator.validate({ description: "x", gravite: "enorme" })
        assert.ok(error)
    })
})

describe("UpdateIncidentValidator", () => {
    test("accepte un statut valide", () => {
        const { error } = UpdateIncidentValidator.validate({ statut: "resolu" })
        assert.equal(error, undefined)
    })

    test("rejette un statut hors enum", () => {
        const { error } = UpdateIncidentValidator.validate({ statut: "clos" })
        assert.ok(error)
    })

    test("rejette l'absence de statut", () => {
        const { error } = UpdateIncidentValidator.validate({})
        assert.ok(error)
    })
})
