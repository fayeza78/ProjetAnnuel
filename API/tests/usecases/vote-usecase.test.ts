import { test, describe, beforeEach, afterEach, mock } from "node:test"
import assert from "node:assert/strict"
import { VoteUsecase } from "../../src/Usecases/vote-usecase.js"
import { AppDataSource_MongoDB } from "../../src/Database/database.js"
import { createMockRepository } from "../helpers/mockRepository.js"

/** VoteUsecase lit le repo MongoDB via le singleton. On le remplace par un faux repo. */
let mongoRepo: ReturnType<typeof createMockRepository>

beforeEach(() => {
    mongoRepo = createMockRepository()
    mock.method(AppDataSource_MongoDB, "getRepository", () => mongoRepo as any)
})

afterEach(() => {
    mock.restoreAll()
})

describe("VoteUsecase.createVote", () => {
    test("génère des options avec id + compteur à 0, statut actif", async () => {
        mongoRepo.save = (async (x: any) => x) as any
        const usecase = new VoteUsecase()
        const vote = await usecase.createVote(
            { question: "Q ?", type: "single", options: ["Oui", "Non"] },
            1
        )
        assert.equal((vote as any).status, "active")
        assert.equal((vote as any).options.length, 2)
        assert.ok((vote as any).options[0].id, "chaque option a un id généré")
        assert.equal((vote as any).options[0].votesCount, 0)
        assert.equal((vote as any).createdBy_postgres_id, "1")
    })
})

describe("VoteUsecase.castVote", () => {
    function voteActif() {
        return {
            postgres_id: "v1",
            status: "active",
            type: "single",
            deadline: null,
            votes: [] as any[],
            options: [
                { id: "opt-a", label: "A", votesCount: 0 },
                { id: "opt-b", label: "B", votesCount: 0 }
            ]
        }
    }

    test("refus 'not_found' si le vote est introuvable", async () => {
        mongoRepo.findOne = (async () => null) as any
        const usecase = new VoteUsecase()
        const res = await usecase.castVote("v1", 1, ["opt-a"])
        assert.deepEqual(res, { ok: false, reason: "not_found" })
    })

    test("refus 'closed' si le vote est clôturé", async () => {
        mongoRepo.findOne = (async () => ({ ...voteActif(), status: "closed" })) as any
        const usecase = new VoteUsecase()
        const res = await usecase.castVote("v1", 1, ["opt-a"])
        assert.deepEqual(res, { ok: false, reason: "closed" })
    })

    test("refus 'closed' si la deadline est dépassée", async () => {
        mongoRepo.findOne = (async () => ({ ...voteActif(), deadline: new Date(Date.now() - 1000) })) as any
        const usecase = new VoteUsecase()
        const res = await usecase.castVote("v1", 1, ["opt-a"])
        assert.deepEqual(res, { ok: false, reason: "closed" })
    })

    test("refus 'invalid_option' si l'option n'existe pas dans le sondage", async () => {
        mongoRepo.findOne = (async () => voteActif()) as any
        const usecase = new VoteUsecase()
        const res = await usecase.castVote("v1", 1, ["option-fantome"])
        assert.deepEqual(res, { ok: false, reason: "invalid_option" })
    })

    test("incrémente le compteur de l'option choisie", async () => {
        const v = voteActif()
        mongoRepo.findOne = (async () => v) as any
        mongoRepo.save = (async (x: any) => x) as any
        const usecase = new VoteUsecase()
        const res = await usecase.castVote("v1", 5, ["opt-a"])
        assert.ok(res.ok)
        const optA = res.vote.options.find((o: any) => o.id === "opt-a")
        assert.equal(optA!.votesCount, 1)
        assert.equal(res.vote.votes!.length, 1)
    })

    test("type 'single' ne retient qu'une seule option", async () => {
        const v = voteActif()
        mongoRepo.findOne = (async () => v) as any
        mongoRepo.save = (async (x: any) => x) as any
        const usecase = new VoteUsecase()
        const res = await usecase.castVote("v1", 5, ["opt-a", "opt-b"])
        assert.ok(res.ok)
        const optA = res.vote.options.find((o: any) => o.id === "opt-a")
        const optB = res.vote.options.find((o: any) => o.id === "opt-b")
        assert.equal(optA!.votesCount, 1)
        assert.equal(optB!.votesCount, 0, "la 2e option est ignorée en mode single")
    })

    test("refus 'already_voted' si l'utilisateur a déjà voté (un seul vote autorisé)", async () => {
        const v = { ...voteActif(), votes: [{ user_postgres_id: "5", optionIds: ["opt-a"], votedAt: new Date() }] }
        mongoRepo.findOne = (async () => v) as any
        mongoRepo.save = (async (x: any) => x) as any
        const usecase = new VoteUsecase()
        const res = await usecase.castVote("v1", 5, ["opt-b"])
        assert.deepEqual(res, { ok: false, reason: "already_voted" })
    })
})

describe("VoteUsecase.closeVote", () => {
    test("renvoie null si l'utilisateur n'est ni créateur ni modérateur", async () => {
        mongoRepo.findOne = (async () => ({ postgres_id: "v1", createdBy_postgres_id: "1", status: "active" })) as any
        const usecase = new VoteUsecase()
        assert.equal(await usecase.closeVote("v1", 999), null)
    })

    test("clôture le vote pour le créateur", async () => {
        mongoRepo.findOne = (async () => ({ postgres_id: "v1", createdBy_postgres_id: "7", status: "active" })) as any
        mongoRepo.save = (async (x: any) => x) as any
        const usecase = new VoteUsecase()
        const res = await usecase.closeVote("v1", 7)
        assert.equal((res as any).status, "closed")
    })

    test("un admin/modérateur peut clôturer le vote d'un autre", async () => {
        mongoRepo.findOne = (async () => ({ postgres_id: "v1", createdBy_postgres_id: "7", status: "active" })) as any
        mongoRepo.save = (async (x: any) => x) as any
        const usecase = new VoteUsecase()
        const res = await usecase.closeVote("v1", 999, "moderateur")
        assert.equal((res as any).status, "closed")
    })
})
