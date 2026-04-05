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
let InhabitantMongo = class InhabitantMongo {
    id_inhabitant_Mongo;
    // Lien avec Inhabitant PostgreSQL
    postgres_id;
    avatarUrl;
    bio;
    // Coordonnées GPS pour la carte du quartier
    coordinates;
    // Centres d'intérêt (utilisé par Neo4j pour recommandations)
    interests; // ex: ["jardinage", "cuisine", "sport"]
    // Types de services proposés
    servicesOffered; // ex: ["babysitting", "bricolage"]
    // Note moyenne reçue pour les services
    ratings;
    // RGPD
    gdpr;
    points; // points pour les services payants
    createdAt;
    updatedAt;
    constructor(id_inhabitant_Mongo, postgres_id, avatarUrl, bio, coordinates, interests, servicesOffered, ratings, gdpr, points, createdAt, updatedAt) {
        this.id_inhabitant_Mongo = id_inhabitant_Mongo;
        this.postgres_id = postgres_id;
        this.avatarUrl = avatarUrl;
        this.bio = bio;
        this.coordinates = coordinates;
        this.interests = interests;
        this.servicesOffered = servicesOffered;
        this.ratings = ratings;
        this.gdpr = gdpr;
        this.points = points;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
};
__decorate([
    ObjectIdColumn(),
    __metadata("design:type", ObjectId
    // Lien avec Inhabitant PostgreSQL
    )
], InhabitantMongo.prototype, "id_inhabitant_Mongo", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], InhabitantMongo.prototype, "postgres_id", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], InhabitantMongo.prototype, "avatarUrl", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], InhabitantMongo.prototype, "bio", void 0);
__decorate([
    Column("simple-json", { nullable: true }),
    __metadata("design:type", Object)
], InhabitantMongo.prototype, "coordinates", void 0);
__decorate([
    Column("simple-array", { nullable: true }),
    __metadata("design:type", Array)
], InhabitantMongo.prototype, "interests", void 0);
__decorate([
    Column("simple-array", { nullable: true }),
    __metadata("design:type", Array)
], InhabitantMongo.prototype, "servicesOffered", void 0);
__decorate([
    Column("simple-json", { nullable: true }),
    __metadata("design:type", Object)
], InhabitantMongo.prototype, "ratings", void 0);
__decorate([
    Column("simple-json", { nullable: true }),
    __metadata("design:type", Object)
], InhabitantMongo.prototype, "gdpr", void 0);
__decorate([
    Column({ default: 0 }),
    __metadata("design:type", Number)
], InhabitantMongo.prototype, "points", void 0);
__decorate([
    CreateDateColumn(),
    __metadata("design:type", Date)
], InhabitantMongo.prototype, "createdAt", void 0);
__decorate([
    UpdateDateColumn(),
    __metadata("design:type", Date)
], InhabitantMongo.prototype, "updatedAt", void 0);
InhabitantMongo = __decorate([
    Entity("inhabitants"),
    __metadata("design:paramtypes", [ObjectId, String, String, String, Object, Array, Array, Object, Object, Number, Date,
        Date])
], InhabitantMongo);
export { InhabitantMongo };
