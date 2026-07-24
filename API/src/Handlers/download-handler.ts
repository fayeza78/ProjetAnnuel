import { Request, Response } from "express"
import { existsSync } from "fs"

// Archive .zip du client Java de bureau (image jpackage : .exe + runtime JVM).
// Elle est generee au deploiement par prod.sh et montee en lecture seule dans le
// conteneur (docker-compose : ./private:/app/private). On ne compresse pas a la
// volee : c'est un fichier statique de ~150 Mo, on le renvoie tel quel.
const ARCHIVE_APP_JAVA = "private/petits-secrets-voisins.zip"

// GET /admin/telecharger-app-java : renvoie l'archive du client Java (admin only,
// verifie dans routes.ts). 404 clair si l'archive n'a pas encore ete generee.
export const TelechargerAppJava = (_req: Request, res: Response) => {
    if (!existsSync(ARCHIVE_APP_JAVA)) {
        return res.status(404).json({
            error: "Archive du client Java introuvable. Relancez le déploiement (prod) pour la générer."
        })
    }
    return res.download(ARCHIVE_APP_JAVA, "PetitsSecretsVoisins.zip", (err) => {
        if (err) console.error("Erreur envoi archive Java:", err)
    })
}
