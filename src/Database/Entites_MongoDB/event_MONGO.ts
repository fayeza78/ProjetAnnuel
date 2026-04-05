import { Entity, ObjectIdColumn, ObjectId, Column, CreateDateColumn, UpdateDateColumn } from "typeorm"

@Entity("events")
export class EventMongo {

    @ObjectIdColumn()
    id_event_Mongo: ObjectId

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

    @Column("simple-json", { nullable: true })
    participants: {
        inhabitant_postgres_id: string
        firstName: string
        status: "interested" | "confirmed" | "declined"
        joinedAt: Date
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
        id_event_Mongo: ObjectId,
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
        this.id_event_Mongo = id_event_Mongo
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
