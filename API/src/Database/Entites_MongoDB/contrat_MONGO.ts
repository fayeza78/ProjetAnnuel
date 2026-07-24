import { Entity, ObjectIdColumn, ObjectId, Column, CreateDateColumn, UpdateDateColumn } from "typeorm"

@Entity("contracts")
export class ContratMongo {

    // _id natif MongoDB : la propriete porte le meme nom que le champ reel,
    // donc TypeORM mappe directement (aucun champ doublon ecrit en base).
    @ObjectIdColumn()
    _id: ObjectId

    @Column("varchar")
    postgres_id: string

    @Column("varchar", { nullable: true })
    pdfUrl: string

    @Column("simple-json", { nullable: true })
    signatureZones: {
        page: number
        x: number
        y: number
        width: number
        height: number
        type: "signature" | "initials"
        assignedTo_postgres_id: string
        label: string
    }[]

    @Column("simple-json", { nullable: true })
    signatures: {
        user_postgres_id: string
        signatureImage: string
        signedAt: Date
        ipAddress: string
        checksum: string
    }[]

    @Column("simple-json", { nullable: true })
    auditTrail: {
        action: string
        user_postgres_id: string
        timestamp: Date
        details: string
    }[]

    @Column({ type: "varchar", nullable: true, default: "pending" })
    status: "pending" | "partially_signed" | "signed" | "archived"

    @CreateDateColumn()
    createdAt: Date

    @UpdateDateColumn()
    updatedAt: Date

    constructor(
        _id: ObjectId,
        postgres_id: string,
        pdfUrl: string,
        signatureZones: { page: number; x: number; y: number; width: number; height: number; type: "signature" | "initials"; assignedTo_postgres_id: string; label: string }[],
        signatures: { user_postgres_id: string; signatureImage: string; signedAt: Date; ipAddress: string; checksum: string }[],
        auditTrail: { action: string; user_postgres_id: string; timestamp: Date; details: string }[],
        status: "pending" | "partially_signed" | "signed" | "archived",
        createdAt: Date,
        updatedAt: Date
    ) {
        this._id = _id
        this.postgres_id = postgres_id
        this.pdfUrl = pdfUrl
        this.signatureZones = signatureZones
        this.signatures = signatures
        this.auditTrail = auditTrail
        this.status = status
        this.createdAt = createdAt
        this.updatedAt = updatedAt
    }
}
