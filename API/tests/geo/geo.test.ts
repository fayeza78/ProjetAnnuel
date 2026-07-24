import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { lirePolygoneGeoJson, pointDansPolygone, polygonesSeChevauchent, type Point } from "../../src/Geo/geo.js"

// Petit carre [x0,y0]-[x1,y1] sous forme d'anneau GeoJSON ferme.
const carre = (x0: number, y0: number, x1: number, y1: number): Point[] =>
    [[x0, y0], [x0, y1], [x1, y1], [x1, y0], [x0, y0]]

describe("geo — lirePolygoneGeoJson", () => {
    test("lit un Polygon GeoJSON", () => {
        const geo = JSON.stringify({ type: "Polygon", coordinates: [[[0, 0], [0, 5], [5, 5], [5, 0], [0, 0]]] })
        const coins = lirePolygoneGeoJson(geo)
        assert.equal(coins?.length, 5)
        assert.deepEqual(coins?.[2], [5, 5])
    })

    test("renvoie null si illisible ou non-polygone", () => {
        assert.equal(lirePolygoneGeoJson(undefined), null)
        assert.equal(lirePolygoneGeoJson("pas du json"), null)
        assert.equal(lirePolygoneGeoJson(JSON.stringify({ type: "Point", coordinates: [1, 2] })), null)
    })
})

describe("geo — pointDansPolygone", () => {
    const grandCarre = carre(0, 0, 10, 10)
    test("point dedans", () => assert.equal(pointDansPolygone([5, 5], grandCarre), true))
    test("point dehors", () => assert.equal(pointDansPolygone([20, 20], grandCarre), false))
})

describe("geo — polygonesSeChevauchent", () => {
    test("deux carrés qui se chevauchent", () => {
        assert.equal(polygonesSeChevauchent(carre(0, 0, 10, 10), carre(5, 5, 15, 15)), true)
    })
    test("deux carrés séparés", () => {
        assert.equal(polygonesSeChevauchent(carre(0, 0, 10, 10), carre(100, 100, 110, 110)), false)
    })
    test("un carré contenu dans un autre", () => {
        assert.equal(polygonesSeChevauchent(carre(0, 0, 100, 100), carre(10, 10, 20, 20)), true)
    })
})
