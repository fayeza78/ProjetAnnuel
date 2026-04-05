import "dotenv/config";
import { DataSource } from "typeorm";
import neo4j from "neo4j-driver";
import { House } from "./Entites_PostGreSQL/house_POSTGRE.js";
import { Apartment } from "./Entites_PostGreSQL/appartment_POSTGRE.js";
import { Family } from "./Entites_PostGreSQL/family_POSTGRE.js";
import { Neighborhood } from "./Entites_PostGreSQL/Neighborhood_POSTGRE.js";
import { Event } from "./Entites_PostGreSQL/event_POSTGRE.js";
import { Inhabitant } from "./Entites_PostGreSQL/Inhabitant_POSTGRE.js";
import { EventMongo } from "./Entites_MongoDB/event_MONGO.js";
import { InhabitantMongo } from "./Entites_MongoDB/inhabitants_MONGO.js";
import { NeighborhoodMongo } from "./Entites_MongoDB/neighborhood_MONGO.js";
console.log("BDD = ", process.env.DB_HOST);
export const AppDataSource_PostgreSQL = new DataSource({
    type: "postgres",
    host: process.env.POSTGRES_HOST || "localhost",
    port: 5432,
    username: process.env.POSTGRES_USER || "admin",
    password: process.env.POSTGRES_PASSWORD || "admin",
    database: process.env.POSTGRES_DB || "connected_neighbours",
    synchronize: true,
    logging: true,
    entities: [Inhabitant, House, Apartment, Family, Neighborhood, Event]
});
export const AppDataSource_MongoDB = new DataSource({
    type: "mongodb",
    host: process.env.MONGO_HOST || "localhost",
    port: 27017,
    username: process.env.MONGO_USER || "admin",
    password: process.env.MONGO_PASSWORD || "admin",
    database: process.env.MONGO_DB || "Neighbours",
    authSource: "admin",
    synchronize: true,
    logging: true,
    entities: [EventMongo, InhabitantMongo, NeighborhoodMongo]
});
export const neo4jDriver = neo4j.driver(`bolt://${process.env.NEO4J_HOST || "localhost"}:${process.env.NEO4J_PORT || 7687}`, neo4j.auth.basic(process.env.NEO4J_USER || "neo4j", process.env.NEO4J_PASSWORD || "neo4jadmin"));
