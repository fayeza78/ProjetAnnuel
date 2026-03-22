import "dotenv/config"
import express from "express"
import "reflect-metadata"
import { initHandlers } from "./Handlers/routes.js";
import { AppDataSource_MongoDB } from "./Database/database.js"
import { AppDataSource_PostgreSQL } from "./Database/database.js"
import { neo4jDriver } from "./Database/database.js"
import dotenv from "dotenv";



dotenv.config();

console.log("POSTGRES_HOST: " + process.env.POSTGRES_HOST)
console.log("MONGO_HOST: " + process.env.MONGO_HOST)
console.log("NEO4J_HOST: " + process.env.NEO4J_HOST)

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json())

initHandlers(app);


try {
    await   AppDataSource_MongoDB.initialize();
    await   AppDataSource_PostgreSQL.initialize();
   // await   neo4jDriver.();
} catch (error) {
    console.log(error)
    console.log("failed to initialized database conection")
    process.exit(1)
}
app.listen(PORT, () => {
    console.log("App is listening on port " + PORT)
})