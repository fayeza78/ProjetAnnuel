import "reflect-metadata"
import "dotenv/config"
import { hash } from "bcrypt"
import { randomUUID } from "crypto"

// -- Databases -----------------------------------------------------------------
import { AppDataSource_PostgreSQL, AppDataSource_MongoDB, AppDataSource_Neo4j } from "./Database/database.js"

// -- PostgreSQL Entities -------------------------------------------------------
import { User, UserRole } from "./Database/Entites_PostGreSQL/user_POSTGRE.js"
import { Quartier } from "./Database/Entites_PostGreSQL/quartier_POSTGRE.js"
import { Service } from "./Database/Entites_PostGreSQL/service_POSTGRE.js"
import { Contrat } from "./Database/Entites_PostGreSQL/contrat_POSTGRE.js"
import { Competence } from "./Database/Entites_PostGreSQL/competence_POSTGRE.js"
import { Evenement } from "./Database/Entites_PostGreSQL/evenement_POSTGRE.js"
import { Incident } from "./Database/Entites_PostGreSQL/incident_POSTGRE.js"
import { Token, TokenType } from "./Database/Entites_PostGreSQL/token_POSTGRE.js"
import { EffectueDemande } from "./Database/Entites_PostGreSQL/effectueDemande_POSTGRE.js"
import { PointTransaction } from "./Database/Entites_PostGreSQL/pointTransaction_POSTGRE.js"
import { Signalement } from "./Database/Entites_PostGreSQL/signalement_POSTGRE.js"

// -- MongoDB Entities ----------------------------------------------------------
import { InhabitantMongo } from "./Database/Entites_MongoDB/inhabitants_MONGO.js"
import { NeighborhoodMongo } from "./Database/Entites_MongoDB/neighborhood_MONGO.js"
import { EventMongo } from "./Database/Entites_MongoDB/event_MONGO.js"
import { MessageMongo } from "./Database/Entites_MongoDB/message_MONGO.js"
import { VoteMongo } from "./Database/Entites_MongoDB/vote_MONGO.js"
import { ContratMongo } from "./Database/Entites_MongoDB/contrat_MONGO.js"
import { ServiceMongo } from "./Database/Entites_MongoDB/service_MONGO.js"
import { ConversationMongo } from "./Database/Entites_MongoDB/conversation_MONGO.js"

// -----------------------------------------------------------------------------

async function seed() {

    // -- 1. Initialisation des connexions --------------------------------------
    await AppDataSource_PostgreSQL.initialize()
    await AppDataSource_MongoDB.initialize()
    await AppDataSource_Neo4j.initialize()
    console.log("✅ Connexions établies")

    // -- 2. Nettoyage complet --------------------------------------------------

    // PostgreSQL - truncate dans l'ordre enfants -> parents
    // (inclut les tables ajoutees apres coup : point_transaction, signalement)
    await AppDataSource_PostgreSQL.query(
        `TRUNCATE TABLE token, effectue_demande, "Asso_5", competence, incident, evenement, contrat, point_transaction, signalement, "user", service, quartier RESTART IDENTITY CASCADE`
    )
    console.log("🗑  PostgreSQL vidé")

    // MongoDB - vider chaque collection
    await AppDataSource_MongoDB.getMongoRepository(InhabitantMongo).deleteMany({})
    await AppDataSource_MongoDB.getMongoRepository(NeighborhoodMongo).deleteMany({})
    await AppDataSource_MongoDB.getMongoRepository(EventMongo).deleteMany({})
    await AppDataSource_MongoDB.getMongoRepository(MessageMongo).deleteMany({})
    await AppDataSource_MongoDB.getMongoRepository(VoteMongo).deleteMany({})
    await AppDataSource_MongoDB.getMongoRepository(ContratMongo).deleteMany({})
    await AppDataSource_MongoDB.getMongoRepository(ServiceMongo).deleteMany({})
    await AppDataSource_MongoDB.getMongoRepository(ConversationMongo).deleteMany({})
    console.log("🗑  MongoDB vidé")

    // Neo4j - supprimer tous les noeuds et relations
    const neo4jSession = AppDataSource_Neo4j.session()
    await neo4jSession.run("MATCH (n) DETACH DELETE n")
    console.log("🗑  Neo4j vidé")

    // -- 3. PostgreSQL - Donnees -----------------------------------------------

    const pwd = await hash("Password123!", 10)

    // Helper : date dans le futur (pour que les votes ne soient jamais expires)
    const future = (days: number) => new Date(Date.now() + days * 86_400_000)

    // -- Quartiers -------------------------------------------------------------
    // Limites au format GeoJSON (Polygon) - c'est le SEUL format lu par le moteur
    // de collision (src/Geo/geo.ts:lirePolygoneGeoJson fait un JSON.parse ; le WKT etait
    // silencieusement ignore). Coordonnees choisies pour ne PAS se chevaucher :
    // aucun quartier n'en recouvre un autre (regle "une maison = un seul quartier").
    const quartierRepo = AppDataSource_PostgreSQL.getRepository(Quartier)
    const quartiers = await quartierRepo.save(quartierRepo.create([
        { nom_quartier: "Montmartre", limite_geo: '{"type":"Polygon","coordinates":[[[2.332,48.889],[2.352,48.889],[2.352,48.895],[2.332,48.895],[2.332,48.889]]]}' },
        { nom_quartier: "Le Marais",  limite_geo: '{"type":"Polygon","coordinates":[[[2.349,48.855],[2.362,48.855],[2.362,48.862],[2.349,48.862],[2.349,48.855]]]}' },
        { nom_quartier: "Belleville", limite_geo: '{"type":"Polygon","coordinates":[[[2.370,48.873],[2.385,48.873],[2.385,48.881],[2.370,48.881],[2.370,48.873]]]}' },
        { nom_quartier: "Bastille",   limite_geo: '{"type":"Polygon","coordinates":[[[2.368,48.851],[2.380,48.851],[2.380,48.858],[2.368,48.858],[2.368,48.851]]]}' },
        { nom_quartier: "Oberkampf",  limite_geo: '{"type":"Polygon","coordinates":[[[2.370,48.859],[2.382,48.859],[2.382,48.864],[2.370,48.864],[2.370,48.859]]]}' },
        { nom_quartier: "Nation",     limite_geo: '{"type":"Polygon","coordinates":[[[2.393,48.848],[2.408,48.848],[2.408,48.856],[2.393,48.856],[2.393,48.848]]]}' },
        { nom_quartier: "République", limite_geo: '{"type":"Polygon","coordinates":[[[2.360,48.865],[2.373,48.865],[2.373,48.872],[2.360,48.872],[2.360,48.865]]]}' },
        { nom_quartier: "Pigalle",    limite_geo: '{"type":"Polygon","coordinates":[[[2.334,48.882],[2.347,48.882],[2.347,48.888],[2.334,48.888],[2.334,48.882]]]}' },
    ] as any[]))
    const [qMontmartre, qMarais, qBelleville, qBastille, qOberkampf, qNation, qRepublique, qPigalle] = quartiers
    console.log("  Quartiers insérés :", quartiers.length)

    // -- Services --------------------------------------------------------------
    const serviceRepo = AppDataSource_PostgreSQL.getRepository(Service)
    const services = await serviceRepo.save(serviceRepo.create([
        { type: "offre",   categorie: "bricolage",    date_: new Date("2025-05-10"), prix: 3,  statut: "disponible" },
        { type: "offre",   categorie: "jardinage",    date_: new Date("2025-05-15"), prix: 2,  statut: "disponible" },
        { type: "offre",   categorie: "mathematiques",date_: new Date("2025-05-20"), prix: 4,  statut: "disponible" },
        { type: "offre",   categorie: "enfants",      date_: new Date("2025-05-25"), prix: 3,  statut: "disponible" },
        { type: "offre",   categorie: "transport",    date_: new Date("2025-06-01"), prix: 1,  statut: "disponible" },
        { type: "offre",   categorie: "couture",      date_: new Date("2025-06-05"), prix: 2,  statut: "disponible" },
        // une demande est toujours a 0 : seule une offre porte un tarif
        { type: "demande", categorie: "bricolage",    date_: new Date("2025-06-10"), prix: 0,  statut: "disponible" },
        { type: "demande", categorie: "informatique", date_: new Date("2025-06-15"), prix: 0,  statut: "disponible" },
        { type: "offre",   categorie: "cuisine",      date_: new Date("2025-06-20"), prix: 2,  statut: "disponible" },
        { type: "offre",   categorie: "informatique", date_: new Date("2025-06-25"), prix: 5,  statut: "disponible" },
    ] as any[]))
    console.log("  Services insérés :", services.length)

    // -- Contrats --------------------------------------------------------------
    // Uniquement pour les services payants (prix > 0) - lienpdf limite a 50 chars
    const contratRepo = AppDataSource_PostgreSQL.getRepository(Contrat)
    const contrats = await contratRepo.save(contratRepo.create([
        { id_contrat: "CTR-001", lienpdf: "/docs/ctr001.pdf", statut: "signed",   service: services[0] },
        { id_contrat: "CTR-002", lienpdf: "/docs/ctr002.pdf", statut: "signed",   service: services[1] },
        { id_contrat: "CTR-003", lienpdf: "/docs/ctr003.pdf", statut: "pending",  service: services[2] },
        { id_contrat: "CTR-004", lienpdf: "/docs/ctr004.pdf", statut: "signed",   service: services[3] },
        { id_contrat: "CTR-005", lienpdf: "/docs/ctr005.pdf", statut: "pending",  service: services[4] },
        { id_contrat: "CTR-006", lienpdf: "/docs/ctr006.pdf", statut: "signed",   service: services[5] },
        { id_contrat: "CTR-007", lienpdf: "/docs/ctr007.pdf", statut: "pending",  service: services[6] },
        { id_contrat: "CTR-008", lienpdf: "/docs/ctr008.pdf", statut: "signed",   service: services[9] },
    ] as any[]))
    console.log("  Contrats insérés :", contrats.length)

    // -- Users -----------------------------------------------------------------
    const userRepo = AppDataSource_PostgreSQL.getRepository(User)
    const users = await userRepo.save(userRepo.create([
        { email: "martin.dupont@email.fr",  password: pwd, role: UserRole.ADMIN,      adresse: "12 rue Lepic",          ville: "Paris", cp: "75018", quartier: qMontmartre, contrats: [contrats[0], contrats[3]] },
        { email: "sophie.bernard@email.fr", password: pwd, role: UserRole.USER,       adresse: "5 rue de Bretagne",     ville: "Paris", cp: "75003", quartier: qMarais,     contrats: [contrats[1], contrats[5]] },
        { email: "lucas.moreau@email.fr",   password: pwd, role: UserRole.USER,       adresse: "34 rue de Belleville",  ville: "Paris", cp: "75020", quartier: qBelleville, contrats: [contrats[2]] },
        { email: "emma.leroy@email.fr",     password: pwd, role: UserRole.USER,       adresse: "8 rue de la Roquette",  ville: "Paris", cp: "75011", quartier: qBastille,   contrats: [contrats[3]] },
        { email: "theo.girard@email.fr",    password: pwd, role: UserRole.USER,       adresse: "21 rue Oberkampf",      ville: "Paris", cp: "75011", quartier: qOberkampf,  contrats: [contrats[4]] },
        { email: "clara.petit@email.fr",    password: pwd, role: UserRole.MODERATEUR, adresse: "3 avenue de la Nation", ville: "Paris", cp: "75011", quartier: qNation,     contrats: [contrats[5]] },
        { email: "hugo.roux@email.fr",      password: pwd, role: UserRole.USER,       adresse: "17 boulevard Voltaire", ville: "Paris", cp: "75011", quartier: qRepublique, contrats: [contrats[6]] },
        { email: "lea.fournier@email.fr",   password: pwd, role: UserRole.USER,       adresse: "9 rue Houdon",          ville: "Paris", cp: "75018", quartier: qPigalle,    contrats: [contrats[7]] },
        { email: "maxime.durand@email.fr",  password: pwd, role: UserRole.USER,       adresse: "44 rue des Martyrs",    ville: "Paris", cp: "75009", quartier: qMontmartre, contrats: [] },
        { email: "camille.simon@email.fr",  password: pwd, role: UserRole.USER,       adresse: "2 impasse Thérèse",     ville: "Paris", cp: "75020", quartier: qBelleville, contrats: [] },
    ] as any[]))
    const [martin, sophie, lucas, emma, theo, clara, hugo, lea, maxime, camille] = users as [User, User, User, User, User, User, User, User, User, User]
    console.log("  Users insérés :", users.length)

    // -- Compte ADMIN dedie - TOUJOURS present (admin@admin.fr / compaq) ---------
    const adminPwd = await hash("compaq", 10)
    const admin = await userRepo.save(userRepo.create({
        email: "admin@admin.fr", password: adminPwd, role: UserRole.ADMIN,
        adresse: "1 place de la Mairie", ville: "Paris", cp: "75001", quartier: qMontmartre, contrats: []
    } as any)) as unknown as User
    console.log("  Admin inséré : admin@admin.fr / compaq")

    // -- Competences -----------------------------------------------------------
    const competenceRepo = AppDataSource_PostgreSQL.getRepository(Competence)
    await competenceRepo.save(competenceRepo.create([
        { libelle: "Plomberie",     user: martin  },
        { libelle: "Electricité",   user: martin  },
        { libelle: "Jardinage",     user: sophie  },
        { libelle: "Mathématiques", user: lucas   },
        { libelle: "Baby-sitting",  user: emma    },
        { libelle: "Conduite",      user: clara   },
        { libelle: "Couture",       user: hugo    },
        { libelle: "Informatique",  user: lea     },
        { libelle: "Cuisine",       user: maxime  },
        { libelle: "Bricolage",     user: camille },
    ] as any[]))
    console.log("  Compétences insérées : 10")

    // -- Evenements ------------------------------------------------------------
    const evenementRepo = AppDataSource_PostgreSQL.getRepository(Evenement)
    const evenements = await evenementRepo.save(evenementRepo.create([
        { titre: "Repas de quartier",     date_: new Date("2025-06-01"), type: "social",     statut: "actif",   user: martin  },
        { titre: "Atelier jardinage",     date_: new Date("2025-06-08"), type: "atelier",    statut: "actif",   user: sophie  },
        { titre: "Soirée voisins",        date_: new Date("2025-06-15"), type: "social",     statut: "actif",   user: lucas   },
        { titre: "Collecte solidaire",    date_: new Date("2025-06-20"), type: "solidarite", statut: "actif",   user: emma    },
        { titre: "Cours de français",     date_: new Date("2025-06-22"), type: "education",  statut: "actif",   user: clara   },
        { titre: "Nettoyage du parc",     date_: new Date("2025-06-28"), type: "ecologie",   statut: "actif",   user: theo    },
        { titre: "Réunion copropriété",   date_: new Date("2025-07-01"), type: "reunion",    statut: "actif",   user: hugo    },
        { titre: "Vide-grenier",          date_: new Date("2025-07-05"), type: "commerce",   statut: "actif",   user: lea     },
    ] as any[]))
    console.log("  Événements insérés :", evenements.length)

    // (Les votes et les messages vivent UNIQUEMENT dans MongoDB - voir les sections
    //  VoteMongo et MessageMongo plus bas. Les anciennes tables PostgreSQL `vote` et
    //  `message`, vestiges du MCD initial, ont ete supprimees de l'application.)

    // -- Incidents -------------------------------------------------------------
    const incidentRepo = AppDataSource_PostgreSQL.getRepository(Incident)
    const incidents = await incidentRepo.save(incidentRepo.create([
        { description: "Lampadaire cassé Lepic", statut: "ouvert",   user: martin  },
        { description: "Tags mur rue Bretagne",  statut: "en_cours", user: sophie  },
        { description: "Poubelles non ramassées",statut: "ouvert",   user: lucas   },
        { description: "Nid de poule avenue N",  statut: "resolu",   user: emma    },
        { description: "Inondation cave immeub", statut: "en_cours", user: theo    },
        { description: "Bruit nocturne Voltaire",statut: "ouvert",   user: hugo    },
        { description: "Vélos bloquent trottoir",statut: "resolu",   user: lea     },
        { description: "Fuite eau rue Martyrs",  statut: "en_cours", user: maxime  },
    ] as any[]))
    console.log("  Incidents insérés :", incidents.length)

    // -- Tokens ----------------------------------------------------------------
    const tokenRepo = AppDataSource_PostgreSQL.getRepository(Token)
    await tokenRepo.save(tokenRepo.create([
        { token: randomUUID(), type: TokenType.REFRESH,        expireA: new Date("2026-01-01"), user: martin  },
        { token: randomUUID(), type: TokenType.REFRESH,        expireA: new Date("2026-01-01"), user: sophie  },
        { token: randomUUID(), type: TokenType.RESET_PASSWORD, expireA: new Date("2025-12-01"), user: lucas   },
        { token: randomUUID(), type: TokenType.REFRESH,        expireA: new Date("2026-01-01"), user: emma    },
        { token: randomUUID(), type: TokenType.REFRESH,        expireA: new Date("2026-01-01"), user: theo    },
        { token: randomUUID(), type: TokenType.RESET_PASSWORD, expireA: new Date("2025-12-01"), user: clara   },
        { token: randomUUID(), type: TokenType.REFRESH,        expireA: new Date("2026-02-01"), user: hugo    },
        { token: randomUUID(), type: TokenType.REFRESH,        expireA: new Date("2026-02-01"), user: lea     },
    ] as any[]))
    console.log("  Tokens insérés : 8")

    // -- EffectueDemande -------------------------------------------------------
    // Qui a demande quel service
    const edRepo = AppDataSource_PostgreSQL.getRepository(EffectueDemande)
    await edRepo.save(edRepo.create([
        { id_user: theo.id_user,    id_service: services[0]!.id_service, user: theo,    service: services[0] }, // theo demande bricolage a martin
        { id_user: lea.id_user,     id_service: services[1]!.id_service, user: lea,     service: services[1] }, // lea demande jardinage a sophie
        { id_user: emma.id_user,    id_service: services[2]!.id_service, user: emma,    service: services[2] }, // emma demande maths a lucas
        { id_user: maxime.id_user,  id_service: services[3]!.id_service, user: maxime,  service: services[3] }, // maxime demande babysitting a emma
        { id_user: hugo.id_user,    id_service: services[4]!.id_service, user: hugo,    service: services[4] }, // hugo demande covoiturage a clara
        { id_user: camille.id_user, id_service: services[5]!.id_service, user: camille, service: services[5] }, // camille demande couture a hugo
        { id_user: martin.id_user,  id_service: services[7]!.id_service, user: martin,  service: services[7] }, // martin demande info (demande de theo)
        { id_user: sophie.id_user,  id_service: services[9]!.id_service, user: sophie,  service: services[9] }, // sophie demande info a lea
    ] as any[]))
    console.log("  EffectueDemandes insérés : 8")

    // -- PointTransactions -----------------------------------------------------
    // Trace comptable des transferts de points (miroir des relations A_AIDE Neo4j) :
    // l'emetteur est le demandeur qui paie, le recepteur le prestataire.
    const txRepo = AppDataSource_PostgreSQL.getRepository(PointTransaction)
    await txRepo.save(txRepo.create([
        { id_emetteur: theo.id_user,   id_recepteur: martin.id_user, id_service: services[0]!.id_service, montant: 3, motif: `Service #${services[0]!.id_service} terminé` },
        { id_emetteur: lea.id_user,    id_recepteur: sophie.id_user, id_service: services[1]!.id_service, montant: 2, motif: `Service #${services[1]!.id_service} terminé` },
        { id_emetteur: emma.id_user,   id_recepteur: lucas.id_user,  id_service: services[2]!.id_service, montant: 4, motif: `Service #${services[2]!.id_service} terminé` },
        { id_emetteur: maxime.id_user, id_recepteur: emma.id_user,   id_service: services[3]!.id_service, montant: 3, motif: `Service #${services[3]!.id_service} terminé` },
    ] as any[]))
    console.log("  PointTransactions insérées : 4")

    // -- Signalements (moderation - back office) -------------------------------
    const signalementRepo = AppDataSource_PostgreSQL.getRepository(Signalement)
    await signalementRepo.save(signalementRepo.create([
        { cible_type: "message",   cible_id: "1",                                    motif: "Propos inappropriés dans le fil du quartier", statut: "ouvert", signaleur: sophie  },
        { cible_type: "service",   cible_id: services[6]!.id_service.toString(),     motif: "Annonce suspecte (prix anormal)",             statut: "traite", signaleur: hugo    },
        { cible_type: "user",      cible_id: theo.id_user.toString(),                motif: "Messages répétés non sollicités",             statut: "rejete", signaleur: camille },
    ] as any[]))
    console.log("  Signalements insérés : 3")
    console.log("✅ PostgreSQL seed terminé")

    // -- 4. MongoDB - Donnees --------------------------------------------------

    // -- NeighborhoodMongo (un par quartier) -----------------------------------
    const neighborRepo = AppDataSource_MongoDB.getRepository(NeighborhoodMongo)
    await neighborRepo.save(neighborRepo.create([
        { postgres_id: qMontmartre!.id_quartier.toString(), description: "Quartier bohème et artistique sur la butte", photos: [], stats: { inhabitants_count: 2, events_count: 2, services_count: 2, active_votes: 1 } },
        { postgres_id: qMarais!.id_quartier.toString(),     description: "Quartier historique au cœur de Paris",      photos: [], stats: { inhabitants_count: 2, events_count: 1, services_count: 2, active_votes: 1 } },
        { postgres_id: qBelleville!.id_quartier.toString(), description: "Quartier multiculturel et vivant",          photos: [], stats: { inhabitants_count: 2, events_count: 1, services_count: 1, active_votes: 0 } },
        { postgres_id: qBastille!.id_quartier.toString(),   description: "Quartier festif autour de la place",        photos: [], stats: { inhabitants_count: 2, events_count: 1, services_count: 1, active_votes: 1 } },
        { postgres_id: qOberkampf!.id_quartier.toString(),  description: "Quartier branché du 11e arrondissement",    photos: [], stats: { inhabitants_count: 1, events_count: 1, services_count: 1, active_votes: 0 } },
        { postgres_id: qNation!.id_quartier.toString(),     description: "Quartier résidentiel calme",                photos: [], stats: { inhabitants_count: 1, events_count: 1, services_count: 1, active_votes: 0 } },
        { postgres_id: qRepublique!.id_quartier.toString(), description: "Quartier populaire et engagé",              photos: [], stats: { inhabitants_count: 1, events_count: 1, services_count: 1, active_votes: 0 } },
        { postgres_id: qPigalle!.id_quartier.toString(),    description: "Quartier en pleine mutation",               photos: [], stats: { inhabitants_count: 1, events_count: 1, services_count: 1, active_votes: 0 } },
    ] as any[]))
    console.log("  NeighborhoodMongo insérés : 8")

    // -- InhabitantMongo (un par user) -----------------------------------------
    const inhabitantRepo = AppDataSource_MongoDB.getRepository(InhabitantMongo)
    await inhabitantRepo.save(inhabitantRepo.create([
        {
            postgres_id: martin!.id_user.toString(),
            avatarUrl: "https://i.pravatar.cc/150?u=martin",
            bio: "Bricoleur passionné, toujours prêt à aider les voisins.",
            interests: ["bricolage", "jardinage", "social"],
            gdpr: { consentDate: new Date("2024-01-10"), exportRequestedAt: null, deletionRequestedAt: null },
            points: 25
        },
        {
            postgres_id: sophie!.id_user.toString(),
            avatarUrl: "https://i.pravatar.cc/150?u=sophie",
            bio: "Amoureuse des plantes et du jardinage partagé.",
            interests: ["jardinage", "ecologie", "social"],
            gdpr: { consentDate: new Date("2024-02-15"), exportRequestedAt: null, deletionRequestedAt: null },
            points: 18
        },
        {
            postgres_id: lucas!.id_user.toString(),
            avatarUrl: "https://i.pravatar.cc/150?u=lucas",
            bio: "Prof de maths bénévole le week-end.",
            interests: ["mathematiques", "social", "education"],
            gdpr: { consentDate: new Date("2024-03-01"), exportRequestedAt: null, deletionRequestedAt: null },
            points: 22
        },
        {
            postgres_id: emma!.id_user.toString(),
            avatarUrl: "https://i.pravatar.cc/150?u=emma",
            bio: "Baby-sitter expérimentée, j'adore les enfants.",
            interests: ["enfants", "social", "cuisine"],
            gdpr: { consentDate: new Date("2024-03-15"), exportRequestedAt: null, deletionRequestedAt: null },
            points: 30
        },
        {
            postgres_id: theo!.id_user.toString(),
            avatarUrl: "https://i.pravatar.cc/150?u=theo",
            bio: "Dev web le jour, voisin sympa le soir.",
            interests: ["informatique", "bricolage", "social"],
            gdpr: { consentDate: new Date("2024-04-01"), exportRequestedAt: null, deletionRequestedAt: null },
            points: 5
        },
        {
            postgres_id: clara!.id_user.toString(),
            avatarUrl: "https://i.pravatar.cc/150?u=clara",
            bio: "Modératrice bienveillante, je veille à la bonne entente.",
            interests: ["transport", "social", "ecologie"],
            gdpr: { consentDate: new Date("2024-04-15"), exportRequestedAt: null, deletionRequestedAt: null },
            points: 12
        },
        {
            postgres_id: hugo!.id_user.toString(),
            avatarUrl: "https://i.pravatar.cc/150?u=hugo",
            bio: "Passionné de couture et de réparation textile.",
            interests: ["couture", "social", "ecologie"],
            gdpr: { consentDate: new Date("2024-05-01"), exportRequestedAt: null, deletionRequestedAt: null },
            points: 10
        },
        {
            postgres_id: lea!.id_user.toString(),
            avatarUrl: "https://i.pravatar.cc/150?u=lea",
            bio: "Développeuse freelance, passionnée d'informatique.",
            interests: ["informatique", "ecologie", "social"],
            gdpr: { consentDate: new Date("2024-05-15"), exportRequestedAt: null, deletionRequestedAt: null },
            points: 20
        },
        {
            postgres_id: maxime!.id_user.toString(),
            avatarUrl: "https://i.pravatar.cc/150?u=maxime",
            bio: "Chef amateur, toujours partant pour partager une recette.",
            interests: ["cuisine", "social", "jardinage"],
            gdpr: { consentDate: new Date("2024-06-01"), exportRequestedAt: null, deletionRequestedAt: null },
            points: 8
        },
        {
            postgres_id: camille!.id_user.toString(),
            avatarUrl: "https://i.pravatar.cc/150?u=camille",
            bio: "Bricoleuse curieuse, j'aime apprendre de mes voisins.",
            interests: ["bricolage", "ecologie", "jardinage"],
            gdpr: { consentDate: new Date("2024-06-15"), exportRequestedAt: null, deletionRequestedAt: null },
            points: 3
        },
    ] as any[]))
    console.log("  InhabitantMongo insérés : 10")

    // -- InhabitantMongo pour l'admin ------------------------------------------
    await inhabitantRepo.save(inhabitantRepo.create({
        postgres_id: admin!.id_user.toString(),
        avatarUrl: "https://i.pravatar.cc/150?u=admin",
        bio: "Administrateur de la plateforme Connected Neighbours.",
        interests: ["social", "ecologie"],
        gdpr: { consentDate: new Date(), exportRequestedAt: null, deletionRequestedAt: null },
        points: 0
    } as any))
    console.log("  InhabitantMongo admin inséré : 1")

    // -- Tout le monde demarre avec 1000 points d'entraide ---------------------
    await AppDataSource_MongoDB.getMongoRepository(InhabitantMongo).updateMany({}, { $set: { points: 1000 } })
    console.log("  Points initialisés à 1000 pour tous les habitants")

    // -- ServiceMongo (un par service) -----------------------------------------
    const serviceMongo = AppDataSource_MongoDB.getRepository(ServiceMongo)
    await serviceMongo.save(serviceMongo.create([
        { postgres_id: services[0]!.id_service.toString(), description: "Petits travaux de bricolage, plomberie, peinture.", location: null, availabilities: [{ day: "samedi", startTime: "09:00", endTime: "17:00" }], reviews: [{ user_postgres_id: theo!.id_user.toString(), rating: 5, comment: "Parfait, rapide et efficace !", createdAt: new Date() }], averageRating: 5.0, reviewsCount: 1 },
        { postgres_id: services[1]!.id_service.toString(), description: "Entretien jardin, taille haies, arrosage plantes.",  location: null, availabilities: [{ day: "dimanche", startTime: "10:00", endTime: "16:00" }], reviews: [{ user_postgres_id: lea!.id_user.toString(), rating: 5, comment: "Sophie est adorable et très compétente.", createdAt: new Date() }], averageRating: 5.0, reviewsCount: 1 },
        { postgres_id: services[2]!.id_service.toString(), description: "Cours particuliers de mathématiques niveaux collège/lycée.", location: null, availabilities: [{ day: "mercredi", startTime: "14:00", endTime: "18:00" }, { day: "samedi", startTime: "10:00", endTime: "12:00" }], reviews: [{ user_postgres_id: emma!.id_user.toString(), rating: 5, comment: "Lucas explique très bien, ma fille a eu 18 !", createdAt: new Date() }], averageRating: 5.0, reviewsCount: 1 },
        { postgres_id: services[3]!.id_service.toString(), description: "Baby-sitting à domicile, expérience 5 ans.", location: null, availabilities: [{ day: "vendredi", startTime: "18:00", endTime: "23:00" }], reviews: [{ user_postgres_id: maxime!.id_user.toString(), rating: 5, comment: "Les enfants adorent Emma !", createdAt: new Date() }], averageRating: 5.0, reviewsCount: 1 },
        { postgres_id: services[4]!.id_service.toString(), description: "Covoiturage vers la Défense chaque matin.", location: null, availabilities: [{ day: "lundi", startTime: "08:00", endTime: "09:00" }, { day: "mardi", startTime: "08:00", endTime: "09:00" }], reviews: [{ user_postgres_id: hugo!.id_user.toString(), rating: 5, comment: "Clara est ponctuelle et de bonne humeur le matin.", createdAt: new Date() }], averageRating: 5.0, reviewsCount: 1 },
        { postgres_id: services[5]!.id_service.toString(), description: "Retouches et réparations textiles, ourlets, fermetures.", location: null, availabilities: [{ day: "samedi", startTime: "14:00", endTime: "18:00" }], reviews: [{ user_postgres_id: camille!.id_user.toString(), rating: 4, comment: "Bon travail, veste comme neuve.", createdAt: new Date() }], averageRating: 4.0, reviewsCount: 1 },
        { postgres_id: services[6]!.id_service.toString(), description: "Cherche quelqu'un pour m'aider à déménager un canapé.", location: null, availabilities: [{ day: "samedi", startTime: "10:00", endTime: "12:00" }], reviews: [], averageRating: 0, reviewsCount: 0 },
        { postgres_id: services[7]!.id_service.toString(), description: "Besoin d'aide pour configurer mon PC et mes logiciels.", location: null, availabilities: [{ day: "dimanche", startTime: "14:00", endTime: "16:00" }], reviews: [], averageRating: 0, reviewsCount: 0 },
        { postgres_id: services[8]!.id_service.toString(), description: "Cours de cuisine française, pâtisserie incluse.", location: null, availabilities: [{ day: "dimanche", startTime: "11:00", endTime: "14:00" }], reviews: [], averageRating: 0, reviewsCount: 0 },
        { postgres_id: services[9]!.id_service.toString(), description: "Dépannage informatique, création de sites web.", location: null, availabilities: [{ day: "lundi", startTime: "18:00", endTime: "21:00" }], reviews: [{ user_postgres_id: sophie!.id_user.toString(), rating: 5, comment: "Très pro, problème résolu en 30min.", createdAt: new Date() }], averageRating: 5.0, reviewsCount: 1 },
    ] as any[]))
    console.log("  ServiceMongo insérés : 10")

    // -- EventMongo (un par evenement) -----------------------------------------
    const eventMongo = AppDataSource_MongoDB.getRepository(EventMongo)
    const [ev0, ev1, ev2, ev3, ev4, ev5, ev6, ev7] = evenements
    await eventMongo.save(eventMongo.create([
        {
            postgres_id: ev0!.id_evenement.toString(),
            title_event: "Repas de quartier",
            description: "Grand repas convivial pour tous les voisins de Montmartre. Chacun apporte un plat !",
            photos: [],
            tags: ["social", "cuisine"],
            participants: [
                { inhabitant_postgres_id: martin!.id_user.toString(),  firstName: "Martin",  status: "confirmed",  joinedAt: new Date() },
                { inhabitant_postgres_id: sophie!.id_user.toString(),  firstName: "Sophie",  status: "confirmed",  joinedAt: new Date() },
                { inhabitant_postgres_id: hugo!.id_user.toString(),    firstName: "Hugo",    status: "confirmed",  joinedAt: new Date() },
                { inhabitant_postgres_id: emma!.id_user.toString(),    firstName: "Emma",    status: "interested", joinedAt: new Date() },
                { inhabitant_postgres_id: maxime!.id_user.toString(),  firstName: "Maxime",  status: "confirmed",  joinedAt: new Date() },
            ],
            comments: [
                { inhabitant_postgres_id: sophie!.id_user.toString(), firstName: "Sophie", content: "Super initiative, j'apporte une quiche !", createdAt: new Date() },
                { inhabitant_postgres_id: hugo!.id_user.toString(),   firstName: "Hugo",   content: "Je prépare un dessert.",                  createdAt: new Date() },
            ],
            creator: { postgres_id: martin!.id_user.toString(), firstName: "Martin", lastName: "Dupont", avatarUrl: "https://i.pravatar.cc/150?u=martin" }
        },
        {
            postgres_id: ev1!.id_evenement.toString(),
            title_event: "Atelier jardinage",
            description: "Atelier pratique pour apprendre à créer et entretenir un jardin partagé.",
            photos: [],
            tags: ["jardinage", "ecologie"],
            participants: [
                { inhabitant_postgres_id: sophie!.id_user.toString(),  firstName: "Sophie",  status: "confirmed",  joinedAt: new Date() },
                { inhabitant_postgres_id: lea!.id_user.toString(),     firstName: "Léa",     status: "interested", joinedAt: new Date() },
                { inhabitant_postgres_id: camille!.id_user.toString(), firstName: "Camille", status: "confirmed",  joinedAt: new Date() },
                { inhabitant_postgres_id: theo!.id_user.toString(),    firstName: "Théo",    status: "interested", joinedAt: new Date() },
            ],
            comments: [
                { inhabitant_postgres_id: lea!.id_user.toString(), firstName: "Léa", content: "J'apporte mes graines de tomates.", createdAt: new Date() },
            ],
            creator: { postgres_id: sophie!.id_user.toString(), firstName: "Sophie", lastName: "Bernard", avatarUrl: "https://i.pravatar.cc/150?u=sophie" }
        },
        {
            postgres_id: ev2!.id_evenement.toString(),
            title_event: "Soirée voisins",
            description: "Soirée décontractée pour mieux se connaître, jeux de société et bonne humeur.",
            photos: [],
            tags: ["social"],
            participants: [
                { inhabitant_postgres_id: lucas!.id_user.toString(),  firstName: "Lucas",  status: "confirmed",  joinedAt: new Date() },
                { inhabitant_postgres_id: martin!.id_user.toString(), firstName: "Martin", status: "interested", joinedAt: new Date() },
                { inhabitant_postgres_id: clara!.id_user.toString(),  firstName: "Clara",  status: "confirmed",  joinedAt: new Date() },
            ],
            comments: [],
            creator: { postgres_id: lucas!.id_user.toString(), firstName: "Lucas", lastName: "Moreau", avatarUrl: "https://i.pravatar.cc/150?u=lucas" }
        },
        {
            postgres_id: ev3!.id_evenement.toString(),
            title_event: "Collecte solidaire",
            description: "Collecte de vêtements et jouets pour les familles dans le besoin.",
            photos: [],
            tags: ["ecologie", "social", "solidarite"],
            participants: [
                { inhabitant_postgres_id: emma!.id_user.toString(),  firstName: "Emma",  status: "confirmed",  joinedAt: new Date() },
                { inhabitant_postgres_id: hugo!.id_user.toString(),  firstName: "Hugo",  status: "confirmed",  joinedAt: new Date() },
                { inhabitant_postgres_id: clara!.id_user.toString(), firstName: "Clara", status: "interested", joinedAt: new Date() },
            ],
            comments: [
                { inhabitant_postgres_id: hugo!.id_user.toString(), firstName: "Hugo", content: "J'apporte des vêtements d'hiver.", createdAt: new Date() },
            ],
            creator: { postgres_id: emma!.id_user.toString(), firstName: "Emma", lastName: "Leroy", avatarUrl: "https://i.pravatar.cc/150?u=emma" }
        },
        {
            postgres_id: ev4!.id_evenement.toString(),
            title_event: "Cours de français",
            description: "Cours de français bénévoles pour les nouveaux arrivants du quartier.",
            photos: [],
            tags: ["education", "social"],
            participants: [
                { inhabitant_postgres_id: clara!.id_user.toString(),  firstName: "Clara",  status: "confirmed",  joinedAt: new Date() },
                { inhabitant_postgres_id: theo!.id_user.toString(),   firstName: "Théo",   status: "confirmed",  joinedAt: new Date() },
                { inhabitant_postgres_id: maxime!.id_user.toString(), firstName: "Maxime", status: "interested", joinedAt: new Date() },
            ],
            comments: [],
            creator: { postgres_id: clara!.id_user.toString(), firstName: "Clara", lastName: "Petit", avatarUrl: "https://i.pravatar.cc/150?u=clara" }
        },
        {
            postgres_id: ev5!.id_evenement.toString(),
            title_event: "Nettoyage du parc",
            description: "Action citoyenne pour nettoyer le parc Oberkampf ensemble.",
            photos: [],
            tags: ["ecologie", "social"],
            participants: [
                { inhabitant_postgres_id: theo!.id_user.toString(),    firstName: "Théo",    status: "confirmed",  joinedAt: new Date() },
                { inhabitant_postgres_id: camille!.id_user.toString(), firstName: "Camille", status: "confirmed",  joinedAt: new Date() },
                { inhabitant_postgres_id: sophie!.id_user.toString(),  firstName: "Sophie",  status: "interested", joinedAt: new Date() },
            ],
            comments: [],
            creator: { postgres_id: theo!.id_user.toString(), firstName: "Théo", lastName: "Girard", avatarUrl: "https://i.pravatar.cc/150?u=theo" }
        },
        {
            postgres_id: ev6!.id_evenement.toString(),
            title_event: "Réunion copropriété",
            description: "Réunion annuelle de la copropriété — ordre du jour : ravalement de façade.",
            photos: [],
            tags: ["reunion", "social"],
            participants: [
                { inhabitant_postgres_id: hugo!.id_user.toString(),   firstName: "Hugo",   status: "confirmed",  joinedAt: new Date() },
                { inhabitant_postgres_id: martin!.id_user.toString(), firstName: "Martin", status: "confirmed",  joinedAt: new Date() },
            ],
            comments: [],
            creator: { postgres_id: hugo!.id_user.toString(), firstName: "Hugo", lastName: "Roux", avatarUrl: "https://i.pravatar.cc/150?u=hugo" }
        },
        {
            postgres_id: ev7!.id_evenement.toString(),
            title_event: "Vide-grenier",
            description: "Grand vide-grenier de Pigalle, venez chineurs et vendeurs !",
            photos: [],
            tags: ["commerce", "social"],
            participants: [
                { inhabitant_postgres_id: lea!.id_user.toString(),     firstName: "Léa",     status: "confirmed",  joinedAt: new Date() },
                { inhabitant_postgres_id: camille!.id_user.toString(), firstName: "Camille", status: "interested", joinedAt: new Date() },
                { inhabitant_postgres_id: maxime!.id_user.toString(),  firstName: "Maxime",  status: "confirmed",  joinedAt: new Date() },
            ],
            comments: [
                { inhabitant_postgres_id: maxime!.id_user.toString(), firstName: "Maxime", content: "J'apporte mes vieux livres de cuisine.", createdAt: new Date() },
            ],
            creator: { postgres_id: lea!.id_user.toString(), firstName: "Léa", lastName: "Fournier", avatarUrl: "https://i.pravatar.cc/150?u=lea" }
        },
    ] as any[]))
    console.log("  EventMongo insérés : 8")

    // -- MessageMongo (2 conversations reelles) --------------------------------
    const msgMongo = AppDataSource_MongoDB.getRepository(MessageMongo)
    const conv1 = randomUUID()  // Martin Sophie
    const conv2 = randomUUID()  // Lucas Emma
    const conv3 = randomUUID()  // Groupe Montmartre : Martin, Clara, Maxime
    await msgMongo.save(msgMongo.create([
        // -- Conversation 1 : Martin Sophie ---------------------------------
        {
            postgres_id: randomUUID(), conversationId: conv1,
            sender_postgres_id: martin!.id_user.toString(),
            recipient_postgres_ids: [sophie!.id_user.toString()],
            content: "Salut Sophie ! Tu fais toujours du jardinage le week-end ?",
            mediaAttachments: []
        },
        {
            postgres_id: randomUUID(), conversationId: conv1,
            sender_postgres_id: sophie!.id_user.toString(),
            recipient_postgres_ids: [martin!.id_user.toString()],
            content: "Oui, samedi matin ! Tu veux des conseils pour ton balcon ?",
            mediaAttachments: []
        },
        {
            postgres_id: randomUUID(), conversationId: conv1,
            sender_postgres_id: martin!.id_user.toString(),
            recipient_postgres_ids: [sophie!.id_user.toString()],
            content: "Ce serait top ! Je te fais un petit bricolage en échange.",
            mediaAttachments: []
        },
        // -- Conversation 2 : Lucas Emma ------------------------------------
        {
            postgres_id: randomUUID(), conversationId: conv2,
            sender_postgres_id: emma!.id_user.toString(),
            recipient_postgres_ids: [lucas!.id_user.toString()],
            content: "Bonjour Lucas, ma fille a besoin de cours de maths, tu es disponible ?",
            mediaAttachments: []
        },
        {
            postgres_id: randomUUID(), conversationId: conv2,
            sender_postgres_id: lucas!.id_user.toString(),
            recipient_postgres_ids: [emma!.id_user.toString()],
            content: "Bonjour Emma ! Bien sûr, quel niveau ? Je suis libre mercredi après-midi.",
            mediaAttachments: []
        },
        {
            postgres_id: randomUUID(), conversationId: conv2,
            sender_postgres_id: emma!.id_user.toString(),
            recipient_postgres_ids: [lucas!.id_user.toString()],
            content: "Troisième, elle a du mal avec les équations. Merci beaucoup !",
            mediaAttachments: []
        },
        // -- Conversation 3 : Groupe Montmartre --------------------------------
        {
            postgres_id: randomUUID(), conversationId: conv3,
            sender_postgres_id: martin!.id_user.toString(),
            recipient_postgres_ids: [clara!.id_user.toString(), maxime!.id_user.toString()],
            content: "Salut groupe Montmartre ! On organise le repas samedi prochain ?",
            mediaAttachments: []
        },
        {
            postgres_id: randomUUID(), conversationId: conv3,
            sender_postgres_id: clara!.id_user.toString(),
            recipient_postgres_ids: [martin!.id_user.toString(), maxime!.id_user.toString()],
            content: "Parfait pour moi ! Je préviens les autres voisins.",
            mediaAttachments: []
        },
        {
            postgres_id: randomUUID(), conversationId: conv3,
            sender_postgres_id: maxime!.id_user.toString(),
            recipient_postgres_ids: [martin!.id_user.toString(), clara!.id_user.toString()],
            content: "Je prépare mon gratin dauphinois signature ! 🙌",
            mediaAttachments: []
        },
    ] as any[]))
    console.log("  MessageMongo insérés : 9")

    // -- ConversationMongo -----------------------------------------------------
    //  Indispensable : l'API messagerie (GET /conversations, controle d'acces aux
    // messages) lit la collection `conversations`. Sans ces documents, les messages
    // ci-dessus seraient invisibles (conversation "introuvable").
    const convRepo = AppDataSource_MongoDB.getRepository(ConversationMongo)
    await convRepo.save(convRepo.create([
        {
            postgres_id: conv1,
            participants_postgres_ids: [martin!.id_user.toString(), sophie!.id_user.toString()],
            type: "direct",
            title: null,
            createdBy_postgres_id: martin!.id_user.toString(),
            lastMessageAt: new Date()
        },
        {
            postgres_id: conv2,
            participants_postgres_ids: [emma!.id_user.toString(), lucas!.id_user.toString()],
            type: "direct",
            title: null,
            createdBy_postgres_id: emma!.id_user.toString(),
            lastMessageAt: new Date()
        },
        {
            postgres_id: conv3,
            participants_postgres_ids: [martin!.id_user.toString(), clara!.id_user.toString(), maxime!.id_user.toString()],
            type: "group",
            title: "Groupe Montmartre",
            createdBy_postgres_id: martin!.id_user.toString(),
            lastMessageAt: new Date()
        },
    ] as any[]))
    console.log("  ConversationMongo insérées : 3")

    // -- VoteMongo -------------------------------------------------------------
    const voteMongo = AppDataSource_MongoDB.getRepository(VoteMongo)
    const optPotagerOui = randomUUID(), optPotagerNon = randomUUID()
    const optLundi = randomUUID(), optMercredi = randomUUID(), optSamedi = randomUUID()
    const optAccord = randomUUID(), optRefus = randomUUID(), optAbstention = randomUUID()
    await voteMongo.save(voteMongo.create([
        {
            postgres_id: randomUUID(),
            question: "Faut-il créer un potager collectif dans le quartier ?",
            description: "Un espace vert partagé pour cultiver des légumes ensemble.",
            type: "yesno",
            options: [
                { id: optPotagerOui, label: "Oui", votesCount: 7 },
                { id: optPotagerNon, label: "Non", votesCount: 2 },
            ],
            votes: [
                { user_postgres_id: martin!.id_user.toString(),  optionIds: [optPotagerOui], votedAt: new Date() },
                { user_postgres_id: sophie!.id_user.toString(),  optionIds: [optPotagerOui], votedAt: new Date() },
                { user_postgres_id: lucas!.id_user.toString(),   optionIds: [optPotagerOui], votedAt: new Date() },
                { user_postgres_id: emma!.id_user.toString(),    optionIds: [optPotagerNon], votedAt: new Date() },
                { user_postgres_id: theo!.id_user.toString(),    optionIds: [optPotagerOui], votedAt: new Date() },
                { user_postgres_id: clara!.id_user.toString(),   optionIds: [optPotagerOui], votedAt: new Date() },
                { user_postgres_id: hugo!.id_user.toString(),    optionIds: [optPotagerOui], votedAt: new Date() },
                { user_postgres_id: lea!.id_user.toString(),     optionIds: [optPotagerNon], votedAt: new Date() },
                { user_postgres_id: maxime!.id_user.toString(),  optionIds: [optPotagerOui], votedAt: new Date() },
            ],
            isAnonymous: false,
            deadline: future(60),
            createdBy_postgres_id: martin!.id_user.toString(),
            targetQuartier_postgres_id: qMontmartre!.id_quartier.toString(),
            status: "active"
        },
        {
            postgres_id: randomUUID(),
            question: "Quel jour pour la réunion mensuelle de quartier ?",
            description: "Choisissez le jour qui convient le mieux.",
            type: "single",
            options: [
                { id: optLundi,    label: "Lundi soir",    votesCount: 2 },
                { id: optMercredi, label: "Mercredi soir", votesCount: 5 },
                { id: optSamedi,   label: "Samedi matin",  votesCount: 3 },
            ],
            votes: [
                { user_postgres_id: martin!.id_user.toString(),  optionIds: [optMercredi], votedAt: new Date() },
                { user_postgres_id: sophie!.id_user.toString(),  optionIds: [optSamedi],   votedAt: new Date() },
                { user_postgres_id: lucas!.id_user.toString(),   optionIds: [optMercredi], votedAt: new Date() },
                { user_postgres_id: emma!.id_user.toString(),    optionIds: [optMercredi], votedAt: new Date() },
                { user_postgres_id: theo!.id_user.toString(),    optionIds: [optLundi],    votedAt: new Date() },
                { user_postgres_id: clara!.id_user.toString(),   optionIds: [optSamedi],   votedAt: new Date() },
                { user_postgres_id: hugo!.id_user.toString(),    optionIds: [optMercredi], votedAt: new Date() },
                { user_postgres_id: lea!.id_user.toString(),     optionIds: [optSamedi],   votedAt: new Date() },
                { user_postgres_id: maxime!.id_user.toString(),  optionIds: [optLundi],    votedAt: new Date() },
                { user_postgres_id: camille!.id_user.toString(), optionIds: [optMercredi], votedAt: new Date() },
            ],
            isAnonymous: false,
            deadline: future(30),
            createdBy_postgres_id: clara!.id_user.toString(),
            targetQuartier_postgres_id: null,
            status: "active"
        },
        {
            postgres_id: randomUUID(),
            question: "Accord pour le nouveau règlement intérieur de la résidence ?",
            description: "Le règlement interdit les fêtes après 22h et les vélos dans les couloirs.",
            type: "yesno",
            options: [
                { id: optAccord,     label: "Pour",      votesCount: 5 },
                { id: optRefus,      label: "Contre",    votesCount: 2 },
                { id: optAbstention, label: "Abstention",votesCount: 1 },
            ],
            votes: [
                { user_postgres_id: martin!.id_user.toString(), optionIds: [optAccord],     votedAt: new Date() },
                { user_postgres_id: sophie!.id_user.toString(), optionIds: [optAccord],     votedAt: new Date() },
                { user_postgres_id: hugo!.id_user.toString(),   optionIds: [optRefus],      votedAt: new Date() },
                { user_postgres_id: lea!.id_user.toString(),    optionIds: [optAccord],     votedAt: new Date() },
                { user_postgres_id: theo!.id_user.toString(),   optionIds: [optRefus],      votedAt: new Date() },
                { user_postgres_id: clara!.id_user.toString(),  optionIds: [optAccord],     votedAt: new Date() },
                { user_postgres_id: emma!.id_user.toString(),   optionIds: [optAccord],     votedAt: new Date() },
                { user_postgres_id: maxime!.id_user.toString(), optionIds: [optAbstention], votedAt: new Date() },
            ],
            isAnonymous: true,
            deadline: future(90),
            createdBy_postgres_id: hugo!.id_user.toString(),
            targetQuartier_postgres_id: qRepublique!.id_quartier.toString(),
            status: "active"
        },
    ] as any[]))
    console.log("  VoteMongo insérés : 3")

    // -- ContratMongo (un par contrat PostgreSQL) -------------------------------
    const contratMongo = AppDataSource_MongoDB.getRepository(ContratMongo)
    await contratMongo.save(contratMongo.create([
        {
            postgres_id: "CTR-001",
            pdfUrl: "https://storage.connected-neighbours.fr/contrats/ctr001.pdf",
            signatureZones: [
                { page: 1, x: 100, y: 700, width: 200, height: 50, type: "signature", assignedTo_postgres_id: martin!.id_user.toString(), label: "Signature prestataire" },
                { page: 1, x: 400, y: 700, width: 200, height: 50, type: "signature", assignedTo_postgres_id: theo!.id_user.toString(),   label: "Signature client" },
            ],
            signatures: [
                { user_postgres_id: martin!.id_user.toString(), signatureImage: "data:image/png;base64,iVBORw0KGgo...", signedAt: new Date("2025-05-11"), ipAddress: "192.168.1.10", checksum: randomUUID() },
                { user_postgres_id: theo!.id_user.toString(),   signatureImage: "data:image/png;base64,iVBORw0KGgo...", signedAt: new Date("2025-05-11"), ipAddress: "192.168.1.20", checksum: randomUUID() },
            ],
            auditTrail: [
                { action: "created", user_postgres_id: martin!.id_user.toString(), timestamp: new Date("2025-05-10"), details: "Contrat créé" },
                { action: "signed",  user_postgres_id: martin!.id_user.toString(), timestamp: new Date("2025-05-11"), details: "Signé par le prestataire" },
                { action: "signed",  user_postgres_id: theo!.id_user.toString(),   timestamp: new Date("2025-05-11"), details: "Signé par le client" },
            ],
            status: "signed"
        },
        {
            postgres_id: "CTR-002",
            pdfUrl: "https://storage.connected-neighbours.fr/contrats/ctr002.pdf",
            signatureZones: [
                { page: 1, x: 100, y: 700, width: 200, height: 50, type: "signature", assignedTo_postgres_id: sophie!.id_user.toString(), label: "Signature prestataire" },
                { page: 1, x: 400, y: 700, width: 200, height: 50, type: "signature", assignedTo_postgres_id: lea!.id_user.toString(),    label: "Signature client" },
            ],
            signatures: [
                { user_postgres_id: sophie!.id_user.toString(), signatureImage: "data:image/png;base64,iVBORw0KGgo...", signedAt: new Date("2025-05-16"), ipAddress: "192.168.1.11", checksum: randomUUID() },
                { user_postgres_id: lea!.id_user.toString(),    signatureImage: "data:image/png;base64,iVBORw0KGgo...", signedAt: new Date("2025-05-16"), ipAddress: "192.168.1.21", checksum: randomUUID() },
            ],
            auditTrail: [
                { action: "created", user_postgres_id: sophie!.id_user.toString(), timestamp: new Date("2025-05-15"), details: "Contrat créé" },
                { action: "signed",  user_postgres_id: sophie!.id_user.toString(), timestamp: new Date("2025-05-16"), details: "Signé par le prestataire" },
                { action: "signed",  user_postgres_id: lea!.id_user.toString(),    timestamp: new Date("2025-05-16"), details: "Signé par le client" },
            ],
            status: "signed"
        },
        {
            postgres_id: "CTR-003",
            pdfUrl: "https://storage.connected-neighbours.fr/contrats/ctr003.pdf",
            signatureZones: [
                { page: 1, x: 100, y: 700, width: 200, height: 50, type: "signature", assignedTo_postgres_id: lucas!.id_user.toString(), label: "Signature prestataire" },
                { page: 1, x: 400, y: 700, width: 200, height: 50, type: "signature", assignedTo_postgres_id: emma!.id_user.toString(),  label: "Signature client" },
            ],
            signatures: [],
            auditTrail: [
                { action: "created", user_postgres_id: lucas!.id_user.toString(), timestamp: new Date("2025-05-20"), details: "Contrat créé, en attente de signature" },
            ],
            status: "pending"
        },
    ] as any[]))
    console.log("  ContratMongo insérés : 3")
    console.log("✅ MongoDB seed terminé")

    // -- 5. Neo4j - Noeuds et Relations ----------------------------------------

    // Helper pour executer une query Neo4j
    const run = async (query: string, params: Record<string, any> = {}) => {
        await neo4jSession.run(query, params)
    }

    // -- Noeuds Quartier -------------------------------------------------------
    for (const q of quartiers) {
        await run(
            `MERGE (q:Quartier {postgres_id: $id}) SET q.nom_quartier = $nom`,
            { id: q.id_quartier.toString(), nom: q.nom_quartier }
        )
    }
    console.log("  Neo4j — Quartier nodes : 8")

    // -- Relations ADJACENT_A -------------------------------------------------
    const adjacences = [
        [qMontmartre, qPigalle],
        [qMontmartre, qMarais],
        [qMarais,     qBastille],
        [qBastille,   qBelleville],
        [qBastille,   qOberkampf],
        [qOberkampf,  qRepublique],
        [qRepublique, qNation],
    ]
    for (const [q1, q2] of adjacences) {
        await run(
            `MATCH (q1:Quartier {postgres_id: $id1})
             MATCH (q2:Quartier {postgres_id: $id2})
             MERGE (q1)-[:ADJACENT_A]->(q2)
             MERGE (q2)-[:ADJACENT_A]->(q1)`,
            { id1: q1!.id_quartier.toString(), id2: q2!.id_quartier.toString() }
        )
    }
    console.log("  Neo4j — ADJACENT_A relations : 7 paires")

    // -- Noeuds User -----------------------------------------------------------
    const userNodeData = [
        { u: martin,  quartier: qMontmartre },
        { u: sophie,  quartier: qMarais     },
        { u: lucas,   quartier: qBelleville },
        { u: emma,    quartier: qBastille   },
        { u: theo,    quartier: qOberkampf  },
        { u: clara,   quartier: qNation     },
        { u: hugo,    quartier: qRepublique },
        { u: lea,     quartier: qPigalle    },
        { u: maxime,  quartier: qMontmartre },
        { u: camille, quartier: qBelleville },
        { u: admin,   quartier: qMontmartre },
    ]
    for (const { u, quartier } of userNodeData) {
        await run(
            `MERGE (u:User {postgres_id: $id})
             SET u.email = $email, u.role = $role, u.nom_quartier = $nom_quartier`,
            { id: u!.id_user.toString(), email: u!.email, role: u!.role, nom_quartier: quartier!.nom_quartier }
        )
    }
    console.log("  Neo4j — User nodes : 10")

    // -- Relations HABITE_DANS -------------------------------------------------
    for (const { u, quartier } of userNodeData) {
        await run(
            `MATCH (u:User {postgres_id: $uid})
             MATCH (q:Quartier {postgres_id: $qid})
             MERGE (u)-[:HABITE_DANS]->(q)`,
            { uid: u!.id_user.toString(), qid: quartier!.id_quartier.toString() }
        )
    }
    console.log("  Neo4j — HABITE_DANS relations : 10")

    // -- Noeuds Service + PROPOSE_SERVICE --------------------------------------
    const serviceOwners = [
        { svc: services[0], owner: martin,  tags: ["bricolage",     "maison"]     },
        { svc: services[1], owner: sophie,  tags: ["jardinage",     "ecologie"]   },
        { svc: services[2], owner: lucas,   tags: ["mathematiques", "education"]  },
        { svc: services[3], owner: emma,    tags: ["enfants",       "social"]     },
        { svc: services[4], owner: clara,   tags: ["transport",     "ecologie"]   },
        { svc: services[5], owner: hugo,    tags: ["couture",       "textile"]    },
        { svc: services[8], owner: maxime,  tags: ["cuisine",       "social"]     },
        { svc: services[9], owner: lea,     tags: ["informatique",  "numerique"]  },
    ]
    for (const { svc, owner, tags } of serviceOwners) {
        await run(
            `MERGE (s:Service {postgres_id: $sid})
             SET s.type = $type, s.categorie = $categorie, s.prix = $prix`,
            { sid: svc!.id_service.toString(), type: svc!.type, categorie: svc!.categorie, prix: svc!.prix }
        )
        await run(
            `MATCH (u:User {postgres_id: $uid})
             MATCH (s:Service {postgres_id: $sid})
             MERGE (u)-[:PROPOSE_SERVICE]->(s)`,
            { uid: owner!.id_user.toString(), sid: svc!.id_service.toString() }
        )
        for (const tagName of tags) {
            await run(
                `MERGE (t:Tag {name: $tagName})
                 WITH t
                 MATCH (s:Service {postgres_id: $sid})
                 MERGE (s)-[:A_TAG]->(t)`,
                { tagName, sid: svc!.id_service.toString() }
            )
        }
    }
    console.log("  Neo4j — Service nodes + PROPOSE_SERVICE + A_TAG : ok")

    // -- Noeuds Event + A_TAG ---------------------------------------------------
    const eventTagsData = [
        { ev: ev0, tags: ["social",    "cuisine"]               },
        { ev: ev1, tags: ["jardinage", "ecologie"]              },
        { ev: ev2, tags: ["social"]                             },
        { ev: ev3, tags: ["ecologie",  "social", "solidarite"]  },
        { ev: ev4, tags: ["education", "social"]                },
        { ev: ev5, tags: ["ecologie",  "social"]                },
        { ev: ev6, tags: ["reunion",   "social"]                },
        { ev: ev7, tags: ["commerce",  "social"]                },
    ]
    for (const { ev, tags } of eventTagsData) {
        await run(
            `MERGE (e:Event {postgres_id: $id})
             SET e.titre = $titre, e.type = $type`,
            { id: ev!.id_evenement.toString(), titre: ev!.titre, type: ev!.type }
        )
        for (const tagName of tags) {
            await run(
                `MERGE (t:Tag {name: $tagName})
                 WITH t
                 MATCH (e:Event {postgres_id: $id})
                 MERGE (e)-[:A_TAG]->(t)`,
                { tagName, id: ev!.id_evenement.toString() }
            )
        }
    }
    console.log("  Neo4j — Event nodes + A_TAG : ok")

    // -- Relations A_PARTICIPE (user -> event) ----------------------------------
    const participations = [
        { user: martin,  event: ev0, status: "confirmed"  },
        { user: sophie,  event: ev0, status: "confirmed"  },
        { user: hugo,    event: ev0, status: "confirmed"  },
        { user: emma,    event: ev0, status: "interested" },
        { user: maxime,  event: ev0, status: "confirmed"  },
        { user: sophie,  event: ev1, status: "confirmed"  },
        { user: lea,     event: ev1, status: "interested" },
        { user: camille, event: ev1, status: "confirmed"  },
        { user: theo,    event: ev1, status: "interested" },
        { user: lucas,   event: ev2, status: "confirmed"  },
        { user: martin,  event: ev2, status: "interested" },
        { user: clara,   event: ev2, status: "confirmed"  },
        { user: emma,    event: ev3, status: "confirmed"  },
        { user: hugo,    event: ev3, status: "confirmed"  },
        { user: clara,   event: ev3, status: "interested" },
        { user: clara,   event: ev4, status: "confirmed"  },
        { user: theo,    event: ev4, status: "confirmed"  },
        { user: maxime,  event: ev4, status: "interested" },
        { user: theo,    event: ev5, status: "confirmed"  },
        { user: camille, event: ev5, status: "confirmed"  },
        { user: sophie,  event: ev5, status: "interested" },
        { user: hugo,    event: ev6, status: "confirmed"  },
        { user: martin,  event: ev6, status: "confirmed"  },
        { user: lea,     event: ev7, status: "confirmed"  },
        { user: camille, event: ev7, status: "interested" },
        { user: maxime,  event: ev7, status: "confirmed"  },
    ]
    for (const { user: u, event: ev, status } of participations) {
        await run(
            `MATCH (u:User {postgres_id: $uid})
             MATCH (e:Event {postgres_id: $eid})
             MERGE (u)-[r:A_PARTICIPE]->(e)
             SET r.status = $status, r.joinedAt = $joinedAt`,
            { uid: u!.id_user.toString(), eid: ev!.id_evenement.toString(), status, joinedAt: new Date().toISOString() }
        )
    }
    console.log("  Neo4j — A_PARTICIPE relations :", participations.length)

    // -- Relations INTERESSE_PAR (user -> tag) ----------------------------------
    const interests = [
        { user: martin,  tags: ["bricolage", "jardinage", "social", "cuisine"] },
        { user: sophie,  tags: ["jardinage", "ecologie", "social"] },
        { user: lucas,   tags: ["mathematiques", "education", "social"] },
        { user: emma,    tags: ["enfants", "social", "cuisine"] },
        { user: theo,    tags: ["informatique", "bricolage", "social"] },
        { user: clara,   tags: ["transport", "social", "ecologie"] },
        { user: hugo,    tags: ["couture", "social", "ecologie"] },
        { user: lea,     tags: ["informatique", "ecologie", "social", "numerique"] },
        { user: maxime,  tags: ["cuisine", "social", "jardinage"] },
        { user: camille, tags: ["bricolage", "jardinage", "ecologie"] },
    ]
    for (const { user: u, tags } of interests) {
        for (const tagName of tags) {
            await run(
                `MERGE (t:Tag {name: $tagName})
                 WITH t
                 MATCH (u:User {postgres_id: $uid})
                 MERGE (u)-[:INTERESSE_PAR]->(t)`,
                { tagName, uid: u!.id_user.toString() }
            )
        }
    }
    console.log("  Neo4j — INTERESSE_PAR relations : ok")

    // -- Relations A_AIDE (helper -> helped) ------------------------------------
    // Represente les services rendus - source du moteur de recommandation
    const aides = [
        { helper: martin, helped: theo,    serviceId: services[0]!.id_service, points: 3, date: "2025-05-12" },
        { helper: sophie, helped: lea,     serviceId: services[1]!.id_service, points: 2, date: "2025-05-17" },
        { helper: lucas,  helped: emma,    serviceId: services[2]!.id_service, points: 4, date: "2025-05-22" },
        { helper: emma,   helped: maxime,  serviceId: services[3]!.id_service, points: 3, date: "2025-05-27" },
        { helper: clara,  helped: hugo,    serviceId: services[4]!.id_service, points: 1, date: "2025-06-02" },
        { helper: hugo,   helped: camille, serviceId: services[5]!.id_service, points: 2, date: "2025-06-07" },
        { helper: maxime, helped: sophie,  serviceId: services[8]!.id_service, points: 2, date: "2025-06-10" },
        { helper: lea,    helped: martin,  serviceId: services[9]!.id_service, points: 5, date: "2025-06-12" },
    ]
    for (const { helper, helped, serviceId, points, date } of aides) {
        await run(
            `MATCH (h1:User {postgres_id: $hid1})
             MATCH (h2:User {postgres_id: $hid2})
             CREATE (h1)-[:A_AIDE {service_postgres_id: $sid, points: $points, date: $date}]->(h2)`,
            {
                hid1: helper!.id_user.toString(),
                hid2: helped!.id_user.toString(),
                sid:  serviceId.toString(),
                points,
                date
            }
        )
    }
    console.log("  Neo4j — A_AIDE relations :", aides.length)

    // -- Relations A_NOTE (noter un voisin apres service) ----------------------
    const notes = [
        { rater: theo,    rated: martin, rating: 5, date: "2025-05-13" },
        { rater: lea,     rated: sophie, rating: 5, date: "2025-05-18" },
        { rater: emma,    rated: lucas,  rating: 5, date: "2025-05-23" },
        { rater: maxime,  rated: emma,   rating: 4, date: "2025-05-28" },
        { rater: hugo,    rated: clara,  rating: 5, date: "2025-06-03" },
        { rater: camille, rated: hugo,   rating: 4, date: "2025-06-08" },
        { rater: sophie,  rated: maxime, rating: 4, date: "2025-06-11" },
        { rater: martin,  rated: lea,    rating: 5, date: "2025-06-13" },
    ]
    for (const { rater, rated, rating, date } of notes) {
        await run(
            `MATCH (r1:User {postgres_id: $rid1})
             MATCH (r2:User {postgres_id: $rid2})
             MERGE (r1)-[r:A_NOTE]->(r2)
             SET r.rating = $rating, r.date = $date`,
            {
                rid1:   rater!.id_user.toString(),
                rid2:   rated!.id_user.toString(),
                rating,
                date
            }
        )
    }
    console.log("  Neo4j — A_NOTE relations :", notes.length)
    console.log("✅ Neo4j seed terminé")

    // -- 6. Fermeture des connexions -------------------------------------------
    await neo4jSession.close()
    await AppDataSource_PostgreSQL.destroy()
    await AppDataSource_MongoDB.destroy()
    await AppDataSource_Neo4j.getDriver().close()

    console.log("")
    console.log("═══════════════════════════════════════════")
    console.log("✅  SEED COMPLET — Connected Neighbours")
    console.log("───────────────────────────────────────────")
    console.log("  PostgreSQL : 8 quartiers, 10 services, 8 contrats,")
    console.log("               11 users (10 + admin), 10 compétences, 8 événements,")
    console.log("               8 incidents,")
    console.log("               8 tokens, 8 effectueDemandes,")
    console.log("               4 pointTransactions, 3 signalements")
    console.log("  MongoDB    : 8 neighborhoods, 11 inhabitants, 10 services,")
    console.log("               8 events, 9 messages, 3 CONVERSATIONS, 3 votes, 3 contrats")
    console.log("  Neo4j      : 10 User, 8 Quartier, 8 Service, 8 Event, ~15 Tag")
    console.log("               + HABITE_DANS, ADJACENT_A, PROPOSE_SERVICE,")
    console.log("               A_PARTICIPE, INTERESSE_PAR, A_AIDE, A_NOTE, A_TAG")
    console.log("═══════════════════════════════════════════")
    console.log("")
    console.log("  Compte ADMIN principal :")
    console.log("  Email   : admin@admin.fr")
    console.log("  Password: compaq")
    console.log("───────────────────────────────────────────")
    console.log("  Autres comptes de démo :")
    console.log("  Email   : martin.dupont@email.fr  (admin)")
    console.log("  Email   : sophie.bernard@email.fr (user)")
    console.log("  Password: Password123!")
    console.log("═══════════════════════════════════════════")
}

seed().catch((err) => {
    console.error("❌ Erreur seed :", err)
    process.exit(1)
})
