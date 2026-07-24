// secret JWT centralise. en prod si le secret manque on crash direct (pas question
// d'utiliser un secret par defaut), en dev/test on tolere un secret de repli

let warned = false

export function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET
    if (secret && secret.length > 0) return secret

    if (process.env.NODE_ENV === "production") {
        throw new Error(
            "JWT_SECRET manquant. Refus de signer/vérifier un token en production avec un secret par défaut."
        )
    }

    if (!warned) {
        console.warn("JWT_SECRET non défini — secret de développement NON SÉCURISÉ utilisé.")
        warned = true
    }
    return "dev-insecure-secret-change-me"
}
