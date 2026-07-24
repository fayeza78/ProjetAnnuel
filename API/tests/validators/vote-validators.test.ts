import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { CreateVoteValidator, CastVoteValidator } from "../../src/Handlers/Validators/vote-validators.js"

describe("CreateVoteValidator", () => {
    const valide = {
        question: "Faut-il un banc au square ?",
        type: "single",
        options: ["Oui", "Non"]
    }

    test("accepte un vote valide minimal", () => {
        const { error } = CreateVoteValidator.validate(valide)
        assert.equal(error, undefined)
    })

    test("applique la valeur par défaut isAnonymous=false", () => {
        const { value } = CreateVoteValidator.validate(valide)
        assert.equal(value.isAnonymous, false)
    })

    test("rejette moins de 2 options", () => {
        const { error } = CreateVoteValidator.validate({ ...valide, options: ["Oui"] })
        assert.ok(error)
    })

    test("rejette un type hors enum", () => {
        const { error } = CreateVoteValidator.validate({ ...valide, type: "ranked" })
        assert.ok(error)
    })

    test("rejette une question absente", () => {
        const { question, ...sansQuestion } = valide
        const { error } = CreateVoteValidator.validate(sansQuestion)
        assert.ok(error)
    })

    test("accepte une deadline ISO", () => {
        const { error } = CreateVoteValidator.validate({ ...valide, deadline: "2025-07-01T00:00:00Z" })
        assert.equal(error, undefined)
    })
})

describe("CastVoteValidator", () => {
    test("accepte au moins un optionId", () => {
        const { error } = CastVoteValidator.validate({ optionIds: ["abc"] })
        assert.equal(error, undefined)
    })

    test("rejette un tableau vide", () => {
        const { error } = CastVoteValidator.validate({ optionIds: [] })
        assert.ok(error)
    })

    test("rejette l'absence de optionIds", () => {
        const { error } = CastVoteValidator.validate({})
        assert.ok(error)
    })
})
