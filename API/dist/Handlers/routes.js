import { Status } from "./status-handler.js";
export const initHandlers = (app) => {
    app.get("/", (req, res) => {
        return res.send({
            message: "Hell world"
        });
    });
    app.get("/Status", Status);
};
