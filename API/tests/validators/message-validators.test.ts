import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { CreateConversationValidator, SendMessageValidator } from "../../src/Handlers/Validators/message-validators.js"

describe("CreateConversationValidator", () => {
    test("accepte une liste de destinataires", () => {
        const { error } = CreateConversationValidator.validate({ recipient_postgres_ids: ["2", "3"] })
        assert.equal(error, undefined)
    })

    test("rejette une liste vide", () => {
        const { error } = CreateConversationValidator.validate({ recipient_postgres_ids: [] })
        assert.ok(error)
    })
})

describe("SendMessageValidator", () => {
    test("accepte un message avec contenu seul", () => {
        const { error } = SendMessageValidator.validate({ content: "Bonjour" })
        assert.equal(error, undefined)
    })

    test("accepte un message avec pièce jointe seule", () => {
        const { error } = SendMessageValidator.validate({
            mediaAttachments: [{ type: "photo", url: "https://x/p.jpg", size: 1000, mimeType: "image/jpeg" }]
        })
        assert.equal(error, undefined)
    })

    test("rejette un message sans contenu ni pièce jointe (.or)", () => {
        const { error } = SendMessageValidator.validate({})
        assert.ok(error)
    })

    test("rejette une pièce jointe avec une url non valide", () => {
        const { error } = SendMessageValidator.validate({
            mediaAttachments: [{ type: "photo", url: "pas-une-url", size: 1, mimeType: "image/jpeg" }]
        })
        assert.ok(error)
    })

    test("rejette un type de média hors enum", () => {
        const { error } = SendMessageValidator.validate({
            mediaAttachments: [{ type: "gif", url: "https://x/p.gif", size: 1, mimeType: "image/gif" }]
        })
        assert.ok(error)
    })
})
