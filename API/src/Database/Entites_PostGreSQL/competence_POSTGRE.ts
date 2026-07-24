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
export class Competence {

    @PrimaryGeneratedColumn()
    id_comp!: number

    @Column("varchar", { length: 50 })
    libelle!: string

    @ManyToOne(() => User, (user) => user.competences)
    @JoinColumn({ name: "id_user" })
    user!: Relation<User>

    @CreateDateColumn()
    createdAt!: Date

    @UpdateDateColumn()
    updatedAt!: Date

    @DeleteDateColumn()
    deletedAt!: Date
}
