import { Driver } from "neo4j-driver"
import { QuartierNode } from "./nodes_NEO4J.js"

export class QuartierNeo4jRepository {
    constructor(private driver: Driver) {}

    // --- Creation / merge du node ---------------------------------------------

    async merge(quartier: QuartierNode): Promise<void> {
        const session = this.driver.session()
        try {
            await session.run(
                `MERGE (q:Quartier {postgres_id: $postgres_id})
                 SET q.nom_quartier = $nom_quartier`,
                quartier
            )
        } finally {
            await session.close()
        }
    }

    async delete(postgres_id: string): Promise<void> {
        const session = this.driver.session()
        try {
            await session.run(
                `MATCH (q:Quartier {postgres_id: $postgres_id}) DETACH DELETE q`,
                { postgres_id }
            )
        } finally {
            await session.close()
        }
    }

    // --- Adjacence geographique -----------------------------------------------

    // Definit deux quartiers comme adjacents (relation bidirectionnelle).
    // Utile pour elargir les recommandations aux quartiers voisins.
    async setAdjacent(quartier1_id: string, quartier2_id: string): Promise<void> {
        const session = this.driver.session()
        try {
            await session.run(
                `MATCH (q1:Quartier {postgres_id: $quartier1_id})
                 MATCH (q2:Quartier {postgres_id: $quartier2_id})
                 MERGE (q1)-[:ADJACENT_A]->(q2)
                 MERGE (q2)-[:ADJACENT_A]->(q1)`,
                { quartier1_id, quartier2_id }
            )
        } finally {
            await session.close()
        }
    }

    async removeAdjacent(quartier1_id: string, quartier2_id: string): Promise<void> {
        const session = this.driver.session()
        try {
            await session.run(
                `MATCH (q1:Quartier {postgres_id: $quartier1_id})-[r:ADJACENT_A]-(q2:Quartier {postgres_id: $quartier2_id})
                 DELETE r`,
                { quartier1_id, quartier2_id }
            )
        } finally {
            await session.close()
        }
    }

    // --- Lecture -------------------------------------------------------------

    // Retourne les quartiers accessibles en N sauts (pour elargir un perimetre).
    async getQuartiersProches(postgres_id: string, maxSauts = 1): Promise<string[]> {
        const session = this.driver.session()
        try {
            const result = await session.run(
                `MATCH (q:Quartier {postgres_id: $postgres_id})-[:ADJACENT_A*1..$maxSauts]->(voisin:Quartier)
                 WHERE voisin.postgres_id <> $postgres_id
                 RETURN DISTINCT voisin.postgres_id AS id`,
                { postgres_id, maxSauts }
            )
            return result.records.map(r => r.get("id") as string)
        } finally {
            await session.close()
        }
    }

    // Habitants d'un quartier avec leur score de confiance (aide + notes).
    async getHabitants(postgres_id: string): Promise<{ id: string; score: number }[]> {
        const session = this.driver.session()
        try {
            const result = await session.run(
                `MATCH (u:User)-[:HABITE_DANS]->(q:Quartier {postgres_id: $postgres_id})
                 OPTIONAL MATCH (u)-[aide:A_AIDE]->()
                 OPTIONAL MATCH ()-[note:A_NOTE]->(u)
                 WITH u,
                      COUNT(DISTINCT aide) AS nbAides,
                      AVG(note.rating)     AS noteMoyenne
                 RETURN u.postgres_id AS id,
                        (nbAides * 0.6 + COALESCE(noteMoyenne, 0) * 0.4) AS score
                 ORDER BY score DESC`,
                { postgres_id }
            )
            return result.records.map(r => ({
                id: r.get("id") as string,
                score: r.get("score") as number
            }))
        } finally {
            await session.close()
        }
    }
}
