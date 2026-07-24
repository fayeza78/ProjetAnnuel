import {
    PrimaryColumn,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    UpdateDateColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { User } from "./user_POSTGRE.js";
import { Service } from "./service_POSTGRE.js";

@Entity("effectue_demande")
export class EffectueDemande {

    @PrimaryColumn("int")
    id_user!: number

    @PrimaryColumn("int")
    id_service!: number

    @ManyToOne(() => User, (user) => user.effectueDemandes)
    @JoinColumn({ name: "id_user" })
    user!: Relation<User>

    @ManyToOne(() => Service, (service) => service.effectueDemandes)
    @JoinColumn({ name: "id_service" })
    service!: Relation<Service>

    @CreateDateColumn()
    createdAt!: Date

    @UpdateDateColumn()
    updatedAt!: Date

    @DeleteDateColumn()
    deletedAt!: Date
}
