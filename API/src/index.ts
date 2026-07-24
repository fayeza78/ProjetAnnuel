import "reflect-metadata"    // doit rester en ligne 1 (typeorm en a besoin avant tout le reste)
import "dotenv/config"
import express, { type Request, type Response, type NextFunction } from "express"
import { createServer } from "http"
import { initHandlers } from "./Handlers/routes.js"
import { initRealtime } from "./Realtime/realtime.js"
import { globalLimiter } from "./Middleware/rate-limit.js"
import { securityHeaders } from "./Middleware/security-headers.js"
import { repondreErreur } from "./I18n/i18n.js"
import { AppDataSource_MongoDB, AppDataSource_PostgreSQL, AppDataSource_Neo4j } from "./Database/database.js"

const app = express()
const PORT = process.env.PORT || 3000

app.disable("x-powered-by")

// on est derriere Apache : X-Forwarded-For donne la vraie IP client (pour le rate limit)
// uniquelocal en plus de loopback : en conteneur, Apache arrive par la passerelle
// Docker (172.x) et pas par 127.0.0.1. Sans ca toutes les IP clientes etaient vues
// comme une seule et tout le monde partageait le meme compteur de rate limit
app.set("trust proxy", ["loopback", "uniquelocal"])

app.use(securityHeaders)

// 5 Mo parce que les signatures de contrat (images base64) depassent la limite par defaut
app.use(express.json({ limit: "5mb" }))

app.use(globalLimiter)

// fichiers uploades servis en statique, nosniff pour eviter le XSS stocke
app.use("/uploads", express.static("uploads", {
    setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff")
}))

initHandlers(app)

// 404 au format { code, error }
app.use((req: Request, res: Response) => {
    repondreErreur(req, res, 404, "NOT_FOUND_ROUTE")
})

// gestionnaire d'erreurs final : on renvoie toujours du JSON, messages traduits
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err)
    const e = err as { type?: string; name?: string; message?: string }
    if (e?.type === "entity.too.large") return repondreErreur(req, res, 413, "PAYLOAD_TOO_LARGE")
    if (err instanceof SyntaxError && "body" in (err as object)) return repondreErreur(req, res, 400, "INVALID_JSON")
    if (e?.name === "MulterError") return res.status(400).json({ code: "UPLOAD_ERROR", error: e.message ?? "Erreur de téléversement" })
    if (e?.message === "TYPE_FICHIER_NON_AUTORISE") return repondreErreur(req, res, 415, "FILE_TYPE_NOT_ALLOWED")
    console.error(err)
    return repondreErreur(req, res, 500, "INTERNAL_ERROR")
})

try {
    await AppDataSource_MongoDB.initialize()
    await AppDataSource_PostgreSQL.initialize()
    await AppDataSource_Neo4j.initialize()
} catch (error) {
    console.error(error)
    console.error("Impossible d'initialiser les connexions aux bases de données")
    process.exit(1)
}

// serveur HTTP partage entre Express et Socket.io (presence + chat temps reel)
const httpServer = createServer(app)
initRealtime(httpServer)

httpServer.listen(PORT, () => {
    console.log(`API démarrée sur le port ${PORT} - Swagger : /api-docs`)
})