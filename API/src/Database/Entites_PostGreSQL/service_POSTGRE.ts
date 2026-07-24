import {
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
    OneToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { Contrat } from "./contrat_POSTGRE.js";
import { EffectueDemande } from "./effectueDemande_POSTGRE.js";
import { User } from "./user_POSTGRE.js";

@Entity()
export class Service {

    @PrimaryGeneratedColumn()
    id_service!: number

    @Column("varchar", { length: 50 })
    type!: string

    @Column("varchar", { length: 50, nullable: true })
    categorie!: string

    @Column("date", { nullable: true })
    date_!: Date

    @Column("int", { nullable: true })
    prix!: number

    @Column("varchar", { length: 50 })
    statut!: string

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: "id_prestataire" })
    prestataire!: Relation<User>

    @OneToOne(() => Contrat, (contrat) => contrat.service)
    contrat!: Relation<Contrat>

    @OneToMany(() => EffectueDemande, (ed) => ed.service)
    effectueDemandes!: EffectueDemande[]

    @CreateDateColumn()
    createdAt!: Date

    @UpdateDateColumn()
    updatedAt!: Date

    @DeleteDateColumn()
    deletedAt!: Date
}
