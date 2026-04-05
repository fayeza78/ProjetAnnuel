import { Column, CreateDateColumn, DeleteDateColumn,JoinColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { House } from "./house_POSTGRE.js";
import { Apartment } from "./appartment_POSTGRE.js";
import { Family } from "./family_POSTGRE.js";
import { Neighborhood } from "./Neighborhood_POSTGRE.js";



export enum Type_house {
  Apartment = "Apartment",
  House = "House",
  StudentHousing = "StudentHousing"
}
export enum OccupancyStatus {
  OWNER = "owner",  //Propriétaire
  TENANT = "tenant" //Locataire
}
export enum Sex_inhabitant {
    MALE = "male",
    FEMALE = "female",
    OTHER = "other"
}
export enum Role_inhabitant {
    HABITANT = "habitant",
    ADMIN = "admin",
    MANAGER = "manager"
}

@Entity()
export class Inhabitant {

    @PrimaryGeneratedColumn("uuid")
    id_inhabitant: string
    
    @ManyToOne(() => Neighborhood, (neighborhood) => neighborhood.inhabitants, { nullable: true })
    @JoinColumn({ name: "neighborhood_id" })
    neighborhood: Neighborhood | null
    
    @ManyToOne(() => Family, (family) => family.members, { nullable: true })
    @JoinColumn({ name: "family_id" })
    family: Family | null

    @ManyToOne(() => House, (house) => house.inhabitants, { nullable: true })
    @JoinColumn({ name: "house_id" })
    house: House | null

    @ManyToOne(() => Apartment, (apartment) => apartment.inhabitants, { nullable: true })
    @JoinColumn({ name: "apartment_id" })
    apartment: Apartment | null

    @Column({
    type: "enum",
    enum: Type_house
    })
    type_house: Type_house;    

        @Column("int")
    age_inhabitant: number

     @Column({
        type: "enum",
        enum: OccupancyStatus
    })
    occupancyStatus: OccupancyStatus      
    
      @Column({
        type: "enum",
        enum: Role_inhabitant,
        default: Role_inhabitant.HABITANT
    })
    role_inhabitant: Role_inhabitant

    @Column({
        type: "enum",
        enum: Sex_inhabitant
    })
    sex_inhabitant: Sex_inhabitant

    @Column("varchar", { unique: true })
    email_inhabitant: string
 
    @Column("varchar", { length: 255 })
    passwordHash_inhabitant: string
 
    @Column("varchar", { length: 100 })
    firstName_inhabitant: string
 
    @Column("varchar", { length: 255 })
    lastName_inhabitant: string
 
    @Column("varchar", { length: 20, nullable: true })
    phone_inhabitant: string
 
    @Column("varchar", { length: 50 })
    job_inhabitant: string   
 
    @Column("date")
    birthDate_inhabitant: Date

    @Column("boolean",{ default: true })
    isActive_inhabitant: boolean     

    @CreateDateColumn()
    createdAt_inhabitant: Date

    @UpdateDateColumn()
    updatedAt_inhabitant: Date

    @DeleteDateColumn()
    deletedAt_inhabitant: Date


    constructor(
        id_inhabitant: string,
        family: Family | null,
        neighborhood: Neighborhood | null,
        house: House | null,
        apartment: Apartment | null,
        type_house: Type_house,
        age_inhabitant: number,
        occupancyStatus: OccupancyStatus,
        role_inhabitant: Role_inhabitant,
        sex_inhabitant: Sex_inhabitant,
        email_inhabitant: string,
        passwordHash_inhabitant: string,
        firstName_inhabitant: string,
        lastName_inhabitant: string,
        phone_inhabitant: string,
        job_inhabitant: string,
        birthDate_inhabitant: Date,
        isActive_inhabitant: boolean,
        createdAt_inhabitant: Date,
        updatedAt_inhabitant: Date,
        deletedAt_inhabitant: Date  

    ) {
        this.id_inhabitant = id_inhabitant;
        this.family = family;
        this.house = house;
        this.apartment = apartment;
        this.neighborhood = neighborhood;
        this.type_house = type_house;
        this.age_inhabitant = age_inhabitant;
        this.occupancyStatus = occupancyStatus;
        this.role_inhabitant = role_inhabitant;
        this.age_inhabitant = age_inhabitant;
        this.sex_inhabitant = sex_inhabitant;
        this.email_inhabitant = email_inhabitant;
        this.passwordHash_inhabitant = passwordHash_inhabitant;
        this.firstName_inhabitant = firstName_inhabitant;
        this.lastName_inhabitant = lastName_inhabitant;
        this.phone_inhabitant = phone_inhabitant;
        this.job_inhabitant = job_inhabitant;
        this.birthDate_inhabitant = birthDate_inhabitant;
        this.isActive_inhabitant = isActive_inhabitant;
        this.createdAt_inhabitant = createdAt_inhabitant;
        this.updatedAt_inhabitant = updatedAt_inhabitant;
        this.deletedAt_inhabitant = deletedAt_inhabitant;
    }
}








