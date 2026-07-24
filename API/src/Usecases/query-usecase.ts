import { AppDataSource_MongoDB } from "../Database/database.js"
import { analyserRequete } from "../Query/queryLanguage.js"
import { EventMongo } from "../Database/Entites_MongoDB/event_MONGO.js"
import { ContratMongo } from "../Database/Entites_MongoDB/contrat_MONGO.js"
import { MessageMongo } from "../Database/Entites_MongoDB/message_MONGO.js"
import { VoteMongo } from "../Database/Entites_MongoDB/vote_MONGO.js"
import { ServiceMongo } from "../Database/Entites_MongoDB/service_MONGO.js"
import { InhabitantMongo } from "../Database/Entites_MongoDB/inhabitants_MONGO.js"
import { NeighborhoodMongo } from "../Database/Entites_MongoDB/neighborhood_MONGO.js"
import { ConversationMongo } from "../Database/Entites_MongoDB/conversation_MONGO.js"

// collections autorisees (whitelist), pour empecher d'interroger n'importe quoi
const COLLECTIONS_AUTORISEES: Record<string, any> = {
    events: EventMongo,
    contracts: ContratMongo,
    messages: MessageMongo,
    votes: VoteMongo,
    services: ServiceMongo,
    inhabitants: InhabitantMongo,
    neighborhoods: NeighborhoodMongo,
    conversations: ConversationMongo
}

// bornes sur le nombre de documents renvoyes : sans LIMIT, un FIND inhabitants
// ou FIND messages renverrait des collections entieres (profils, messages,
// signatures...). on met un defaut raisonnable et un plafond dur
const LIMITE_PAR_DEFAUT = 100
const LIMITE_MAXIMUM = 500

export class QueryUsecase {
    // execute une requete du langage maison sur une collection MongoDB
    async executerRequete(texteRequete: string): Promise<{ collection: string; count: number; limit: number; results: any[] }> {
        // le texte est transforme en objet : le filtre est du Mongo pret a l'emploi
        const { collection, filtreMongo, limite } = analyserRequete(texteRequete)

        const EntiteMongo = COLLECTIONS_AUTORISEES[collection.toLowerCase()]
        if (!EntiteMongo) {
            throw new Error(`Collection inconnue: '${collection}'. Disponibles: ${Object.keys(COLLECTIONS_AUTORISEES).join(", ")}`)
        }

        // null = defaut, sinon on borne dans [1, LIMITE_MAXIMUM]
        const limiteAppliquee = limite === null
            ? LIMITE_PAR_DEFAUT
            : Math.min(Math.max(1, limite), LIMITE_MAXIMUM)

        const repo = AppDataSource_MongoDB.getMongoRepository(EntiteMongo)
        const resultats = (await repo.find({ where: filtreMongo })).slice(0, limiteAppliquee)

        // les cles de la reponse (collection/count/limit/results) sont le contrat
        // HTTP avec le front, on ne les traduit pas
        return { collection: collection.toLowerCase(), count: resultats.length, limit: limiteAppliquee, results: resultats }
    }
}
