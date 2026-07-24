// Interfaces des corps de requetes - domaine SYNC (client Java offline-first).

// Un incident tel qu'envoye par le client Java. Les champs sont volontairement
// tous optionnels sauf structure minimale : le client peut pousser des creations
// (sans id) comme des mises a jour (avec id) - voir SyncUsecase.push.
export interface IncidentSyncItem {
    id_incident?: number
    description?: string
    statut?: string
    type?: string
    gravite?: string
    updatedAt?: string         // ISO - arbitre du last-write-wins
    id_user?: number
}

export interface SyncPushRequest {
    incidents: IncidentSyncItem[]
}
