var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Column, CreateDateColumn, DeleteDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Inhabitant } from "./Inhabitant_POSTGRE.js";
let Family = class Family {
    id_family;
    family_name;
    members;
    isActive_inhabitant;
    createdAt_inhabitant;
    updatedAt_inhabitant;
    deletedAt_inhabitant;
    constructor(id_family, family_name, isActive_inhabitant, createdAt_inhabitant, updatedAt_inhabitant, deletedAt_inhabitant) {
        this.id_family = id_family;
        this.family_name = family_name;
        this.isActive_inhabitant = isActive_inhabitant;
        this.createdAt_inhabitant = createdAt_inhabitant;
        this.updatedAt_inhabitant = updatedAt_inhabitant;
        this.deletedAt_inhabitant = deletedAt_inhabitant;
    }
};
__decorate([
    PrimaryGeneratedColumn("uuid"),
    __metadata("design:type", String)
], Family.prototype, "id_family", void 0);
__decorate([
    Column("varchar", { length: 100 }),
    __metadata("design:type", String)
], Family.prototype, "family_name", void 0);
__decorate([
    OneToMany(() => Inhabitant, (inhabitant) => inhabitant.family),
    __metadata("design:type", Array)
], Family.prototype, "members", void 0);
__decorate([
    Column({ default: true }),
    __metadata("design:type", Boolean)
], Family.prototype, "isActive_inhabitant", void 0);
__decorate([
    CreateDateColumn(),
    __metadata("design:type", Date)
], Family.prototype, "createdAt_inhabitant", void 0);
__decorate([
    UpdateDateColumn(),
    __metadata("design:type", Date)
], Family.prototype, "updatedAt_inhabitant", void 0);
__decorate([
    DeleteDateColumn(),
    __metadata("design:type", Date)
], Family.prototype, "deletedAt_inhabitant", void 0);
Family = __decorate([
    Entity(),
    __metadata("design:paramtypes", [String, String, Boolean, Date,
        Date,
        Date])
], Family);
export { Family };
