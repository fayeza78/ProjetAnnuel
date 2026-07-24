import {
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    JoinColumn,
    ManyToMany,
    OneToOne,
    PrimaryColumn,
    UpdateDateColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { Service } from "./service_POSTGRE.js";
import { User } from "./user_POSTGRE.js";

@Entity()
export class Contrat {

    @PrimaryColumn("varchar", { length: 50 })
    id_contrat!: string

    @Column("text", { nullable: true })
    lienpdf!: string

    @Column("varchar", { length: 50, nullable: true })
    statut!: string

    @OneToOne(() => Service, (service) => service.contrat)
    @JoinColumn({ name: "id_service" })
    service!: Relation<Service>

    @ManyToMany(() => User, (user) => user.contrats)
    users!: User[]

    @CreateDateColumn()
    createdAt!: Date

    @UpdateDateColumn()
    updatedAt!: Date

    @DeleteDateColumn()
    deletedAt!: Date
}
