import {
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from "typeorm";
import { User } from "./user_POSTGRE.js";

@Entity()
export class Quartier {

    @PrimaryGeneratedColumn()
    id_quartier!: number

    @Column("varchar", { length: 100 })
    nom_quartier!: string

    @Column("text", { nullable: true })
    limite_geo!: string

    @OneToMany(() => User, (user) => user.quartier)
    users!: User[]

    @CreateDateColumn()
    createdAt!: Date

    @UpdateDateColumn()
    updatedAt!: Date

    @DeleteDateColumn()
    deletedAt!: Date
}
