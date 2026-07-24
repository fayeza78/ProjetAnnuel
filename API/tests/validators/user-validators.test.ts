import { test, describe } from "node:test"
import assert from "node:assert/strict"
import {
    CreateUserValidator,
    LoginValidator,
    UpdateUserValidator
} from "../../src/Handlers/Validators/user-validators.js"

describe("CreateUserValidator", () => {
    const valide = {
        email: "jean@example.fr",
        password: "motdepasse123",
        adresse: "12 rue des Fleurs",
        ville: "Paris",
        cp: "75018",
        nom_quartier: "Montmartre"
    }

    test("accepte un payload valide", () => {
        const { error } = CreateUserValidator.validate(valide)
        assert.equal(error, undefined)
    })

    test("rejette un email mal formé", () => {
        const { error } = CreateUserValidator.validate({ ...valide, email: "pasunmail" })
        assert.ok(error)
    })

    test("rejette un mot de passe trop court (< 8)", () => {
        const { error } = CreateUserValidator.validate({ ...valide, password: "court" })
        assert.ok(error)
    })

    test("rejette un code postal non numérique", () => {
        const { error } = CreateUserValidator.validate({ ...valide, cp: "ABCDE" })
        assert.ok(error)
    })

    test("rejette un code postal de mauvaise longueur", () => {
        const { error } = CreateUserValidator.validate({ ...valide, cp: "750" })
        assert.ok(error)
    })

    test("rejette un champ obligatoire manquant", () => {
        const { nom_quartier, ...sansQuartier } = valide
        const { error } = CreateUserValidator.validate(sansQuartier)
        assert.ok(error)
    })

    test("n'autorise pas de définir le rôle à l'inscription", () => {
        const { error } = CreateUserValidator.validate({ ...valide, role: "admin" })
        assert.ok(error, "un champ inconnu (role) doit être rejeté")
    })
})

describe("LoginValidator", () => {
    test("accepte email + mot de passe", () => {
        const { error } = LoginValidator.validate({ email: "a@b.fr", password: "motdepasse" })
        assert.equal(error, undefined)
    })

    test("rejette si le mot de passe est absent", () => {
        const { error } = LoginValidator.validate({ email: "a@b.fr" })
        assert.ok(error)
    })
})

describe("UpdateUserValidator", () => {
    test("accepte une mise à jour partielle", () => {
        const { error } = UpdateUserValidator.validate({ ville: "Lyon" })
        assert.equal(error, undefined)
    })

    test("rejette un corps vide (min 1 champ)", () => {
        const { error } = UpdateUserValidator.validate({})
        assert.ok(error)
    })
})
