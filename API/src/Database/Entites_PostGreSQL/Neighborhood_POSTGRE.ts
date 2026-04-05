import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn,ManyToOne, OneToMany,PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Inhabitant } from "./Inhabitant_POSTGRE.js";
import { House } from "./house_POSTGRE.js";
import { Apartment } from "./appartment_POSTGRE.js";
import { Event } from "./event_POSTGRE.js";


@Entity()
export class Neighborhood {

    @PrimaryGeneratedColumn("uuid")
    id_neighborhood: string

    @Column("varchar", { length: 100 })
    name_neighborhood: string
 
    @Column("varchar", { length: 100 })
    city: string
 
    @Column("varchar", { length: 10 })
    postalCode: string
 
    @Column("text", { nullable: true })
    geometry: string      

    // Admin du quartier (FK → Inhabitant)
    @ManyToOne(() => Inhabitant, { nullable: true })
    @JoinColumn({ name: "admin_id" })
    admin: Inhabitant
 
    // Un quartier a plusieurs habitants
    @OneToMany(() => Inhabitant, (inhabitant) => inhabitant.neighborhood)
    inhabitants!: Inhabitant[]
 
    // Un quartier a plusieurs maisons
    @OneToMany(() => House, (house) => house.neighborhood)
    houses!: House[]
 
    // Un quartier a plusieurs appartements
    @OneToMany(() => Apartment, (apartment) => apartment.neighborhood)
    apartments!: Apartment[]
 
    // Un quartier a plusieurs événements
    @OneToMany(() => Event, (event) => event.neighborhood)
    events!: Event[]

    @Column("boolean", { default: true })
    isActive_neighborhood: boolean
 
    @CreateDateColumn()
    createdAt_neighborhood: Date
 
    @UpdateDateColumn()
    updatedAt_neighborhood: Date
 
    @DeleteDateColumn()
    deletedAt_neighborhood: Date

    constructor(
        id_neighborhood: string,
        name_neighborhood: string,
        city: string,
        postalCode: string,
        geometry: string,
        admin: Inhabitant,
        isActive_neighborhood: boolean,
        createdAt_neighborhood: Date,
        updatedAt_neighborhood: Date,
        deletedAt_neighborhood: Date
    ) {
        this.id_neighborhood = id_neighborhood;
        this.name_neighborhood = name_neighborhood;
        this.city = city;
        this.postalCode = postalCode;
        this.geometry = geometry;
        this.admin = admin;
        this.isActive_neighborhood = isActive_neighborhood;
        this.createdAt_neighborhood = createdAt_neighborhood;
        this.updatedAt_neighborhood = updatedAt_neighborhood;
        this.deletedAt_neighborhood = deletedAt_neighborhood;
    }
}