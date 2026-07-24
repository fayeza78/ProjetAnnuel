// Interfaces des corps de requetes - domaine SERVICES.

export interface CreateServiceRequest {
    type: "offre" | "demande"
    categorie?: string
    date_?: Date               // converti par Joi (date ISO)
    prix?: number              // points (0 = gratuit)
    description?: string       // stockee dans la fiche MongoDB (pas de colonne PG)
}

export interface UpdateServiceRequest {
    categorie?: string
    date_?: Date
    prix?: number
    statut?: "disponible" | "en_cours" | "termine" | "annule"
}

export interface TerminerServiceRequest {
    id_demandeur?: number      // sinon : premiere demande du service
}
