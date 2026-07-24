import { Request, Response } from "express"

// GET /Status : health check, si l'app repond c'est 200
export const Status = async (_req: Request, res: Response) => {
    return res.status(200).json({ status: "ok" })
}
