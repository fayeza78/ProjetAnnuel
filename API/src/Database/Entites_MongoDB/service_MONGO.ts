import { Entity, ObjectIdColumn, ObjectId, Column, CreateDateColumn, UpdateDateColumn } from "typeorm"

@Entity("services")
export class ServiceMongo {

    // _id natif MongoDB : la propriete porte le meme nom que le champ reel,
    // donc TypeORM mappe directement (aucun champ doublon ecrit en base).
    @ObjectIdColumn()
    _id: ObjectId

    @Column("varchar")
    postgres_id: string

    @Column("varchar", { nullable: true })
    description: string

    @Column("simple-json", { nullable: true })
    location: {
        lat: number
        lng: number
        address: string
    } | null

    @Column("simple-json", { nullable: true })
    availabilities: {
        day: string
        startTime: string
        endTime: string
    }[]

    @Column("simple-json", { nullable: true })
    reviews: {
        user_postgres_id: string
        rating: number
        comment: string
        createdAt: Date
    }[]

    @Column("float", { default: 0 })
    averageRating: number

    @Column("int", { default: 0 })
    reviewsCount: number

    @CreateDateColumn()
    createdAt: Date

    @UpdateDateColumn()
    updatedAt: Date

    constructor(
        _id: ObjectId,
        postgres_id: string,
        description: string,
        location: { lat: number; lng: number; address: string } | null,
        availabilities: { day: string; startTime: string; endTime: string }[],
        reviews: { user_postgres_id: string; rating: number; comment: string; createdAt: Date }[],
        averageRating: number,
        reviewsCount: number,
        createdAt: Date,
        updatedAt: Date
    ) {
        this._id = _id
        this.postgres_id = postgres_id
        this.description = description
        this.location = location
        this.availabilities = availabilities
        this.reviews = reviews
        this.averageRating = averageRating
        this.reviewsCount = reviewsCount
        this.createdAt = createdAt
        this.updatedAt = updatedAt
    }
}
