import { Driver } from "neo4j-driver"
import { EventNode } from "./nodes_NEO4J.js"

export class EventNeo4jRepository {
    constructor(private driver: Driver) {}

    // --- Creation / merge du node ---------------------------------------------

    async merge(event: EventNode): Promise<void> {
        const session = this.driver.session()
        try {
            // Le driver neo4j REFUSE les parametres `undefined` (" Unable to pack
            // the given value ") : un evenement sans type/date ferait echouer tout
            // le merge. Chaque champ optionnel est donc explicitement ramene a null.
            await session.run(
                `MERGE (e:Event {postgres_id: $postgres_id})
                 SET e.titre = $titre, e.type = $type, e.date_ = $date_`,
                {
                    postgres_id: event.postgres_id,
                    titre: event.titre,
                    type: event.type ?? null,
                    date_: event.date_ ?? null
                }
            )
        } finally {
            await session.close()
        }
    }

    async delete(postgres_id: string): Promise<void> {
        const session = this.driver.session()
        try {
            await session.run(
                `MATCH (e:Event {postgres_id: $postgres_id}) DETACH DELETE e`,
                { postgres_id }
            )
        } finally {
            await session.close()
        }
    }

    // --- Tags ----------------------------------------------------------------

    async addTag(event_postgres_id: string, tagName: string): Promise<void> {
        const session = this.driver.session()
        try {
            await session.run(
                `MATCH (e:Event {postgres_id: $event_postgres_id})
                 MERGE (t:Tag {name: $tagName})
                 MERGE (e)-[:A_TAG]->(t)`,
                { event_postgres_id, tagName }
            )
        } finally {
            await session.close()
        }
    }

    async removeTag(event_postgres_id: string, tagName: string): Promise<void> {
        const session = this.driver.session()
        try {
            await session.run(
                `MATCH (e:Event {postgres_id: $event_postgres_id})-[r:A_TAG]->(t:Tag {name: $tagName})
                 DELETE r`,
                { event_postgres_id, tagName }
            )
        } finally {
            await session.close()
        }
    }

    // --- Lecture -------------------------------------------------------------

    // Retourne les postgres_id des participants confirmes d'un evenement.
    async getParticipantsConfirmes(event_postgres_id: string): Promise<string[]> {
        const session = this.driver.session()
        try {
            const result = await session.run(
                `MATCH (u:User)-[:A_PARTICIPE {status: "confirmed"}]->(e:Event {postgres_id: $event_postgres_id})
                 RETURN u.postgres_id AS id`,
                { event_postgres_id }
            )
            return result.records.map(r => r.get("id") as string)
        } finally {
            await session.close()
        }
    }

    // Evenements auxquels deux utilisateurs ont tous deux participe (interactions communes).
    // Utile pour calculer la proximite sociale.
    async getEvenementsCommuns(user1_id: string, user2_id: string): Promise<string[]> {
        const session = this.driver.session()
        try {
            const result = await session.run(
                `MATCH (u1:User {postgres_id: $user1_id})-[:A_PARTICIPE]->(e:Event)<-[:A_PARTICIPE]-(u2:User {postgres_id: $user2_id})
                 RETURN e.postgres_id AS id`,
                { user1_id, user2_id }
            )
            return result.records.map(r => r.get("id") as string)
        } finally {
            await session.close()
        }
    }
}
