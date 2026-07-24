import { Server } from "socket.io"
import type { Server as HttpServer } from "http"
import jwt from "jsonwebtoken"
import { getJwtSecret } from "../Middleware/jwt.js"
import { AppDataSource_MongoDB } from "../Database/database.js"
import { ConversationMongo } from "../Database/Entites_MongoDB/conversation_MONGO.js"

// presence gardee en memoire : userId -> nombre de sockets ouvertes
const onlineUsers = new Map<string, number>()

export function getOnlineUsers(): string[] {
    return Array.from(onlineUsers.keys())
}

// securite du chat : on verifie que le user est bien membre de la conversation
// avant de le laisser rejoindre ou poster dedans
async function estMembre(userId: string, conversationId: string): Promise<boolean> {
    try {
        const conv = await AppDataSource_MongoDB.getRepository(ConversationMongo)
            .findOne({ where: { postgres_id: conversationId } })
        return !!conv && (conv.participants_postgres_ids ?? []).includes(userId)
    } catch {
        return false
    }
}

// initialise le temps reel (presence online/offline + chat), branche sur le
// serveur HTTP dans index.ts
export function initRealtime(httpServer: HttpServer): Server {
    // CORS : origines autorisees via CORS_ORIGINS (separees par des virgules)
    // si la variable est vide on retombe sur "*" (dev) avec un warning, parce qu'en
    // prod un site tiers pourrait ouvrir une socket avec un token vole
    const origines = (process.env.CORS_ORIGINS ?? "")
        .split(",")
        .map(o => o.trim())
        .filter(Boolean)
    if (origines.length === 0) {
        console.warn("CORS_ORIGINS non défini - Socket.io accepte toutes les origines (*).")
    }

    const io = new Server(httpServer, { cors: { origin: origines.length > 0 ? origines : "*" } })

    // authentification de la socket avec le meme JWT que l'API
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token as string | undefined
        if (!token) return next(new Error("token requis"))
        try {
            const payload = jwt.verify(token, getJwtSecret()) as { userId: number }
            socket.data.userId = payload.userId
            next()
        } catch {
            next(new Error("token invalide"))
        }
    })

    io.on("connection", (socket) => {
        const userId = String(socket.data.userId)

        // passage online (broadcast a tout le monde)
        onlineUsers.set(userId, (onlineUsers.get(userId) ?? 0) + 1)
        io.emit("presence", { userId, status: "online" })

        // rejoindre une conversation pour recevoir ses messages en direct
        // (seulement si on en est membre)
        socket.on("join", async (conversationId: string) => {
            if (await estMembre(userId, conversationId)) {
                socket.join(conversationId)
            } else {
                socket.emit("error", "Accès refusé à cette conversation")
            }
        })

        // diffusion d'un message aux membres de la conversation
        // (refuse si l'emetteur n'est pas membre)
        socket.on("message", async (msg: { conversationId: string; content?: string }) => {
            if (!(await estMembre(userId, msg.conversationId))) return
            io.to(msg.conversationId).emit("message", {
                conversationId: msg.conversationId,
                content: msg.content ?? "",
                sender: userId,
                at: new Date().toISOString()
            })
        })

        // passage offline (seulement quand la derniere socket se ferme)
        socket.on("disconnect", () => {
            const remaining = (onlineUsers.get(userId) ?? 1) - 1
            if (remaining <= 0) {
                onlineUsers.delete(userId)
                io.emit("presence", { userId, status: "offline" })
            } else {
                onlineUsers.set(userId, remaining)
            }
        })
    })

    return io
}
