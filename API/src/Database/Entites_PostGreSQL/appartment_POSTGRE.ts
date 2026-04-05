import { Column, CreateDateColumn, DeleteDateColumn, OneToMany,Entity, PrimaryGeneratedColumn, UpdateDateColumn, JoinColumn, ManyToOne } from "typeorm";
import { Inhabitant } from "./Inhabitant_POSTGRE.js";
import { Neighborhood } from "./Neighborhood_POSTGRE.js";

@Entity()
export class Apartment {

    @PrimaryGeneratedColumn("uuid")
    id_apartment: string
    
    @OneToMany(() => Inhabitant, (inhabitant) => inhabitant.apartment)
    inhabitants!: Inhabitant[]

    @ManyToOne(() => Neighborhood, (neighborhood) => neighborhood.apartments, { nullable: true })
    @JoinColumn({ name: "neighborhood_id" })
    neighborhood: Neighborhood | null

    @Column("int")
    floor_apartment: number

    @Column("varchar", { length: 20 })
    number_apartment: string

    @Column("varchar", { length: 50 })
    co_property_manager: string   

    @Column("varchar", { length: 255 })
    address_apartment: string

    @Column("int")
    bedroom_count: number

    @Column("int")
    bathroom_count: number

    @Column("int")
    living_room_count: number

    @Column("int")
    kitchen_count: number

    @Column("int")
    parking_count: number

    @Column("int")
    balcony_count: number

    @Column("boolean", { default: false })
    has_elevator: boolean

    @Column("boolean", { default: false })
    has_garden: boolean

    @Column("decimal", { precision: 10, scale: 2 })
    living_area: number

    @Column("decimal", { precision: 10, scale: 2 })
    price_apartment: number

    @Column("int")
    year_built_apartment: number

    @Column("boolean", { default: true })
    isActive_apartment: boolean     

    @CreateDateColumn()
    createdAt_apartment: Date

    @UpdateDateColumn()
    updatedAt_apartment: Date

    @DeleteDateColumn()
    deletedAt_apartment: Date

    constructor(
        id_apartment: string,
        floor_apartment: number,
        number_apartment: string,
        neighborhood: Neighborhood | null,
        co_property_manager: string,
        address_apartment: string,
        bedroom_count: number,
        bathroom_count: number,
        living_room_count: number,
        kitchen_count: number,
        parking_count: number,
        balcony_count: number,
        has_elevator: boolean,
        has_garden: boolean,
        living_area: number,
        price_apartment: number,
        year_built_apartment: number,
        isActive_apartment: boolean,
        createdAt_apartment: Date,
        updatedAt_apartment: Date,
        deletedAt_apartment: Date
    ) {
        this.id_apartment = id_apartment;
        this.floor_apartment = floor_apartment;
        this.neighborhood = neighborhood;
        this.number_apartment = number_apartment;
        this.co_property_manager = co_property_manager;
        this.address_apartment = address_apartment;
        this.bedroom_count = bedroom_count;
        this.bathroom_count = bathroom_count;
        this.living_room_count = living_room_count;
        this.kitchen_count = kitchen_count;
        this.parking_count = parking_count;
        this.balcony_count = balcony_count;
        this.has_elevator = has_elevator;
        this.has_garden = has_garden;
        this.living_area = living_area;
        this.price_apartment = price_apartment;
        this.year_built_apartment = year_built_apartment;
        this.isActive_apartment = isActive_apartment;
        this.createdAt_apartment = createdAt_apartment;
        this.updatedAt_apartment = updatedAt_apartment;
        this.deletedAt_apartment = deletedAt_apartment;
      
    }
}








