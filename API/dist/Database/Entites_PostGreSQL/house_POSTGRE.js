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
import { Neighborhood } from "./Neighborhood_POSTGRE.js";
let House = class House {
    id_house;
    neighborhood;
    inhabitants;
    floor_number_house;
    address_house;
    bedroom_count;
    bathroom_count;
    living_room_count;
    kitchen_count;
    garage_count;
    swimming_pool;
    surface_area;
    living_area;
    price_house;
    year_built_house;
    isActive_house;
    createdAt_house;
    updatedAt_house;
    deletedAt_house;
    constructor(id_house, floor_number_house, address_house, bedroom_count, bathroom_count, neighborhood, swimming_pool, living_room_count, kitchen_count, garage_count, living_area, surface_area, price_house, year_built_house, isActive_house, createdAt_house, updatedAt_house, deletedAt_house) {
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
};
__decorate([
    PrimaryGeneratedColumn("uuid"),
    __metadata("design:type", String)
], House.prototype, "id_house", void 0);
__decorate([
    ManyToOne(() => Neighborhood, (neighborhood) => neighborhood.houses, { nullable: true }),
    JoinColumn({ name: "neighborhood_id" }),
    __metadata("design:type", Object)
], House.prototype, "neighborhood", void 0);
__decorate([
    OneToMany(() => Inhabitant, (inhabitant) => inhabitant.house),
    __metadata("design:type", Array)
], House.prototype, "inhabitants", void 0);
__decorate([
    Column("int"),
    __metadata("design:type", Number)
], House.prototype, "floor_number_house", void 0);
__decorate([
    Column("varchar", { length: 255 }),
    __metadata("design:type", String)
], House.prototype, "address_house", void 0);
__decorate([
    Column("int"),
    __metadata("design:type", Number)
], House.prototype, "bedroom_count", void 0);
__decorate([
    Column("int"),
    __metadata("design:type", Number)
], House.prototype, "bathroom_count", void 0);
__decorate([
    Column("int"),
    __metadata("design:type", Number)
], House.prototype, "living_room_count", void 0);
__decorate([
    Column("int"),
    __metadata("design:type", Number)
], House.prototype, "kitchen_count", void 0);
__decorate([
    Column("int"),
    __metadata("design:type", Number)
], House.prototype, "garage_count", void 0);
__decorate([
    Column("boolean", { default: false }),
    __metadata("design:type", Boolean)
], House.prototype, "swimming_pool", void 0);
__decorate([
    Column("float", { precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], House.prototype, "surface_area", void 0);
__decorate([
    Column("float", { precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], House.prototype, "living_area", void 0);
__decorate([
    Column("decimal", { precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], House.prototype, "price_house", void 0);
__decorate([
    Column("int"),
    __metadata("design:type", Number)
], House.prototype, "year_built_house", void 0);
__decorate([
    Column({ default: true }),
    __metadata("design:type", Boolean)
], House.prototype, "isActive_house", void 0);
__decorate([
    CreateDateColumn(),
    __metadata("design:type", Date)
], House.prototype, "createdAt_house", void 0);
__decorate([
    UpdateDateColumn(),
    __metadata("design:type", Date)
], House.prototype, "updatedAt_house", void 0);
__decorate([
    DeleteDateColumn(),
    __metadata("design:type", Date)
], House.prototype, "deletedAt_house", void 0);
House = __decorate([
    Entity(),
    __metadata("design:paramtypes", [String, Number, String, Number, Number, Object, Boolean, Number, Number, Number, Number, Number, Number, Number, Boolean, Date,
        Date,
        Date])
], House);
export { House };
