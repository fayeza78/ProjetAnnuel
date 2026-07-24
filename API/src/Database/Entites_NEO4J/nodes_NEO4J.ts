// --- Node interfaces ----------------------------------------------------------
// Chaque node stocke uniquement l'identifiant PostgreSQL + les champs utiles
// pour Cypher sans avoir a joindre sur Postgres.

export interface UserNode {
    postgres_id: string   // = User.id_user.toString()
    email: string
    role: string          // "user" | "moderateur" | "admin"
    nom_quartier?: string // denormalise pour les filtres de proximite
}

export interface EventNode {
    postgres_id: string   // = Evenement.id_evenement.toString()
    titre: string
    type?: string         // "soiree" | "atelier" | "collecte" ...
    date_?: string        // ISO string
}

export interface ServiceNode {
    postgres_id: string   // = Service.id_service.toString()
    type: string
    categorie?: string
    prix?: number         // 0 = gratuit, >0 = payant en points
}

export interface QuartierNode {
    postgres_id: string   // = Quartier.id_quartier.toString()
    nom_quartier: string
}

export interface TagNode {
    name: string          // ex: "jardinage", "informatique", "musique"
}

// --- Relationship property interfaces ----------------------------------------

export interface A_AIDE_Props {
    service_postgres_id: string
    points: number
    date: string          // ISO string
}

export interface A_PARTICIPE_Props {
    status: "interested" | "confirmed" | "declined"
    joinedAt: string      // ISO string
}

export interface A_NOTE_Props {
    rating: number        // 1-5
    date: string
}

export interface HABITE_DANS_Props {
    depuis: string        // ISO string
}
