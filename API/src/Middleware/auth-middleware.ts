import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { getJwtSecret } from "./jwt.js"
import { repondreErreur } from "../I18n/i18n.js"

export interface JwtPayload {
    userId: number
    email: string
    role: string
}

declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload
        }
    }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization
    const token = authHeader?.split(" ")[1] // Bearer <token>

    if (!token) {
        repondreErreur(req, res, 401, "AUTH_TOKEN_REQUIRED")
        return
    }

    try {
        const payload = jwt.verify(token, getJwtSecret()) as JwtPayload
        req.user = payload
        next()
    } catch {
        repondreErreur(req, res, 401, "AUTH_TOKEN_INVALID")
    }
}

export const requireRole = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            repondreErreur(req, res, 401, "AUTH_REQUIRED")
            return
        }
        if (!roles.includes(req.user.role)) {
            repondreErreur(req, res, 403, "FORBIDDEN_ROLE")
            return
        }
        next()
    }
}
