import { neo4jDriver } from "../database.js"
import { UserNeo4jRepository } from "./user_NEO4J.js"
import { EventNeo4jRepository } from "./event_NEO4J.js"
import { ServiceNeo4jRepository } from "./service_NEO4J.js"
import { QuartierNeo4jRepository } from "./quartier_NEO4J.js"

export const UserNeo4j     = new UserNeo4jRepository(neo4jDriver)
export const EventNeo4j    = new EventNeo4jRepository(neo4jDriver)
export const ServiceNeo4j  = new ServiceNeo4jRepository(neo4jDriver)
export const QuartierNeo4j = new QuartierNeo4jRepository(neo4jDriver)

export * from "./nodes_NEO4J.js"
