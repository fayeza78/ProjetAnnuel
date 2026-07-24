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
export class Evenement {

    @PrimaryGeneratedColumn()
    id_evenement!: number

    @Column("varchar", { length: 50 })
    titre!: string

    @Column("date", { nullable: true })
    date_!: Date

    @Column("varchar", { length: 50, nullable: true })
    type!: string

    @Column("varchar", { length: 50, nullable: true })
    statut!: string

    @ManyToOne(() => User, (user) => user.evenements)
    @JoinColumn({ name: "id_user" })
    user!: Relation<User>

    @CreateDateColumn()
    createdAt!: Date

    @UpdateDateColumn()
    updatedAt!: Date

    @DeleteDateColumn()
    deletedAt!: Date
}
