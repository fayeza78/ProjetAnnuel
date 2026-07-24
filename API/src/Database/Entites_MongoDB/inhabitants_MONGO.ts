import { Entity, ObjectIdColumn, ObjectId, Column, CreateDateColumn, UpdateDateColumn } from "typeorm"

@Entity("inhabitants")
export class InhabitantMongo {

    // _id natif MongoDB : la propriete porte le meme nom que le champ reel,
    // donc TypeORM mappe directement (aucun champ doublon ecrit en base).
    @ObjectIdColumn()
    _id: ObjectId

    @Column("varchar")
    postgres_id: string

    @Column("varchar", { nullable: true })
    avatarUrl: string

    @Column("varchar", { nullable: true })
    bio: string

    @Column("simple-array", { nullable: true })
    interests: string[]

    @Column("simple-json", { nullable: true })
    gdpr: {
        consentDate: Date
        exportRequestedAt: Date | null
        deletionRequestedAt: Date | null
    }

    @Column("int", { default: 0 })
    points: number

    @CreateDateColumn()
    createdAt: Date

    @UpdateDateColumn()
    updatedAt: Date

    constructor(
        _id: ObjectId,
        postgres_id: string,
        avatarUrl: string,
        bio: string,
        interests: string[],
        gdpr: { consentDate: Date; exportRequestedAt: Date | null; deletionRequestedAt: Date | null },
        points: number,
        createdAt: Date,
        updatedAt: Date
    ) {
        this._id = _id
        this.postgres_id = postgres_id
        this.avatarUrl = avatarUrl
        this.bio = bio
        this.interests = interests
        this.gdpr = gdpr
        this.points = points
        this.createdAt = createdAt
        this.updatedAt = updatedAt
    }
}
