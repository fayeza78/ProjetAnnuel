var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Inhabitant } from "./Inhabitant_POSTGRE.js";
import { House } from "./house_POSTGRE.js";
import { Apartment } from "./appartment_POSTGRE.js";
import { Event } from "./event_POSTGRE.js";
let Neighborhood = class Neighborhood {
    id_neighborhood;
    name_neighborhood;
    city;
    postalCode;
    geometry;
    // Admin du quartier (FK → Inhabitant)
    admin;
    // Un quartier a plusieurs habitants
    inhabitants;
    // Un quartier a plusieurs maisons
    houses;
    // Un quartier a plusieurs appartements
    apartments;
    // Un quartier a plusieurs événements
    events;
    isActive_neighborhood;
    createdAt_neighborhood;
    updatedAt_neighborhood;
    deletedAt_neighborhood;
    constructor(id_neighborhood, name_neighborhood, city, postalCode, geometry, admin, isActive_neighborhood, createdAt_neighborhood, updatedAt_neighborhood, deletedAt_neighborhood) {
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
};
__decorate([
    PrimaryGeneratedColumn("uuid"),
    __metadata("design:type", String)
], Neighborhood.prototype, "id_neighborhood", void 0);
__decorate([
    Column("varchar", { length: 100 }),
    __metadata("design:type", String)
], Neighborhood.prototype, "name_neighborhood", void 0);
__decorate([
    Column("varchar", { length: 100 }),
    __metadata("design:type", String)
], Neighborhood.prototype, "city", void 0);
__decorate([
    Column("varchar", { length: 10 }),
    __metadata("design:type", String)
], Neighborhood.prototype, "postalCode", void 0);
__decorate([
    Column("text", { nullable: true }),
    __metadata("design:type", String)
], Neighborhood.prototype, "geometry", void 0);
__decorate([
    ManyToOne(() => Inhabitant, { nullable: true }),
    JoinColumn({ name: "admin_id" }),
    __metadata("design:type", Inhabitant
    // Un quartier a plusieurs habitants
    )
], Neighborhood.prototype, "admin", void 0);
__decorate([
    OneToMany(() => Inhabitant, (inhabitant) => inhabitant.neighborhood),
    __metadata("design:type", Array)
], Neighborhood.prototype, "inhabitants", void 0);
__decorate([
    OneToMany(() => House, (house) => house.neighborhood),
    __metadata("design:type", Array)
], Neighborhood.prototype, "houses", void 0);
__decorate([
    OneToMany(() => Apartment, (apartment) => apartment.neighborhood),
    __metadata("design:type", Array)
], Neighborhood.prototype, "apartments", void 0);
__decorate([
    OneToMany(() => Event, (event) => event.neighborhood),
    __metadata("design:type", Array)
], Neighborhood.prototype, "events", void 0);
__decorate([
    Column("boolean", { default: true }),
    __metadata("design:type", Boolean)
], Neighborhood.prototype, "isActive_neighborhood", void 0);
__decorate([
    CreateDateColumn(),
    __metadata("design:type", Date)
], Neighborhood.prototype, "createdAt_neighborhood", void 0);
__decorate([
    UpdateDateColumn(),
    __metadata("design:type", Date)
], Neighborhood.prototype, "updatedAt_neighborhood", void 0);
__decorate([
    DeleteDateColumn(),
    __metadata("design:type", Date)
], Neighborhood.prototype, "deletedAt_neighborhood", void 0);
Neighborhood = __decorate([
    Entity(),
    __metadata("design:paramtypes", [String, String, String, String, String, Inhabitant, Boolean, Date,
        Date,
        Date])
], Neighborhood);
export { Neighborhood };
