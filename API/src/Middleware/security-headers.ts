import { Request, Response, NextFunction } from "express"

// en-tetes de securite mis sur toutes les reponses (comme Helmet mais sans dependance)
// pas de CSP globale parce que ca casserait Swagger UI (/api-docs)
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
    res.setHeader("X-Content-Type-Options", "nosniff")
    res.setHeader("X-Frame-Options", "DENY")
    res.setHeader("Referrer-Policy", "no-referrer")
    res.setHeader("X-XSS-Protection", "0")
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains")
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
    next()
}
