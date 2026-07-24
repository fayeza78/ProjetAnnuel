import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { CreateServiceValidator, UpdateServiceValidator } from "../../src/Handlers/Validators/service-validators.js"

describe("CreateServiceValidator", () => {
    test("accepte un type 'offre' seul", () => {
        const { error } = CreateServiceValidator.validate({ type: "offre" })
        assert.equal(error, undefined)
    })

    test("accepte tous les champs optionnels", () => {
        const { error } = CreateServiceValidator.validate({
            type: "offre",
            categorie: "jardinage",
            date_: "2025-07-15",
            prix: 5
        })
        assert.equal(error, undefined)
    })

    test("rejette un prix > 0 sur une demande", () => {
        const { error } = CreateServiceValidator.validate({ type: "demande", prix: 50 })
        assert.ok(error, "une demande payante inverserait le transfert de points")
    })

    test("accepte une demande à prix 0", () => {
        const { error } = CreateServiceValidator.validate({ type: "demande", prix: 0 })
        assert.equal(error, undefined)
    })

    test("accepte une demande sans prix", () => {
        const { error } = CreateServiceValidator.validate({ type: "demande", categorie: "bricolage" })
        assert.equal(error, undefined)
    })

    test("rejette un type hors enum", () => {
        const { error } = CreateServiceValidator.validate({ type: "autre" })
        assert.ok(error)
    })

    test("rejette si type absent", () => {
        const { error } = CreateServiceValidator.validate({ categorie: "x" })
        assert.ok(error)
    })

    test("rejette un prix négatif", () => {
        const { error } = CreateServiceValidator.validate({ type: "offre", prix: -1 })
        assert.ok(error)
    })

    test("rejette le champ 'statut' (non accepté à la création)", () => {
        const { error } = CreateServiceValidator.validate({ type: "offre", statut: "disponible" })
        assert.ok(error, "statut n'est pas dans le schéma de création")
    })
})

describe("UpdateServiceValidator", () => {
    test("accepte une mise à jour de statut valide", () => {
        const { error } = UpdateServiceValidator.validate({ statut: "termine" })
        assert.equal(error, undefined)
    })

    test("rejette un statut hors enum", () => {
        const { error } = UpdateServiceValidator.validate({ statut: "fini" })
        assert.ok(error)
    })

    test("rejette un corps vide", () => {
        const { error } = UpdateServiceValidator.validate({})
        assert.ok(error)
    })
})
