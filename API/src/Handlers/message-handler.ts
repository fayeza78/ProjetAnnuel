import { Request, Response } from "express"
import { CreateConversationValidator, SendMessageValidator } from "./Validators/message-validators.js"
import { generateValidationErrorMessage } from "./Validators/utils.js"
import { MessageUsecase } from "../Usecases/message-usecase.js"

const getUsecase = () => new MessageUsecase()

export const GetConversations = async (req: Request, res: Response) => {
    try {
        const conversations = await getUsecase().getConversations(req.user!.userId)
        return res.status(200).json(conversations)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const CreateConversation = async (req: Request, res: Response) => {
    const validation = CreateConversationValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }

    try {
        const conversation = await getUsecase().createConversation(
            req.user!.userId,
            validation.value.recipient_postgres_ids
        )
        return res.status(201).json(conversation)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const GetMessages = async (req: Request, res: Response) => {
    const { conversationId } = req.params

    try {
        // controle d'acces : l'appelant doit etre membre de la conversation
        const conv = await getUsecase().getConversation(conversationId as string)
        if (!conv) return res.status(404).json({ error: "Conversation introuvable" })
        if (!(conv.participants_postgres_ids ?? []).includes(req.user!.userId.toString())) {
            return res.status(403).json({ error: "Vous n'êtes pas membre de cette conversation" })
        }

        const messages = await getUsecase().getMessages(conversationId as string)
        return res.status(200).json(messages)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const EnvoyerMessage = async (req: Request, res: Response) => {
    const { conversationId } = req.params

    const validation = SendMessageValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }

    const { content, recipientIds, mediaAttachments } = validation.value

    try {
        // controle d'acces : l'appelant doit etre membre de la conversation
        const conv = await getUsecase().getConversation(conversationId as string)
        if (!conv) return res.status(404).json({ error: "Conversation introuvable" })
        if (!(conv.participants_postgres_ids ?? []).includes(req.user!.userId.toString())) {
            return res.status(403).json({ error: "Vous n'êtes pas membre de cette conversation" })
        }

        const message = await getUsecase().sendMessage({
            conversationId: conversationId as string,
            senderId: req.user!.userId,
            ...(recipientIds ? { recipientIds } : {}),
            ...(content !== undefined ? { content } : {}),
            ...(mediaAttachments !== undefined ? { mediaAttachments } : {})
        })
        return res.status(201).json(message)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}
