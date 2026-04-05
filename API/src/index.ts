import "reflect-metadata"    // ← ligne 1 absolument
import "dotenv/config"
import express from "express"
import { initHandlers } from "./Handlers/routes.js"
import { AppDataSource_MongoDB, AppDataSource_PostgreSQL, neo4jDriver } from "./Database/database.js"

console.log("API is starting...")



const app = express()
const PORT = process.env.PORT || 3000
app.use(express.json())

initHandlers(app)

try {
    await AppDataSource_MongoDB.initialize()
    await AppDataSource_PostgreSQL.initialize()
} catch (error) {
    console.log(error)
    console.log("Failed to initialize database connection")
    process.exit(1)
}

app.listen(PORT, () => {
    console.log("App is listening on port " + process.env.IP + ":" + PORT)
    // console.log("POSTGRES_HOST: " + process.env.POSTGRES_HOST)
    // console.log("MONGO_HOST: " + process.env.MONGO_HOST)
    // console.log("NEO4J_HOST: " + process.env.NEO4J_HOST)
})