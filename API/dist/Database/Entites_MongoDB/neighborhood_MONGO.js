var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Entity, ObjectIdColumn, ObjectId, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";
let NeighborhoodMongo = class NeighborhoodMongo {
    id_neighborhood;
    postgres_id;
    description;
    photos;
    // Statistiques du quartier
    stats;
    createdAt;
    updatedAt;
    constructor(id_neighborhood, postgres_id, description, photos, stats, createdAt, updatedAt) {
        this.id_neighborhood = id_neighborhood;
        this.postgres_id = postgres_id;
        this.description = description;
        this.photos = photos;
        this.stats = stats;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
};
__decorate([
    ObjectIdColumn(),
    __metadata("design:type", ObjectId)
], NeighborhoodMongo.prototype, "id_neighborhood", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], NeighborhoodMongo.prototype, "postgres_id", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], NeighborhoodMongo.prototype, "description", void 0);
__decorate([
    Column("simple-array", { nullable: true }),
    __metadata("design:type", Array)
], NeighborhoodMongo.prototype, "photos", void 0);
__decorate([
    Column("simple-json", { nullable: true }),
    __metadata("design:type", Object)
], NeighborhoodMongo.prototype, "stats", void 0);
__decorate([
    CreateDateColumn(),
    __metadata("design:type", Date)
], NeighborhoodMongo.prototype, "createdAt", void 0);
__decorate([
    UpdateDateColumn(),
    __metadata("design:type", Date)
], NeighborhoodMongo.prototype, "updatedAt", void 0);
NeighborhoodMongo = __decorate([
    Entity("neighborhoods"),
    __metadata("design:paramtypes", [ObjectId, String, String, Array, Object, Date,
        Date])
], NeighborhoodMongo);
export { NeighborhoodMongo };
