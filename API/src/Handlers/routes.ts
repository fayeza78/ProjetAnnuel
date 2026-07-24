import { Application, Request, Response } from "express"
import swaggerUi from "swagger-ui-express"

import { authenticateToken, requireRole } from "../Middleware/auth-middleware.js"
import { swaggerSpec } from "../swagger.js"
import { ChangeEmail, ChangePassword, ChangePhone, DisableMfa, ForgotPassword, Login, Logout, Me, Refresh, ResetPassword, SetupMfa, SsoExchange, SsoTicket, VerifyMfa } from "./auth-handler.js"
import { Status } from "./status-handler.js"
import { BloquerVoteUtilisateur, ChangerRoleUtilisateur, ConsulterAnnuaireVoisins, ConsulterInteretsVoisin, ConsulterMesInterets, ConsulterNoteVoisin, CreateUser, DeleteUser, EnregistrerMesInterets, GetAllUsers, GetUser, NoterVoisin, UpdateUser } from "./user-handler.js"

import { authLimiter, queryLimiter, sensitiveLimiter, uploadLimiter, writeLimiter } from "../Middleware/rate-limit.js"
import { getOnlineUsers } from "../Realtime/realtime.js"
import { CreateCompetence, DeleteCompetence, GetCompetences } from "./competence-handler.js"
import { TelechargerAppJava } from "./download-handler.js"
import { ArchiverContrat, ConsulterAuditContrat, CreateContrat, GetContrat, SignerContrat } from "./contrat-handler.js"
import { AjouterPhotoEvenement, AjouterTagEvenement, CommenterEvenement, CreateEvenement, DeleteEvenement, GetAllEvenements, GetEvenement, ParticiperEvenement, UpdateEvenement } from "./evenement-handler.js"
import { AnonymiserCompte, ConsulterConsentement, EnregistrerConsentement, ExporterDonnees } from "./gdpr-handler.js"
import { ChangerStatutIncident, CreateIncident, GetAllIncidents, GetIncident } from "./incident-handler.js"
import { CreateConversation, EnvoyerMessage, GetConversations, GetMessages } from "./message-handler.js"
import { CreateQuartier, DeleteQuartier, GetAllQuartiers, GetQuartier, UpdateQuartier } from "./quartier-handler.js"
import { ExecuterRequete } from "./query-handler.js"
import { RecommanderEvenements, RecommanderServices, RecommanderVoisins } from "./recommendation-handler.js"
import { ConsulterMesPoints, CreateService, DeleteService, DemanderService, GetAllServices, GetService, ListerDemandesService, RetirerDemande, TerminerService, UpdateService } from "./service-handler.js"
import { CreateSignalement, GetAllSignalements, TraiterSignalement } from "./signalement-handler.js"
import { StatistiquesIncidents, StatistiquesParticipations } from "./stats-handler.js"
import { SyncPull, SyncPush } from "./sync-handler.js"
import { EnvoyerFichier, upload } from "./upload-handler.js"
import { CloturerVote, CreateVote, GetAllVotes, GetVote, Voter } from "./vote-handler.js"

// rate limiting : globalLimiter (index.ts) couvre deja toutes les routes,
// chaque route sensible ou en ecriture ajoute son palier, place avant l'auth

export const initHandlers = (app: Application) => {

    // Swagger UI
    // persistAuthorization : le token colle dans Authorize survit au rechargement
    // de la page (sinon il faut le recoller a chaque F5)
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        swaggerOptions: { persistAuthorization: true }
    }))

    // Health check
    app.get("/", (_req: Request, res: Response) => {
        return res.json({ message: "Connected Neighbours API", version: "1.0.0" })
    })

    app.get("/Status", Status)

    // --- auth ---
    app.post("/auth/register", authLimiter, CreateUser)
    app.post("/auth/login", authLimiter, Login)
    app.post("/auth/refresh", authLimiter, Refresh)
    app.post("/auth/logout", Logout)
    app.get("/auth/me", authenticateToken, Me)

    // changements d'infos sensibles (mot de passe / email / telephone), MFA exigee
    app.post("/auth/change-password", sensitiveLimiter, authenticateToken, ChangePassword)
    app.post("/auth/change-email", sensitiveLimiter, authenticateToken, ChangeEmail)
    app.post("/auth/change-phone", sensitiveLimiter, authenticateToken, ChangePhone)

    // SSO web / client Java : generation d'un ticket (connecte) + echange (public)
    app.post("/auth/sso/ticket", sensitiveLimiter, authenticateToken, SsoTicket)
    app.post("/auth/sso/exchange", authLimiter, SsoExchange)

    // mot de passe oublie (public) : ticket usage unique 15 min, puis reinitialisation
    app.post("/auth/forgot-password", authLimiter, ForgotPassword)
    app.post("/auth/reset-password", authLimiter, ResetPassword)

    // --- users ---
    app.get("/neighbours", authenticateToken, ConsulterAnnuaireVoisins)   // annuaire leger (messagerie)
    app.get("/users/:id", authenticateToken, GetUser)
    app.put("/users/:id", writeLimiter, authenticateToken, UpdateUser)
    app.delete("/users/:id", sensitiveLimiter, authenticateToken, DeleteUser)

    // noter un voisin (A_NOTE dans Neo4j, alimente les recommandations)
    app.get("/users/:id/noter", authenticateToken, ConsulterNoteVoisin)   // ma note donnee + moyenne du voisin
    app.post("/users/:id/noter", writeLimiter, authenticateToken, NoterVoisin)

    // centres d'interet (profil Mongo + INTERESSE_PAR Neo4j, pour les recommandations)
    app.get("/me/interets", authenticateToken, ConsulterMesInterets)
    app.put("/me/interets", writeLimiter, authenticateToken, EnregistrerMesInterets)
    app.get("/users/:id/interets", authenticateToken, ConsulterInteretsVoisin)   // interets d'un voisin (recommandations)

    // --- quartiers ---
    app.get("/quartiers", GetAllQuartiers)
    app.get("/quartiers/:id", GetQuartier)
    app.post("/quartiers", writeLimiter, authenticateToken, requireRole("admin"), CreateQuartier)
    app.put("/quartiers/:id", writeLimiter, authenticateToken, requireRole("admin"), UpdateQuartier)
    app.delete("/quartiers/:id", writeLimiter, authenticateToken, requireRole("admin"), DeleteQuartier)

    // --- services ---
    app.get("/services", authenticateToken, GetAllServices)
    app.get("/services/:id", authenticateToken, GetService)
    app.post("/services", writeLimiter, authenticateToken, CreateService)
    app.put("/services/:id", writeLimiter, authenticateToken, UpdateService)
    app.delete("/services/:id", writeLimiter, authenticateToken, DeleteService)
    app.post("/services/:id/demander", writeLimiter, authenticateToken, DemanderService)
    app.delete("/services/:id/demander", writeLimiter, authenticateToken, RetirerDemande)   // retirer sa propre demande
    app.get("/services/:id/demandes", authenticateToken, ListerDemandesService)

    // --- evenements ---
    app.get("/evenements", authenticateToken, GetAllEvenements)
    app.get("/evenements/:id", authenticateToken, GetEvenement)
    app.post("/evenements", writeLimiter, authenticateToken, CreateEvenement)
    app.put("/evenements/:id", writeLimiter, authenticateToken, UpdateEvenement)
    app.delete("/evenements/:id", writeLimiter, authenticateToken, DeleteEvenement)
    app.post("/evenements/:id/participer", writeLimiter, authenticateToken, ParticiperEvenement)
    // detail MongoDB : commentaires (tous), photos/tags (createur ou moderation)
    app.post("/evenements/:id/commentaires", writeLimiter, authenticateToken, CommenterEvenement)
    app.post("/evenements/:id/photos", writeLimiter, authenticateToken, AjouterPhotoEvenement)
    app.post("/evenements/:id/tags", writeLimiter, authenticateToken, AjouterTagEvenement)

    // --- votes ---
    app.get("/votes", authenticateToken, GetAllVotes)
    app.get("/votes/:id", authenticateToken, GetVote)
    app.post("/votes", writeLimiter, authenticateToken, CreateVote)
    app.post("/votes/:id/voter", writeLimiter, authenticateToken, Voter)
    app.post("/votes/:id/cloturer", writeLimiter, authenticateToken, CloturerVote)

    // --- contrats ---
    app.post("/contrats", writeLimiter, authenticateToken, CreateContrat)
    app.get("/contrats/:id", authenticateToken, GetContrat)
    app.get("/contrats/:id/audit", authenticateToken, ConsulterAuditContrat)
    app.post("/contrats/:id/signer", sensitiveLimiter, authenticateToken, SignerContrat)
    app.post("/contrats/:id/archiver", sensitiveLimiter, authenticateToken, ArchiverContrat)

    // --- messages / conversations ---
    app.get("/conversations", authenticateToken, GetConversations)
    app.post("/conversations", writeLimiter, authenticateToken, CreateConversation)
    app.get("/conversations/:conversationId/messages", authenticateToken, GetMessages)
    app.post("/conversations/:conversationId/messages", writeLimiter, authenticateToken, EnvoyerMessage)

    // --- incidents ---
    // lecture reservee aux admins/moderateurs (le client Java gere les incidents)
    // par contre tout habitant peut en signaler un (POST)
    app.get("/incidents", authenticateToken, requireRole("admin", "moderateur"), GetAllIncidents)
    app.get("/incidents/:id", authenticateToken, requireRole("admin", "moderateur"), GetIncident)
    app.post("/incidents", writeLimiter, authenticateToken, CreateIncident)
    app.put("/incidents/:id/statut", writeLimiter, authenticateToken, ChangerStatutIncident)

    // --- competences ---
    app.get("/users/:userId/competences", authenticateToken, GetCompetences)
    app.post("/competences", writeLimiter, authenticateToken, CreateCompetence)
    app.delete("/competences/:id", writeLimiter, authenticateToken, DeleteCompetence)

    // --- recommandations (Neo4j) ---
    app.get("/recommendations/voisins", authenticateToken, RecommanderVoisins)
    app.get("/recommendations/evenements", authenticateToken, RecommanderEvenements)
    app.get("/recommendations/services", authenticateToken, RecommanderServices)

    // --- RGPD ---
    app.get("/gdpr/export", sensitiveLimiter, authenticateToken, ExporterDonnees)
    app.get("/gdpr/consentement", authenticateToken, ConsulterConsentement)
    app.post("/gdpr/consentement", writeLimiter, authenticateToken, EnregistrerConsentement)
    app.delete("/gdpr/delete", sensitiveLimiter, authenticateToken, AnonymiserCompte)

    // --- upload de fichiers (PDF contrats, photos, vocaux) ---
    app.post("/upload", uploadLimiter, authenticateToken, upload.single("file"), EnvoyerFichier)

    // --- MFA ---
    app.post("/auth/mfa/setup", sensitiveLimiter, authenticateToken, SetupMfa)
    app.post("/auth/mfa/verify", sensitiveLimiter, authenticateToken, VerifyMfa)
    app.post("/auth/mfa/disable", sensitiveLimiter, authenticateToken, DisableMfa)

    // --- users (back office) ---
    app.get("/users", authenticateToken, requireRole("admin", "moderateur"), GetAllUsers)
    app.put("/users/:id/role", sensitiveLimiter, authenticateToken, requireRole("admin"), ChangerRoleUtilisateur)
    app.put("/users/:id/vote-block", sensitiveLimiter, authenticateToken, requireRole("admin", "moderateur"), BloquerVoteUtilisateur)

    // --- points ---
    app.get("/me/points", authenticateToken, ConsulterMesPoints)
    app.post("/services/:id/terminer", writeLimiter, authenticateToken, TerminerService)

    // --- stats (client Java) ---
    app.get("/stats/incidents", authenticateToken, requireRole("admin", "moderateur"), StatistiquesIncidents)
    app.get("/stats/participations", authenticateToken, requireRole("admin", "moderateur"), StatistiquesParticipations)

    // --- synchronisation offline-first (client Java) ---
    app.get("/sync", authenticateToken, requireRole("admin", "moderateur"), SyncPull)
    app.post("/sync", writeLimiter, authenticateToken, requireRole("admin", "moderateur"), SyncPush)

    // --- telechargement du client Java de bureau (.zip, admin only) ---
    app.get("/admin/telecharger-app-java", authenticateToken, requireRole("admin"), TelechargerAppJava)

    // --- signalements / moderation ---
    app.post("/signalements", writeLimiter, authenticateToken, CreateSignalement)
    app.get("/signalements", authenticateToken, requireRole("admin", "moderateur"), GetAllSignalements)
    app.put("/signalements/:id/traiter", writeLimiter, authenticateToken, requireRole("admin", "moderateur"), TraiterSignalement)

    // --- langage de requete MongoDB maison ---
    app.post("/query", queryLimiter, authenticateToken, requireRole("admin", "moderateur"), ExecuterRequete)

    // --- presence temps reel (lecture REST, live via WebSocket) ---
    app.get("/presence", authenticateToken, (_req: Request, res: Response) => res.json({ online: getOnlineUsers() }))
}
