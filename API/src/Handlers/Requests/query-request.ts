// Interfaces des corps de requetes - domaine QUERY (langage maison MongoDB).

export interface QueryRequest {
    query: string              // ex. FIND events WHERE tags CONTAINS "musique" LIMIT 5
}
