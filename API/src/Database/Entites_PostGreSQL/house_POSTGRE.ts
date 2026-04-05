import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany,PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Inhabitant } from "./Inhabitant_POSTGRE.js";
import { Neighborhood } from "./Neighborhood_POSTGRE.js";

@Entity()
export class House {

    @PrimaryGeneratedColumn("uuid")
    id_house: string
    
    @ManyToOne(() => Neighborhood, (neighborhood) => neighborhood.houses, { nullable: true })
    @JoinColumn({ name: "neighborhood_id" })
    neighborhood: Neighborhood | null
    
    @OneToMany(() => Inhabitant, (inhabitant) => inhabitant.house)
    inhabitants!: Inhabitant[]

    @Column("int")
    floor_number_house: number

    @Column("varchar", { length: 255 })
    address_house: string

    @Column("int")
    bedroom_count: number

    @Column("int")
    bathroom_count: number

    @Column("int")
    living_room_count: number

    @Column("int")
    kitchen_count: number

    @Column("int")
    garage_count: number

    @Column("boolean", { default: false })
    swimming_pool: boolean
    
    @Column("decimal", { precision: 10, scale: 2 })
    surface_area: number

    @Column("decimal", { precision: 10, scale: 2 })
    living_area: number
    
    @Column("decimal", { precision: 10, scale: 2 })
    price_house: number

    @Column("int")
    year_built_house: number

    @Column("boolean",{ default: true })
    isActive_house: boolean     

    @CreateDateColumn()
    createdAt_house: Date

    @UpdateDateColumn()
    updatedAt_house: Date

    @DeleteDateColumn()
    deletedAt_house: Date


    constructor(
        id_house: string,
        floor_number_house: number,
        address_house: string,
        bedroom_count: number,
        bathroom_count: number,
        neighborhood: Neighborhood | null,
        swimming_pool: boolean,
        living_room_count: number,
        kitchen_count: number,
        garage_count: number,
        living_area: number,
        surface_area: number,
        price_house: number,
        year_built_house: number,
        isActive_house: boolean,
        createdAt_house: Date,
        updatedAt_house: Date,
        deletedAt_house: Date
    ) {
        this.id_house = id_house;
        this.floor_number_house = floor_number_house;
        this.neighborhood = neighborhood;
        this.address_house = address_house;
        this.swimming_pool = swimming_pool;
        this.bedroom_count = bedroom_count;
        this.bathroom_count = bathroom_count;
        this.living_room_count = living_room_count;
        this.kitchen_count = kitchen_count;
        this.garage_count = garage_count;
        this.living_area = living_area;
        this.surface_area = surface_area;
        this.price_house = price_house;
        this.year_built_house = year_built_house;
        this.isActive_house = isActive_house;
        this.createdAt_house = createdAt_house;
        this.updatedAt_house = updatedAt_house;
        this.deletedAt_house = deletedAt_house;
      
    }
}








