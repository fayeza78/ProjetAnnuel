import { AppDataSource_MongoDB } from "../Database/database.js"
import { MessageMongo } from "../Database/Entites_MongoDB/message_MONGO.js"
import { ConversationMongo } from "../Database/Entites_MongoDB/conversation_MONGO.js"
import { randomUUID } from "crypto"

export class MessageUsecase {
    private get repo() {
        return AppDataSource_MongoDB.getRepository(MessageMongo)
    }
    private get convRepo() {
        return AppDataSource_MongoDB.getRepository(ConversationMongo)
    }

    // conversations dont le user est membre (+ dernier message de chacune)
    async getConversations(userId: number): Promise<{ conversation: ConversationMongo; lastMessage: MessageMongo | null }[]> {
        const userStr = userId.toString()
        const all = await this.convRepo.find()
        const mine = all.filter(c => (c.participants_postgres_ids ?? []).includes(userStr))

        const result: { conversation: ConversationMongo; lastMessage: MessageMongo | null }[] = []
        for (const conv of mine) {
            const msgs = await this.repo.find({ where: { conversationId: conv.postgres_id } })
            let last: MessageMongo | null = null
            for (const m of msgs) {
                if (!last || m.createdAt > last.createdAt) last = m
            }
            result.push({ conversation: conv, lastMessage: last })
        }
        return result
    }

    async getConversation(conversationId: string): Promise<ConversationMongo | null> {
        return await this.convRepo.findOne({ where: { postgres_id: conversationId } })
    }

    // cree une conversation avec ses participants (createur inclus)
    async createConversation(creatorId: number, participantIds: string[]): Promise<ConversationMongo> {
        const participants = Array.from(new Set([creatorId.toString(), ...participantIds]))
        const conv = this.convRepo.create({
            postgres_id: randomUUID(),
            participants_postgres_ids: participants,
            type: participants.length > 2 ? "group" : "direct",
            title: null,
            createdBy_postgres_id: creatorId.toString(),
            lastMessageAt: null
        })
        return await this.convRepo.save(conv)
    }

    async getMessages(conversationId: string): Promise<MessageMongo[]> {
        return await this.repo.find({ where: { conversationId } })
    }

    async sendMessage(data: {
        conversationId: string
        senderId: number
        recipientIds?: string[]
        content?: string
        mediaAttachments?: {
            type: "photo" | "voice" | "video"
            url: string
            size: number
            mimeType: string
            duration?: number
        }[]
    }): Promise<MessageMongo> {
        const conv = await this.getConversation(data.conversationId)

        // destinataires : ceux fournis, sinon les autres membres de la conversation
        let recipients = data.recipientIds ?? []
        if (recipients.length === 0 && conv) {
            recipients = (conv.participants_postgres_ids ?? []).filter(id => id !== data.senderId.toString())
        }

        const message = this.repo.create({
            postgres_id: randomUUID(),
            conversationId: data.conversationId,
            sender_postgres_id: data.senderId.toString(),
            recipient_postgres_ids: recipients,
            content: data.content ?? "",
            mediaAttachments: data.mediaAttachments ?? []
        })
        const saved = await this.repo.save(message)

        // met a jour la date du dernier message de la conversation
        if (conv) {
            conv.lastMessageAt = new Date()
            await this.convRepo.save(conv)
        }

        return saved
    }
}
