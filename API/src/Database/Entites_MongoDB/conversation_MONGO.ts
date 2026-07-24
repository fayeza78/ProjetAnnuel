import { Entity, ObjectIdColumn, ObjectId, Column, CreateDateColumn, UpdateDateColumn } from "typeorm"

@Entity("conversations")
export class ConversationMongo {

    // _id natif MongoDB : la propriete porte le meme nom que le champ reel,
    // donc TypeORM mappe directement (aucun champ doublon ecrit en base).
    @ObjectIdColumn()
    _id: ObjectId

    @Column("varchar")
    postgres_id: string   // = conversationId (UUID logique de la conversation)

    @Column("simple-array")
    participants_postgres_ids: string[]

    @Column({ type: "varchar", default: "direct" })
    type: "direct" | "group"

    @Column("varchar", { nullable: true })
    title: string | null

    @Column("varchar")
    createdBy_postgres_id: string

    @Column("timestamp", { nullable: true })
    lastMessageAt: Date | null

    @CreateDateColumn()
    createdAt: Date

    @UpdateDateColumn()
    updatedAt: Date

    constructor(
        _id: ObjectId,
        postgres_id: string,
        participants_postgres_ids: string[],
        type: "direct" | "group",
        title: string | null,
        createdBy_postgres_id: string,
        lastMessageAt: Date | null,
        createdAt: Date,
        updatedAt: Date
    ) {
        this._id = _id
        this.postgres_id = postgres_id
        this.participants_postgres_ids = participants_postgres_ids
        this.type = type
        this.title = title
        this.createdBy_postgres_id = createdBy_postgres_id
        this.lastMessageAt = lastMessageAt
        this.createdAt = createdAt
        this.updatedAt = updatedAt
    }
}
