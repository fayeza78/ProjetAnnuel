// Interfaces des corps de requetes - domaine RGPD.

export interface ConsentementRequest {
    consentement: boolean      // true = accorder, false = retirer (art. 7 RGPD)
}
