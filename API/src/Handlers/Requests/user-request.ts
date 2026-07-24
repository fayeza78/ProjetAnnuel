// Interfaces des corps de requetes - domaine USERS (inscription, profil,
// back-office, notation, centres d'interet).

export interface CreateUserRequest {
    email: string
    password: string
    adresse: string
    ville: string
    cp: string
    nom_quartier: string
    // Pas de champ `role` : l'inscription publique ne peut pas choisir son role.
}

export interface UpdateUserRequest {
    adresse?: string
    ville?: string
    cp?: string
    telephone?: string
    langue?: string
}

export interface UpdateRoleRequest {
    role: "user" | "moderateur" | "admin"
}

export interface VoteBlockRequest {
    blocked: boolean
}

export interface NoterVoisinRequest {
    rating: number             // 1 a 5 - relation A_NOTE (Neo4j)
}

export interface SetInteretsRequest {
    interests: string[]        // max 10 tags, normalises en minuscules
}
