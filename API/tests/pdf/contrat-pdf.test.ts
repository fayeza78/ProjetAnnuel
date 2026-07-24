import { test, describe, after } from "node:test"
import assert from "node:assert/strict"
import { createHash } from "crypto"
import { existsSync, readFileSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import {
    remplirTemplateContrat, genererPdfContrat, genererDocumentsContrat,
    type ContratPdfData, type SignaturePdf
} from "../../src/Pdf/contrat-pdf.js"

// Generation du contrat d'un service payant par l'API :
// gabarit HTML a balises {{...}} rempli, puis converti en PDF A4 par un
// Chromium sans interface (puppeteer-core). Les tests qui produisent un vrai
// PDF sont sautes si Chromium n'est pas installe (il l'est dans l'image Docker).

const chromiumAbsent = !process.env.PUPPETEER_EXECUTABLE_PATH
    && !["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"].some(existsSync)

const donnees: ContratPdfData = {
    numeroContrat: "TEST-1234",
    dateContrat: new Date("2026-07-21T12:00:00Z"),
    service: { id: 7, nom: "Garde d'animaux (chats & chiens)" },
    prestataire: { id: 1, email: "prestataire@email.fr" },
    demandeur: { id: 2, email: "demandeur@email.fr" },
    prix: 50
}

// PNG 1x1 minimal, sert de faux trace de signature
const PNG_1x1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

const signatures: SignaturePdf[] = [
    { role: "prestataire", imageDataUri: "data:image/png;base64," + PNG_1x1,
      signataire: "presta@email.fr", signedAt: new Date("2026-07-23T11:00:00Z"), ipAddress: "10.0.0.1" },
    { role: "demandeur", imageDataUri: "data:image/png;base64," + PNG_1x1,
      signataire: "demandeur@email.fr", signedAt: new Date("2026-07-23T12:00:00Z"), ipAddress: "10.0.0.2" }
]

describe("remplirTemplateContrat (gabarit HTML à balises)", () => {
    const html = remplirTemplateContrat(donnees)

    test("remplit toutes les balises (aucun {{...}} restant)", () => {
        assert.equal(/\{\{[A-Z_]+\}\}/.test(html), false)
    })

    test("injecte les vraies données : parties, prix, numéro, date", () => {
        assert.ok(html.includes("prestataire@email.fr"))
        assert.ok(html.includes("demandeur@email.fr"))
        assert.ok(html.includes("50 points"))
        assert.ok(html.includes("TEST-1234"))
        assert.ok(html.includes("21/07/2026"))
    })

    test("échappe le HTML des valeurs injectées (anti-XSS)", () => {
        // Le " & " de la categorie doit devenir &amp; - jamais du HTML brut.
        assert.ok(html.includes("Garde d&#39;animaux (chats &amp; chiens)"))
        const malveillant = remplirTemplateContrat({
            ...donnees,
            service: { id: 7, nom: "<script>alert(1)</script>" }
        })
        assert.equal(malveillant.includes("<script>alert(1)</script>"), false)
        assert.ok(malveillant.includes("&lt;script&gt;"))
    })

    test("sans signature : les cadres restent vides (aucune balise <img>)", () => {
        assert.equal(html.includes("<img"), false)
    })

    test("insère l'image et la preuve (qui, quand, IP) de chaque signature", () => {
        const signe = remplirTemplateContrat(donnees, signatures)
        assert.equal((signe.match(/<img class="image-signature"/g) ?? []).length, 2)
        assert.ok(signe.includes("data:image/png;base64," + PNG_1x1))
        assert.ok(signe.includes("10.0.0.1") && signe.includes("10.0.0.2"))
        assert.ok(signe.includes("presta@email.fr"))
    })

    test("échappe aussi la preuve de signature (anti-XSS sur le signataire)", () => {
        const signe = remplirTemplateContrat(donnees, [{
            ...signatures[0]!, signataire: "<img src=x onerror=alert(1)>"
        }])
        assert.equal(signe.includes("<img src=x"), false)
        assert.ok(signe.includes("&lt;img src=x"))
    })
})

describe("genererPdfContrat (conversion Chromium)", { skip: chromiumAbsent && "Chromium non installé" }, () => {
    test("produit un PDF valide", async () => {
        const pdf = await genererPdfContrat(donnees)
        const texte = pdf.toString("latin1")
        assert.ok(texte.startsWith("%PDF-"), "doit commencer par %PDF-")
        assert.ok(texte.includes("%%EOF"), "doit contenir le marqueur de fin %%EOF")
        assert.ok(pdf.length > 5_000, "un contrat d'une page fait plusieurs Ko")
    })

    test("les signatures grossissent le fichier (images + preuves embarquées)", async () => {
        const vide = await genererPdfContrat(donnees)
        const signe = await genererPdfContrat(donnees, signatures)
        assert.ok(signe.length > vide.length)
    })
})

describe("genererDocumentsContrat (écriture disque)", { skip: chromiumAbsent && "Chromium non installé" }, () => {
    const dossier = join(tmpdir(), `cn-pdf-test-${process.pid}`)
    after(() => rmSync(dossier, { recursive: true, force: true }))

    test("écrit le PDF et le HTML, renvoie leurs URL publiques + checksum", async () => {
        const { pdfUrl, htmlUrl, checksum } = await genererDocumentsContrat(donnees, dossier, signatures)
        assert.equal(pdfUrl, "/uploads/contrats/contrat-TEST-1234.pdf")
        assert.equal(htmlUrl, "/uploads/contrats/contrat-TEST-1234.html")

        const cheminPdf = join(dossier, "contrat-TEST-1234.pdf")
        const cheminHtml = join(dossier, "contrat-TEST-1234.html")
        assert.ok(existsSync(cheminPdf) && existsSync(cheminHtml))
        const pdf = readFileSync(cheminPdf)
        assert.ok(pdf.subarray(0, 5).toString() === "%PDF-")

        const trace = readFileSync(cheminHtml, "utf-8")
        assert.ok(trace.includes("prestataire@email.fr"))
        // la trace HTML garde aussi les signatures inserees
        assert.ok(trace.includes("data:image/png"))

        // Le checksum renvoye = SHA-256 des octets reellement ecrits sur disque
        // (preuve d'integrite du document original, tracee dans l'audit du contrat).
        assert.equal(checksum, createHash("sha256").update(pdf).digest("hex"))
    })
})
