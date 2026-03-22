import { Application, Request, Response } from "express";
import { Status} from "./status-handler.js";


export const initHandlers = (app: Application) => {
  
    app.get("/", (req, res) => {
        return res.send({
            message: "Hell world"
        })
    })

    app.get("/Status", Status)
 
}