import { Column, CreateDateColumn, DeleteDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Inhabitant } from "./Inhabitant_POSTGRE.js";

@Entity()
export class Family {

    @PrimaryGeneratedColumn("uuid")
    id_family: string
    
    @Column("varchar", { length: 100 })
    family_name: string

    @OneToMany(() => Inhabitant, (inhabitant) => inhabitant.family)
    members!: Inhabitant[]

    @Column("boolean", { default: true })
    isActive_inhabitant: boolean     

    @CreateDateColumn()
    createdAt_inhabitant: Date

    @UpdateDateColumn()
    updatedAt_inhabitant: Date

    @DeleteDateColumn()
    deletedAt_inhabitant: Date


   constructor
   (
    id_family: string,
    family_name: string,
    isActive_inhabitant: boolean,
    createdAt_inhabitant: Date,
    updatedAt_inhabitant: Date,
    deletedAt_inhabitant: Date
    )
    {
        this.id_family = id_family;
        this.family_name = family_name;
        this.isActive_inhabitant = isActive_inhabitant;
        this.createdAt_inhabitant = createdAt_inhabitant;
        this.updatedAt_inhabitant = updatedAt_inhabitant;
        this.deletedAt_inhabitant = deletedAt_inhabitant;
    }
}



