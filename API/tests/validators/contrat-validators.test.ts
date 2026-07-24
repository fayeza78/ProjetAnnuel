import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { CreateContratValidator, SignerContratValidator } from "../../src/Handlers/Validators/contrat-validators.js"

describe("CreateContratValidator", () => {
    test("accepte id_service + pdfUrl", () => {
        const { error } = CreateContratValidator.validate({ id_service: 1, pdfUrl: "https://x/c.pdf" })
        assert.equal(error, undefined)
    })

    test("applique signatureZones=[] par défaut", () => {
        const { value } = CreateContratValidator.validate({ id_service: 1, pdfUrl: "https://x/c.pdf" })
        assert.deepEqual(value.signatureZones, [])
    })

    test("rejette pdfUrl manquant", () => {
        const { error } = CreateContratValidator.validate({ id_service: 1 })
        assert.ok(error)
    })

    test("rejette une signatureZone incomplète", () => {
        const { error } = CreateContratValidator.validate({
            id_service: 1,
            pdfUrl: "https://x/c.pdf",
            signatureZones: [{ page: 1, x: 0, y: 0 }]
        })
        assert.ok(error)
    })

    test("accepte une signatureZone complète", () => {
        const { error } = CreateContratValidator.validate({
            id_service: 1,
            pdfUrl: "https://x/c.pdf",
            signatureZones: [{
                page: 1, x: 10, y: 20, width: 100, height: 50,
                type: "signature", assignedTo_postgres_id: "2", label: "Prestataire"
            }]
        })
        assert.equal(error, undefined)
    })
})

describe("SignerContratValidator", () => {
    test("accepte une signatureImage", () => {
        const { error } = SignerContratValidator.validate({ signatureImage: "data:image/png;base64,xxx" })
        assert.equal(error, undefined)
    })

    test("rejette l'absence de signatureImage", () => {
        const { error } = SignerContratValidator.validate({})
        assert.ok(error)
    })

    test("tolère et IGNORE l'ancien champ code (MFA retirée de la signature)", () => {
        const { error, value } = SignerContratValidator.validate({
            signatureImage: "data:image/png;base64,xxx", code: "123456"
        })
        assert.equal(error, undefined)
        assert.equal("code" in value, false, "le champ code doit être retiré par stripUnknown")
    })

    test("rejette une signature qui n'est pas une image en data URI", () => {
        assert.ok(SignerContratValidator.validate({ signatureImage: "je signe" }).error)
        assert.ok(SignerContratValidator.validate({ signatureImage: "data:text/html;base64,xxx" }).error)
    })

    test("accepte les autres formats d'image courants", () => {
        assert.equal(SignerContratValidator.validate({ signatureImage: "data:image/jpeg;base64,xxx" }).error, undefined)
        assert.equal(SignerContratValidator.validate({ signatureImage: "data:image/webp;base64,xxx" }).error, undefined)
    })

    test("rejette une signature de plus de 2 Mo", () => {
        const enorme = "data:image/png;base64," + "A".repeat(2_000_001)
        assert.ok(SignerContratValidator.validate({ signatureImage: enorme }).error)
    })
})
