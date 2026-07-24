import { Driver } from "neo4j-driver";
import {
  A_AIDE_Props,
  A_NOTE_Props,
  A_PARTICIPE_Props,
  UserNode,
} from "./nodes_NEO4J.js";

export class UserNeo4jRepository {
  constructor(private driver: Driver) {}

  // --- Creation / merge du node ---------------------------------------------

  async merge(user: UserNode): Promise<void> {
    const session = this.driver.session();
    try {
      // Le driver neo4j refuse les parametres `undefined` -> champ optionnel
      // explicitement ramene a null (un spread ne suffirait pas : une cle
      // presente avec la valeur undefined reecraserait le defaut).
      await session.run(
        `MERGE (u:User {postgres_id: $postgres_id})
                 SET u.email = $email, u.role = $role, u.nom_quartier = $nom_quartier`,
        {
          postgres_id: user.postgres_id,
          email: user.email,
          role: user.role,
          nom_quartier: user.nom_quartier ?? null,
        },
      );
    } finally {
      await session.close();
    }
  }

  // Garantit l'existence du noeud SANS ecraser ses proprietes s'il existe deja
  // (ON CREATE SET uniquement). Utilise en " auto-reparation " avant de creer une
  // relation (participation, note, A_AIDE...) pour les comptes crees avant que
  // l'inscription ne synchronise Neo4j.
  async ensure(postgres_id: string, email = "", role = "user"): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        `MERGE (u:User {postgres_id: $postgres_id})
                 ON CREATE SET u.email = $email, u.role = $role`,
        { postgres_id, email, role },
      );
    } finally {
      await session.close();
    }
  }

  async delete(postgres_id: string): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (u:User {postgres_id: $postgres_id}) DETACH DELETE u`,
        { postgres_id },
      );
    } finally {
      await session.close();
    }
  }

  // --- Relations avec Quartier ----------------------------------------------

  async habiterDans(
    user_postgres_id: string,
    quartier_postgres_id: string,
  ): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (u:User {postgres_id: $user_postgres_id})
                 MATCH (q:Quartier {postgres_id: $quartier_postgres_id})
                 MERGE (u)-[:HABITE_DANS]->(q)`,
        { user_postgres_id, quartier_postgres_id },
      );
    } finally {
      await session.close();
    }
  }

  // --- Centres d'interet ----------------------------------------------------

  async addInterest(postgres_id: string, tagName: string): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (u:User {postgres_id: $postgres_id})
                 MERGE (t:Tag {name: $tagName})
                 MERGE (u)-[:INTERESSE_PAR]->(t)`,
        { postgres_id, tagName },
      );
    } finally {
      await session.close();
    }
  }

  async removeInterest(postgres_id: string, tagName: string): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (u:User {postgres_id: $postgres_id})-[r:INTERESSE_PAR]->(t:Tag {name: $tagName})
                 DELETE r`,
        { postgres_id, tagName },
      );
    } finally {
      await session.close();
    }
  }

  // Remplace l'ensemble des centres d'interet de l'utilisateur (declaratif) :
  // supprime les INTERESSE_PAR existants puis relie chaque tag fourni.
  // Alimente directement le moteur de recommandations (evenements/services).
  async setInterests(postgres_id: string, tags: string[]): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (u:User {postgres_id: $postgres_id})
                 OPTIONAL MATCH (u)-[r:INTERESSE_PAR]->()
                 DELETE r
                 WITH DISTINCT u
                 UNWIND $tags AS tagName
                 MERGE (t:Tag {name: tagName})
                 MERGE (u)-[:INTERESSE_PAR]->(t)`,
        { postgres_id, tags },
      );
    } finally {
      await session.close();
    }
  }

  // --- Services rendus (qui a aide qui) ------------------------------------

  async aAide(
    helper_postgres_id: string,
    helped_postgres_id: string,
    props: A_AIDE_Props,
  ): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (helper:User {postgres_id: $helper_postgres_id})
                 MATCH (helped:User {postgres_id: $helped_postgres_id})
                 CREATE (helper)-[:A_AIDE {service_postgres_id: $service_postgres_id, points: $points, date: $date}]->(helped)`,
        { helper_postgres_id, helped_postgres_id, ...props },
      );
    } finally {
      await session.close();
    }
  }

  // --- Participation aux evenements -----------------------------------------

  async participer(
    user_postgres_id: string,
    event_postgres_id: string,
    props: A_PARTICIPE_Props,
  ): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (u:User {postgres_id: $user_postgres_id})
                 MATCH (e:Event {postgres_id: $event_postgres_id})
                 MERGE (u)-[r:A_PARTICIPE]->(e)
                 SET r.status = $status, r.joinedAt = $joinedAt`,
        { user_postgres_id, event_postgres_id, ...props },
      );
    } finally {
      await session.close();
    }
  }

  // --- Notation d'un voisin -------------------------------------------------

  async noter(
    rater_postgres_id: string,
    rated_postgres_id: string,
    props: A_NOTE_Props,
  ): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (rater:User {postgres_id: $rater_postgres_id})
                 MATCH (rated:User {postgres_id: $rated_postgres_id})
                 MERGE (rater)-[r:A_NOTE]->(rated)
                 SET r.rating = $rating, r.date = $date`,
        { rater_postgres_id, rated_postgres_id, ...props },
      );
    } finally {
      await session.close();
    }
  }

  // --- Note lue (ma note donnee + moyenne recue) ---------------------------

  // Renvoie la note que `rater` a donnee a `rated` (null s'il ne l'a pas notee),
  // la moyenne des notes recues par `rated` (null si personne ne l'a note) et le
  // nombre de notes recues. Une seule requete : les deux OPTIONAL MATCH partent du
  // meme noeud `rated`.
  async getNoteDonnee(
    rater_postgres_id: string,
    rated_postgres_id: string,
  ): Promise<{ maNote: number | null; moyenne: number | null; nombreDeNotes: number }> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (rated:User {postgres_id: $rated_postgres_id})
                 OPTIONAL MATCH (rater:User {postgres_id: $rater_postgres_id})-[maNote:A_NOTE]->(rated)
                 OPTIONAL MATCH ()-[toutes:A_NOTE]->(rated)
                 RETURN maNote.rating AS maNote,
                        AVG(toutes.rating) AS moyenne,
                        COUNT(toutes)      AS nombreDeNotes`,
        { rater_postgres_id, rated_postgres_id },
      );
      // neo4j renvoie ses entiers comme objets ({low, high}) : on les ramene en number
      const enNombre = (v: any): number | null =>
        v == null
          ? null
          : typeof v.toNumber === "function"
            ? v.toNumber()
            : Number(v);
      const rec = result.records[0];
      const moyenne = enNombre(rec?.get("moyenne"));
      return {
        maNote: enNombre(rec?.get("maNote")),
        moyenne: moyenne == null ? null : Math.round(moyenne * 10) / 10,
        nombreDeNotes: enNombre(rec?.get("nombreDeNotes")) ?? 0,
      };
    } finally {
      await session.close();
    }
  }

  // --- Recommandations -----------------------------------------------------

  // Voisins fiables : habitants du meme quartier, tries par score de confiance.
  // Trois signaux dans le score : le nombre d'aides rendues (activite), la note
  // moyenne recue (reputation) et le nombre de centres d'interet en commun avec
  // moi (affinite via les tags INTERESSE_PAR). L'activite pese le plus, l'affinite
  // sert de bonus pour departager deux voisins aussi actifs et aussi bien notes.
  async getVoisinsFiables(postgres_id: string, limit = 10): Promise<string[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (me:User {postgres_id: $postgres_id})-[:HABITE_DANS]->(q:Quartier)
                 MATCH (voisin:User)-[:HABITE_DANS]->(q)
                 WHERE voisin.postgres_id <> $postgres_id
                 OPTIONAL MATCH (voisin)-[aide:A_AIDE]->()
                 OPTIONAL MATCH ()-[note:A_NOTE]->(voisin)
                 OPTIONAL MATCH (me)-[:INTERESSE_PAR]->(tag:Tag)<-[:INTERESSE_PAR]-(voisin)
                 WITH voisin,
                      COUNT(DISTINCT aide) AS nbAides,
                      AVG(note.rating)     AS noteMoyenne,
                      COUNT(DISTINCT tag)  AS interetsCommuns
                 ORDER BY (nbAides * 0.5 + COALESCE(noteMoyenne, 0) * 0.3 + interetsCommuns * 0.2) DESC
                 LIMIT toInteger($limit)
                 RETURN voisin.postgres_id AS id`,
        { postgres_id, limit },
      );
      return result.records.map((r) => r.get("id") as string);
    } finally {
      await session.close();
    }
  }

  // Evenements pertinents : evenements tagues avec les interets de l'utilisateur
  // ou auxquels des voisins de confiance participent, que l'utilisateur n'a pas encore vus.
  async getEvenementsRecommandes(
    postgres_id: string,
    limit = 10,
  ): Promise<string[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (me:User {postgres_id: $postgres_id})
                 // Evenements via interets communs
                 OPTIONAL MATCH (me)-[:INTERESSE_PAR]->(t:Tag)<-[:A_TAG]-(e1:Event)
                 WHERE NOT (me)-[:A_PARTICIPE]->(e1)
                 // Evenements via voisins qui participent
                 OPTIONAL MATCH (me)-[:HABITE_DANS]->(q:Quartier)<-[:HABITE_DANS]-(voisin:User)
                 OPTIONAL MATCH (voisin)-[:A_PARTICIPE {status: "confirmed"}]->(e2:Event)
                 WHERE NOT (me)-[:A_PARTICIPE]->(e2)
                 WITH COLLECT(DISTINCT e1.postgres_id) + COLLECT(DISTINCT e2.postgres_id) AS ids
                 UNWIND ids AS id
                 WITH id WHERE id IS NOT NULL
                 RETURN DISTINCT id
                 LIMIT toInteger($limit)`,
        { postgres_id, limit },
      );
      return result.records.map((r) => r.get("id") as string);
    } finally {
      await session.close();
    }
  }

  // Services compatibles : services dont la categorie correspond aux interets
  // de l'utilisateur, proposes par des voisins du meme quartier.
  async getServicesRecommandes(
    postgres_id: string,
    limit = 10,
  ): Promise<string[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (me:User {postgres_id: $postgres_id})-[:INTERESSE_PAR]->(t:Tag)<-[:A_TAG]-(s:Service)
                 MATCH (prestataire:User)-[:PROPOSE_SERVICE]->(s)
                 WHERE prestataire.postgres_id <> $postgres_id
                 OPTIONAL MATCH ()-[note:A_NOTE]->(prestataire)
                 WITH s, AVG(note.rating) AS noteMoyenne
                 ORDER BY COALESCE(noteMoyenne, 0) DESC
                 LIMIT toInteger($limit)
                 RETURN s.postgres_id AS id`,
        { postgres_id, limit },
      );
      return result.records.map((r) => r.get("id") as string);
    } finally {
      await session.close();
    }
  }
}
