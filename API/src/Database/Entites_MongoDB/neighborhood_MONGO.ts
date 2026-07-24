import { Entity, ObjectIdColumn, ObjectId, Column, CreateDateColumn, UpdateDateColumn } from "typeorm"

@Entity("neighborhoods")
export class NeighborhoodMongo {

    // _id natif MongoDB : la propriete porte le meme nom que le champ reel,
    // donc TypeORM mappe directement (aucun champ doublon ecrit en base).
    @ObjectIdColumn()
    _id: ObjectId

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
        _id: ObjectId,
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
        this._id = _id
        this.postgres_id = postgres_id
        this.description = description
        this.photos = photos
        this.stats = stats
        this.createdAt = createdAt
        this.updatedAt = updatedAt
    }
}
