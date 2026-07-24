import { Repository } from "typeorm"
import { Contrat } from "../Database/Entites_PostGreSQL/contrat_POSTGRE.js"
import { Service } from "../Database/Entites_PostGreSQL/service_POSTGRE.js"
import { User } from "../Database/Entites_PostGreSQL/user_POSTGRE.js"
import { AppDataSource_MongoDB } from "../Database/database.js"
import { ContratMongo } from "../Database/Entites_MongoDB/contrat_MONGO.js"
import { randomUUID, createHash } from "crypto"
import { genererDocumentsContrat, ZONES_SIGNATURE_CONTRAT, type SignaturePdf } from "../Pdf/contrat-pdf.js"

// resultat de signature : ok ou refus type
export type SignContratResult =
    | { ok: true; contrat: ContratMongo }
    | { ok: false; reason: "not_found" | "forbidden" | "already_signed" | "closed" }

// resultat d'archivage : ok ou refus type
export type ArchiveContratResult =
    | { ok: true; contrat: ContratMongo }
    | { ok: false; reason: "not_found" | "forbidden" | "not_signed" }

export class ContratUsecase {
    constructor(
        private contratRepository: Repository<Contrat>,
        private serviceRepository: Repository<Service>,
        private userRepository: Repository<User>
    ) {}

    async createContrat(data: {
        id_service: number
        pdfUrl: string
        signatureZones?: {
            page: number
            x: number
            y: number
            width: number
            height: number
            type: "signature" | "initials"
            assignedTo_postgres_id: string
            label: string
        }[]
    }, userId: number): Promise<{ contrat: Contrat; contratMongo: ContratMongo } | null> {
        const service = await this.serviceRepository.findOneBy({ id_service: data.id_service })
        if (!service) return null

        const user = await this.userRepository.findOneBy({ id_user: userId })
        if (!user) return null

        const id_contrat = randomUUID().substring(0, 36)

        // reference cote PostgreSQL
        const contrat = this.contratRepository.create({
            id_contrat,
            lienpdf: data.pdfUrl,
            statut: "pending",
            service,
            users: [user]
        })
        const savedContrat = await this.contratRepository.save(contrat)

        // document complet cote MongoDB
        const mongoRepo = AppDataSource_MongoDB.getRepository(ContratMongo)
        const contratMongo = mongoRepo.create({
            postgres_id: id_contrat,
            pdfUrl: data.pdfUrl,
            signatureZones: data.signatureZones ?? [],
            signatures: [],
            auditTrail: [{
                action: "created",
                user_postgres_id: userId.toString(),
                timestamp: new Date(),
                details: "Contrat créé"
            }],
            status: "pending"
        })
        const savedMongo = await mongoRepo.save(contratMongo)

        return { contrat: savedContrat, contratMongo: savedMongo }
    }

    async getContratById(postgres_id: string): Promise<ContratMongo | null> {
        const mongoRepo = AppDataSource_MongoDB.getRepository(ContratMongo)
        return await mongoRepo.findOne({ where: { postgres_id } })
    }

    async getContratRefById(id: string): Promise<Contrat | null> {
        return await this.contratRepository.findOne({
            where: { id_contrat: id },
            relations: ["service", "users"]
        })
    }

    // un user est "partie" au contrat s'il est assigne a une zone de signature
    // ou liste comme signataire cote PostgreSQL
    private async estPartie(contratMongo: ContratMongo, userId: number): Promise<boolean> {
        const userStr = userId.toString()
        if ((contratMongo.signatureZones ?? []).some(z => z.assignedTo_postgres_id === userStr)) return true
        const ref = await this.contratRepository.findOne({
            where: { id_contrat: contratMongo.postgres_id },
            relations: ["users"]
        })
        return (ref?.users ?? []).some(u => u.id_user === userId)
    }

    // acces en lecture : parties au contrat + admin/moderateur
    async peutConsulter(postgres_id: string, userId: number, role: string): Promise<boolean> {
        if (role === "admin" || role === "moderateur") return true
        const contratMongo = await AppDataSource_MongoDB.getRepository(ContratMongo).findOne({ where: { postgres_id } })
        if (!contratMongo) return false
        return this.estPartie(contratMongo, userId)
    }

    // la securite de la signature : JWT + reserve aux parties au contrat + pas de
    // double signature + IP + horodatage + checksum SHA-256 + journal d'audit
    // (la MFA protege le login et les changements mdp/email/tel, voir auth-usecase)
    async signerContrat(
        postgres_id: string,
        userId: number,
        signatureImage: string,
        ipAddress: string
    ): Promise<SignContratResult> {
        const mongoRepo = AppDataSource_MongoDB.getRepository(ContratMongo)
        const contratMongo = await mongoRepo.findOne({ where: { postgres_id } })
        if (!contratMongo) return { ok: false, reason: "not_found" }

        // un contrat deja finalise ou archive ne peut plus etre signe
        if (contratMongo.status === "signed" || contratMongo.status === "archived") {
            return { ok: false, reason: "closed" }
        }

        // seules les parties au contrat peuvent signer
        if (!(await this.estPartie(contratMongo, userId))) {
            return { ok: false, reason: "forbidden" }
        }

        const userStr = userId.toString()
        const signatures = contratMongo.signatures ?? []

        // pas de double signature par la meme personne
        if (signatures.some(s => s.user_postgres_id === userStr)) {
            return { ok: false, reason: "already_signed" }
        }

        const signedAt = new Date()
        // checksum d'integrite : SHA-256 de contrat + signataire + image + horodatage
        // recalculable plus tard pour prouver que la signature n'a pas ete modifiee
        const checksum = createHash("sha256")
            .update(`${postgres_id}|${userStr}|${signatureImage}|${signedAt.toISOString()}`)
            .digest("hex")

        signatures.push({
            user_postgres_id: userStr,
            signatureImage,
            signedAt,
            ipAddress,                 // IP reelle du signataire (tracabilite)
            checksum
        })

        const auditTrail = contratMongo.auditTrail ?? []
        auditTrail.push({
            action: "signed",
            user_postgres_id: userStr,
            timestamp: new Date(),
            details: `Document signé numériquement (IP: ${ipAddress || "inconnue"})`
        })

        // est-ce que toutes les zones assignees ont ete signees ?
        const allSigned = (contratMongo.signatureZones ?? []).every(zone =>
            signatures.some(sig => sig.user_postgres_id === zone.assignedTo_postgres_id)
        )

        contratMongo.signatures = signatures
        contratMongo.auditTrail = auditTrail
        contratMongo.status = allSigned ? "signed" : "partially_signed"

        const saved = await mongoRepo.save(contratMongo)

        // on recopie le statut cote PostgreSQL
        await this.contratRepository.update({ id_contrat: postgres_id }, { statut: contratMongo.status })

        // contrat complet : on regenere le PDF avec les signatures dedans, sinon le
        // fichier telecharge garderait ses cadres vides
        if (allSigned) await this.regenererPdfSigne(postgres_id, contratMongo)

        return { ok: true, contrat: saved }
    }

    // Reecrit le PDF du contrat avec les images de signature dans leurs cadres.
    // best-effort : un echec ici ne doit pas annuler une signature deja enregistree.
    private async regenererPdfSigne(postgres_id: string, contratMongo: ContratMongo): Promise<void> {
        try {
            const ref = await this.contratRepository.findOne({
                where: { id_contrat: postgres_id },
                relations: ["service", "service.prestataire", "users"]
            })
            if (!ref?.service) return

            const prestataire = ref.service.prestataire
            const demandeur = (ref.users ?? []).find(u => u.id_user !== prestataire?.id_user)
            if (!prestataire || !demandeur) return

            // chaque signature est rattachee a son cadre via l'id du signataire
            const signatures: SignaturePdf[] = (contratMongo.signatures ?? []).map(s => ({
                role: s.user_postgres_id === prestataire.id_user.toString() ? "prestataire" as const : "demandeur" as const,
                imageDataUri: s.signatureImage,
                signataire: s.user_postgres_id === prestataire.id_user.toString() ? prestataire.email : demandeur.email,
                signedAt: new Date(s.signedAt),
                ipAddress: s.ipAddress
            }))

            await genererDocumentsContrat({
                numeroContrat: postgres_id,
                dateContrat: ref.createdAt ?? new Date(),
                service: { id: ref.service.id_service, nom: ref.service.categorie ?? ref.service.type },
                prestataire: { id: prestataire.id_user, email: prestataire.email },
                demandeur: { id: demandeur.id_user, email: demandeur.email },
                prix: ref.service.prix ?? 0
            }, undefined, signatures)
        } catch (err) {
            console.error("Erreur régénération du PDF signé:", err)
        }
    }

    // creation automatique du contrat obligatoire d'un service payant
    // lie le prestataire et le demandeur, avec une zone de signature chacun
    // idempotent : si le service a deja un contrat on le renvoie sans en recreer
    async creerContratAutomatique(idService: number, prestataireId: number, demandeurId: number): Promise<Contrat | null> {
        const service = await this.serviceRepository.findOne({
            where: { id_service: idService },
            relations: ["contrat"]
        })
        if (!service) return null
        if (service.contrat) return service.contrat   // deja un contrat, rien a faire

        const prestataire = await this.userRepository.findOneBy({ id_user: prestataireId })
        const demandeur = await this.userRepository.findOneBy({ id_user: demandeurId })
        if (!prestataire || !demandeur) return null

        const id_contrat = randomUUID()

        // le PDF du contrat est genere par l'API (gabarit HTML rempli puis converti
        // en PDF par un Chromium sans interface, voir src/Pdf/contrat-pdf.ts) :
        // le document existe des la creation avec les vraies infos (parties, prix, date)
        // best-effort : si la generation echoue on cree quand meme le contrat
        let pdfUrl = ""
        let pdfChecksum = ""
        try {
            const docs = await genererDocumentsContrat({
                numeroContrat: id_contrat,
                dateContrat: new Date(),
                service: { id: service.id_service, nom: service.categorie ?? service.type },
                prestataire: { id: prestataire.id_user, email: prestataire.email },
                demandeur: { id: demandeur.id_user, email: demandeur.email },
                prix: service.prix ?? 0
            })
            pdfUrl = docs.pdfUrl
            pdfChecksum = docs.checksum   // empreinte du PDF original, tracee dans l'audit
        } catch (err) {
            console.error("Erreur génération PDF contrat:", err)
        }

        // reference PostgreSQL : les deux parties sont signataires
        const contrat = this.contratRepository.create({
            id_contrat,
            lienpdf: pdfUrl,        // PDF genere par l'API (vide si echec disque)
            statut: "pending",
            service,
            users: [prestataire, demandeur]
        })
        const savedContrat = await this.contratRepository.save(contrat)

        // document signable MongoDB : une zone de signature par partie, qui dit
        // qui doit signer (la mise en page des cadres vient du gabarit HTML)
        const mongoRepo = AppDataSource_MongoDB.getRepository(ContratMongo)
        const contratMongo = mongoRepo.create({
            postgres_id: id_contrat,
            pdfUrl,
            signatureZones: [
                { ...ZONES_SIGNATURE_CONTRAT.prestataire, type: "signature", assignedTo_postgres_id: prestataireId.toString(), label: "Signature prestataire" },
                { ...ZONES_SIGNATURE_CONTRAT.demandeur, type: "signature", assignedTo_postgres_id: demandeurId.toString(), label: "Signature demandeur" }
            ],
            signatures: [],
            auditTrail: [{
                action: "created",
                user_postgres_id: prestataireId.toString(),
                timestamp: new Date(),
                // l'empreinte du PDF est tracee des la creation : si quelqu'un
                // remplace le fichier plus tard ca se verra
                details: "Contrat obligatoire créé automatiquement (service payant)"
                    + (pdfChecksum ? ` — PDF SHA-256 : ${pdfChecksum}` : "")
            }],
            status: "pending"
        })
        await mongoRepo.save(contratMongo)

        return savedContrat
    }

    // archivage d'un contrat signe : reserve aux parties au contrat ou admin/mod
    async archiverContrat(postgres_id: string, userId: number, role: string): Promise<ArchiveContratResult> {
        const mongoRepo = AppDataSource_MongoDB.getRepository(ContratMongo)
        const contratMongo = await mongoRepo.findOne({ where: { postgres_id } })
        if (!contratMongo) return { ok: false, reason: "not_found" }

        const estPrivilegie = role === "admin" || role === "moderateur"
        if (!estPrivilegie && !(await this.estPartie(contratMongo, userId))) {
            return { ok: false, reason: "forbidden" }
        }

        // on n'archive qu'un contrat entierement signe
        if (contratMongo.status !== "signed") return { ok: false, reason: "not_signed" }

        contratMongo.status = "archived"
        contratMongo.auditTrail = [
            ...(contratMongo.auditTrail ?? []),
            { action: "archived", user_postgres_id: userId.toString(), timestamp: new Date(), details: "Contrat archivé" }
        ]
        const saved = await mongoRepo.save(contratMongo)

        await this.contratRepository.update({ id_contrat: postgres_id }, { statut: "archived" })
        return { ok: true, contrat: saved }
    }
}
