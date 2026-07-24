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

export enum TokenType {
    REFRESH = "refresh",
    RESET_PASSWORD = "reset_password",
    SSO = "sso"                         // ticket SSO a usage unique (echange par le client Java)
}

@Entity()
export class Token {

    @PrimaryGeneratedColumn()
    id_token!: number

    @Column("varchar", { length: 50, unique: true })
    token!: string

    @Column({
        type: "enum",
        enum: TokenType,
        nullable: true,
        default: TokenType.REFRESH
    })
    type!: TokenType

    @Column("timestamp", { nullable: true })
    expireA!: Date

    @ManyToOne(() => User, (user) => user.tokens)
    @JoinColumn({ name: "id_user" })
    user!: Relation<User>

    @CreateDateColumn()
    createdAt!: Date

    @UpdateDateColumn()
    updatedAt!: Date

    @DeleteDateColumn()
    deletedAt!: Date
}
