import "dotenv/config"
import { DataSource } from "typeorm";
import neo4j, { Driver, Session } from "neo4j-driver"

class Neo4jDataSource {
    private driver: Driver

    constructor(config: {
        host: string
        port: number
        username: string
        password: string
    }) {
        this.driver = neo4j.driver(
            `bolt://${config.host}:${config.port}`,
            neo4j.auth.basic(config.username, config.password),
            { encrypted: false }
        )
    }

    session(): Session {
        return this.driver.session()
    }

    getDriver(): Driver {
        return this.driver
    }

    async initialize(): Promise<void> {
        await this.driver.verifyConnectivity()

        const session = this.driver.session()
        try {
            const constraints = [
                `CREATE CONSTRAINT user_postgres_id    IF NOT EXISTS FOR (u:User)     REQUIRE u.postgres_id IS UNIQUE`,
                `CREATE CONSTRAINT event_postgres_id   IF NOT EXISTS FOR (e:Event)    REQUIRE e.postgres_id IS UNIQUE`,
                `CREATE CONSTRAINT service_postgres_id IF NOT EXISTS FOR (s:Service)  REQUIRE s.postgres_id IS UNIQUE`,
                `CREATE CONSTRAINT quartier_postgres_id IF NOT EXISTS FOR (q:Quartier) REQUIRE q.postgres_id IS UNIQUE`,
                `CREATE CONSTRAINT tag_name             IF NOT EXISTS FOR (t:Tag)      REQUIRE t.name        IS UNIQUE`,
            ]
            const indexes = [
                `CREATE INDEX user_role         IF NOT EXISTS FOR (u:User)    ON (u.role)`,
                `CREATE INDEX user_nom_quartier IF NOT EXISTS FOR (u:User)    ON (u.nom_quartier)`,
                `CREATE INDEX event_type        IF NOT EXISTS FOR (e:Event)   ON (e.type)`,
                `CREATE INDEX event_date        IF NOT EXISTS FOR (e:Event)   ON (e.date_)`,
                `CREATE INDEX service_categorie IF NOT EXISTS FOR (s:Service) ON (s.categorie)`,
            ]
            for (const query of [...constraints, ...indexes]) {
                await session.run(query)
            }
        } finally {
            await session.close()
        }
    }
}

import { User} from "./Entites_PostGreSQL/user_POSTGRE.js";
import { Quartier } from "./Entites_PostGreSQL/quartier_POSTGRE.js";
import { Competence } from "./Entites_PostGreSQL/competence_POSTGRE.js";
import { Evenement } from "./Entites_PostGreSQL/evenement_POSTGRE.js";
import { Incident } from "./Entites_PostGreSQL/incident_POSTGRE.js";
import { Token } from "./Entites_PostGreSQL/token_POSTGRE.js";
import { EffectueDemande } from "./Entites_PostGreSQL/effectueDemande_POSTGRE.js";
import { Contrat } from "./Entites_PostGreSQL/contrat_POSTGRE.js";
import { Service } from "./Entites_PostGreSQL/service_POSTGRE.js";
import { PointTransaction } from "./Entites_PostGreSQL/pointTransaction_POSTGRE.js";
import { Signalement } from "./Entites_PostGreSQL/signalement_POSTGRE.js";

import { EventMongo } from "./Entites_MongoDB/event_MONGO.js";
import { InhabitantMongo } from "./Entites_MongoDB/inhabitants_MONGO.js";
import { NeighborhoodMongo } from "./Entites_MongoDB/neighborhood_MONGO.js";
import { ContratMongo } from "./Entites_MongoDB/contrat_MONGO.js";
import { MessageMongo } from "./Entites_MongoDB/message_MONGO.js";
import { ServiceMongo } from "./Entites_MongoDB/service_MONGO.js";
import { VoteMongo } from "./Entites_MongoDB/vote_MONGO.js";
import { ConversationMongo } from "./Entites_MongoDB/conversation_MONGO.js";

// logs SQL seulement hors production
const DB_LOGGING = process.env.NODE_ENV !== "production"

// le schema est synchronise automatiquement depuis les entites, DB_SYNC=false pour couper
const DB_SYNC = process.env.DB_SYNC !== "false"

export const AppDataSource_PostgreSQL = new DataSource({
    type: "postgres",
    host: process.env.POSTGRES_HOST || "localhost",
    port: 5432,
    username: process.env.POSTGRES_USER || "admin",
    password: process.env.POSTGRES_PASSWORD || "admin",
    database: process.env.POSTGRES_DB || "connected_neighbours",
    synchronize: DB_SYNC,
    logging: DB_LOGGING,
    entities: [User, Quartier, Competence, Evenement, Incident, Token, EffectueDemande, Contrat, Service, PointTransaction, Signalement]
}
)
 
export const AppDataSource_MongoDB = new DataSource({
    type: "mongodb",
    host: process.env.MONGO_HOST || "localhost",
    port: 27017,
    username: process.env.MONGO_USER || "admin",
    password: process.env.MONGO_PASSWORD || "admin",
    database: process.env.MONGO_DB || "Neighbours",
    authSource: "admin",
    synchronize: DB_SYNC,
    logging: DB_LOGGING,
    entities: [EventMongo, InhabitantMongo, NeighborhoodMongo, ContratMongo, MessageMongo, ServiceMongo, VoteMongo, ConversationMongo]
})
 
export const AppDataSource_Neo4j = new Neo4jDataSource({
    host:     process.env.NEO4J_HOST     || "localhost",
    port:     parseInt(process.env.NEO4J_PORT || "7687"),
    username: process.env.NEO4J_USER     || "neo4j",
    password: process.env.NEO4J_PASSWORD || "neo4jadmin"
})

export const neo4jDriver = AppDataSource_Neo4j.getDriver()