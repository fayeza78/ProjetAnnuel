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
export class Signalement {

    @PrimaryGeneratedColumn()
    id_signalement!: number

    @Column("varchar", { length: 50 })
    cible_type!: string        // "message" | "service" | "evenement" | "user"

    @Column("varchar", { length: 100 })
    cible_id!: string          // identifiant de la ressource signalee

    @Column("text", { nullable: true })
    motif!: string

    @Column("varchar", { length: 30, default: "ouvert" })
    statut!: string            // "ouvert" | "traite" | "rejete"

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: "id_signaleur" })
    signaleur!: Relation<User>

    @CreateDateColumn()
    createdAt!: Date

    @UpdateDateColumn()
    updatedAt!: Date

    @DeleteDateColumn()
    deletedAt!: Date
}
