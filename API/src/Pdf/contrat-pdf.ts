import { createHash } from "crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { createRequire } from "module"

// -----------------------------------------------------------------------------
// Generation du CONTRAT d'un service payant, entierement cote API :
//   1. un gabarit HTML (`templates/contrat-template.html`) contient des balises
//      `{{NUMERO_CONTRAT}}`, `{{PRIX}}`, `{{PRESTATAIRE_EMAIL}}`... que l'API
//      remplit avec les vraies donnees (parties, prix, date), plus deux
//      emplacements ou viennent s'inserer les images de signature ;
//   2. le HTML rempli est converti en PDF A4 par un Chromium sans interface,
//      pilote par la bibliotheque puppeteer-core (meme resultat que "imprimer
//      en PDF" dans un navigateur) ;
//   3. les deux fichiers sont stockes dans `uploads/contrats/` et servis en
//      statique via `/uploads` - le contrat reference leur URL.
// Quand le contrat est signe des deux cotes, le meme gabarit est re-rempli avec
// les signatures et le PDF est regenere par-dessus l'ancien.
// -----------------------------------------------------------------------------

export interface ContratPdfData {
    numeroContrat: string
    dateContrat: Date
    service: { id: number; nom: string }
    prestataire: { id: number; email: string }
    demandeur: { id: number; email: string }
    prix: number
}

// Zones de signature stockees dans le document MongoDB du contrat : elles
// disent QUI doit signer (assignedTo) et donnent un repere d'affichage aux
// clients. La mise en page reelle des cadres vient du gabarit HTML.
export const ZONES_SIGNATURE_CONTRAT = {
    prestataire: { page: 1, x: 70, y: 150, width: 200, height: 80 },
    demandeur: { page: 1, x: 325, y: 150, width: 200, height: 80 }
} as const

const CHEMIN_TEMPLATE = "templates/contrat-template.html"
const DOSSIER_CONTRATS = "uploads/contrats"

// -- Remplissage du gabarit HTML ----------------------------------------------

// Toute valeur injectee dans le HTML est echappee (anti-XSS : un email ou une
// categorie de service ne doit jamais pouvoir injecter de balise).
const echapperHtml = (texte: string) => texte
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;")

const valeursBalises = (donnees: ContratPdfData): Record<string, string> => ({
    NUMERO_CONTRAT: donnees.numeroContrat,
    DATE: donnees.dateContrat.toLocaleDateString("fr-FR"),
    SERVICE_ID: String(donnees.service.id),
    SERVICE_NOM: donnees.service.nom,
    PRIX: String(donnees.prix),
    PRESTATAIRE_EMAIL: donnees.prestataire.email,
    PRESTATAIRE_ID: String(donnees.prestataire.id),
    DEMANDEUR_EMAIL: donnees.demandeur.email,
    DEMANDEUR_ID: String(donnees.demandeur.id)
})

// une signature a inserer dans le contrat, avec sa preuve (qui, quand, IP)
export interface SignaturePdf {
    role: "prestataire" | "demandeur"
    imageDataUri: string        // le trace du canvas, ex: data:image/png;base64,...
    signataire: string
    signedAt: Date
    ipAddress: string
}

// Bloc HTML d'une signature : l'image du trace, et la ligne de preuve dessous.
// Le data URI a deja ete valide par le validator a la signature ; il repasse
// quand meme par echapperHtml avant d'atterrir dans l'attribut src.
const blocSignatureHtml = (signatures: SignaturePdf[], role: "prestataire" | "demandeur"): string => {
    const signature = signatures.find(s => s.role === role)
    if (!signature) return ""
    const preuve = `${signature.signataire} — le ${signature.signedAt.toLocaleString("fr-FR")} — IP ${signature.ipAddress || "inconnue"}`
    return `<img class="image-signature" src="${echapperHtml(signature.imageDataUri)}" alt="Signature">`
        + `<p class="preuve-signature">${echapperHtml(preuve)}</p>`
}

export const remplirTemplateContrat = (data: ContratPdfData, signatures: SignaturePdf[] = []): string => {
    const gabarit = readFileSync(CHEMIN_TEMPLATE, "utf-8")
    const valeurs = valeursBalises(data)
    return gabarit
        // 1er passage : les balises {{...}}, valeurs toujours echappees
        .replace(/\{\{([A-Z_]+)\}\}/g, (_, balise: string) => echapperHtml(valeurs[balise] ?? ""))
        // 2e passage : les emplacements de signature recoivent un bloc HTML
        // construit ci-dessus (il contient une balise <img>, donc insere tel
        // quel : seules ses valeurs internes sont echappees). Les remplacants
        // sont des fonctions pour que "$" dans un email ne soit pas interprete.
        .replace("<!--SIGNATURE_PRESTATAIRE-->", () => blocSignatureHtml(signatures, "prestataire"))
        .replace("<!--SIGNATURE_DEMANDEUR-->", () => blocSignatureHtml(signatures, "demandeur"))
}

// -- Conversion HTML -> PDF (Chromium pilote par puppeteer-core) ---------------

// puppeteer-core ne telecharge aucun navigateur : on pilote le Chromium deja
// installe dans l'image Docker. Charge via require() a la demande, pour que ce
// module reste importable sur un poste ou la bibliotheque n'est pas installee.
const require = createRequire(import.meta.url)

// chemins habituels du Chromium systeme (surchargable par variable d'env)
const CHEMINS_CHROMIUM = ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"]

const trouverChromium = (): string => {
    const chemin = process.env.PUPPETEER_EXECUTABLE_PATH ?? CHEMINS_CHROMIUM.find(existsSync)
    if (!chemin) throw new Error("Chromium introuvable : installez-le ou definissez PUPPETEER_EXECUTABLE_PATH")
    return chemin
}

// Ouvre un Chromium sans interface, charge le HTML rempli et "imprime" en A4.
export const genererPdfContrat = async (data: ContratPdfData, signatures: SignaturePdf[] = []): Promise<Buffer> => {
    const puppeteer = require("puppeteer-core")
    // --no-sandbox : l'API tourne en root dans le conteneur et le bac a sable
    // de Chromium refuse ce cas ; --disable-dev-shm-usage : le /dev/shm des
    // conteneurs est trop petit pour Chromium
    const navigateur = await puppeteer.launch({
        executablePath: trouverChromium(),
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    })
    try {
        const page = await navigateur.newPage()
        // waitUntil "load" : attend que les images (les signatures) soient decodees
        await page.setContent(remplirTemplateContrat(data, signatures), { waitUntil: "load" })
        const pdf = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: { top: "15mm", bottom: "15mm", left: "12mm", right: "12mm" }
        })
        return Buffer.from(pdf)
    } finally {
        await navigateur.close()
    }
}

// -- Ecriture sur disque ------------------------------------------------------

// Genere le PDF + le HTML rempli dans `uploads/contrats/` et renvoie leurs URL
// publiques (servies en statique par `/uploads`) ainsi que l'empreinte SHA-256
// des octets du PDF (preuve d'integrite du document original, tracee dans
// l'audit du contrat). `dossier` est surchargable pour les tests.
export const genererDocumentsContrat = async (
    data: ContratPdfData,
    dossier: string = DOSSIER_CONTRATS,
    signatures: SignaturePdf[] = []
): Promise<{ pdfUrl: string; htmlUrl: string; checksum: string }> => {
    if (!existsSync(dossier)) mkdirSync(dossier, { recursive: true })
    const base = `contrat-${data.numeroContrat}`
    const pdf = await genererPdfContrat(data, signatures)
    writeFileSync(join(dossier, `${base}.pdf`), pdf)
    writeFileSync(join(dossier, `${base}.html`), remplirTemplateContrat(data, signatures), "utf-8")
    return {
        pdfUrl: `/uploads/contrats/${base}.pdf`,
        htmlUrl: `/uploads/contrats/${base}.html`,
        checksum: createHash("sha256").update(pdf).digest("hex")
    }
}
