import { Request, Response } from "express"
import { CreateUserValidator, UpdateUserValidator, UpdateRoleValidator, VoteBlockValidator, NoterVoisinValidator, SetInteretsValidator } from "./Validators/user-validators.js"
import { generateValidationErrorMessage } from "./Validators/utils.js"
import { AppDataSource_PostgreSQL, AppDataSource_MongoDB, AppDataSource_Neo4j } from "../Database/database.js"
import { User } from "../Database/Entites_PostGreSQL/user_POSTGRE.js"
import { Quartier } from "../Database/Entites_PostGreSQL/quartier_POSTGRE.js"
import { InhabitantMongo } from "../Database/Entites_MongoDB/inhabitants_MONGO.js"
import { UserNeo4jRepository } from "../Database/Entites_NEO4J/user_NEO4J.js"
import { UserUsecase } from "../Usecases/user-usecase.js"
import { repondreErreur, t } from "../I18n/i18n.js"

const getUserUsecase = () => new UserUsecase(
    AppDataSource_PostgreSQL.getRepository(User),
    AppDataSource_PostgreSQL.getRepository(Quartier)
)

export const CreateUser = async (req: Request, res: Response) => {
    const validator = CreateUserValidator.validate(req.body)
    if (validator.error) {
        return res.status(400).send(generateValidationErrorMessage(validator.error.details))
    }

    try {
        const userCreated = await getUserUsecase().createUser(validator.value)
        return res.status(201).json({
            id_user: userCreated.id_user,
            email: userCreated.email,
            role: userCreated.role,
            createdAt: userCreated.createdAt,
            updatedAt: userCreated.updatedAt
        })
    } catch {
        return res.status(400).json({ error: "Email déjà utilisé" })
    }
}

// back office : liste de tous les users (reserve admin/moderateur via routes.ts)
export const GetAllUsers = async (_req: Request, res: Response) => {
    try {
        const users = await getUserUsecase().getAllUsers()
        return res.status(200).json(users.map(u => ({
            id_user: u.id_user,
            email: u.email,
            role: u.role,
            ville: u.ville,
            quartier: u.quartier ?? null,
            vote_blocked: u.vote_blocked,
            createdAt: u.createdAt
        })))
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

// back office : changement de role (reserve admin via routes.ts)
export const ChangerRoleUtilisateur = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" })

    const validator = UpdateRoleValidator.validate(req.body)
    if (validator.error) {
        return res.status(400).send(generateValidationErrorMessage(validator.error.details))
    }

    try {
        const result = await getUserUsecase().updateRole(id, validator.value.role)
        if (!result.ok) {
            if (result.reason === "last_admin") {
                return res.status(409).json({ error: "Impossible de rétrograder le dernier administrateur." })
            }
            return res.status(404).json({ error: "Utilisateur introuvable" })
        }
        return res.status(200).json({ id_user: result.user.id_user, email: result.user.email, role: result.user.role })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

// annuaire leger : liste des voisins, pour demarrer une conversation
// un habitant ne voit que les voisins de son quartier, un admin/mod voit tout le monde
export const ConsulterAnnuaireVoisins = async (req: Request, res: Response) => {
    try {
        const isPrivilegie = req.user!.role === "admin" || req.user!.role === "moderateur"

        // quartier de l'appelant (sert a filtrer pour un habitant simple)
        const moi = isPrivilegie ? null : await getUserUsecase().getUserById(req.user!.userId)
        const monQuartierId = moi?.quartier?.id_quartier

        const users = await getUserUsecase().getAllUsers()
        const visibles = users
            .filter(u => u.id_user !== req.user!.userId)
            .filter(u => isPrivilegie || (monQuartierId != null && u.quartier?.id_quartier === monQuartierId))

        return res.status(200).json(
            visibles.map(u => ({
                id_user: u.id_user,
                email: u.email,
                ville: u.ville ?? null,
                quartier: u.quartier?.nom_quartier ?? null
            }))
        )
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

// back office : bloquer / debloquer un user pour les votes (admin/moderateur via routes.ts)
export const BloquerVoteUtilisateur = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" })

    const validation = VoteBlockValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }

    try {
        const user = await getUserUsecase().setVoteBlock(id, validation.value.blocked)
        if (!user) return res.status(404).json({ error: "Utilisateur introuvable" })
        return res.status(200).json({ id_user: user.id_user, email: user.email, vote_blocked: user.vote_blocked })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const GetUser = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
        return res.status(400).json({ error: "ID invalide" })
    }

    try {
        const user = await getUserUsecase().getUserById(id)
        if (!user) {
            return res.status(404).json({ error: "Utilisateur introuvable" })
        }

        // profil public minimal pour les autres, profil complet (adresse, cp)
        // seulement pour le proprietaire du compte ou un admin/moderateur
        const profilPublic = {
            id_user: user.id_user,
            email: user.email,
            role: user.role,
            ville: user.ville,
            quartier: user.quartier ?? null,
            createdAt: user.createdAt
        }

        const isSelf = req.user!.userId === user.id_user
        const isPrivilegie = req.user!.role === "admin" || req.user!.role === "moderateur"
        if (!isSelf && !isPrivilegie) {
            return res.status(200).json(profilPublic)
        }

        return res.status(200).json({
            ...profilPublic,
            adresse: user.adresse,
            cp: user.cp,
            updatedAt: user.updatedAt
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const UpdateUser = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
        return res.status(400).json({ error: "ID invalide" })
    }

    // seulement soi-meme ou un admin
    if (req.user!.userId !== id && req.user!.role !== "admin") {
        return res.status(403).json({ error: "Permissions insuffisantes" })
    }

    const validator = UpdateUserValidator.validate(req.body)
    if (validator.error) {
        return res.status(400).send(generateValidationErrorMessage(validator.error.details))
    }

    try {
        const user = await getUserUsecase().updateUser(id, validator.value)
        if (!user) {
            return res.status(404).json({ error: "Utilisateur introuvable" })
        }
        return res.status(200).json({
            id_user: user.id_user,
            email: user.email,
            role: user.role,
            adresse: user.adresse,
            ville: user.ville,
            cp: user.cp,
            updatedAt: user.updatedAt
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const DeleteUser = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
        return res.status(400).json({ error: "ID invalide" })
    }

    // seulement soi-meme ou un admin
    if (req.user!.userId !== id && req.user!.role !== "admin") {
        return res.status(403).json({ error: "Permissions insuffisantes" })
    }

    try {
        // on ne supprime pas le dernier admin (sinon plus de back office)
        const cible = await getUserUsecase().getUserById(id)
        if (cible && cible.role === "admin" && (await getUserUsecase().countAdmins()) <= 1) {
            return res.status(409).json({ error: "Impossible de supprimer le dernier administrateur." })
        }

        const deleted = await getUserUsecase().deleteUser(id)
        if (!deleted) {
            return res.status(404).json({ error: "Utilisateur introuvable" })
        }

        // synchro Neo4j : retire le noeud :User et ses relations du graphe (sinon
        // un compte supprime ressortirait dans les recommandations de voisins)
        // le profil MongoDB est garde volontairement : le soft-delete PG est
        // reversible, l'effacement complet c'est le boulot du RGPD
        try {
            await new UserNeo4jRepository(AppDataSource_Neo4j.getDriver()).delete(id.toString())
        } catch (err) {
            console.error("Erreur suppression Neo4j user:", err)
        }

        return res.status(200).json({ message: "Utilisateur supprimé" })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

// --- noter un voisin : alimente A_NOTE dans Neo4j (recommandations) ---
// POST /users/:id/noter { rating: 1..5 }. re-noter la meme personne met a jour
// la note (MERGE cote Cypher) : une seule note par couple noteur/note
export const NoterVoisin = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" })

    // on ne se note pas soi-meme (ca fausserait le score de confiance)
    if (id === req.user!.userId) {
        return repondreErreur(req, res, 400, "SELF_RATING")
    }

    const validation = NoterVoisinValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }

    try {
        const cible = await getUserUsecase().getUserById(id)
        if (!cible) return repondreErreur(req, res, 404, "USER_NOT_FOUND")

        // les deux noeuds :User doivent exister avant de creer la relation
        // (couvre les comptes crees avant la synchro Neo4j a l'inscription)
        const userNeo4j = new UserNeo4jRepository(AppDataSource_Neo4j.getDriver())
        await userNeo4j.ensure(req.user!.userId.toString(), req.user!.email, req.user!.role)
        await userNeo4j.ensure(cible.id_user.toString(), cible.email, cible.role)

        await userNeo4j.noter(
            req.user!.userId.toString(),
            cible.id_user.toString(),
            { rating: validation.value.rating, date: new Date().toISOString() }
        )

        return res.status(200).json({ message: t(req, "RATED"), rating: validation.value.rating })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

// --- consulter la note d'un voisin ---
// GET /users/:id/noter : la note que J'AI donnee a ce voisin (null si aucune),
// sa note moyenne recue et le nombre de notes. Lu depuis Neo4j (relation A_NOTE).
export const ConsulterNoteVoisin = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" })

    try {
        const cible = await getUserUsecase().getUserById(id)
        if (!cible) return repondreErreur(req, res, 404, "USER_NOT_FOUND")

        const userNeo4j = new UserNeo4jRepository(AppDataSource_Neo4j.getDriver())
        const note = await userNeo4j.getNoteDonnee(req.user!.userId.toString(), id.toString())
        return res.status(200).json(note)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

// --- centres d'interet ---
// GET /me/interets : lus depuis le profil MongoDB (affichage)
// PUT /me/interets : remplace la liste dans MongoDB (profil) et dans Neo4j
// (INTERESSE_PAR), ce qui alimente les recommandations d'evenements et services
export const ConsulterMesInterets = async (req: Request, res: Response) => {
    try {
        const inhabitant = await AppDataSource_MongoDB.getRepository(InhabitantMongo)
            .findOne({ where: { postgres_id: req.user!.userId.toString() } })
        return res.status(200).json({ interests: inhabitant?.interests ?? [] })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

// GET /users/:id/interets : centres d'interet d'un voisin (pour afficher les
// interets en commun sur les recommandations). Lecture seule, authentifie.
export const ConsulterInteretsVoisin = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" })
    try {
        const inhabitant = await AppDataSource_MongoDB.getRepository(InhabitantMongo)
            .findOne({ where: { postgres_id: id.toString() } })
        return res.status(200).json({ interests: inhabitant?.interests ?? [] })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}

export const EnregistrerMesInterets = async (req: Request, res: Response) => {
    const validation = SetInteretsValidator.validate(req.body)
    if (validation.error) {
        return res.status(400).send(generateValidationErrorMessage(validation.error.details))
    }
    const interests: string[] = validation.value.interests // normalises (trim + minuscules) par Joi
    const uid = req.user!.userId.toString()

    try {
        // MongoDB (profil) : cree le profil s'il n'existe pas (comptes d'avant la synchro)
        const repo = AppDataSource_MongoDB.getRepository(InhabitantMongo)
        let inhabitant = await repo.findOne({ where: { postgres_id: uid } })
        if (!inhabitant) {
            inhabitant = repo.create({
                postgres_id: uid,
                avatarUrl: "",
                bio: "",
                interests,
                gdpr: { consentDate: new Date(), exportRequestedAt: null, deletionRequestedAt: null },
                points: 1000
            })
        } else {
            inhabitant.interests = interests
        }
        await repo.save(inhabitant)

        // Neo4j (INTERESSE_PAR), best-effort : le profil Mongo reste la reference d'affichage
        try {
            const userNeo4j = new UserNeo4jRepository(AppDataSource_Neo4j.getDriver())
            await userNeo4j.ensure(uid, req.user!.email, req.user!.role)
            await userNeo4j.setInterests(uid, interests)
        } catch (err) {
            console.error("Erreur sync Neo4j intérêts:", err)
        }

        return res.status(200).json({ message: t(req, "INTERESTS_UPDATED"), interests })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal Server Error" })
    }
}
