import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"

// chiffre les secrets TOTP avant stockage en base (AES-256-GCM), la cle vient de MFA_ENC_KEY
// format stocke : "enc:v1:" + base64(iv | authTag | ciphertext)
// les vieux secrets en clair restent lisibles. attention : changer la cle rend
// les secrets deja chiffres illisibles

const PREFIXE = "enc:v1:"

function cle(): Buffer {
    const brut = process.env.MFA_ENC_KEY || process.env.JWT_SECRET || "dev-insecure-secret-change-me"
    return createHash("sha256").update(brut).digest()
}

export function chiffrerSecret(clair: string): string {
    const iv = randomBytes(12)
    const cipher = createCipheriv("aes-256-gcm", cle(), iv)
    const chiffre = Buffer.concat([cipher.update(clair, "utf8"), cipher.final()])
    const tag = cipher.getAuthTag()
    return PREFIXE + Buffer.concat([iv, tag, chiffre]).toString("base64")
}

// renvoie le secret en clair. si on n'arrive pas a dechiffrer (cle changee,
// donnee corrompue) on renvoie une chaine vide et le code TOTP sera juste refuse
export function dechiffrerSecret(stocke: string | null | undefined): string {
    if (!stocke) return ""
    if (!stocke.startsWith(PREFIXE)) return stocke // ancien format : secret en clair

    try {
        const buf = Buffer.from(stocke.slice(PREFIXE.length), "base64")
        const iv = buf.subarray(0, 12)
        const tag = buf.subarray(12, 28)
        const donnees = buf.subarray(28)
        const decipher = createDecipheriv("aes-256-gcm", cle(), iv)
        decipher.setAuthTag(tag)
        return Buffer.concat([decipher.update(donnees), decipher.final()]).toString("utf8")
    } catch {
        return ""
    }
}
