import {
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    JoinColumn,
    JoinTable,
    ManyToMany,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { Quartier } from "./quartier_POSTGRE.js";
import { Competence } from "./competence_POSTGRE.js";
import { Evenement } from "./evenement_POSTGRE.js";
import { Incident } from "./incident_POSTGRE.js";
import { Token } from "./token_POSTGRE.js";
import { EffectueDemande } from "./effectueDemande_POSTGRE.js";
import { Contrat } from "./contrat_POSTGRE.js";

export enum UserRole {
    ADMIN = "admin",
    USER = "user",
    MODERATEUR = "moderateur"
}

@Entity()
export class User {

    @PrimaryGeneratedColumn()
    id_user!: number

    @Column("varchar", { length: 50, unique: true })
    email!: string

    @Column("varchar", { length: 200 })
    password!: string

    @Column({
        type: "enum",
        enum: UserRole,
        default: UserRole.USER
    })
    role!: UserRole

    @Column("varchar", { length: 50, nullable: true })
    adresse!: string

    @Column("varchar", { length: 50, nullable: true })
    ville!: string

    @Column("varchar", { length: 50, nullable: true })
    cp!: string

    @Column("varchar", { length: 20, nullable: true })
    telephone!: string

    @Column("varchar", { length: 5, default: "fr" })
    langue!: string

    @Column("varchar", { length: 255, nullable: true })
    mfa_secret!: string

    @Column("boolean", { default: false })
    mfa_enabled!: boolean

    @Column("boolean", { default: false })
    vote_blocked!: boolean

    @ManyToOne(() => Quartier, (quartier) => quartier.users)
    @JoinColumn({ name: "id_quartier" })
    quartier!: Relation<Quartier>

    @OneToMany(() => Competence, (competence) => competence.user)
    competences!: Competence[]

    @OneToMany(() => Evenement, (evenement) => evenement.user)
    evenements!: Evenement[]

    @OneToMany(() => Incident, (incident) => incident.user)
    incidents!: Incident[]

    @OneToMany(() => Token, (token) => token.user)
    tokens!: Token[]

    @OneToMany(() => EffectueDemande, (ed) => ed.user)
    effectueDemandes!: EffectueDemande[]

    @ManyToMany(() => Contrat, (contrat) => contrat.users)
    @JoinTable({
        name: "Asso_5",
        joinColumn: { name: "id_user", referencedColumnName: "id_user" },
        inverseJoinColumn: { name: "id_contrat", referencedColumnName: "id_contrat" }
    })
    contrats!: Contrat[]

    @CreateDateColumn()
    createdAt!: Date

    @UpdateDateColumn()
    updatedAt!: Date

    @DeleteDateColumn()
    deletedAt!: Date

    // empeche la fuite des champs sensibles a chaque serialisation JSON, meme
    // quand un User est imbrique dans un autre objet renvoye par l'API (createur
    // d'un evenement, signaleur d'un incident...). res.json appelle JSON.stringify
    // qui declenche ce toJSON a n'importe quel niveau
    // caches : hash du mot de passe, secret MFA, adresse/cp/telephone
    // les endpoints qui doivent renvoyer l'adresse au proprietaire (/auth/me,
    // /users/:id pour soi) construisent leur objet a la main, donc pas impactes
    toJSON(): Record<string, unknown> {
        const clone = { ...this } as Record<string, unknown>
        delete clone.password
        delete clone.mfa_secret
        delete clone.adresse
        delete clone.cp
        delete clone.telephone
        return clone
    }
}
