var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Column, CreateDateColumn, DeleteDateColumn, OneToMany, Entity, PrimaryGeneratedColumn, UpdateDateColumn, JoinColumn, ManyToOne } from "typeorm";
import { Inhabitant } from "./Inhabitant_POSTGRE.js";
import { Neighborhood } from "./Neighborhood_POSTGRE.js";
let Apartment = class Apartment {
    id_apartment;
    inhabitants;
    neighborhood;
    floor_apartment;
    number_apartment;
    co_property_manager;
    address_apartment;
    bedroom_count;
    bathroom_count;
    living_room_count;
    kitchen_count;
    parking_count;
    balcony_count;
    has_elevator;
    has_garden;
    living_area;
    price_apartment;
    year_built_apartment;
    isActive_apartment;
    createdAt_apartment;
    updatedAt_apartment;
    deletedAt_apartment;
    constructor(id_apartment, floor_apartment, number_apartment, neighborhood, co_property_manager, address_apartment, bedroom_count, bathroom_count, living_room_count, kitchen_count, parking_count, balcony_count, has_elevator, has_garden, living_area, price_apartment, year_built_apartment, isActive_apartment, createdAt_apartment, updatedAt_apartment, deletedAt_apartment) {
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
};
__decorate([
    PrimaryGeneratedColumn("uuid"),
    __metadata("design:type", String)
], Apartment.prototype, "id_apartment", void 0);
__decorate([
    OneToMany(() => Inhabitant, (inhabitant) => inhabitant.apartment),
    __metadata("design:type", Array)
], Apartment.prototype, "inhabitants", void 0);
__decorate([
    ManyToOne(() => Neighborhood, (neighborhood) => neighborhood.apartments, { nullable: true }),
    JoinColumn({ name: "neighborhood_id" }),
    __metadata("design:type", Object)
], Apartment.prototype, "neighborhood", void 0);
__decorate([
    Column("int"),
    __metadata("design:type", Number)
], Apartment.prototype, "floor_apartment", void 0);
__decorate([
    Column("varchar", { length: 20 }),
    __metadata("design:type", String)
], Apartment.prototype, "number_apartment", void 0);
__decorate([
    Column("varchar", { length: 50 }),
    __metadata("design:type", String)
], Apartment.prototype, "co_property_manager", void 0);
__decorate([
    Column("varchar", { length: 255 }),
    __metadata("design:type", String)
], Apartment.prototype, "address_apartment", void 0);
__decorate([
    Column("int"),
    __metadata("design:type", Number)
], Apartment.prototype, "bedroom_count", void 0);
__decorate([
    Column("int"),
    __metadata("design:type", Number)
], Apartment.prototype, "bathroom_count", void 0);
__decorate([
    Column("int"),
    __metadata("design:type", Number)
], Apartment.prototype, "living_room_count", void 0);
__decorate([
    Column("int"),
    __metadata("design:type", Number)
], Apartment.prototype, "kitchen_count", void 0);
__decorate([
    Column("int"),
    __metadata("design:type", Number)
], Apartment.prototype, "parking_count", void 0);
__decorate([
    Column("int"),
    __metadata("design:type", Number)
], Apartment.prototype, "balcony_count", void 0);
__decorate([
    Column("boolean", { default: false }),
    __metadata("design:type", Boolean)
], Apartment.prototype, "has_elevator", void 0);
__decorate([
    Column("boolean", { default: false }),
    __metadata("design:type", Boolean)
], Apartment.prototype, "has_garden", void 0);
__decorate([
    Column("float", { precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], Apartment.prototype, "living_area", void 0);
__decorate([
    Column("decimal", { precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], Apartment.prototype, "price_apartment", void 0);
__decorate([
    Column("int"),
    __metadata("design:type", Number)
], Apartment.prototype, "year_built_apartment", void 0);
__decorate([
    Column({ default: true }),
    __metadata("design:type", Boolean)
], Apartment.prototype, "isActive_apartment", void 0);
__decorate([
    CreateDateColumn(),
    __metadata("design:type", Date)
], Apartment.prototype, "createdAt_apartment", void 0);
__decorate([
    UpdateDateColumn(),
    __metadata("design:type", Date)
], Apartment.prototype, "updatedAt_apartment", void 0);
__decorate([
    DeleteDateColumn(),
    __metadata("design:type", Date)
], Apartment.prototype, "deletedAt_apartment", void 0);
Apartment = __decorate([
    Entity(),
    __metadata("design:paramtypes", [String, Number, String, Object, String, String, Number, Number, Number, Number, Number, Number, Boolean, Boolean, Number, Number, Number, Boolean, Date,
        Date,
        Date])
], Apartment);
export { Apartment };
