import "dotenv/config"
import { DataSource } from "typeorm";
import neo4j from "neo4j-driver"
// import { Product } from "./entities/product.js";
// import { User } from "./entities/user.js";
// import { Token } from "./entities/token.js";

console.log(process.env.DB_HOST)

export const AppDataSource_PostgreSQL = new DataSource({
    type: "postgres",
    host: process.env.POSTGRES_HOST || "localhost",
    port: 5432,
    username: process.env.POSTGRES_USER || "admin",
    password: process.env.POSTGRES_PASSWORD || "admin",
    database: process.env.POSTGRES_DB || "connected_neighbours",
    synchronize: true,
    logging: true,
    entities: []
})
 
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
    entities: []
})
 
export const neo4jDriver = neo4j.driver(
    `bolt://${process.env.NEO4J_HOST || "localhost"}:${process.env.NEO4J_PORT || 7687}`,
    neo4j.auth.basic(
        process.env.NEO4J_USER || "neo4j",
        process.env.NEO4J_PASSWORD || "neo4jadmin"
    )
)