import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { RefreshTokenValidator, SsoExchangeValidator, VoteBlockValidator } from "../../src/Handlers/Validators/user-validators.js"
import { ConsentementValidator } from "../../src/Handlers/Validators/gdpr-validators.js"
import { QueryValidator } from "../../src/Handlers/Validators/query-validators.js"
import { TerminerServiceValidator } from "../../src/Handlers/Validators/service-validators.js"
import { SyncPushValidator } from "../../src/Handlers/Validators/sync-validators.js"
import { CreateCompetenceValidator } from "../../src/Handlers/Validators/competence-validators.js"

// Validators crees lors de l'harmonisation " interface + validator sur chaque
// route " : ils remplacent les anciens checks manuels des handlers.

describe("RefreshTokenValidator (refresh / logout)", () => {
    test("accepte un refresh_token", () => {
        assert.equal(RefreshTokenValidator.validate({ refresh_token: "abc-123" }).error, undefined)
    })
    test("rejette un corps vide", () => {
        assert.ok(RefreshTokenValidator.validate({}).error)
    })
})

describe("SsoExchangeValidator", () => {
    test("accepte un sso_ticket", () => {
        assert.equal(SsoExchangeValidator.validate({ sso_ticket: "t-1" }).error, undefined)
    })
    test("rejette l'absence de ticket", () => {
        assert.ok(SsoExchangeValidator.validate({}).error)
    })
})

describe("VoteBlockValidator (modération)", () => {
    test("accepte un booléen", () => {
        assert.equal(VoteBlockValidator.validate({ blocked: true }).error, undefined)
    })
    test("rejette la chaîne \"true\" (strict)", () => {
        assert.ok(VoteBlockValidator.validate({ blocked: "true" }).error)
    })
    test("rejette un corps vide", () => {
        assert.ok(VoteBlockValidator.validate({}).error)
    })
})

describe("ConsentementValidator (RGPD)", () => {
    test("accepte true et false", () => {
        assert.equal(ConsentementValidator.validate({ consentement: true }).error, undefined)
        assert.equal(ConsentementValidator.validate({ consentement: false }).error, undefined)
    })
    test("rejette un non-booléen (strict)", () => {
        assert.ok(ConsentementValidator.validate({ consentement: "oui" }).error)
        assert.ok(ConsentementValidator.validate({}).error)
    })
})

describe("QueryValidator (langage maison)", () => {
    test("accepte une requête texte", () => {
        assert.equal(QueryValidator.validate({ query: "FIND events LIMIT 5" }).error, undefined)
    })
    test("rejette l'absence de query ou une query vide", () => {
        assert.ok(QueryValidator.validate({}).error)
        assert.ok(QueryValidator.validate({ query: "" }).error)
    })
})

describe("TerminerServiceValidator", () => {
    test("accepte un corps vide (id_demandeur optionnel)", () => {
        assert.equal(TerminerServiceValidator.validate({}).error, undefined)
    })
    test("accepte un id_demandeur entier, rejette un non-entier", () => {
        assert.equal(TerminerServiceValidator.validate({ id_demandeur: 5 }).error, undefined)
        assert.ok(TerminerServiceValidator.validate({ id_demandeur: "abc" }).error)
    })
})

describe("SyncPushValidator (client Java)", () => {
    test("accepte un lot mixte création + mise à jour", () => {
        const { error } = SyncPushValidator.validate({
            incidents: [
                { description: "créé hors-ligne", statut: "ouvert" },
                { id_incident: 4, statut: "resolu", updatedAt: "2026-07-15T10:00:00Z" }
            ]
        })
        assert.equal(error, undefined)
    })
    test("tolère des champs additionnels du client (unknown)", () => {
        const { error } = SyncPushValidator.validate({
            incidents: [{ description: "x", sync_status: "pending", localId: 12 }]
        })
        assert.equal(error, undefined)
    })
    test("rejette l'absence du tableau incidents", () => {
        assert.ok(SyncPushValidator.validate({}).error)
        assert.ok(SyncPushValidator.validate({ incidents: "pas-un-tableau" }).error)
    })
})

describe("CreateCompetenceValidator", () => {
    test("accepte un libellé", () => {
        assert.equal(CreateCompetenceValidator.validate({ libelle: "Plomberie" }).error, undefined)
    })
    test("rejette l'absence de libellé ou un libellé trop long", () => {
        assert.ok(CreateCompetenceValidator.validate({}).error)
        assert.ok(CreateCompetenceValidator.validate({ libelle: "x".repeat(51) }).error)
    })
})
