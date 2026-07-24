// Interfaces des corps de requetes - domaine EVENEMENTS.

export interface CreateEvenementRequest {
    titre: string
    date_?: Date
    type?: string
    description?: string
    interests?: string[]   // centres d'interet de l'evenement (tags -> recommandations)
    lieu?: string
    heure?: string
    duree?: string
    ageRecommande?: string
    points?: number        // points gagnes en confirmant sa presence (0 = gratuit)
}

export interface UpdateEvenementRequest {
    titre?: string
    date_?: Date
    type?: string
    statut?: "actif" | "annule" | "termine"
}

export interface ParticiperRequest {
    status: "interested" | "confirmed" | "declined"   // le " swipe "
}

export interface CommentaireRequest {
    content: string
}

export interface PhotoRequest {
    url: string                // typiquement issue de POST /upload (/uploads/...)
}

export interface TagRequest {
    tag: string                // aussi pousse dans Neo4j (A_TAG -> recommandations)
}
