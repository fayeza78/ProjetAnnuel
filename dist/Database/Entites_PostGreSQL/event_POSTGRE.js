var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Inhabitant } from "./Inhabitant_POSTGRE.js";
import { Neighborhood } from "./Neighborhood_POSTGRE.js";
export var EventStatus;
(function (EventStatus) {
    EventStatus["DRAFT"] = "draft";
    EventStatus["PUBLISHED"] = "published";
    EventStatus["CANCELLED"] = "cancelled";
    EventStatus["DONE"] = "done"; // terminé
})(EventStatus || (EventStatus = {}));
export var EventType;
(function (EventType) {
    EventType["SOCIAL"] = "social";
    EventType["WORKSHOP"] = "workshop";
    EventType["FUNDRAISER"] = "fundraiser";
    EventType["SPORT"] = "sport";
    EventType["OTHER"] = "other";
})(EventType || (EventType = {}));
let Event = class Event {
    id_event;
    // ── Relations ────────────────────────────────────────────────
    // FK → Inhabitant (créateur de l'événement)
    creator;
    neighborhood;
    title_event;
    type_event;
    status_event;
    startDate_event;
    endDate_event;
    location_event;
    participants_count;
    max_participants;
    price_event;
    isActive_event;
    createdAt_event;
    updatedAt_event;
    deletedAt_event;
    constructor(id_event, creator, neighborhood, title_event, type_event, status_event, startDate_event, endDate_event, location_event, participants_count, max_participants, price_event, isActive_event, createdAt_event, updatedAt_event, deletedAt_event) {
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
};
__decorate([
    PrimaryGeneratedColumn("uuid"),
    __metadata("design:type", String)
], Event.prototype, "id_event", void 0);
__decorate([
    ManyToOne(() => Inhabitant, { nullable: false }),
    JoinColumn({ name: "creator_id" }),
    __metadata("design:type", Inhabitant)
], Event.prototype, "creator", void 0);
__decorate([
    ManyToOne(() => Neighborhood, (neighborhood) => neighborhood.events, { nullable: false }),
    JoinColumn({ name: "neighborhood_id" }),
    __metadata("design:type", Neighborhood)
], Event.prototype, "neighborhood", void 0);
__decorate([
    Column("varchar", { length: 150 }),
    __metadata("design:type", String)
], Event.prototype, "title_event", void 0);
__decorate([
    Column({
        type: "enum",
        enum: EventType,
        default: EventType.OTHER
    }),
    __metadata("design:type", String)
], Event.prototype, "type_event", void 0);
__decorate([
    Column({
        type: "enum",
        enum: EventStatus,
        default: EventStatus.DRAFT
    }),
    __metadata("design:type", String)
], Event.prototype, "status_event", void 0);
__decorate([
    Column("timestamp"),
    __metadata("design:type", Date)
], Event.prototype, "startDate_event", void 0);
__decorate([
    Column("timestamp", { nullable: true }),
    __metadata("design:type", Date)
], Event.prototype, "endDate_event", void 0);
__decorate([
    Column("varchar", { length: 255, nullable: true }),
    __metadata("design:type", String)
], Event.prototype, "location_event", void 0);
__decorate([
    Column("int", { default: 0 }),
    __metadata("design:type", Number)
], Event.prototype, "participants_count", void 0);
__decorate([
    Column("int", { nullable: true }),
    __metadata("design:type", Number)
], Event.prototype, "max_participants", void 0);
__decorate([
    Column("float", { nullable: true }),
    __metadata("design:type", Number)
], Event.prototype, "price_event", void 0);
__decorate([
    Column("boolean", { default: true }),
    __metadata("design:type", Boolean)
], Event.prototype, "isActive_event", void 0);
__decorate([
    CreateDateColumn(),
    __metadata("design:type", Date)
], Event.prototype, "createdAt_event", void 0);
__decorate([
    UpdateDateColumn(),
    __metadata("design:type", Date)
], Event.prototype, "updatedAt_event", void 0);
__decorate([
    DeleteDateColumn(),
    __metadata("design:type", Date)
], Event.prototype, "deletedAt_event", void 0);
Event = __decorate([
    Entity(),
    __metadata("design:paramtypes", [String, Inhabitant,
        Neighborhood, String, String, String, Date,
        Date, String, Number, Number, Number, Boolean, Date,
        Date,
        Date])
], Event);
export { Event };
