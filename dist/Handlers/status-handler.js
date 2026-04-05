import { ResourceConflictError } from "../Usecases/error.js";
export const Status = async (req, res) => {
    try {
        return res.status(201).send("Ca marche");
    }
    catch (error) {
        if (error instanceof ResourceConflictError) {
            return res.status(409).send({
                name: "name is already taken"
            });
        }
        return res.status(500).send({
            error: "Internal Server Error"
        });
    }
};
