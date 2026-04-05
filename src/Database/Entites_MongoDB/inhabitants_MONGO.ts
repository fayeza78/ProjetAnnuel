import { Entity, ObjectIdColumn, ObjectId, Column, CreateDateColumn, UpdateDateColumn } from "typeorm"

@Entity("inhabitants")
export class InhabitantMongo {

    @ObjectIdColumn()
    id_inhabitant_Mongo: ObjectId

    @Column("varchar")
    postgres_id: string

    @Column("varchar", { nullable: true })
    avatarUrl: string

    @Column("varchar", { nullable: true })
    bio: string

    @Column("simple-json", { nullable: true })
    coordinates: {
        lat: number
        lng: number
    }

    @Column("simple-array", { nullable: true })
    interests: string[]

    @Column("simple-array", { nullable: true })
    servicesOffered: string[]

    @Column("simple-json", { nullable: true })
    ratings: {
        average: number
        count: number
    }

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
        id_inhabitant_Mongo: ObjectId,
        postgres_id: string,
        avatarUrl: string,
        bio: string,
        coordinates: { lat: number; lng: number },
        interests: string[],
        servicesOffered: string[],
        ratings: { average: number; count: number },
        gdpr: { consentDate: Date; exportRequestedAt: Date | null; deletionRequestedAt: Date | null },
        points: number,
        createdAt: Date,
        updatedAt: Date
    ) {
        this.id_inhabitant_Mongo = id_inhabitant_Mongo
        this.postgres_id = postgres_id
        this.avatarUrl = avatarUrl
        this.bio = bio
        this.coordinates = coordinates
        this.interests = interests
        this.servicesOffered = servicesOffered
        this.ratings = ratings
        this.gdpr = gdpr
        this.points = points
        this.createdAt = createdAt
        this.updatedAt = updatedAt
    }
}
