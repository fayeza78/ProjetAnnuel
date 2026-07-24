import {
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from "typeorm";

@Entity()
export class PointTransaction {

    @PrimaryGeneratedColumn()
    id_transaction!: number

    @Column("int")
    id_emetteur!: number      // utilisateur qui depense les points

    @Column("int")
    id_recepteur!: number     // utilisateur qui recoit les points (prestataire)

    @Column("int", { nullable: true })
    id_service!: number       // service a l'origine du transfert (si applicable)

    @Column("int")
    montant!: number

    @Column("varchar", { length: 100, nullable: true })
    motif!: string

    @CreateDateColumn()
    createdAt!: Date

    @UpdateDateColumn()
    updatedAt!: Date

    @DeleteDateColumn()
    deletedAt!: Date
}
