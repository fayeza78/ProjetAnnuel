import { Entity, ObjectIdColumn, ObjectId, Column, CreateDateColumn, UpdateDateColumn } from "typeorm"

@Entity("events")
export class EventMongo {

    // _id natif MongoDB : la propriete porte le meme nom que le champ reel,
    // donc TypeORM mappe directement (aucun champ doublon ecrit en base).
    @ObjectIdColumn()
    _id: ObjectId

    @Column("varchar")
    postgres_id: string

    @Column("varchar")
    title_event: string

    @Column("varchar", { nullable: true })
    description: string

    @Column("simple-array", { nullable: true })
    photos: string[]

    @Column("simple-array", { nullable: true })
    tags: string[]

    // infos pratiques saisies a la creation (affichage, pas de logique)
    @Column("varchar", { nullable: true })
    lieu?: string

    @Column("varchar", { nullable: true })
    heure?: string

    @Column("varchar", { nullable: true })
    duree?: string

    @Column("varchar", { nullable: true })
    ageRecommande?: string

    // points d'entraide gagnes en confirmant sa presence (0 = evenement gratuit)
    @Column("int", { default: 0 })
    points?: number

    @Column("simple-json", { nullable: true })
    participants: {
        inhabitant_postgres_id: string
        firstName: string
        status: "interested" | "confirmed" | "declined"
        joinedAt: Date
        pointsAwarded?: boolean   // points deja credites (anti double-credit)
    }[]

    @Column("simple-json", { nullable: true })
    comments: {
        inhabitant_postgres_id: string
        firstName: string
        content: string
        createdAt: Date
    }[]

    @Column("simple-json", { nullable: true })
    creator: {
        postgres_id: string
        firstName: string
        lastName: string
        avatarUrl: string
    }

    @CreateDateColumn()
    createdAt: Date

    @UpdateDateColumn()
    updatedAt: Date

    constructor(
        _id: ObjectId,
        postgres_id: string,
        title_event: string,
        description: string,
        photos: string[],
        tags: string[],
        participants: {
            inhabitant_postgres_id: string
            firstName: string
            status: "interested" | "confirmed" | "declined"
            joinedAt: Date
        }[],
        comments: {
            inhabitant_postgres_id: string
            firstName: string
            content: string
            createdAt: Date
        }[],
        creator: {
            postgres_id: string
            firstName: string
            lastName: string
            avatarUrl: string
        },
        createdAt: Date,
        updatedAt: Date
    ) {
        this._id = _id
        this.postgres_id = postgres_id
        this.title_event = title_event
        this.description = description
        this.photos = photos
        this.tags = tags
        this.participants = participants
        this.comments = comments
        this.creator = creator
        this.createdAt = createdAt
        this.updatedAt = updatedAt
    }
}
