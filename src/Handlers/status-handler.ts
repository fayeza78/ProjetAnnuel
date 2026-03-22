import { Request, Response } from "express"
import { AppDataSource_MongoDB } from "../Database/database.js"
import { AppDataSource_PostgreSQL } from "../Database/database.js"
import { neo4jDriver } from "../Database/database.js"
import { ResourceConflictError } from "../Usecases/error.js"
export const Status = async (req: Request, res: Response) => {
 
  
    try {
       
        return res.status(201).send("Ca marche");
    } catch (error: unknown) {
        if (error instanceof ResourceConflictError) {
            return res.status(409).send({
                name: "name is already taken"
            })
        }
        return res.status(500).send({
            error: "Internal Server Error"
        })
    }
}
