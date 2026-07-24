// Interfaces des corps de requetes - domaine INCIDENTS (client Java).

export interface CreateIncidentRequest {
    description: string
    type?: "incident" | "alerte"
    gravite?: "faible" | "moyenne" | "haute" | "critique"
}

export interface UpdateIncidentStatutRequest {
    statut: "ouvert" | "en_cours" | "resolu" | "ferme"
}
