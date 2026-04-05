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
let EventMongo = class EventMongo {
    id_event_Mongo;
    // Lien avec Event PostgreSQL
    postgres_id;
    title_event;
    description;
    // Photos de l'événement
    photos; // URLs des photos
    // Tags pour les recommandations Neo4j
    tags; // ex: ["sport", "gratuit", "famille"]
    // Participants avec leur statut de swipe
    participants;
    // Commentaires
    comments;
    // Infos du créateur (dénormalisé pour éviter les jointures)
    creator;
    createdAt;
    updatedAt;
    constructor(id_event_Mongo, postgres_id, title_event, description, photos, tags, participants, comments, creator, createdAt, updatedAt) {
        this.id_event_Mongo = id_event_Mongo;
        this.postgres_id = postgres_id;
        this.title_event = title_event;
        this.description = description;
        this.photos = photos;
        this.tags = tags;
        this.participants = participants;
        this.comments = comments;
        this.creator = creator;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
};
__decorate([
    ObjectIdColumn(),
    __metadata("design:type", ObjectId
    // Lien avec Event PostgreSQL
    )
], EventMongo.prototype, "id_event_Mongo", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], EventMongo.prototype, "postgres_id", void 0);
__decorate([
    Column(),
    __metadata("design:type", String)
], EventMongo.prototype, "title_event", void 0);
__decorate([
    Column({ nullable: true }),
    __metadata("design:type", String)
], EventMongo.prototype, "description", void 0);
__decorate([
    Column("simple-array", { nullable: true }),
    __metadata("design:type", Array)
], EventMongo.prototype, "photos", void 0);
__decorate([
    Column("simple-array", { nullable: true }),
    __metadata("design:type", Array)
], EventMongo.prototype, "tags", void 0);
__decorate([
    Column("simple-json", { nullable: true }),
    __metadata("design:type", Array)
], EventMongo.prototype, "participants", void 0);
__decorate([
    Column("simple-json", { nullable: true }),
    __metadata("design:type", Array)
], EventMongo.prototype, "comments", void 0);
__decorate([
    Column("simple-json", { nullable: true }),
    __metadata("design:type", Object)
], EventMongo.prototype, "creator", void 0);
__decorate([
    CreateDateColumn(),
    __metadata("design:type", Date)
], EventMongo.prototype, "createdAt", void 0);
__decorate([
    UpdateDateColumn(),
    __metadata("design:type", Date)
], EventMongo.prototype, "updatedAt", void 0);
EventMongo = __decorate([
    Entity("events"),
    __metadata("design:paramtypes", [ObjectId, String, String, String, Array, Array, Array, Array, Object, Date,
        Date])
], EventMongo);
export { EventMongo };
