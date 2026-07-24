// Interfaces des corps de requetes - domaine QUARTIERS.

export interface CreateQuartierRequest {
    nom_quartier: string
    limite_geo?: string        // polygone GeoJSON (chevauchement verifie au usecase)
}

export interface UpdateQuartierRequest {
    nom_quartier?: string
    limite_geo?: string
}
