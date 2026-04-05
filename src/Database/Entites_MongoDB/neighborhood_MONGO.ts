import { Entity, ObjectIdColumn, ObjectId, Column, CreateDateColumn, UpdateDateColumn } from "typeorm"

@Entity("neighborhoods")
export class NeighborhoodMongo {

    @ObjectIdColumn()
    id_neighborhood: ObjectId

    @Column("varchar")
    postgres_id: string

    @Column("varchar", { nullable: true })
    description: string

    @Column("simple-array", { nullable: true })
    photos: string[]

    @Column("simple-json", { nullable: true })
    stats: {
        inhabitants_count: number
        events_count: number
        services_count: number
        active_votes: number
    }

    @CreateDateColumn()
    createdAt: Date

    @UpdateDateColumn()
    updatedAt: Date

    constructor(
        id_neighborhood: ObjectId,
        postgres_id: string,
        description: string,
        photos: string[],
        stats: {
            inhabitants_count: number
            events_count: number
            services_count: number
            active_votes: number
        },
        createdAt: Date,
        updatedAt: Date
    ) {
        this.id_neighborhood = id_neighborhood
        this.postgres_id = postgres_id
        this.description = description
        this.photos = photos
        this.stats = stats
        this.createdAt = createdAt
        this.updatedAt = updatedAt
    }
}
