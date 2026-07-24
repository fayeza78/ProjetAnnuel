import { test, describe, beforeEach, afterEach, mock } from "node:test"
import assert from "node:assert/strict"
import { ServiceUsecase } from "../../src/Usecases/service-usecase.js"
import { AppDataSource_MongoDB } from "../../src/Database/database.js"
import { createMockRepository } from "../helpers/mockRepository.js"

function build(repos: { service?: any; demande?: any; user?: any; tx?: any } = {}) {
    return new ServiceUsecase(
        (repos.service ?? createMockRepository()) as any,
        (repos.demande ?? createMockRepository()) as any,
        (repos.user ?? createMockRepository()) as any,
        (repos.tx ?? createMockRepository()) as any
    )
}

// Repo MongoDB (InhabitantMongo) mocke via le singleton
let mongoRepo: ReturnType<typeof createMockRepository>
beforeEach(() => {
    mongoRepo = createMockRepository()
    mock.method(AppDataSource_MongoDB, "getRepository", () => mongoRepo as any)
})
afterEach(() => {
    mock.restoreAll()
})

describe("ServiceUsecase.createService", () => {
    test("force le statut à 'disponible' et rattache le prestataire", async () => {
        const usecase = build()
        const service = await usecase.createService({ type: "offre" }, 7)
        assert.equal((service as any).statut, "disponible")
        assert.equal((service as any).type, "offre")
        assert.equal((service as any).prestataire.id_user, 7)
    })
})

describe("ServiceUsecase.updateService", () => {
    test("refus (not_found) si le service n'existe pas", async () => {
        const usecase = build({ service: createMockRepository({ findOne: async () => null }) })
        const res = await usecase.updateService(1, 1, "admin", { prix: 5 })
        assert.equal(res.ok, false)
        assert.equal((res as any).reason, "not_found")
    })

    test("refus (forbidden) si l'appelant n'est pas l'auteur de l'annonce", async () => {
        const usecase = build({
            service: createMockRepository({ findOne: async () => ({ id_service: 1, prestataire: { id_user: 2 } }) })
        })
        const res = await usecase.updateService(1, 99, "user", { prix: 5 })
        assert.equal(res.ok, false)
        assert.equal((res as any).reason, "forbidden")
    })

    test("l'auteur de l'annonce peut modifier son prix", async () => {
        const usecase = build({
            service: createMockRepository({ findOne: async () => ({ id_service: 1, prix: 0, prestataire: { id_user: 7 } }) })
        })
        const res = await usecase.updateService(1, 7, "user", { prix: 9 })
        assert.equal(res.ok, true)
        assert.equal((res as any).service.prix, 9)
    })

    test("autorise un admin même s'il n'est pas l'auteur", async () => {
        const usecase = build({
            service: createMockRepository({ findOne: async () => ({ id_service: 1, prix: 0, prestataire: { id_user: 2 } }) })
        })
        const res = await usecase.updateService(1, 50, "admin", { prix: 9 })
        assert.equal(res.ok, true)
        assert.equal((res as any).service.prix, 9)
    })

    test("refus (statut_reserve) : l'auteur ne force pas le statut à la main", async () => {
        const usecase = build({
            service: createMockRepository({ findOne: async () => ({ id_service: 1, prestataire: { id_user: 7 } }) })
        })
        const res = await usecase.updateService(1, 7, "user", { statut: "termine" })
        assert.equal(res.ok, false)
        assert.equal((res as any).reason, "statut_reserve")
    })

    test("refus (prix_verrouille) si un contrat a déjà été généré", async () => {
        const usecase = build({
            service: createMockRepository({
                findOne: async () => ({ id_service: 1, prix: 3, prestataire: { id_user: 7 }, contrat: { id_contrat: "abc" } })
            })
        })
        const res = await usecase.updateService(1, 7, "user", { prix: 9 })
        assert.equal(res.ok, false)
        assert.equal((res as any).reason, "prix_verrouille")
    })
})

describe("ServiceUsecase.deleteService", () => {
    test("refus (forbidden) pour un voisin qui n'est pas l'auteur", async () => {
        const usecase = build({
            service: createMockRepository({ findOne: async () => ({ id_service: 1, prestataire: { id_user: 2 } }) })
        })
        const res = await usecase.deleteService(1, 99, "user")
        assert.equal(res.ok, false)
        assert.equal((res as any).reason, "forbidden")
    })

    test("l'auteur peut supprimer sa propre annonce", async () => {
        let softDeleteAppele = false
        const usecase = build({
            service: createMockRepository({
                findOne: async () => ({ id_service: 1, prestataire: { id_user: 7 } }),
                softDelete: async () => { softDeleteAppele = true; return { affected: 1 } }
            })
        })
        const res = await usecase.deleteService(1, 7, "user")
        assert.equal(res.ok, true)
        assert.equal(softDeleteAppele, true)
    })

    test("autorise un moderateur", async () => {
        let softDeleteAppele = false
        const usecase = build({
            service: createMockRepository({
                findOne: async () => ({ id_service: 1, prestataire: { id_user: 2 } }),
                softDelete: async () => { softDeleteAppele = true; return { affected: 1 } }
            })
        })
        const res = await usecase.deleteService(1, 50, "moderateur")
        assert.equal(res.ok, true)
        assert.equal(softDeleteAppele, true)
    })

    test("refus (contrat_existant) si le service porte un contrat", async () => {
        const usecase = build({
            service: createMockRepository({
                findOne: async () => ({ id_service: 1, prestataire: { id_user: 7 }, contrat: { id_contrat: "abc" } })
            })
        })
        const res = await usecase.deleteService(1, 7, "user")
        assert.equal(res.ok, false)
        assert.equal((res as any).reason, "contrat_existant")
    })
})

describe("ServiceUsecase.demanderService", () => {
    test("renvoie null si le service est introuvable", async () => {
        const usecase = build({ service: createMockRepository({ findOneBy: async () => null }) })
        assert.equal(await usecase.demanderService(1, 1), null)
    })

    test("renvoie la demande existante si déjà présente (pas de doublon)", async () => {
        const existante = { id_user: 1, id_service: 1 }
        const usecase = build({
            service: createMockRepository({ findOneBy: async () => ({ id_service: 1 }) }),
            user: createMockRepository({ findOneBy: async () => ({ id_user: 1 }) }),
            demande: createMockRepository({ findOneBy: async () => existante })
        })
        assert.deepEqual(await usecase.demanderService(1, 1), existante)
    })

    test("crée une nouvelle demande sinon", async () => {
        const usecase = build({
            service: createMockRepository({ findOneBy: async () => ({ id_service: 2 }) }),
            user: createMockRepository({ findOneBy: async () => ({ id_user: 7 }) }),
            demande: createMockRepository({ findOneBy: async () => null })
        })
        const res = await usecase.demanderService(2, 7)
        assert.equal((res as any).id_user, 7)
        assert.equal((res as any).id_service, 2)
    })
})

describe("ServiceUsecase.retirerDemande", () => {
    test("refus (service_not_found) si le service est introuvable", async () => {
        const usecase = build({ service: createMockRepository({ findOneBy: async () => null }) })
        const res = await usecase.retirerDemande(1, 1)
        assert.equal(res.ok, false)
        assert.equal((res as any).reason, "service_not_found")
    })

    test("refus (service_termine) si le service est déjà terminé", async () => {
        const usecase = build({ service: createMockRepository({ findOneBy: async () => ({ id_service: 1, statut: "termine" }) }) })
        const res = await usecase.retirerDemande(1, 1)
        assert.equal(res.ok, false)
        assert.equal((res as any).reason, "service_termine")
    })

    test("refus (no_demande) si l'utilisateur n'a pas de demande", async () => {
        const usecase = build({
            service: createMockRepository({ findOneBy: async () => ({ id_service: 1, statut: "disponible" }) }),
            demande: createMockRepository({ findOneBy: async () => null })
        })
        const res = await usecase.retirerDemande(1, 7)
        assert.equal(res.ok, false)
        assert.equal((res as any).reason, "no_demande")
    })

    test("succès : supprime (hard delete) la demande de l'utilisateur", async () => {
        let deleteAppele: any = null
        const usecase = build({
            service: createMockRepository({ findOneBy: async () => ({ id_service: 1, statut: "disponible" }) }),
            demande: createMockRepository({
                findOneBy: async () => ({ id_user: 7, id_service: 1 }),
                delete: async (criteria: any) => { deleteAppele = criteria; return { affected: 1 } }
            })
        })
        const res = await usecase.retirerDemande(1, 7)
        assert.equal(res.ok, true)
        assert.deepEqual(deleteAppele, { id_user: 7, id_service: 1 })
    })
})

describe("ServiceUsecase.terminerService", () => {
    test("refus (not_found) si le service est introuvable", async () => {
        const usecase = build({ service: createMockRepository({ findOne: async () => null }) })
        const res = await usecase.terminerService(1, 1, "admin")
        assert.equal(res.ok, false)
        assert.equal((res as any).reason, "not_found")
    })

    test("refus (forbidden) si l'appelant n'est ni prestataire ni admin", async () => {
        const usecase = build({
            service: createMockRepository({
                findOne: async () => ({ id_service: 1, statut: "disponible", prix: 0, prestataire: { id_user: 2 }, effectueDemandes: [{ id_user: 3 }] })
            })
        })
        const res = await usecase.terminerService(1, 99, "user") // 99 = prestataire (2)
        assert.equal(res.ok, false)
        assert.equal((res as any).reason, "forbidden")
    })

    test("service gratuit : le prestataire le passe à 'termine' sans transaction", async () => {
        const usecase = build({
            service: createMockRepository({
                findOne: async () => ({ id_service: 1, statut: "disponible", prix: 0, prestataire: { id_user: 2 }, effectueDemandes: [{ id_user: 3 }] })
            })
        })
        const res = await usecase.terminerService(1, 2, "user") // appelant = prestataire
        assert.equal(res.ok, true)
        assert.equal((res as any).service.statut, "termine")
        assert.equal((res as any).transaction, null)
    })

    test("service payant : transfère les points et trace la transaction", async () => {
        mongoRepo.findOne = (async () => ({ postgres_id: "x", points: 10 })) as any
        mongoRepo.save = (async (x: any) => x) as any
        const usecase = build({
            service: createMockRepository({
                findOne: async () => ({ id_service: 1, statut: "disponible", prix: 4, prestataire: { id_user: 2 }, effectueDemandes: [{ id_user: 3 }] })
            }),
            tx: createMockRepository({ create: (x: any) => x, save: async (x: any) => x })
        })
        const res = await usecase.terminerService(1, 2, "user") // appelant = prestataire
        assert.equal(res.ok, true)
        assert.equal((res as any).service.statut, "termine")
        assert.equal((res as any).prestataireId, 2)
        assert.equal((res as any).demandeurId, 3)
        assert.equal((res as any).transaction.montant, 4)
        assert.equal((res as any).transaction.id_emetteur, 3)
        assert.equal((res as any).transaction.id_recepteur, 2)
    })

    test("service payant : refuse si le demandeur n'a pas assez de points", async () => {
        mongoRepo.findOne = (async () => ({ postgres_id: "x", points: 2 })) as any // solde 2 < prix 4
        mongoRepo.save = (async (x: any) => x) as any
        const usecase = build({
            service: createMockRepository({
                findOne: async () => ({ id_service: 1, statut: "disponible", prix: 4, prestataire: { id_user: 2 }, effectueDemandes: [{ id_user: 3 }] })
            }),
            tx: createMockRepository({ create: (x: any) => x, save: async (x: any) => x })
        })
        const res = await usecase.terminerService(1, 2, "user")
        assert.equal(res.ok, false)
        assert.equal((res as any).reason, "insufficient_points")
    })

    test("un admin peut aussi terminer le service", async () => {
        const usecase = build({
            service: createMockRepository({
                findOne: async () => ({ id_service: 1, statut: "disponible", prix: 0, prestataire: { id_user: 2 }, effectueDemandes: [{ id_user: 3 }] })
            })
        })
        const res = await usecase.terminerService(1, 50, "admin") // appelant = admin
        assert.equal(res.ok, true)
    })
})

describe("ServiceUsecase.getPoints", () => {
    test("retourne le solde du profil habitant", async () => {
        mongoRepo.findOne = (async () => ({ postgres_id: "5", points: 42 })) as any
        const usecase = build()
        assert.equal(await usecase.getPoints(5), 42)
    })

    test("retourne 0 si aucun profil", async () => {
        mongoRepo.findOne = (async () => null) as any
        const usecase = build()
        assert.equal(await usecase.getPoints(5), 0)
    })
})
