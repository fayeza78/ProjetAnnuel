import Joi from "joi"
import { mediaUrlRule } from "./utils.js"
import type { CreateConversationRequest, SendMessageRequest } from "../Requests/message-request.js"

// Validators Joi - domaine MESSAGERIE (types sur les interfaces Requests).

export const CreateConversationValidator = Joi.object<CreateConversationRequest>({
    recipient_postgres_ids: Joi.array().items(Joi.string()).min(1).required()
}).options({ abortEarly: false })

export const SendMessageValidator = Joi.object<SendMessageRequest>({
    content: Joi.string().max(2000).optional(),
    // Destinataires explicites (sinon : les autres membres de la conversation).
    recipientIds: Joi.array().items(Joi.string()).optional(),
    mediaAttachments: Joi.array().items(
        Joi.object({
            type: Joi.string().valid("photo", "voice", "video").required(),
            url: mediaUrlRule().required(),   // URI absolue ou /uploads/...
            size: Joi.number().required(),
            mimeType: Joi.string().required(),
            duration: Joi.number().optional()
        })
    ).optional()
}).or("content", "mediaAttachments").options({ abortEarly: false })
