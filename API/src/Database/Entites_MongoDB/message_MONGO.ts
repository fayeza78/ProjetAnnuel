import { Entity, ObjectIdColumn, ObjectId, Column, CreateDateColumn, UpdateDateColumn } from "typeorm"

@Entity("messages")
export class MessageMongo {

    // _id natif MongoDB : la propriete porte le meme nom que le champ reel,
    // donc TypeORM mappe directement (aucun champ doublon ecrit en base).
    @ObjectIdColumn()
    _id: ObjectId

    @Column("varchar")
    postgres_id: string

    @Column("varchar")
    conversationId: string

    @Column("varchar")
    sender_postgres_id: string

    @Column("simple-array", { nullable: true })
    recipient_postgres_ids: string[]

    @Column("varchar", { nullable: true })
    content: string

    @Column("simple-json", { nullable: true })
    mediaAttachments: {
        type: "photo" | "voice" | "video"
        url: string
        duration?: number
        size: number
        mimeType: string
    }[]

    @CreateDateColumn()
    createdAt: Date

    @UpdateDateColumn()
    updatedAt: Date

    constructor(
        _id: ObjectId,
        postgres_id: string,
        conversationId: string,
        sender_postgres_id: string,
        recipient_postgres_ids: string[],
        content: string,
        mediaAttachments: { type: "photo" | "voice" | "video"; url: string; duration?: number; size: number; mimeType: string }[],
        createdAt: Date,
        updatedAt: Date
    ) {
        this._id = _id
        this.postgres_id = postgres_id
        this.conversationId = conversationId
        this.sender_postgres_id = sender_postgres_id
        this.recipient_postgres_ids = recipient_postgres_ids
        this.content = content
        this.mediaAttachments = mediaAttachments
        this.createdAt = createdAt
        this.updatedAt = updatedAt
    }
}
