import { Entity, ObjectIdColumn, ObjectId, Column, CreateDateColumn, UpdateDateColumn } from "typeorm"

@Entity("votes")
export class VoteMongo {

    // _id natif MongoDB : la propriete porte le meme nom que le champ reel,
    // donc TypeORM mappe directement (aucun champ doublon ecrit en base).
    @ObjectIdColumn()
    _id: ObjectId

    @Column("varchar")
    postgres_id: string

    @Column("varchar")
    question: string

    @Column("varchar", { nullable: true })
    description: string

    @Column({ type: "varchar", default: "single" })
    type: "single" | "multiple" | "yesno"

    @Column("simple-json")
    options: {
        id: string
        label: string
        votesCount: number
    }[]

    @Column("simple-json", { nullable: true })
    votes: {
        user_postgres_id: string
        optionIds: string[]
        votedAt: Date
    }[]

    @Column("boolean", { default: false })
    isAnonymous: boolean

    @Column("timestamp", { nullable: true })
    deadline: Date | null

    @Column("varchar")
    createdBy_postgres_id: string

    @Column("varchar", { nullable: true })
    targetQuartier_postgres_id: string | null

    @Column({ type: "varchar", default: "draft" })
    status: "draft" | "active" | "closed"

    @CreateDateColumn()
    createdAt: Date

    @UpdateDateColumn()
    updatedAt: Date

    constructor(
        _id: ObjectId,
        postgres_id: string,
        question: string,
        description: string,
        type: "single" | "multiple" | "yesno",
        options: { id: string; label: string; votesCount: number }[],
        votes: { user_postgres_id: string; optionIds: string[]; votedAt: Date }[],
        isAnonymous: boolean,
        deadline: Date | null,
        createdBy_postgres_id: string,
        targetQuartier_postgres_id: string | null,
        status: "draft" | "active" | "closed",
        createdAt: Date,
        updatedAt: Date
    ) {
        this._id = _id
        this.postgres_id = postgres_id
        this.question = question
        this.description = description
        this.type = type
        this.options = options
        this.votes = votes
        this.isAnonymous = isAnonymous
        this.deadline = deadline
        this.createdBy_postgres_id = createdBy_postgres_id
        this.targetQuartier_postgres_id = targetQuartier_postgres_id
        this.status = status
        this.createdAt = createdAt
        this.updatedAt = updatedAt
    }
}
