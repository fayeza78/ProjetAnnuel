// Interfaces des corps de requetes - domaine VOTES.

export interface CreateVoteRequest {
    question: string
    description?: string
    type: "single" | "multiple" | "yesno"
    options: string[]          // >= 2 libelles
    isAnonymous?: boolean      // defaut false (applique par Joi)
    deadline?: Date            // doit etre dans le futur (verifie au handler)
    targetQuartier_postgres_id?: string
}

export interface CastVoteRequest {
    optionIds: string[]        // doivent exister dans le sondage
}
