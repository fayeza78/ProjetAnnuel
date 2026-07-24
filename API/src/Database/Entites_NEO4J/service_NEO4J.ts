import { Driver } from "neo4j-driver"
import { ServiceNode } from "./nodes_NEO4J.js"

export class ServiceNeo4jRepository {
    constructor(private driver: Driver) {}

    // --- Creation / merge du node ---------------------------------------------

    async merge(service: ServiceNode): Promise<void> {
        const session = this.driver.session()
        try {
            // Meme protection que pour les evenements : les champs optionnels
            // absents (`categorie`, `prix`) doivent etre null, jamais undefined,
            // sinon le driver neo4j rejette la requete entiere.
            await session.run(
                `MERGE (s:Service {postgres_id: $postgres_id})
                 SET s.type = $type, s.categorie = $categorie, s.prix = $prix`,
                {
                    postgres_id: service.postgres_id,
                    type: service.type,
                    categorie: service.categorie ?? null,
                    prix: service.prix ?? null
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
                `MATCH (s:Service {postgres_id: $postgres_id}) DETACH DELETE s`,
                { postgres_id }
            )
        } finally {
            await session.close()
        }
    }

    // --- Relation prestataire ------------------------------------------------

    // Lie un User comme prestataire du service.
    // Cree lors de l'offre d'un service.
    async setPrestataire(service_postgres_id: string, user_postgres_id: string): Promise<void> {
        const session = this.driver.session()
        try {
            await session.run(
                `MATCH (s:Service {postgres_id: $service_postgres_id})
                 MATCH (u:User {postgres_id: $user_postgres_id})
                 MERGE (u)-[:PROPOSE_SERVICE]->(s)`,
                { service_postgres_id, user_postgres_id }
            )
        } finally {
            await session.close()
        }
    }

    // --- Tags / categories ----------------------------------------------------

    async addTag(service_postgres_id: string, tagName: string): Promise<void> {
        const session = this.driver.session()
        try {
            await session.run(
                `MATCH (s:Service {postgres_id: $service_postgres_id})
                 MERGE (t:Tag {name: $tagName})
                 MERGE (s)-[:A_TAG]->(t)`,
                { service_postgres_id, tagName }
            )
        } finally {
            await session.close()
        }
    }

    // --- Lecture -------------------------------------------------------------

    // Retourne les services proposes par les voisins directs d'un utilisateur
    // (meme quartier), tries par note moyenne du prestataire.
    async getServicesVoisins(user_postgres_id: string, limit = 10): Promise<string[]> {
        const session = this.driver.session()
        try {
            const result = await session.run(
                `MATCH (me:User {postgres_id: $user_postgres_id})-[:HABITE_DANS]->(q:Quartier)
                 MATCH (prestataire:User)-[:HABITE_DANS]->(q)
                 WHERE prestataire.postgres_id <> $user_postgres_id
                 MATCH (prestataire)-[:PROPOSE_SERVICE]->(s:Service)
                 OPTIONAL MATCH ()-[note:A_NOTE]->(prestataire)
                 WITH s, prestataire, AVG(note.rating) AS noteMoyenne
                 ORDER BY COALESCE(noteMoyenne, 0) DESC
                 LIMIT toInteger($limit)
                 RETURN s.postgres_id AS id`,
                { user_postgres_id, limit }
            )
            return result.records.map(r => r.get("id") as string)
        } finally {
            await session.close()
        }
    }
}
