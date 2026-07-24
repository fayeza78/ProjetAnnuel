export const swaggerSpec = {
  openapi: "3.0.0",
  info: {
    title: "Connected Neighbours API !",
    version: "1.0.0",
    description:
      "API pour la plateforme collaborative de quartier — Connected Neighbours.\n\nToutes les routes protégées nécessitent un `Bearer <access_token>` dans le header `Authorization` (`POST /auth/register` → `POST /auth/login`).",
  },
  servers: [
    {
      url: "https://petitsecretentrevoisins.online/api",
      description: "Production (HTTPS, via Apache)",
    },
    {
      url: "http://51.77.245.139:3000",
      description: "Production (accès direct API)",
    },
    { url: "http://localhost:3000", description: "Serveur local" },
  ],

  security: [{ bearerAuth: [] }],
  tags: [
    { name: "Health", description: "Disponibilité de l'API." },
    {
      name: "Auth",
      description:
        "Inscription, connexion, rafraîchissement et révocation des tokens JWT.",
    },
    {
      name: "Users",
      description: "Gestion des comptes utilisateurs (PostgreSQL).",
    },
    {
      name: "Quartiers",
      description:
        "Quartiers de la plateforme (PostgreSQL). Lecture publique, écriture réservée aux admins.",
    },
    {
      name: "Services",
      description:
        "Offres et demandes d'entraide (PostgreSQL + sync Neo4j pour les offres).",
    },
    {
      name: "Evenements",
      description:
        "Événements de quartier (PostgreSQL + détail MongoDB + participation Neo4j).",
    },
    {
      name: "Votes",
      description: "Votes citoyens (stockés dans MongoDB ; l'id est un UUID).",
    },
    {
      name: "Contrats",
      description:
        "Contrats de service : référence PostgreSQL + document signable MongoDB.",
    },
    { name: "Messagerie", description: "Conversations et messages (MongoDB)." },
    {
      name: "Incidents",
      description: "Signalements d'incidents (PostgreSQL).",
    },
    {
      name: "Compétences",
      description: "Compétences déclarées par les utilisateurs (PostgreSQL).",
    },
    {
      name: "Recommandations",
      description: "Suggestions calculées sur le graphe social Neo4j.",
    },
    {
      name: "RGPD",
      description:
        "Droits RGPD : accès, portabilité, consentement, effacement.",
    },
    {
      name: "Upload",
      description:
        "Téléversement de fichiers (PDF de contrats, photos, vocaux).",
    },
    {
      name: "MFA",
      description:
        "Double authentification TOTP (obligatoire pour les actions sensibles).",
    },
    {
      name: "Stats",
      description:
        "Statistiques (incidents, participations) pour le client Java.",
    },
    {
      name: "Sync",
      description:
        "Synchronisation offline-first du client Java (pull/push + conflits).",
    },
    {
      name: "Signalements",
      description: "Modération : signalements de contenu et traitement.",
    },
    {
      name: "Modération",
      description:
        "Actions de modération réservées aux admins/modérateurs : bloquer un utilisateur pour les votes, changer un rôle.",
    },
    {
      name: "Query",
      description: "Langage d'interrogation maison des collections MongoDB.",
    },
    {
      name: "Présence",
      description:
        "Présence temps réel online/offline (WebSocket + lecture REST).",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "1. Exécuter `POST /auth/login`.\n2. Copier la valeur de `access_token` dans la réponse.\n3. La coller ici (sans écrire `Bearer`, il est ajouté automatiquement) puis cliquer **Authorize**.\n\nLe token reste actif sur toutes les routes cadenassées, même après rechargement de la page.",
      },
    },
    responses: {
      BadRequest: {
        description:
          'Requête invalide. Soit un objet `{ "champ.path": "message" }` (erreurs de validation Joi), soit `{ error }`.',
        content: {
          "application/json": {
            schema: {
              oneOf: [
                {
                  type: "object",
                  additionalProperties: { type: "string" },
                  example: { email: '"email" must be a valid email' },
                },
                { $ref: "#/components/schemas/Error" },
              ],
            },
          },
        },
      },
      Unauthorized: {
        description: "Token d'accès absent, invalide ou expiré.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: { error: "Invalid or expired token" },
          },
        },
      },
      Forbidden: {
        description:
          "Authentifié mais permissions insuffisantes pour cette action.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: { error: "Insufficient permissions" },
          },
        },
      },
      NotFound: {
        description: "Ressource introuvable.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      ServerError: {
        description: "Erreur interne du serveur.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: { error: "Internal Server Error" },
          },
        },
      },
      TooManyRequests: {
        description:
          "Trop de requêtes — limite de débit (rate limit) dépassée. Réessayez après la fenêtre indiquée par l'en-tête `RateLimit`.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: { error: "Trop de requêtes, réessayez plus tard." },
          },
        },
      },
    },
    schemas: {
      // -- Generics ------------------------------------------------------
      Error: {
        type: "object",
        properties: { error: { type: "string", example: "Message d'erreur" } },
      },
      MessageResponse: {
        type: "object",
        properties: {
          message: { type: "string", example: "Opération réussie" },
        },
      },
      // -- Auth ----------------------------------------------------------
      RegisterRequest: {
        type: "object",
        required: [
          "email",
          "password",
          "adresse",
          "ville",
          "cp",
          "nom_quartier",
        ],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "jean.dupont@email.fr",
          },
          password: { type: "string", minLength: 8, example: "MotDePasse123!" },
          adresse: { type: "string", example: "12 rue des Fleurs" },
          ville: { type: "string", example: "Paris" },
          cp: { type: "string", pattern: "^[0-9]{5}$", example: "75018" },
          nom_quartier: { type: "string", example: "Montmartre" },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "jean.dupont@email.fr",
          },
          password: { type: "string", example: "MotDePasse123!" },
          code: {
            type: "string",
            pattern: "^[0-9]{6}$",
            description:
              "Code TOTP à 6 chiffres. **Obligatoire uniquement si le compte a activé la MFA** — sinon laisser le champ vide/absent.",
            example: "123456",
          },
        },
      },
      RefreshRequest: {
        type: "object",
        required: ["refresh_token"],
        properties: {
          refresh_token: {
            type: "string",
            format: "uuid",
            description: "Refresh token (UUID) obtenu via POST /auth/login",
            example: "550e8400-e29b-41d4-a716-446655440000",
          },
        },
      },
      AuthResponse: {
        type: "object",
        properties: {
          access_token: {
            type: "string",
            example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          },
          refresh_token: {
            type: "string",
            example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          },
          token_type: { type: "string", example: "Bearer" },
          expires_in: {
            type: "integer",
            example: 3600,
            description: "Durée de validité de l'access token en secondes",
          },
          user: {
            type: "object",
            properties: {
              id_user: { type: "integer", example: 1 },
              email: { type: "string", example: "jean.dupont@email.fr" },
              role: {
                type: "string",
                enum: ["user", "moderateur", "admin"],
                example: "user",
              },
            },
          },
        },
      },
      // -- User ----------------------------------------------------------
      UserProfile: {
        type: "object",
        properties: {
          id_user: { type: "integer", example: 1 },
          email: { type: "string", example: "jean.dupont@email.fr" },
          role: {
            type: "string",
            enum: ["user", "moderateur", "admin"],
            example: "user",
          },
          adresse: { type: "string", example: "12 rue des Fleurs" },
          ville: { type: "string", example: "Paris" },
          cp: { type: "string", example: "75018" },
          quartier: { type: "string", nullable: true, example: "Montmartre" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      UpdateUserRequest: {
        type: "object",
        properties: {
          adresse: { type: "string", example: "5 avenue de la Paix" },
          ville: { type: "string", example: "Paris" },
          cp: { type: "string", pattern: "^[0-9]{5}$", example: "75001" },
        },
      },
      // -- Quartier ------------------------------------------------------
      Quartier: {
        type: "object",
        properties: {
          id_quartier: { type: "integer", example: 1 },
          nom_quartier: { type: "string", example: "Montmartre" },
          limite_geo: {
            type: "string",
            description: "Polygone géographique GeoJSON (chaîne)",
            example:
              '{"type":"Polygon","coordinates":[[[2.332,48.889],[2.352,48.889],[2.352,48.895],[2.332,48.895],[2.332,48.889]]]}',
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      CreateQuartierRequest: {
        type: "object",
        required: ["nom_quartier"],
        properties: {
          nom_quartier: {
            type: "string",
            maxLength: 100,
            example: "Montmartre",
          },
          limite_geo: {
            type: "string",
            maxLength: 2000,
            description:
              "Polygone GeoJSON (chaîne). Le serveur refuse (409) une limite qui en chevauche une autre.",
            example:
              '{"type":"Polygon","coordinates":[[[2.33,48.88],[2.35,48.88],[2.35,48.89],[2.33,48.89],[2.33,48.88]]]}',
          },
        },
      },
      // -- Service -------------------------------------------------------
      Service: {
        type: "object",
        properties: {
          id_service: { type: "integer", example: 1 },
          type: {
            type: "string",
            enum: ["offre", "demande"],
            example: "offre",
          },
          categorie: { type: "string", example: "bricolage" },
          date_: { type: "string", format: "date", example: "2025-06-01" },
          prix: {
            type: "integer",
            example: 3,
            description: "Nombre de points (0 = gratuit)",
          },
          statut: {
            type: "string",
            enum: ["disponible", "en_cours", "termine", "annule"],
            example: "disponible",
          },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CreateServiceRequest: {
        type: "object",
        required: ["type"],
        properties: {
          type: {
            type: "string",
            enum: ["offre", "demande"],
            example: "offre",
          },
          categorie: { type: "string", maxLength: 50, example: "jardinage" },
          date_: { type: "string", format: "date", example: "2025-07-15" },
          prix: {
            type: "integer",
            minimum: 0,
            example: 2,
            description:
              "Nombre de points. Uniquement sur une `offre` : sur une `demande` le prix doit rester à 0 (sinon 400).",
          },
          description: {
            type: "string",
            maxLength: 1000,
            description: "Stockée dans la fiche MongoDB du service",
            example: "Taille de haies et tonte de pelouse le week-end.",
          },
        },
      },
      DemandeService: {
        type: "object",
        properties: {
          id_user: { type: "integer", example: 5 },
          id_service: { type: "integer", example: 1 },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      // -- Evenement -----------------------------------------------------
      Evenement: {
        type: "object",
        properties: {
          id_evenement: { type: "integer", example: 1 },
          titre: { type: "string", example: "Repas de quartier" },
          date_: { type: "string", format: "date", example: "2025-06-15" },
          type: { type: "string", example: "social" },
          statut: {
            type: "string",
            enum: ["actif", "annule", "termine"],
            example: "actif",
          },
          user: {
            type: "object",
            properties: {
              id_user: { type: "integer", example: 1 },
              email: { type: "string", example: "martin.dupont@email.fr" },
            },
          },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      EvenementDetail: {
        type: "object",
        description:
          "Données PostgreSQL + détail MongoDB (participants, photos, commentaires)",
        properties: {
          evenement: { $ref: "#/components/schemas/Evenement" },
          detail: {
            type: "object",
            nullable: true,
            properties: {
              postgres_id: { type: "string", example: "1" },
              title_event: { type: "string", example: "Repas de quartier" },
              description: { type: "string", example: "Venez nombreux !" },
              photos: { type: "array", items: { type: "string" } },
              tags: { type: "array", items: { type: "string" } },
              participants: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    inhabitant_postgres_id: { type: "string", example: "3" },
                    firstName: { type: "string", example: "Sophie" },
                    status: {
                      type: "string",
                      enum: ["interested", "confirmed", "declined"],
                    },
                    joinedAt: { type: "string", format: "date-time" },
                  },
                },
              },
              comments: { type: "array", items: { type: "object" } },
            },
          },
        },
      },
      CreateEvenementRequest: {
        type: "object",
        required: ["titre"],
        properties: {
          titre: {
            type: "string",
            maxLength: 50,
            example: "Vide-grenier de printemps",
          },
          date_: { type: "string", format: "date", example: "2025-07-05" },
          type: { type: "string", maxLength: 50, example: "commerce" },
        },
      },
      UpdateEvenementRequest: {
        type: "object",
        properties: {
          titre: { type: "string", maxLength: 50 },
          date_: { type: "string", format: "date" },
          type: { type: "string", maxLength: 50 },
          statut: { type: "string", enum: ["actif", "annule", "termine"] },
        },
      },
      ParticiperRequest: {
        type: "object",
        required: ["status"],
        properties: {
          status: {
            type: "string",
            enum: ["interested", "confirmed", "declined"],
            example: "confirmed",
          },
        },
      },
      // -- Vote ----------------------------------------------------------
      VoteOption: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid", example: "a1b2c3d4-..." },
          label: { type: "string", example: "Option A" },
          votesCount: { type: "integer", example: 12 },
        },
      },
      Vote: {
        type: "object",
        properties: {
          postgres_id: { type: "string", format: "uuid" },
          question: {
            type: "string",
            example: "Faut-il installer un banc au square ?",
          },
          description: { type: "string", example: "Vote citoyen du quartier" },
          type: {
            type: "string",
            enum: ["single", "multiple", "yesno"],
            example: "single",
          },
          options: {
            type: "array",
            items: { $ref: "#/components/schemas/VoteOption" },
          },
          isAnonymous: { type: "boolean", example: false },
          deadline: { type: "string", format: "date-time", nullable: true },
          status: {
            type: "string",
            enum: ["active", "closed"],
            example: "active",
          },
          createdBy_postgres_id: { type: "string", example: "1" },
          targetQuartier_postgres_id: { type: "string", nullable: true },
        },
      },
      CreateVoteRequest: {
        type: "object",
        required: ["question", "type", "options"],
        properties: {
          question: {
            type: "string",
            maxLength: 255,
            example: "Faut-il installer un banc au square ?",
          },
          description: {
            type: "string",
            example: "Vote pour les habitants du quartier",
          },
          type: {
            type: "string",
            enum: ["single", "multiple", "yesno"],
            example: "single",
          },
          options: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            example: ["Oui", "Non", "Sans avis"],
          },
          isAnonymous: { type: "boolean", example: false },
          deadline: {
            type: "string",
            format: "date-time",
            example: "2025-07-01T00:00:00Z",
          },
          targetQuartier_postgres_id: { type: "string", example: "1" },
        },
      },
      CastVoteRequest: {
        type: "object",
        required: ["optionIds"],
        properties: {
          optionIds: {
            type: "array",
            items: { type: "string", format: "uuid" },
            minItems: 1,
            example: ["a1b2c3d4-..."],
          },
        },
      },
      // -- Contrat -------------------------------------------------------
      Contrat: {
        type: "object",
        properties: {
          id_contrat: { type: "string", example: "CTR-001" },
          lienpdf: {
            type: "string",
            description:
              "PDF du contrat — généré par l'API pour un contrat automatique (service payant)",
            example: "/uploads/contrats/contrat-CTR-001.pdf",
          },
          statut: {
            type: "string",
            enum: ["pending", "partially_signed", "signed", "archived"],
            example: "pending",
          },
          service: { $ref: "#/components/schemas/Service" },
        },
      },
      SignatureZone: {
        type: "object",
        description: "Zone de signature positionnée dans le PDF.",
        properties: {
          page: { type: "integer", example: 1 },
          x: { type: "number", example: 100 },
          y: { type: "number", example: 500 },
          width: { type: "number", example: 200 },
          height: { type: "number", example: 50 },
          type: {
            type: "string",
            enum: ["signature", "initials"],
            example: "signature",
          },
          assignedTo_postgres_id: {
            type: "string",
            description: "id_user devant signer cette zone",
            example: "2",
          },
          label: { type: "string", example: "Signature prestataire" },
        },
      },
      Signature: {
        type: "object",
        description: "Signature apposée par un utilisateur.",
        properties: {
          user_postgres_id: { type: "string", example: "2" },
          signatureImage: {
            type: "string",
            description: "Image base64 (PNG)",
            example: "data:image/png;base64,iVBORw0KGgo...",
          },
          signedAt: { type: "string", format: "date-time" },
          ipAddress: { type: "string", example: "" },
          checksum: {
            type: "string",
            format: "uuid",
            description: "Empreinte d'intégrité de la signature",
          },
        },
      },
      AuditEntry: {
        type: "object",
        description: "Entrée du journal d'audit d'un contrat.",
        properties: {
          action: {
            type: "string",
            enum: ["created", "signed"],
            example: "signed",
          },
          user_postgres_id: { type: "string", example: "2" },
          timestamp: { type: "string", format: "date-time" },
          details: { type: "string", example: "Document signé numériquement" },
        },
      },
      ContratDocument: {
        type: "object",
        description: "Document MongoDB d'un contrat (collection `contracts`).",
        properties: {
          postgres_id: {
            type: "string",
            description: "= id_contrat côté PostgreSQL",
            example: "CTR-001",
          },
          pdfUrl: {
            type: "string",
            description:
              "PDF du contrat (généré par l'API pour un contrat automatique, ou téléversé via /upload)",
            example: "/uploads/contrats/contrat-CTR-001.pdf",
          },
          signatureZones: {
            type: "array",
            items: { $ref: "#/components/schemas/SignatureZone" },
          },
          signatures: {
            type: "array",
            items: { $ref: "#/components/schemas/Signature" },
          },
          auditTrail: {
            type: "array",
            items: { $ref: "#/components/schemas/AuditEntry" },
          },
          status: {
            type: "string",
            enum: ["pending", "partially_signed", "signed", "archived"],
            example: "partially_signed",
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      MediaAttachment: {
        type: "object",
        description: "Pièce jointe d'un message.",
        properties: {
          type: {
            type: "string",
            enum: ["photo", "voice", "video"],
            example: "photo",
          },
          url: {
            type: "string",
            format: "uri",
            example: "https://storage.example.com/photo.jpg",
          },
          size: {
            type: "number",
            description: "Taille en octets",
            example: 204800,
          },
          mimeType: { type: "string", example: "image/jpeg" },
          duration: {
            type: "number",
            nullable: true,
            description: "Durée en secondes (audio/vidéo)",
            example: 12,
          },
        },
      },
      CreateContratRequest: {
        type: "object",
        required: ["id_service", "pdfUrl"],
        properties: {
          id_service: { type: "integer", example: 1 },
          pdfUrl: {
            type: "string",
            maxLength: 500,
            example: "https://storage.example.com/contrat.pdf",
          },
          signatureZones: {
            type: "array",
            description: "Zones de signature positionnées dans le PDF",
            items: {
              type: "object",
              properties: {
                page: { type: "integer", example: 1 },
                x: { type: "number", example: 100 },
                y: { type: "number", example: 500 },
                width: { type: "number", example: 200 },
                height: { type: "number", example: 50 },
                type: {
                  type: "string",
                  enum: ["signature", "initials"],
                  example: "signature",
                },
                assignedTo_postgres_id: { type: "string", example: "2" },
                label: { type: "string", example: "Signature prestataire" },
              },
            },
          },
        },
      },
      SignerContratRequest: {
        type: "object",
        required: ["signatureImage"],
        properties: {
          signatureImage: {
            type: "string",
            maxLength: 2000000,
            description:
              "Image du tracé en **data URI** (`data:image/png|jpeg|webp;base64,...`), tel que rendu par `canvas.toDataURL()`. Tout autre format est refusé en 400. Maximum **2 Mo** : l'image est stockée dans le document MongoDB du contrat.",
            example: "data:image/png;base64,iVBORw0KGgo...",
          },
        },
      },
      // -- Messagerie ----------------------------------------------------
      Conversation: {
        type: "object",
        properties: {
          conversationId: { type: "string", example: "conv_abc123" },
          participants: {
            type: "array",
            items: { type: "string" },
            example: ["1", "3"],
          },
          lastMessage: {
            type: "object",
            nullable: true,
            properties: {
              content: { type: "string", example: "Bonjour !" },
              sender_postgres_id: { type: "string", example: "1" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
      Message: {
        type: "object",
        properties: {
          conversationId: { type: "string", example: "conv_abc123" },
          postgres_id: {
            type: "string",
            format: "uuid",
            description: "Identifiant logique du message",
          },
          sender_postgres_id: { type: "string", example: "1" },
          recipient_postgres_ids: {
            type: "array",
            items: { type: "string" },
            example: ["2", "3"],
          },
          content: {
            type: "string",
            example: "Bonjour, je suis disponible demain.",
          },
          mediaAttachments: {
            type: "array",
            items: { $ref: "#/components/schemas/MediaAttachment" },
          },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CreateConversationRequest: {
        type: "object",
        required: ["recipient_postgres_ids"],
        properties: {
          recipient_postgres_ids: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            example: ["2", "3"],
          },
        },
      },
      SendMessageRequest: {
        type: "object",
        properties: {
          content: {
            type: "string",
            maxLength: 2000,
            description:
              "Requis si `mediaAttachments` est absent (au moins l'un des deux).",
            example: "Bonjour, je suis disponible demain !",
          },
          recipientIds: {
            type: "array",
            items: { type: "string" },
            description:
              "Destinataires du message (lus directement dans le body par le handler, requis).",
            example: ["2"],
          },
          mediaAttachments: {
            type: "array",
            items: { $ref: "#/components/schemas/MediaAttachment" },
          },
        },
      },
      // -- Incident ------------------------------------------------------
      Incident: {
        type: "object",
        properties: {
          id_incident: { type: "integer", example: 1 },
          description: {
            type: "string",
            example: "Lampadaire cassé rue Lepic",
          },
          statut: {
            type: "string",
            enum: ["ouvert", "en_cours", "resolu", "ferme"],
            example: "ouvert",
          },
          user: {
            type: "object",
            nullable: true,
            properties: {
              id_user: { type: "integer", example: 1 },
              email: { type: "string", example: "martin.dupont@email.fr" },
            },
          },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CreateIncidentRequest: {
        type: "object",
        required: ["description"],
        properties: {
          description: {
            type: "string",
            maxLength: 50,
            example: "Nid de poule dangereux avenue Voltaire",
          },
        },
      },
      // -- Competence ----------------------------------------------------
      Competence: {
        type: "object",
        properties: {
          id_comp: { type: "integer", example: 1 },
          libelle: { type: "string", example: "Plomberie" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
    },
  },
  paths: {
    // -- Upload --------------------------------------------------------------
    "/upload": {
      post: {
        tags: ["Upload"],
        summary: "Téléverser un fichier",
        description:
          "Envoie un fichier (`multipart/form-data`, champ `file`). Retourne l'URL publique (servie sous `/uploads`, avec `nosniff`). **Types autorisés** : PDF, images (jpeg/png/webp/gif), audio (mpeg/mp4/ogg/webm/wav), vidéo (mp4/webm/ogg). Tout autre type (ex. HTML, SVG) est refusé. **Taille max** : 20 Mo.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: { file: { type: "string", format: "binary" } },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Fichier reçu",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    url: { type: "string", example: "/uploads/uuid.pdf" },
                    filename: { type: "string" },
                    originalName: { type: "string" },
                    mimeType: { type: "string" },
                    size: { type: "integer" },
                  },
                },
              },
            },
          },
          400: {
            description: "Aucun fichier reçu",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          413: {
            description: "Fichier trop volumineux (> 20 Mo)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          415: {
            description: "Type de fichier non autorisé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          429: { $ref: "#/components/responses/TooManyRequests" },
        },
      },
    },
    // -- MFA -----------------------------------------------------------------
    "/auth/mfa/setup": {
      post: {
        tags: ["MFA"],
        summary: "Initialiser la MFA (TOTP)",
        description:
          "Génère un secret TOTP et l'URL `otpauth://` à scanner dans une app d'authentification. La MFA n'est active qu'après `POST /auth/mfa/verify`.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Secret généré",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    secret: { type: "string" },
                    otpauthUrl: {
                      type: "string",
                      example:
                        "otpauth://totp/Connected%20Neighbours:jean@email.fr?secret=...",
                    },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/auth/mfa/verify": {
      post: {
        tags: ["MFA"],
        summary: "Activer la MFA",
        description:
          "Vérifie un premier code TOTP à 6 chiffres et active la MFA. Ensuite, `POST /auth/login` exigera le champ `code`.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["code"],
                properties: { code: { type: "string", example: "123456" } },
              },
            },
          },
        },
        responses: {
          200: {
            description: "MFA activée",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" },
              },
            },
          },
          400: {
            description: "Code invalide",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/auth/mfa/disable": {
      post: {
        tags: ["MFA"],
        summary: "Désactiver la MFA",
        description:
          "Désactive la double authentification du compte connecté et oublie le secret TOTP. ⚠️ Avec `MFA_ENFORCE` actif (défaut), le compte devra la réactiver pour les actions sensibles.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "MFA désactivée",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    // -- Mot de passe oublie -------------------------------------------------
    "/auth/forgot-password": {
      post: {
        tags: ["Auth"],
        summary: "Mot de passe oublié — demander un ticket",
        security: [],
        description:
          "Route **publique**. Génère un ticket de réinitialisation à **usage unique, valable 15 min** (`TokenType.reset_password`). Réponse identique que l'e-mail existe ou non (anti-énumération). ⚠️ Le ticket (`reset_token`) n'est renvoyé dans la réponse **que si `EXPOSE_RESET_TOKEN=true`** (démo sans serveur mail) ; en production il reste côté serveur et partirait par e-mail.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: {
                    type: "string",
                    format: "email",
                    example: "jean.dupont@email.fr",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Ticket généré (si le compte existe)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    reset_token: { type: "string", format: "uuid" },
                    expires_in: { type: "integer", example: 900 },
                  },
                },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          429: { $ref: "#/components/responses/TooManyRequests" },
        },
      },
    },
    "/auth/reset-password": {
      post: {
        tags: ["Auth"],
        summary: "Mot de passe oublié — réinitialiser",
        security: [],
        description:
          "Route **publique**. Consomme le ticket (usage unique), remplace le mot de passe (bcrypt) et **révoque toutes les sessions** (refresh tokens) du compte.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token", "new_password"],
                properties: {
                  token: { type: "string", format: "uuid" },
                  new_password: { type: "string", minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Mot de passe modifié",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: {
            description:
              "Ticket invalide ou expiré (`code: RESET_TOKEN_INVALID`)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          429: { $ref: "#/components/responses/TooManyRequests" },
        },
      },
    },
    // -- Notation & centres d'interet (alimentation du graphe Neo4j) ---------
    "/users/{id}/interets": {
      get: {
        tags: ["Recommandations"],
        summary: "Centres d'intérêt d'un voisin",
        description:
          "Renvoie les centres d'intérêt déclarés par un utilisateur (lecture, tous les authentifiés). Sert à afficher les **intérêts en commun** sur les recommandations de voisins.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 3,
          },
        ],
        responses: {
          200: {
            description: "Centres d'intérêt du voisin",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    interests: {
                      type: "array",
                      items: { type: "string" },
                      example: ["jardinage", "cuisine"],
                    },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/users/{id}/noter": {
      get: {
        tags: ["Recommandations"],
        summary: "Consulter ma note d'un voisin + sa moyenne",
        description:
          "Renvoie la note que l'utilisateur connecté a donnée à ce voisin (`maNote`, `null` s'il ne l'a pas encore noté), la **moyenne des notes reçues** par ce voisin (`moyenne`, arrondie au dixième, `null` si personne ne l'a noté) et le **nombre de notes** reçues. Lu dans **Neo4j** (relation `A_NOTE`).",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 3,
          },
        ],
        responses: {
          200: {
            description: "Ma note et la moyenne du voisin",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    maNote: { type: "integer", nullable: true, example: 4 },
                    moyenne: { type: "number", nullable: true, example: 4.3 },
                    nombreDeNotes: { type: "integer", example: 6 },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: {
            description: "Utilisateur introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
      post: {
        tags: ["Recommandations"],
        summary: "Noter un voisin (1 à 5)",
        description:
          "Crée/met à jour la relation **`A_NOTE`** dans Neo4j (une note par couple noteur→noté ; re-noter met à jour). Alimente le score de confiance des **voisins fiables**. On ne peut pas se noter soi-même (`400 SELF_RATING`).",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 3,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["rating"],
                properties: {
                  rating: {
                    type: "integer",
                    minimum: 1,
                    maximum: 5,
                    example: 5,
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Note enregistrée",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    rating: { type: "integer" },
                  },
                },
              },
            },
          },
          400: {
            description: "ID invalide, rating hors bornes, ou auto-notation",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: {
            description: "Utilisateur introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          429: { $ref: "#/components/responses/TooManyRequests" },
        },
      },
    },
    "/me/interets": {
      get: {
        tags: ["Recommandations"],
        summary: "Mes centres d'intérêt",
        description:
          "Liste des centres d'intérêt de l'utilisateur connecté (profil MongoDB).",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Centres d'intérêt",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    interests: {
                      type: "array",
                      items: { type: "string" },
                      example: ["jardinage", "informatique"],
                    },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
      put: {
        tags: ["Recommandations"],
        summary: "Déclarer mes centres d'intérêt",
        description:
          "**Remplace** la liste (max 10 tags, normalisés en minuscules) dans le profil MongoDB ET dans Neo4j (relations **`INTERESSE_PAR`**). C'est la donnée d'entrée des recommandations d'**événements** et de **services**.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["interests"],
                properties: {
                  interests: {
                    type: "array",
                    maxItems: 10,
                    items: { type: "string", minLength: 2, maxLength: 30 },
                    example: ["jardinage", "cuisine", "informatique"],
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Centres d'intérêt mis à jour",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    interests: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          429: { $ref: "#/components/responses/TooManyRequests" },
        },
      },
    },
    // -- Changements d'infos sensibles (MFA si activee) ------------------------
    "/auth/change-password": {
      post: {
        tags: ["Auth"],
        summary: "Changer son mot de passe",
        description:
          "Action sensible : nécessite le **mot de passe actuel** et, **si la MFA est activée**, un `code` TOTP. Révoque les autres sessions.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["current_password", "new_password"],
                properties: {
                  current_password: {
                    type: "string",
                    example: "AncienMdp123!",
                  },
                  new_password: {
                    type: "string",
                    minLength: 8,
                    example: "NouveauMdp123!",
                  },
                  code: {
                    type: "string",
                    description: "Code TOTP si MFA activée",
                    example: "123456",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Mot de passe modifié",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: {
            description: "Mot de passe ou code MFA invalide (ou MFA requise)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          429: { $ref: "#/components/responses/TooManyRequests" },
        },
      },
    },
    "/auth/change-email": {
      post: {
        tags: ["Auth"],
        summary: "Changer son e-mail",
        description:
          "Action sensible : nécessite le **mot de passe** et, **si la MFA est activée**, un `code` TOTP. L'e-mail doit être libre.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["password", "new_email"],
                properties: {
                  password: { type: "string", example: "MotDePasse123!" },
                  new_email: {
                    type: "string",
                    format: "email",
                    example: "nouveau@email.fr",
                  },
                  code: { type: "string", example: "123456" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "E-mail modifié",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: {
            description: "Mot de passe ou code MFA invalide",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          409: {
            description: "E-mail déjà utilisé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          429: { $ref: "#/components/responses/TooManyRequests" },
        },
      },
    },
    "/auth/change-phone": {
      post: {
        tags: ["Auth"],
        summary: "Changer son téléphone",
        description:
          "Action sensible : nécessite le **mot de passe** et, **si la MFA est activée**, un `code` TOTP.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["password", "telephone"],
                properties: {
                  password: { type: "string", example: "MotDePasse123!" },
                  telephone: {
                    type: "string",
                    maxLength: 20,
                    example: "0612345678",
                  },
                  code: { type: "string", example: "123456" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Téléphone modifié",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: {
            description: "Mot de passe ou code MFA invalide",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          429: { $ref: "#/components/responses/TooManyRequests" },
        },
      },
    },
    // -- SSO web client Java -------------------------------------------------
    "/auth/sso/ticket": {
      post: {
        tags: ["Auth"],
        summary: "SSO — générer un ticket à usage unique",
        description:
          "L'utilisateur connecté au **site web** génère un ticket SSO court (valide 120 s). Le **client Java** l'échangera via `/auth/sso/exchange` pour obtenir des tokens sans ressaisir son mot de passe.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Ticket généré",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    sso_ticket: { type: "string", format: "uuid" },
                    expires_in: { type: "integer", example: 120 },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/auth/sso/exchange": {
      post: {
        tags: ["Auth"],
        summary: "SSO — échanger un ticket contre des tokens",
        security: [],
        description:
          "Le client Java envoie le `sso_ticket` reçu du site web et obtient un `access_token` + `refresh_token` (comme une connexion). Le ticket est **à usage unique**.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["sso_ticket"],
                properties: { sso_ticket: { type: "string", format: "uuid" } },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Connexion SSO réussie",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthResponse" },
              },
            },
          },
          400: {
            description: "sso_ticket manquant",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          401: {
            description: "Ticket invalide ou expiré",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          429: { $ref: "#/components/responses/TooManyRequests" },
        },
      },
    },
    "/contrats/{id}/archiver": {
      post: {
        tags: ["Contrats"],
        summary: "Archiver un contrat signé",
        description:
          "Passe un contrat **entièrement signé** au statut `archived`. Réservé aux **parties au contrat** ou à un **admin/modérateur**.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            example: "CTR-001",
          },
        ],
        responses: {
          200: {
            description: "Contrat archivé",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    contrat: { $ref: "#/components/schemas/ContratDocument" },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: {
            description: "Non autorisé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          404: {
            description: "Contrat introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          409: {
            description: "Le contrat n'est pas entièrement signé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    // -- Users (back office) -------------------------------------------------
    "/neighbours": {
      get: {
        tags: ["Users"],
        summary: "Annuaire des voisins",
        description:
          "Liste légère des autres utilisateurs (id, email, ville, quartier) — pour démarrer une conversation. Un **habitant** ne voit que les voisins de **son quartier** ; un **admin/modérateur** voit tout le monde.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Liste des voisins",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id_user: { type: "integer" },
                      email: { type: "string" },
                      ville: { type: "string", nullable: true },
                      quartier: { type: "string", nullable: true },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/users": {
      get: {
        tags: ["Users"],
        summary: "Lister les utilisateurs (back office)",
        description:
          "Réservé aux **admins/modérateurs**. Retourne la liste des comptes.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Liste des utilisateurs",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/UserProfile" },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/users/{id}/role": {
      put: {
        tags: ["Modération"],
        summary: "Changer le rôle d'un utilisateur",
        description:
          "Réservé aux **admins**. Promeut/rétrograde un compte (`user`/`moderateur`/`admin`).",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["role"],
                properties: {
                  role: {
                    type: "string",
                    enum: ["user", "moderateur", "admin"],
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Rôle mis à jour",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id_user: { type: "integer" },
                    email: { type: "string" },
                    role: { type: "string" },
                  },
                },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: {
            description: "Utilisateur introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/users/{id}/vote-block": {
      put: {
        tags: ["Modération"],
        summary: "Bloquer / débloquer un utilisateur pour les votes",
        description:
          "Réservé aux **admins/modérateurs**. Si `blocked=true`, l'utilisateur reçoit `403` lorsqu'il tente de voter (`POST /votes/{id}/voter`).",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 2,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["blocked"],
                properties: { blocked: { type: "boolean", example: true } },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Statut mis à jour",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id_user: { type: "integer" },
                    email: { type: "string" },
                    vote_blocked: { type: "boolean" },
                  },
                },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: {
            description: "Utilisateur introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    // -- Points --------------------------------------------------------------
    "/me/points": {
      get: {
        tags: ["Services"],
        summary: "Solde de points",
        description: "Retourne le solde de points de l'utilisateur connecté.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Solde",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { points: { type: "integer", example: 12 } },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/services/{id}/terminer": {
      post: {
        tags: ["Services"],
        summary: "Terminer un service (transfert de points)",
        description:
          "Clôture le service. Si c'est une **offre payante** (`type = offre` et `prix > 0`), transfère les points du demandeur vers le prestataire, trace la transaction (PostgreSQL) et crée la relation `A_AIDE` (Neo4j). Une `demande` ne déclenche jamais de transfert. `id_demandeur` optionnel (sinon première demande).",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { id_demandeur: { type: "integer", example: 5 } },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Service terminé",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    service: { $ref: "#/components/schemas/Service" },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: {
            description: "Service introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    // -- Stats (client Java) -------------------------------------------------
    "/stats/incidents": {
      get: {
        tags: ["Stats"],
        summary: "Statistiques d'incidents",
        description:
          "Réservé aux **admins/modérateurs**. Total + répartition par statut/gravité/type.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Stats incidents",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    total: { type: "integer" },
                    parStatut: { type: "object" },
                    parGravite: { type: "object" },
                    parType: { type: "object" },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/stats/participations": {
      get: {
        tags: ["Stats"],
        summary: "Statistiques de participations",
        description:
          "Réservé aux **admins/modérateurs**. Participations aux événements par statut et par utilisateur.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Stats participations",
            content: { "application/json": { schema: { type: "object" } } },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    // -- Sync (offline-first) ------------------------------------------------
    "/sync": {
      get: {
        tags: ["Sync"],
        summary: "Pull des changements",
        description:
          "Réservé aux **admins/modérateurs**. Retourne les incidents modifiés depuis `since` (+ `serverTime`).",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "since",
            in: "query",
            schema: { type: "string", format: "date-time" },
            description: "Date ISO du dernier sync",
          },
        ],
        responses: {
          200: {
            description: "Delta",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    serverTime: { type: "string" },
                    incidents: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Incident" },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
      post: {
        tags: ["Sync"],
        summary: "Push des changements (résolution de conflits)",
        description:
          "Réservé aux **admins/modérateurs**. Remonte les incidents créés/modifiés hors-ligne. Conflits résolus par last-write-wins (`updatedAt`).",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["incidents"],
                properties: {
                  incidents: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id_incident: { type: "integer" },
                        description: { type: "string" },
                        statut: { type: "string" },
                        type: { type: "string" },
                        gravite: { type: "string" },
                        updatedAt: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Résultat de la synchro",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    serverTime: { type: "string" },
                    results: { type: "array", items: { type: "object" } },
                  },
                },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    // -- Signalements / moderation -------------------------------------------
    "/signalements": {
      post: {
        tags: ["Signalements"],
        summary: "Signaler un contenu",
        description:
          "Tout utilisateur authentifié peut signaler un message/service/événement/utilisateur.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["cible_type", "cible_id"],
                properties: {
                  cible_type: {
                    type: "string",
                    enum: ["message", "service", "evenement", "user"],
                  },
                  cible_id: { type: "string" },
                  motif: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Signalement créé",
            content: { "application/json": { schema: { type: "object" } } },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
      get: {
        tags: ["Signalements"],
        summary: "Lister les signalements",
        description:
          "Réservé aux **admins/modérateurs**. Filtrable par `statut`.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "statut",
            in: "query",
            schema: { type: "string", enum: ["ouvert", "traite", "rejete"] },
          },
        ],
        responses: {
          200: {
            description: "Liste des signalements",
            content: {
              "application/json": {
                schema: { type: "array", items: { type: "object" } },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/signalements/{id}/traiter": {
      put: {
        tags: ["Signalements"],
        summary: "Traiter un signalement",
        description:
          "Réservé aux **admins/modérateurs**. Passe le statut à `traite` ou `rejete`.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["statut"],
                properties: {
                  statut: {
                    type: "string",
                    enum: ["ouvert", "traite", "rejete"],
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Signalement traité",
            content: { "application/json": { schema: { type: "object" } } },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: {
            description: "Introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    // -- Query (langage maison) ----------------------------------------------
    "/admin/telecharger-app-java": {
      get: {
        tags: ["Administration"],
        summary: "Télécharger le client Java de bureau (.zip)",
        description:
          "Renvoie l'archive **.zip** de l'application de bureau Java (image jpackage : exécutable Windows + runtime JVM). **Réservé aux administrateurs**. L'archive est générée au déploiement (`prod.sh`) et servie telle quelle.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Archive ZIP du client Java",
            content: {
              "application/zip": {
                schema: { type: "string", format: "binary" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: {
            description: "Réservé aux administrateurs",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          404: {
            description: "Archive non générée sur le serveur",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/query": {
      post: {
        tags: ["Query"],
        summary: "Interroger MongoDB (langage maison)",
        description:
          'Réservé aux **admins/modérateurs**. Ex : FIND events WHERE tags CONTAINS "musique" AND title = "Concert" LIMIT 5. Collections : events, contracts, messages, votes, services, inhabitants, neighborhoods, conversations.\n\n**Limite** : sans clause `LIMIT`, un défaut de **100** documents s\'applique ; le maximum est plafonné à **500** (empêche l\'exfiltration de collections entières). Le `CONTAINS` échappe les métacaractères regex (anti-ReDoS).',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["query"],
                properties: {
                  query: {
                    type: "string",
                    example:
                      'FIND events WHERE tags CONTAINS "musique" LIMIT 5',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Résultats",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    collection: { type: "string" },
                    count: { type: "integer" },
                    limit: {
                      type: "integer",
                      description: "Limite effectivement appliquée",
                      example: 100,
                    },
                    results: { type: "array", items: { type: "object" } },
                  },
                },
              },
            },
          },
          400: {
            description: "Erreur de syntaxe / collection inconnue",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          429: { $ref: "#/components/responses/TooManyRequests" },
        },
      },
    },
    // -- Presence ------------------------------------------------------------
    "/presence": {
      get: {
        tags: ["Présence"],
        summary: "Utilisateurs en ligne",
        description:
          "Liste des `userId` actuellement connectés (via WebSocket). Le live se fait par WebSocket (événement `presence`).",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Liste online",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    online: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    // -- Health ------------------------------------------------------------
    "/": {
      get: {
        tags: ["Health"],
        summary: "Vérification que l'API répond",
        security: [],
        description: "Route racine retournant le nom et la version de l'API.",
        responses: {
          200: {
            description: "API en ligne",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: {
                      type: "string",
                      example: "Connected Neighbours API",
                    },
                    version: { type: "string", example: "1.0.0" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/Status": {
      get: {
        tags: ["Health"],
        summary: "Statut de l'API",
        security: [],
        description: "Vérifie que le serveur est opérationnel.",
        responses: {
          200: {
            description: "Serveur opérationnel",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { status: { type: "string", example: "ok" } },
                },
              },
            },
          },
        },
      },
    },
    // -- Auth --------------------------------------------------------------
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Créer un compte utilisateur",
        security: [],
        description:
          "Inscrit un nouvel habitant. Le mot de passe est hashé (bcrypt) avant stockage. Le rôle ne peut pas être choisi à l'inscription : il vaut toujours `user` par défaut. Le `nom_quartier` est rattaché au profil. Route publique (aucun token requis).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterRequest" },
            },
          },
        },
        responses: {
          201: {
            description: "Compte créé avec succès",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id_user: { type: "integer", example: 11 },
                    email: { type: "string", example: "jean.dupont@email.fr" },
                    role: { type: "string", example: "user" },
                    createdAt: { type: "string", format: "date-time" },
                    updatedAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          400: {
            description:
              "Données invalides (email déjà utilisé, champ manquant, format CP incorrect)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          429: { $ref: "#/components/responses/TooManyRequests" },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Se connecter",
        security: [],
        description:
          "Authentifie l'utilisateur et retourne un `access_token` (valide 1h) et un `refresh_token` (UUID, valide 30j).\n\nSi le compte a la **MFA** activée et qu'aucun `code` n'est fourni, la réponse est `200` avec `{ \"mfa_required\": true }` (rejouez la requête en ajoutant le champ `code`).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          200: {
            description:
              "Connexion réussie (ou `{ mfa_required: true }` si la MFA est activée et qu'aucun code n'est fourni)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthResponse" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: {
            description: "Email ou mot de passe invalide",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          429: { $ref: "#/components/responses/TooManyRequests" },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Renouveler l'access token",
        security: [],
        description:
          "Génère un nouvel `access_token` à partir d'un `refresh_token` valide. Le refresh_token n'est pas renouvelé (il reste valable jusqu'à son expiration).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RefreshRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Nouvel access token généré",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    access_token: {
                      type: "string",
                      example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                    },
                    expires_in: {
                      type: "integer",
                      example: 3600,
                      description: "Durée de validité en secondes",
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "refresh_token manquant",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          401: {
            description: "Refresh token invalide ou expiré",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          429: { $ref: "#/components/responses/TooManyRequests" },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Se déconnecter",
        security: [],
        description: "Révoque le refresh token en base de données.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RefreshRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Déconnexion réussie",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" },
              },
            },
          },
          400: {
            description: "refresh_token manquant",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Profil de l'utilisateur connecté",
        description:
          "Retourne les informations du compte associé au token JWT.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Profil de l'utilisateur",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserProfile" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: {
            description: "Utilisateur introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    // -- Users -------------------------------------------------------------
    "/users/{id}": {
      get: {
        tags: ["Users"],
        summary: "Récupérer un utilisateur par son ID",
        description:
          "Retourne un **profil public minimal** (id, email, rôle, ville, quartier) pour un tiers. Les champs sensibles (**adresse, code postal**) ne sont renvoyés qu'au **propriétaire du compte** ou à un **admin/modérateur**.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            description: "ID PostgreSQL de l'utilisateur",
            example: 1,
          },
        ],
        responses: {
          200: {
            description: "Utilisateur trouvé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserProfile" },
              },
            },
          },
          400: {
            description: "ID invalide (non numérique)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: {
            description: "Utilisateur introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
      put: {
        tags: ["Users"],
        summary: "Mettre à jour son profil",
        description:
          "Modifie l'adresse, la ville ou le code postal. Seul l'utilisateur lui-même ou un admin peut modifier un compte.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateUserRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Profil mis à jour",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserProfile" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: {
            description: "Permissions insuffisantes (ni propriétaire ni admin)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          404: {
            description: "Utilisateur introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
      delete: {
        tags: ["Users"],
        summary: "Supprimer un compte",
        description:
          "Suppression logique (soft delete). Seul l'utilisateur lui-même ou un admin peut supprimer un compte. Préférer `/gdpr/delete` pour une anonymisation RGPD complète.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        responses: {
          200: {
            description: "Compte supprimé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" },
              },
            },
          },
          400: {
            description: "ID invalide (non numérique)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: {
            description: "Permissions insuffisantes",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          404: {
            description: "Utilisateur introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    // -- Quartiers ---------------------------------------------------------
    "/quartiers": {
      get: {
        tags: ["Quartiers"],
        summary: "Lister tous les quartiers",
        security: [],
        description:
          "Retourne la liste de tous les quartiers enregistrés. Route publique.",
        responses: {
          200: {
            description: "Liste des quartiers",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Quartier" },
                },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
      post: {
        tags: ["Quartiers"],
        summary: "Créer un quartier",
        description:
          "Réservé aux **admins**. Crée un nouveau quartier avec un nom et un polygone géographique optionnel.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateQuartierRequest" },
            },
          },
        },
        responses: {
          201: {
            description: "Quartier créé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Quartier" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: {
            description: "Réservé aux admins",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          409: {
            description:
              "La limite chevauche un quartier existant (problème de limites)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
                example: {
                  error:
                    "La limite dessinée chevauche le quartier « Centre ». Modifiez le tracé.",
                },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/quartiers/{id}": {
      get: {
        tags: ["Quartiers"],
        summary: "Récupérer un quartier par ID",
        security: [],
        description: "Route publique.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        responses: {
          200: {
            description: "Quartier trouvé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Quartier" },
              },
            },
          },
          400: {
            description: "ID invalide (non numérique)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          404: {
            description: "Quartier introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
      put: {
        tags: ["Quartiers"],
        summary: "Modifier un quartier",
        description: "Réservé aux **admins**.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateQuartierRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Quartier mis à jour",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Quartier" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: {
            description: "Réservé aux admins",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          404: {
            description: "Quartier introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          409: {
            description:
              "La limite chevauche un autre quartier (problème de limites)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
      delete: {
        tags: ["Quartiers"],
        summary: "Supprimer un quartier",
        description: "Réservé aux **admins**.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        responses: {
          200: {
            description: "Quartier supprimé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" },
              },
            },
          },
          400: {
            description: "ID invalide (non numérique)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: {
            description: "Réservé aux admins",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          404: {
            description: "Quartier introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    // -- Services ----------------------------------------------------------
    "/services": {
      get: {
        tags: ["Services"],
        summary: "Lister les services",
        description:
          "Retourne tous les services (offres et demandes). Filtrable par `type` et `statut`.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "type",
            in: "query",
            description: "Filtrer par type",
            schema: { type: "string", enum: ["offre", "demande"] },
          },
          {
            name: "statut",
            in: "query",
            description: "Filtrer par statut",
            schema: {
              type: "string",
              enum: ["disponible", "en_cours", "termine", "annule"],
            },
          },
        ],
        responses: {
          200: {
            description: "Liste des services",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Service" },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
      post: {
        tags: ["Services"],
        summary: "Créer un service (offre ou demande)",
        description:
          "Crée un service (PostgreSQL) et initialise sa fiche riche dans MongoDB (description, disponibilités, avis). Si `type = offre`, le service est également synchronisé dans Neo4j pour les recommandations.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateServiceRequest" },
            },
          },
        },
        responses: {
          201: {
            description: "Service créé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Service" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/services/{id}": {
      get: {
        tags: ["Services"],
        summary: "Récupérer un service par ID",
        description:
          "Retourne les données PostgreSQL du service + sa fiche riche MongoDB sous `detail` (description, disponibilités, avis).",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        responses: {
          200: {
            description:
              "Service trouvé (champs PostgreSQL + `detail` MongoDB)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Service" },
              },
            },
          },
          400: {
            description: "ID invalide (non numérique)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: {
            description: "Service introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
      put: {
        tags: ["Services"],
        summary: "Modifier un service",
        description:
          "Réservé à l'**auteur de l'annonce** (`id_prestataire`) et aux **admins/modérateurs**. Le `statut` ne peut être forcé que par un admin/modérateur (il évolue via `demander`/`terminer`), et le `prix` est figé dès qu'un contrat a été généré.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateServiceRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Service mis à jour",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Service" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: {
            description:
              "Pas l'auteur de l'annonce, ou `statut` réservé aux admins/modérateurs",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          404: {
            description: "Service introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          409: {
            description: "Prix verrouillé : un contrat a déjà été généré",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
      delete: {
        tags: ["Services"],
        summary: "Supprimer un service",
        description:
          "Supprimable par l'**auteur de l'annonce** ou un **admin/modérateur**. Refusé (409) si un contrat est rattaché au service : le contrat et son PDF doivent rester consultables. Suppression logique (soft-delete) + `DETACH DELETE` du nœud Neo4j.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        responses: {
          200: {
            description: "Service supprimé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" },
              },
            },
          },
          400: {
            description: "ID invalide (non numérique)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: {
            description: "Pas l'auteur de l'annonce",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          404: {
            description: "Service introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          409: {
            description: "Un contrat est rattaché à ce service",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/services/{id}/demander": {
      post: {
        tags: ["Services"],
        summary: "Effectuer une demande pour un service",
        description:
          "Crée une liaison `EffectueDemande` entre l'utilisateur connecté et le service. Idempotent : si la demande existe déjà, la demande existante est renvoyée (pas de doublon). **Service payant** : le contrat obligatoire est créé automatiquement et son **PDF est généré par l'API** (gabarit HTML à balises rempli avec les parties, le prix et la date, puis converti en PDF par un Chromium headless piloté par puppeteer-core) — stocké dans `/uploads/contrats/` et référencé par `lienpdf`/`pdfUrl` ; quand les deux parties ont signé, le PDF est régénéré avec les images de signature insérées.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            description: "ID du service à demander",
            example: 1,
          },
        ],
        responses: {
          201: {
            description: "Demande enregistrée",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string", example: "Demande enregistrée" },
                    demande: { $ref: "#/components/schemas/DemandeService" },
                  },
                },
              },
            },
          },
          400: {
            description: "ID invalide (non numérique)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: {
            description: "Service introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
      delete: {
        tags: ["Services"],
        summary: "Retirer sa demande pour un service",
        description:
          "Retire la demande (`EffectueDemande`) de **l'utilisateur connecté** pour ce service. On ne peut retirer que **sa propre** demande. Refusé sur un service déjà `termine` (l'échange a eu lieu). Après retrait, on peut re-demander (suppression réelle, pas de blocage).",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            description: "ID du service",
            example: 1,
          },
        ],
        responses: {
          200: {
            description: "Demande retirée",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" },
              },
            },
          },
          400: {
            description: "ID invalide (non numérique)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: {
            description:
              "Service introuvable, ou aucune demande de l'utilisateur pour ce service",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          409: {
            description: "Service déjà terminé — retrait impossible",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          429: { $ref: "#/components/responses/TooManyRequests" },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/services/{id}/demandes": {
      get: {
        tags: ["Services"],
        summary: "Lister les demandes d'un service",
        description:
          "Retourne la liste des utilisateurs ayant fait une demande pour ce service.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        responses: {
          200: {
            description: "Liste des demandes",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/DemandeService" },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    // -- Evenements --------------------------------------------------------
    "/evenements": {
      get: {
        tags: ["Evenements"],
        summary: "Lister tous les événements",
        description: "Retourne tous les événements avec leur créateur.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Liste des événements",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Evenement" },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
      post: {
        tags: ["Evenements"],
        summary: "Créer un événement",
        description:
          "Crée un événement en PostgreSQL et initialise sa fiche détaillée (participants, photos, commentaires) dans MongoDB.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateEvenementRequest" },
            },
          },
        },
        responses: {
          201: {
            description: "Événement créé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Evenement" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/evenements/{id}": {
      get: {
        tags: ["Evenements"],
        summary: "Récupérer un événement avec ses détails",
        description:
          "Retourne les données PostgreSQL (titre, date, créateur) ET les données MongoDB enrichies (participants, photos, tags, commentaires).",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        responses: {
          200: {
            description: "Événement trouvé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EvenementDetail" },
              },
            },
          },
          400: {
            description: "ID invalide (non numérique)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: {
            description: "Événement introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
      put: {
        tags: ["Evenements"],
        summary: "Modifier un événement",
        description:
          "Modifiable uniquement par le créateur, un modérateur ou un admin.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateEvenementRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Événement mis à jour",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Evenement" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: {
            description:
              "Événement introuvable ou permissions insuffisantes (ni créateur, ni modérateur, ni admin)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
      delete: {
        tags: ["Evenements"],
        summary: "Supprimer un événement",
        description:
          "Suppression logique (soft delete). Réservé au créateur, modérateur ou admin.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        responses: {
          200: {
            description: "Événement supprimé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" },
              },
            },
          },
          400: {
            description: "ID invalide (non numérique)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: {
            description: "Événement introuvable ou permissions insuffisantes",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/evenements/{id}/participer": {
      post: {
        tags: ["Evenements"],
        summary: "Indiquer sa participation (swipe)",
        description:
          "Enregistre ou met à jour le statut de participation de l'utilisateur connecté dans MongoDB.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ParticiperRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Participation enregistrée",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: {
            description: "Événement introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/evenements/{id}/commentaires": {
      post: {
        tags: ["Evenements"],
        summary: "Commenter un événement",
        description:
          "Ajoute un commentaire au détail MongoDB. Ouvert à tout habitant authentifié.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["content"],
                properties: {
                  content: {
                    type: "string",
                    maxLength: 500,
                    example: "Super initiative, j'en suis !",
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Commentaire ajouté" },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: {
            description: "Événement introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/evenements/{id}/photos": {
      post: {
        tags: ["Evenements"],
        summary: "Ajouter une photo à un événement",
        description:
          "Réservé au **créateur** (ou admin/modérateur). URL absolue ou chemin `/uploads/…` issu de `POST /upload`.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["url"],
                properties: {
                  url: { type: "string", example: "/uploads/3f2a1b7c.jpg" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Photo ajoutée" },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: {
            description: "Événement introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/evenements/{id}/tags": {
      post: {
        tags: ["Evenements"],
        summary: "Taguer un événement",
        description:
          "Réservé au **créateur** (ou admin/modérateur). Le tag est aussi poussé dans Neo4j (recommandations).",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["tag"],
                properties: {
                  tag: {
                    type: "string",
                    minLength: 2,
                    maxLength: 30,
                    example: "musique",
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Tag ajouté" },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: {
            description: "Événement introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    // -- Votes -------------------------------------------------------------
    "/votes": {
      get: {
        tags: ["Votes"],
        summary: "Lister tous les votes",
        description: "Retourne tous les votes stockés dans MongoDB.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Liste des votes",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Vote" },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
      post: {
        tags: ["Votes"],
        summary: "Créer un vote",
        description:
          "Crée un vote dans MongoDB avec ses options (≥ 2), son type et sa deadline optionnelle. La `deadline`, si fournie, doit être **dans le futur** (sinon `400`).",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateVoteRequest" },
            },
          },
        },
        responses: {
          201: {
            description: "Vote créé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Vote" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/votes/{id}": {
      get: {
        tags: ["Votes"],
        summary: "Récupérer un vote par son ID",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "UUID du vote (postgres_id)",
            example: "a1b2c3d4-e5f6-...",
          },
        ],
        responses: {
          200: {
            description: "Vote trouvé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Vote" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: {
            description: "Vote introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/votes/{id}/voter": {
      post: {
        tags: ["Votes"],
        summary: "Voter (une seule fois)",
        description:
          "Enregistre le vote de l'utilisateur connecté. **Un seul vote par sondage** (pas de modification). Pour un vote `single`/`yesno`, seule une option est retenue ; pour `multiple`, les doublons sont dédupliqués. Les `optionIds` doivent exister dans le sondage. Un utilisateur bloqué (`vote_blocked`) reçoit `403`.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            example: "a1b2c3d4-...",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CastVoteRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Vote enregistré",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Vote" },
              },
            },
          },
          400: {
            description:
              "Corps invalide, ou une/plusieurs options inexistantes dans le sondage",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: {
            description: "Utilisateur bloqué pour les votes par un modérateur",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          404: {
            description: "Vote introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          409: {
            description: "Vote clôturé/expiré, ou l'utilisateur a déjà voté",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          429: { $ref: "#/components/responses/TooManyRequests" },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/votes/{id}/cloturer": {
      post: {
        tags: ["Votes"],
        summary: "Clôturer un vote",
        description:
          "Passe le statut du vote à `closed`. Le **créateur** du vote, ou un **admin/modérateur**, peut le clôturer.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            example: "a1b2c3d4-...",
          },
        ],
        responses: {
          200: {
            description: "Vote clôturé",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string", example: "Vote clôturé" },
                    vote: { $ref: "#/components/schemas/Vote" },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: {
            description:
              "Vote introuvable ou permissions insuffisantes (seul le créateur peut clôturer)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    // -- Contrats ----------------------------------------------------------
    "/contrats": {
      post: {
        tags: ["Contrats"],
        summary: "Créer un contrat",
        description:
          "Crée un contrat lié à un service en PostgreSQL et initialise son document de signature dans MongoDB (avec zones positionnées dans le PDF).",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateContratRequest" },
            },
          },
        },
        responses: {
          201: {
            description:
              "Contrat créé (référence PostgreSQL + document MongoDB)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    contrat: { $ref: "#/components/schemas/Contrat" },
                    contratMongo: {
                      $ref: "#/components/schemas/ContratDocument",
                    },
                  },
                },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: {
            description: "Service introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/contrats/{id}": {
      get: {
        tags: ["Contrats"],
        summary: "Récupérer un contrat",
        description:
          "Retourne le **document MongoDB** complet du contrat (PDF, zones de signature, signatures apposées, journal d'audit). **Accès réservé aux parties** au contrat (signataires/assignés) et aux admins/modérateurs. L'`id` dans le chemin est le `postgres_id` du contrat (UUID/id_contrat).",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "postgres_id du contrat (ex: CTR-001)",
            example: "CTR-001",
          },
        ],
        responses: {
          200: {
            description: "Document MongoDB du contrat",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ContratDocument" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: {
            description: "Vous n'êtes pas partie à ce contrat",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          404: {
            description: "Contrat introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/contrats/{id}/audit": {
      get: {
        tags: ["Contrats"],
        summary: "Journal d'audit d'un contrat",
        description:
          "Retourne l'historique des actions sur le contrat (création, signatures) avec leurs horodatages. **Accès réservé aux parties** au contrat et aux admins/modérateurs.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            example: "CTR-001",
          },
        ],
        responses: {
          200: {
            description: "Journal d'audit du contrat",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    auditTrail: {
                      type: "array",
                      items: { $ref: "#/components/schemas/AuditEntry" },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: {
            description: "Vous n'êtes pas partie à ce contrat",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          404: {
            description: "Contrat introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/contrats/{id}/signer": {
      post: {
        tags: ["Contrats"],
        summary: "Signer numériquement un contrat",
        description:
          "Appose la signature de l'utilisateur connecté. **Contrôles** : seules les **parties** au contrat peuvent signer ; un contrat déjà `signed`/`archived` est refusé ; pas de double signature. L'IP réelle est enregistrée, la signature est scellée par un **checksum SHA-256** et l'action tracée dans le journal d'audit.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            example: "CTR-001",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SignerContratRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Signature enregistrée",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: {
                      type: "string",
                      example: "Signature enregistrée",
                    },
                    contrat: { $ref: "#/components/schemas/ContratDocument" },
                  },
                },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: {
            description: "L'utilisateur n'est pas partie à ce contrat",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          404: {
            description: "Contrat introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          409: {
            description:
              "Contrat déjà signé/archivé, ou déjà signé par cet utilisateur",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          429: { $ref: "#/components/responses/TooManyRequests" },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    // -- Messagerie --------------------------------------------------------
    "/conversations": {
      get: {
        tags: ["Messagerie"],
        summary: "Lister les conversations",
        description:
          "Retourne toutes les conversations de l'utilisateur connecté avec le dernier message de chaque conversation.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Liste des conversations",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Conversation" },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
      post: {
        tags: ["Messagerie"],
        summary: "Créer une nouvelle conversation",
        description: "Crée une conversation privée ou de groupe dans MongoDB.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CreateConversationRequest",
              },
            },
          },
        },
        responses: {
          201: {
            description: "Conversation créée",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    conversationId: {
                      type: "string",
                      format: "uuid",
                      example: "550e8400-e29b-41d4-a716-446655440000",
                    },
                  },
                },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/conversations/{conversationId}/messages": {
      get: {
        tags: ["Messagerie"],
        summary: "Lire les messages d'une conversation",
        description:
          "Retourne tous les messages d'une conversation, triés par date croissante.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "conversationId",
            in: "path",
            required: true,
            schema: { type: "string" },
            example: "conv_abc123",
          },
        ],
        responses: {
          200: {
            description: "Messages de la conversation",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Message" },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
      post: {
        tags: ["Messagerie"],
        summary: "Envoyer un message",
        description:
          "Envoie un message texte ou avec pièces jointes (photo, audio, vidéo) dans une conversation.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "conversationId",
            in: "path",
            required: true,
            schema: { type: "string" },
            example: "conv_abc123",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SendMessageRequest" },
            },
          },
        },
        responses: {
          201: {
            description: "Message envoyé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Message" },
              },
            },
          },
          400: {
            description:
              "Corps invalide (ni `content` ni `mediaAttachments`) ou `recipientIds` manquant",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    // -- Incidents ---------------------------------------------------------
    "/incidents": {
      get: {
        tags: ["Incidents"],
        summary: "Lister les incidents",
        description:
          "Retourne tous les incidents signalés. Filtrable par `statut`. **Réservé aux admins/modérateurs** (gestion des incidents côté client Java).",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "statut",
            in: "query",
            schema: {
              type: "string",
              enum: ["ouvert", "en_cours", "resolu", "ferme"],
            },
            description: "Filtrer par statut",
          },
        ],
        responses: {
          200: {
            description: "Liste des incidents",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Incident" },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
      post: {
        tags: ["Incidents"],
        summary: "Signaler un incident",
        description:
          "Crée un nouvel incident avec le statut `ouvert`. Associé à l'utilisateur connecté.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateIncidentRequest" },
            },
          },
        },
        responses: {
          201: {
            description: "Incident signalé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Incident" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/incidents/{id}": {
      get: {
        tags: ["Incidents"],
        summary: "Récupérer un incident par ID",
        description: "**Réservé aux admins/modérateurs.**",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        responses: {
          200: {
            description: "Incident trouvé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Incident" },
              },
            },
          },
          400: {
            description: "ID invalide (non numérique)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: {
            description: "Incident introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/incidents/{id}/statut": {
      put: {
        tags: ["Incidents"],
        summary: "Mettre à jour le statut d'un incident",
        description:
          "Réservé aux **modérateurs** et **admins**. Permet de faire avancer un incident dans son cycle de vie.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["statut"],
                properties: {
                  statut: {
                    type: "string",
                    enum: ["ouvert", "en_cours", "resolu", "ferme"],
                    example: "en_cours",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Statut mis à jour",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Incident" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: {
            description: "Réservé aux modérateurs et admins",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          404: {
            description: "Incident introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    // -- Competences -------------------------------------------------------
    "/users/{userId}/competences": {
      get: {
        tags: ["Compétences"],
        summary: "Lister les compétences d'un utilisateur",
        description:
          "Retourne toutes les compétences déclarées par un utilisateur.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "userId",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        responses: {
          200: {
            description: "Liste des compétences",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Competence" },
                },
              },
            },
          },
          400: {
            description: "ID invalide (non numérique)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/competences": {
      post: {
        tags: ["Compétences"],
        summary: "Ajouter une compétence à son profil",
        description: "Ajoute une compétence à l'utilisateur connecté.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["libelle"],
                properties: {
                  libelle: {
                    type: "string",
                    maxLength: 50,
                    example: "Plomberie",
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Compétence ajoutée",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Competence" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: {
            description: "Utilisateur introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/competences/{id}": {
      delete: {
        tags: ["Compétences"],
        summary: "Supprimer une compétence",
        description:
          "Supprime une compétence. Seul le propriétaire ou un admin peut la supprimer.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 1,
          },
        ],
        responses: {
          200: {
            description: "Compétence supprimée",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" },
              },
            },
          },
          400: {
            description: "ID invalide (non numérique)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: {
            description: "Compétence introuvable ou permissions insuffisantes",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    // -- Recommandations ---------------------------------------------------
    "/recommendations/voisins": {
      get: {
        tags: ["Recommandations"],
        summary: "Voisins fiables recommandés",
        description:
          "Utilise le graphe **Neo4j** pour trouver les voisins du même quartier ayant le meilleur score de confiance : nombre d'aides réalisées (×0,5) + note moyenne reçue (×0,3) + centres d'intérêt en commun avec l'appelant (×0,2). Utile pour suggérer des prestataires de confiance.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 10 },
            description: "Nombre de résultats",
          },
        ],
        responses: {
          200: {
            description: "IDs des voisins recommandés",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    voisins: {
                      type: "array",
                      items: { type: "string" },
                      description:
                        "Liste de postgres_id (id_user) triés par score de confiance.",
                      example: ["3", "7", "12"],
                    },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/recommendations/evenements": {
      get: {
        tags: ["Recommandations"],
        summary: "Événements suggérés",
        description:
          "Utilise **Neo4j** pour recommander des événements basés sur les intérêts de l'utilisateur et les événements fréquentés par ses voisins.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 10 },
          },
        ],
        responses: {
          200: {
            description: "IDs des événements recommandés",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    evenements: {
                      type: "array",
                      items: { type: "string" },
                      description:
                        "Liste de postgres_id (id_evenement) recommandés.",
                      example: ["2", "5", "8"],
                    },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/recommendations/services": {
      get: {
        tags: ["Recommandations"],
        summary: "Services compatibles recommandés",
        description:
          "Utilise **Neo4j** pour recommander des services compatibles avec le profil de l'utilisateur (tags, voisinage, historique).",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 10 },
          },
        ],
        responses: {
          200: {
            description: "IDs des services recommandés",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    services: {
                      type: "array",
                      items: { type: "string" },
                      description:
                        "Liste de postgres_id (id_service) recommandés.",
                      example: ["1", "4", "9"],
                    },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    // -- RGPD --------------------------------------------------------------
    "/gdpr/export": {
      get: {
        tags: ["RGPD"],
        summary: "Art. 15 & 20 — Exporter toutes mes données",
        description:
          "Retourne l'intégralité des données personnelles stockées sur les **3 bases de données** (PostgreSQL, MongoDB, Neo4j). Conforme au droit à la portabilité RGPD.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Export JSON des données personnelles",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    meta: {
                      type: "object",
                      properties: {
                        exportDate: { type: "string", format: "date-time" },
                        userId: { type: "integer" },
                        notice: { type: "string" },
                      },
                    },
                    donnees_personnelles: {
                      type: "object",
                      properties: {
                        email: { type: "string" },
                        role: { type: "string" },
                        adresse: { type: "string" },
                        ville: { type: "string" },
                        cp: { type: "string" },
                        quartier: { type: "string", nullable: true },
                      },
                    },
                    profil_mongo: { type: "object", nullable: true },
                    competences: { type: "array", items: { type: "object" } },
                    evenements_crees: {
                      type: "array",
                      items: { type: "object" },
                    },
                    demandes_services: {
                      type: "array",
                      items: { type: "object" },
                    },
                    contrats: { type: "array", items: { type: "object" } },
                    incidents_signales: {
                      type: "array",
                      items: { type: "object" },
                    },
                    messages_envoyes: {
                      type: "array",
                      items: { type: "object" },
                    },
                    messages_recus_count: { type: "integer" },
                    votes: { type: "array", items: { type: "object" } },
                    graphe_social: {
                      type: "object",
                      properties: {
                        usersAides: {
                          type: "array",
                          items: { type: "string" },
                        },
                        participationsEvenements: {
                          type: "array",
                          items: { type: "object" },
                        },
                        notesAttribuees: {
                          type: "array",
                          items: { type: "object" },
                        },
                        interets: { type: "array", items: { type: "string" } },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/gdpr/consentement": {
      get: {
        tags: ["RGPD"],
        summary: "Art. 7 — Consulter mon statut de consentement",
        description:
          "Indique si l'utilisateur a donné son consentement au traitement de ses données et la date.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Statut du consentement",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    consentDonne: { type: "boolean", example: true },
                    date: {
                      type: "string",
                      format: "date-time",
                      nullable: true,
                      example: "2025-01-15T10:30:00Z",
                    },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: {
            description: "Profil introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
      post: {
        tags: ["RGPD"],
        summary: "Art. 7 — Donner ou retirer mon consentement",
        description:
          "Met à jour le consentement. `consentement: false` enregistre un retrait de consentement avec la date.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["consentement"],
                properties: {
                  consentement: {
                    type: "boolean",
                    description: "true = accorder, false = retirer",
                    example: true,
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Consentement mis à jour",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" },
              },
            },
          },
          400: {
            description: "Champ 'consentement' (boolean) manquant ou invalide",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: {
            description: "Profil introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/gdpr/delete": {
      delete: {
        tags: ["RGPD"],
        summary: "Art. 17 — Droit à l'effacement (droit à l'oubli)",
        description:
          "**Action irréversible.** Anonymise toutes les données personnelles sur les 3 bases :\n- **PostgreSQL** : email → hash aléatoire, mot de passe réinitialisé, adresse effacée, soft delete\n- **MongoDB** : profil anonymisé, messages → `[Message supprimé]`, votes retirés\n- **Neo4j** : nœud et toutes ses relations supprimés",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Compte anonymisé sur les 3 bases de données",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: {
            description: "Utilisateur introuvable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
  },
};
