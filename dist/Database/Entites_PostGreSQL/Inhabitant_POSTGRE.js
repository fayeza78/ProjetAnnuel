var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Column, CreateDateColumn, DeleteDateColumn, JoinColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { House } from "./house_POSTGRE.js";
import { Apartment } from "./appartment_POSTGRE.js";
import { Family } from "./family_POSTGRE.js";
import { Neighborhood } from "./Neighborhood_POSTGRE.js";
export var Type_house;
(function (Type_house) {
    Type_house["Apartment"] = "Apartment";
    Type_house["House"] = "House";
    Type_house["StudentHousing"] = "StudentHousing";
})(Type_house || (Type_house = {}));
export var OccupancyStatus;
(function (OccupancyStatus) {
    OccupancyStatus["OWNER"] = "owner";
    OccupancyStatus["TENANT"] = "tenant"; //Locataire
})(OccupancyStatus || (OccupancyStatus = {}));
export var Sex_inhabitant;
(function (Sex_inhabitant) {
    Sex_inhabitant["MALE"] = "male";
    Sex_inhabitant["FEMALE"] = "female";
    Sex_inhabitant["OTHER"] = "other";
})(Sex_inhabitant || (Sex_inhabitant = {}));
export var Role_inhabitant;
(function (Role_inhabitant) {
    Role_inhabitant["HABITANT"] = "habitant";
    Role_inhabitant["ADMIN"] = "admin";
    Role_inhabitant["MANAGER"] = "manager";
})(Role_inhabitant || (Role_inhabitant = {}));
let Inhabitant = class Inhabitant {
    id_inhabitant;
    neighborhood;
    family;
    house;
    apartment;
    type_house;
    age_inhabitant;
    occupancyStatus;
    role_inhabitant;
    sex_inhabitant;
    email_inhabitant;
    passwordHash_inhabitant;
    firstName_inhabitant;
    lastName_inhabitant;
    phone_inhabitant;
    job_inhabitant;
    birthDate_inhabitant;
    isActive_inhabitant;
    createdAt_inhabitant;
    updatedAt_inhabitant;
    deletedAt_inhabitant;
    constructor(id_inhabitant, family, neighborhood, house, apartment, type_house, age_inhabitant, occupancyStatus, role_inhabitant, sex_inhabitant, email_inhabitant, passwordHash_inhabitant, firstName_inhabitant, lastName_inhabitant, phone_inhabitant, job_inhabitant, birthDate_inhabitant, isActive_inhabitant, createdAt_inhabitant, updatedAt_inhabitant, deletedAt_inhabitant) {
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
};
__decorate([
    PrimaryGeneratedColumn("uuid"),
    __metadata("design:type", String)
], Inhabitant.prototype, "id_inhabitant", void 0);
__decorate([
    ManyToOne(() => Neighborhood, (neighborhood) => neighborhood.inhabitants, { nullable: true }),
    JoinColumn({ name: "neighborhood_id" }),
    __metadata("design:type", Object)
], Inhabitant.prototype, "neighborhood", void 0);
__decorate([
    ManyToOne(() => Family, (family) => family.members, { nullable: true }),
    JoinColumn({ name: "family_id" }),
    __metadata("design:type", Object)
], Inhabitant.prototype, "family", void 0);
__decorate([
    ManyToOne(() => House, (house) => house.inhabitants, { nullable: true }),
    JoinColumn({ name: "house_id" }),
    __metadata("design:type", Object)
], Inhabitant.prototype, "house", void 0);
__decorate([
    ManyToOne(() => Apartment, (apartment) => apartment.inhabitants, { nullable: true }),
    JoinColumn({ name: "apartment_id" }),
    __metadata("design:type", Object)
], Inhabitant.prototype, "apartment", void 0);
__decorate([
    Column({
        type: "enum",
        enum: Type_house
    }),
    __metadata("design:type", String)
], Inhabitant.prototype, "type_house", void 0);
__decorate([
    Column("int"),
    __metadata("design:type", Number)
], Inhabitant.prototype, "age_inhabitant", void 0);
__decorate([
    Column({
        type: "enum",
        enum: OccupancyStatus
    }),
    __metadata("design:type", String)
], Inhabitant.prototype, "occupancyStatus", void 0);
__decorate([
    Column({
        type: "enum",
        enum: Role_inhabitant,
        default: Role_inhabitant.HABITANT
    }),
    __metadata("design:type", String)
], Inhabitant.prototype, "role_inhabitant", void 0);
__decorate([
    Column({
        type: "enum",
        enum: Sex_inhabitant
    }),
    __metadata("design:type", String)
], Inhabitant.prototype, "sex_inhabitant", void 0);
__decorate([
    Column({ unique: true }),
    __metadata("design:type", String)
], Inhabitant.prototype, "email_inhabitant", void 0);
__decorate([
    Column("varchar", { length: 255 }),
    __metadata("design:type", String)
], Inhabitant.prototype, "passwordHash_inhabitant", void 0);
__decorate([
    Column("varchar", { length: 100 }),
    __metadata("design:type", String)
], Inhabitant.prototype, "firstName_inhabitant", void 0);
__decorate([
    Column("varchar", { length: 255 }),
    __metadata("design:type", String)
], Inhabitant.prototype, "lastName_inhabitant", void 0);
__decorate([
    Column("varchar", { length: 20, nullable: true }),
    __metadata("design:type", String)
], Inhabitant.prototype, "phone_inhabitant", void 0);
__decorate([
    Column("varchar", { length: 50 }),
    __metadata("design:type", String)
], Inhabitant.prototype, "job_inhabitant", void 0);
__decorate([
    Column("date"),
    __metadata("design:type", Date)
], Inhabitant.prototype, "birthDate_inhabitant", void 0);
__decorate([
    Column({ default: true }),
    __metadata("design:type", Boolean)
], Inhabitant.prototype, "isActive_inhabitant", void 0);
__decorate([
    CreateDateColumn(),
    __metadata("design:type", Date)
], Inhabitant.prototype, "createdAt_inhabitant", void 0);
__decorate([
    UpdateDateColumn(),
    __metadata("design:type", Date)
], Inhabitant.prototype, "updatedAt_inhabitant", void 0);
__decorate([
    DeleteDateColumn(),
    __metadata("design:type", Date)
], Inhabitant.prototype, "deletedAt_inhabitant", void 0);
Inhabitant = __decorate([
    Entity(),
    __metadata("design:paramtypes", [String, Object, Object, Object, Object, String, Number, String, String, String, String, String, String, String, String, String, Date, Boolean, Date,
        Date,
        Date])
], Inhabitant);
export { Inhabitant };
