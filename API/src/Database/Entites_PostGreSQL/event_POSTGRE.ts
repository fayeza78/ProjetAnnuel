import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn,ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Inhabitant } from "./Inhabitant_POSTGRE.js";
import { Neighborhood } from "./Neighborhood_POSTGRE.js";

export enum EventStatus {
    DRAFT     = "draft",        // brouillon
    PUBLISHED = "published",    // visible par les voisins
    CANCELLED = "cancelled",    // annulé
    DONE      = "done"          // terminé
}
 
export enum EventType {
    SOCIAL      = "social",         // soirée, repas
    WORKSHOP    = "workshop",       // atelier
    FUNDRAISER  = "fundraiser",     // collecte de fonds
    SPORT       = "sport",
    OTHER       = "other"
}

@Entity()
export class Event {
 
    @PrimaryGeneratedColumn("uuid")
    id_event: string
 
    // ── Relations ────────────────────────────────────────────────
    // FK → Inhabitant (créateur de l'événement)
    @ManyToOne(() => Inhabitant, { nullable: false })
    @JoinColumn({ name: "creator_id" })
    creator: Inhabitant
    
    @ManyToOne(() => Neighborhood, (neighborhood) => neighborhood.events, { nullable: false })
    @JoinColumn({ name: "neighborhood_id" })
    neighborhood: Neighborhood
  
    @Column("varchar", { length: 150 })
    title_event: string
 
    @Column({
        type: "enum",
        enum: EventType,
        default: EventType.OTHER
    })
    type_event: EventType
 
    @Column({
        type: "enum",
        enum: EventStatus,
        default: EventStatus.DRAFT
    })
    status_event: EventStatus
 
    @Column("timestamp")
    startDate_event: Date
 
    @Column("timestamp", { nullable: true })
    endDate_event: Date
 
    @Column("varchar", { length: 255, nullable: true })
    location_event: string
 
    @Column("int", { default: 0 })
    participants_count: number      
 
    @Column("int", { nullable: true })
    max_participants: number       
 
    @Column("decimal", { precision: 10, scale: 2, nullable: true })
    price_event: number
 
    @Column("boolean", { default: true })
    isActive_event: boolean
 
    @CreateDateColumn()
    createdAt_event: Date
 
    @UpdateDateColumn()
    updatedAt_event: Date
 
    @DeleteDateColumn()
    deletedAt_event: Date


    constructor(
        id_event: string,
        creator: Inhabitant,
        neighborhood: Neighborhood,
        title_event: string,
        type_event: EventType,
        status_event: EventStatus,
        startDate_event: Date,
        endDate_event: Date,
        location_event: string,
        participants_count: number,
        max_participants: number,
        price_event: number,
        isActive_event: boolean,
        createdAt_event: Date,
        updatedAt_event: Date,
        deletedAt_event: Date
    ) 
    {
        this.id_event = id_event;
        this.creator = creator;
        this.neighborhood = neighborhood;
        this.title_event = title_event;
        this.type_event = type_event;
        this.status_event = status_event;
        this.startDate_event = startDate_event;
        this.endDate_event = endDate_event;
        this.location_event = location_event;
        this.participants_count = participants_count;
        this.max_participants = max_participants;
        this.price_event = price_event;
        this.isActive_event = isActive_event;
        this.createdAt_event = createdAt_event;
        this.updatedAt_event = updatedAt_event;
        this.deletedAt_event = deletedAt_event;
    }
}