import { Request, Response } from "express"
import multer from "multer"
import { existsSync, mkdirSync } from "fs"
import { randomUUID } from "crypto"

const UPLOAD_DIR = "uploads"
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true })

// types MIME autorises -> extension imposee. l'extension vient de CETTE table, jamais
// du nom envoye par le client : sinon on pourrait uploader un fichier ".html" (avec un
// faux Content-Type image) qui, servi sous /uploads, executerait du script dans le
// navigateur (XSS stocke). text/html et image/svg+xml sont absents = refuses.
const EXTENSION_PAR_MIME: Record<string, string> = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif",
    "audio/mpeg": ".mp3", "audio/mp4": ".m4a", "audio/ogg": ".ogg", "audio/webm": ".weba", "audio/wav": ".wav",
    "video/mp4": ".mp4", "video/webm": ".webm", "video/ogg": ".ogv"
}
const ALLOWED_MIME = new Set(Object.keys(EXTENSION_PAR_MIME))

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    // nom aleatoire (UUID) + extension derivee du MIME autorise : empeche le path
    // traversal, les collisions et le depot d'un .html/.svg executable
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${EXTENSION_PAR_MIME[file.mimetype] ?? ""}`)
})

// middleware multer reutilise dans routes.ts : upload.single("file")
export const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 Mo (PDF contrats, photos, vocaux...)
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true)
        // message rattrape par le gestionnaire d'erreurs global, qui repond 415
        return cb(new Error("TYPE_FICHIER_NON_AUTORISE"))
    }
})

// renvoie l'URL publique du fichier uploade (servie via /uploads)
export const EnvoyerFichier = (req: Request, res: Response) => {
    if (!req.file) {
        return res.status(400).json({ error: "Aucun fichier reçu (champ 'file')" })
    }

    return res.status(201).json({
        url: `/uploads/${req.file.filename}`,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size
    })
}
