import {
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { User } from "./user_POSTGRE.js";

@Entity()
export class Incident {

    @PrimaryGeneratedColumn()
    id_incident!: number

    @Column("text", { nullable: true })
    description!: string

    @Column("varchar", { length: 50, nullable: true })
    statut!: string

    @Column("varchar", { length: 30, nullable: true })
    type!: string          // "incident" | "alerte"

    @Column("varchar", { length: 20, nullable: true })
    gravite!: string       // "faible" | "moyenne" | "haute" | "critique"

    @ManyToOne(() => User, (user) => user.incidents, { nullable: true })
    @JoinColumn({ name: "id_user" })
    user!: Relation<User>

    @CreateDateColumn()
    createdAt!: Date

    @UpdateDateColumn()
    updatedAt!: Date

    @DeleteDateColumn()
    deletedAt!: Date
}
