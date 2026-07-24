import { Repository } from "typeorm"
import { User, UserRole } from "../Database/Entites_PostGreSQL/user_POSTGRE.js"
import { Quartier } from "../Database/Entites_PostGreSQL/quartier_POSTGRE.js"
import { AppDataSource_MongoDB, AppDataSource_Neo4j } from "../Database/database.js"
import { InhabitantMongo } from "../Database/Entites_MongoDB/inhabitants_MONGO.js"
import { NeighborhoodMongo } from "../Database/Entites_MongoDB/neighborhood_MONGO.js"
import { UserNeo4jRepository } from "../Database/Entites_NEO4J/user_NEO4J.js"
import { QuartierNeo4jRepository } from "../Database/Entites_NEO4J/quartier_NEO4J.js"
import { hash } from "bcrypt"

// resultat d'un changement de role (pour distinguer 404 du cas "dernier admin")
export type UpdateRoleResult =
    | { ok: true; user: User }
    | { ok: false; reason: "not_found" | "last_admin" }

export class UserUsecase {
    constructor(
        private userRepository: Repository<User>,
        private quartierRepository: Repository<Quartier>
    ) {}

    // nombre de comptes admin actifs. sert a empecher la suppression ou la
    // retrogradation du dernier admin (sinon plus personne ne peut administrer)
    async countAdmins(): Promise<number> {
        return await this.userRepository.count({ where: { role: UserRole.ADMIN } })
    }

    // role optionnel : l'inscription publique ne le fournit jamais donc la colonne
    // prend sa valeur par defaut ('user'). seuls le seed et les tests le passent
    async createUser({ email, password, role, adresse, ville, cp, nom_quartier }: {
        email: string
        password: string
        role?: string
        adresse: string
        ville: string
        cp: string
        nom_quartier: string
    }): Promise<User> {
        const hashedPassword = await hash(password, 10)

        // rattachement au quartier : on cherche le quartier par son nom et on le
        // cree s'il n'existe pas. avant on passait juste { nom_quartier } et TypeORM
        // l'ignorait, du coup le user n'etait rattache a aucun quartier
        let quartier = await this.quartierRepository.findOneBy({ nom_quartier })
        if (!quartier) {
            quartier = await this.quartierRepository.save(this.quartierRepository.create({ nom_quartier }))

            // quartier tout juste cree : on cree aussi sa fiche MongoDB (description
            // + stats), sinon GET /quartiers renverrait des champs null pour lui
            try {
                const nRepo = AppDataSource_MongoDB.getRepository(NeighborhoodMongo)
                await nRepo.save(nRepo.create({
                    postgres_id: quartier.id_quartier.toString(),
                    description: "",
                    photos: [],
                    stats: { inhabitants_count: 0, events_count: 0, services_count: 0, active_votes: 0 }
                }))
            } catch (err) {
                console.error("Erreur sync MongoDB quartier:", err)
            }
        }

        const user = this.userRepository.create({
            email,
            password: hashedPassword,
            adresse,
            ville,
            cp,
            role: role as any,
            quartier
        })
        const savedUser = await this.userRepository.save(user)

        // synchro MongoDB : creation du profil habitant (avatar, bio, points, RGPD...)
        try {
            const mongoRepo = AppDataSource_MongoDB.getRepository(InhabitantMongo)
            const inhabitant = mongoRepo.create({
                postgres_id: savedUser.id_user.toString(),
                avatarUrl: "",
                bio: "",
                interests: [],
                gdpr: {
                    consentDate: new Date(),
                    exportRequestedAt: null,
                    deletionRequestedAt: null
                },
                points: 1000
            })
            await mongoRepo.save(inhabitant)
        } catch (err) {
            console.error("Erreur sync MongoDB inhabitant:", err)
        }

        // synchro Neo4j : noeud :User + noeud :Quartier + relation HABITE_DANS
        // sans ca les recommandations ignoraient tous les comptes crees via l'API
        // (elles ne voyaient que les donnees du seed). best-effort : un echec Neo4j
        // ne bloque pas l'inscription
        try {
            const driver = AppDataSource_Neo4j.getDriver()
            const userNeo4j = new UserNeo4jRepository(driver)
            const quartierNeo4j = new QuartierNeo4jRepository(driver)

            await userNeo4j.merge({
                postgres_id: savedUser.id_user.toString(),
                email: savedUser.email,
                role: savedUser.role,
                nom_quartier: quartier.nom_quartier
            })
            await quartierNeo4j.merge({
                postgres_id: quartier.id_quartier.toString(),
                nom_quartier: quartier.nom_quartier
            })
            await userNeo4j.habiterDans(savedUser.id_user.toString(), quartier.id_quartier.toString())
        } catch (err) {
            console.error("Erreur sync Neo4j user:", err)
        }

        return savedUser
    }

    async getUserById(id: number): Promise<User | null> {
        return await this.userRepository.findOne({
            where: { id_user: id },
            relations: ["quartier"]
        })
    }

    async updateUser(id: number, data: { adresse?: string; ville?: string; cp?: string; telephone?: string; langue?: string }): Promise<User | null> {
        const user = await this.userRepository.findOneBy({ id_user: id })
        if (!user) return null

        Object.assign(user, data)
        return await this.userRepository.save(user)
    }

    // back office : liste de tous les users (reserve admin/moderateur cote handler)
    async getAllUsers(): Promise<User[]> {
        return await this.userRepository.find({ relations: ["quartier"] })
    }

    // back office : changement de role (reserve admin cote handler)
    // refuse de retrograder le dernier admin
    async updateRole(id: number, role: string): Promise<UpdateRoleResult> {
        const user = await this.userRepository.findOneBy({ id_user: id })
        if (!user) return { ok: false, reason: "not_found" }

        const retrogradeUnAdmin = user.role === UserRole.ADMIN && role !== UserRole.ADMIN
        if (retrogradeUnAdmin && (await this.countAdmins()) <= 1) {
            return { ok: false, reason: "last_admin" }
        }

        user.role = role as any
        return { ok: true, user: await this.userRepository.save(user) }
    }

    // back office : bloquer / debloquer un user pour les votes
    async setVoteBlock(id: number, blocked: boolean): Promise<User | null> {
        const user = await this.userRepository.findOneBy({ id_user: id })
        if (!user) return null

        user.vote_blocked = blocked
        return await this.userRepository.save(user)
    }

    async deleteUser(id: number): Promise<boolean> {
        const user = await this.userRepository.findOneBy({ id_user: id })
        if (!user) return false

        await this.userRepository.softDelete(id)
        return true
    }
}
