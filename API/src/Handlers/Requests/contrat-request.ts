// Interfaces des corps de requetes - domaine CONTRATS.

export interface SignatureZoneInput {
    page: number
    x: number
    y: number
    width: number
    height: number
    type: "signature" | "initials"
    assignedTo_postgres_id: string
    label: string
}

export interface CreateContratRequest {
    id_service: number
    pdfUrl: string
    signatureZones?: SignatureZoneInput[]
}

export interface SignerContratRequest {
    signatureImage: string     // PNG base64
}
