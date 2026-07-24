// Interfaces des corps de requetes - domaine MESSAGERIE.

export interface MediaAttachmentInput {
    type: "photo" | "voice" | "video"
    url: string
    size: number
    mimeType: string
    duration?: number
}

export interface CreateConversationRequest {
    recipient_postgres_ids: string[]
}

export interface SendMessageRequest {
    content?: string           // requis si mediaAttachments absent (regle .or de Joi)
    recipientIds?: string[]    // sinon : les autres membres de la conversation
    mediaAttachments?: MediaAttachmentInput[]
}
