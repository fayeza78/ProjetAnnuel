import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { analyserRequete } from "../../src/Query/queryLanguage.js"

// Le langage maison compile une requete texte en { collection, filtreMongo, limite }.
describe("analyserRequete — requêtes valides", () => {
    test("FIND simple", () => {
        assert.deepEqual(analyserRequete("FIND events"), { collection: "events", filtreMongo: {}, limite: null })
    })

    test("FIND avec LIMIT", () => {
        assert.deepEqual(analyserRequete("FIND events LIMIT 5"), { collection: "events", filtreMongo: {}, limite: 5 })
    })

    test("égalité sur une chaîne", () => {
        assert.deepEqual(analyserRequete('FIND events WHERE title = "Concert"'), {
            collection: "events", filtreMongo: { title: "Concert" }, limite: null
        })
    })

    test("comparaison numérique >", () => {
        assert.deepEqual(analyserRequete("FIND services WHERE prix > 0"), {
            collection: "services", filtreMongo: { prix: { $gt: 0 } }, limite: null
        })
    })

    test("opérateurs >=, <=, !=", () => {
        assert.deepEqual(analyserRequete("FIND services WHERE prix >= 2").filtreMongo, { prix: { $gte: 2 } })
        assert.deepEqual(analyserRequete("FIND services WHERE prix <= 9").filtreMongo, { prix: { $lte: 9 } })
        assert.deepEqual(analyserRequete('FIND votes WHERE status != "closed"').filtreMongo, { status: { $ne: "closed" } })
    })

    test("CONTAINS → regex insensible à la casse", () => {
        assert.deepEqual(analyserRequete('FIND events WHERE tags CONTAINS "musique"').filtreMongo, {
            tags: { $regex: "musique", $options: "i" }
        })
    })

    test("booléen", () => {
        assert.deepEqual(analyserRequete("FIND votes WHERE isAnonymous = true").filtreMongo, { isAnonymous: true })
    })

    test("conjonction AND", () => {
        assert.deepEqual(analyserRequete('FIND events WHERE type = "soiree" AND title = "X"').filtreMongo, {
            $and: [{ type: "soiree" }, { title: "X" }]
        })
    })

    test("disjonction OR", () => {
        assert.deepEqual(analyserRequete('FIND services WHERE categorie = "a" OR categorie = "b"').filtreMongo, {
            $or: [{ categorie: "a" }, { categorie: "b" }]
        })
    })

    test("WHERE + LIMIT combinés", () => {
        const resultat = analyserRequete('FIND events WHERE tags CONTAINS "jardin" LIMIT 3')
        assert.equal(resultat.collection, "events")
        assert.equal(resultat.limite, 3)
        assert.deepEqual(resultat.filtreMongo, { tags: { $regex: "jardin", $options: "i" } })
    })

    test("mots-clés insensibles à la casse", () => {
        assert.deepEqual(analyserRequete('find events where title = "X"').filtreMongo, { title: "X" })
    })
})

describe("analyserRequete — erreurs de syntaxe", () => {
    test("FIND manquant", () => {
        assert.throws(() => analyserRequete('events WHERE title = "X"'))
    })

    test("condition incomplète (opérateur/valeur manquants)", () => {
        assert.throws(() => analyserRequete("FIND events WHERE title"))
    })

    test("chaîne non terminée", () => {
        assert.throws(() => analyserRequete('FIND events WHERE title = "Concert'))
    })

    test("tokens en trop", () => {
        assert.throws(() => analyserRequete('FIND events WHERE title = "X" GARBAGE'))
    })
})
