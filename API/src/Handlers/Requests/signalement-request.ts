// Interfaces des corps de requetes - domaine SIGNALEMENTS (moderation).

export interface CreateSignalementRequest {
    cible_type: "message" | "service" | "evenement" | "user"
    cible_id: string
    motif?: string
}

export interface TraiterSignalementRequest {
    statut: "ouvert" | "traite" | "rejete"
}
