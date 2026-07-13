package com.neighborhood_manager.database;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class ApiService {

    // Base URL de ton API Node.js
    private static final String BASE_URL = "http://51.77.245.139:3000";

    private static final HttpClient httpClient = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    /**
     * POST /auth/login - Authentifie l'utilisateur auprès de l'API Node.js
     */
    public static CompletableFuture<Boolean> login(String email, String password) {
        String jsonBody = "{\n" +
                "  \"email\": \"" + email + "\",\n" +
                "  \"password\": \"" + password + "\"\n" +
                "}";

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/auth/login"))
                .header("Content-Type", "application/json") // On dit bien au serveur qu'on envoie du JSON
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .build();

        return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .thenApply(response -> {
                    if (response.statusCode() == 200 || response.statusCode() == 201) {
                        // Extraction manuelle et propre du champ access_token via Regex
                        Pattern pattern = Pattern.compile("\"access_token\"\\s*:\\s*\"([^\"]+)\"");
                        Matcher matcher = pattern.matcher(response.body());
                        if (matcher.find()) {
                            String token = matcher.group(1);
                            SessionManager.getInstance().setAccessToken(token);
                            return true;
                        }
                    }
                    System.err.println("Échec Login API — Code HTTP : " + response.statusCode());
                    return false;
                });
    }

    /**
     * GET /users - Liste les utilisateurs
     */
    public static CompletableFuture<String> fetchVoisinsFromServer() {
        String token = SessionManager.getInstance().getAccessToken();

        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/users"))
                .header("Accept", "application/json");

        // Si l'admin est connecté, on injecte le token de sécurité
        if (token != null) {
            builder.header("Authorization", "Bearer " + token);
        }

        return httpClient.sendAsync(builder.GET().build(), HttpResponse.BodyHandlers.ofString())
                .thenApply(response -> {
                    if (response.statusCode() == 200) {
                        return response.body();
                    } else {
                        throw new RuntimeException("Erreur Voisins : Code " + response.statusCode());
                    }
                });
    }

    /**
     * GET /signalements - Récupère les incidents signalés dans le quartier
     */
    public static CompletableFuture<String> fetchSignalements() {
        String token = SessionManager.getInstance().getAccessToken();

        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/signalements"))
                .header("Accept", "application/json");

        // Si l'admin est connecté, on injecte le token de sécurité
        if (token != null) {
            builder.header("Authorization", "Bearer " + token);
        }

        return httpClient.sendAsync(builder.GET().build(), HttpResponse.BodyHandlers.ofString())
                .thenApply(response -> {
                    if (response.statusCode() == 200) {
                        return response.body();
                    } else {
                        System.err.println("Erreur Incident API — Code HTTP : " + response.statusCode());
                        throw new RuntimeException("Refus d'authentification API sur les incidents.");
                    }
                });
    }

    /**
     * PUT /signalements/{id}/traiter - Traiter/Résoudre un incident (Version Sécurisée avec Body)
     */
    public static CompletableFuture<Boolean> traiterSignalement(String id) {
        String token = SessionManager.getInstance().getAccessToken();

        // 1. On prépare le contenu JSON que le serveur attend
        String jsonBody = "{\"statut\": \"traite\"}";

        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/signalements/" + id + "/traiter"))
                .header("Accept", "application/json")
                .header("Content-Type", "application/json"); // Indispensable pour que Node.js lise le corps

        if (token != null) {
            builder.header("Authorization", "Bearer " + token);
        }

        // 2. On remplace noBody() par ofString(jsonBody) pour envoyer la donnée
        return httpClient.sendAsync(builder.PUT(HttpRequest.BodyPublishers.ofString(jsonBody)).build(), HttpResponse.BodyHandlers.ofString())
                .thenApply(response -> {
                    if (response.statusCode() == 200) {
                        return true;
                    } else {
                        System.err.println("Erreur API lors du traitement : " + response.statusCode() + " - " + response.body());
                        return false;
                    }
                });
    }

//    /** POST /auth/sso/exchangeSSO — Échange un ticket SSO contre un access_token JWT. Retourne l'email si présent dans la réponse, "" sinon, null si échec. */
//    public static CompletableFuture<String> exchangeSSOTicket(String ticket) {
//        String jsonBody = "{\"ticket\": \"" + ticket.trim() + "\"}";
//
//        HttpRequest request = HttpRequest.newBuilder()
//                .uri(URI.create(BASE_URL + "/auth/sso/exchangeSSO"))
//                .header("Content-Type", "application/json")
//                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
//                .build();
//
//        return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
//                .thenApply(response -> {
//                    if (response.statusCode() != 200 && response.statusCode() != 201) {
//                        System.err.println("Échec échange ticket SSO — Code HTTP : " + response.statusCode());
//                        return null;
//                    }
//                    String body = response.body();
//                    Pattern tokenPattern = Pattern.compile("\"access_token\"\\s*:\\s*\"([^\"]+)\"");
//                    Matcher tokenMatcher = tokenPattern.matcher(body);
//                    if (!tokenMatcher.find()) {
//                        System.err.println("Réponse SSO : access_token introuvable.");
//                        return null;
//                    }
//                    SessionManager.getInstance().setAccessToken(tokenMatcher.group(1));
//
//                    // On extrait l'email si le serveur le renvoie dans la réponse
//                    Pattern emailPattern = Pattern.compile("\"email\"\\s*:\\s*\"([^\"]+)\"");
//                    Matcher emailMatcher = emailPattern.matcher(body);
//                    return emailMatcher.find() ? emailMatcher.group(1) : "";
//                });
//    }
//
//    public static CompletableFuture<String> pullChangements() {
//        HttpRequest request = HttpRequest.newBuilder()
//                .uri(URI.create(BASE_URL + "/sync"))
//                .header("Accept", "application/json")
//                .GET()
//                .build();
//
//        return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
//                .thenApply(response -> response.statusCode() == 200 ? response.body() : "");
//    }


    /** POST /auth/sso/exchange — échange un ticket SSO contre des tokens. */
    public static CompletableFuture<String> exchangeSSOTicket(String ticket) {
        String jsonBody = "{\"sso_ticket\": \"" + ticket.trim() + "\"}";

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/auth/sso/exchange"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .build();

        return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .thenApply(response -> {
                    if (response.statusCode() != 200 && response.statusCode() != 201) {
                        System.err.println("Échec échange ticket SSO — HTTP " + response.statusCode() + " : " + response.body());
                        return null;
                    }
                    String body = response.body();

                    Matcher tokenMatcher = Pattern.compile("\"access_token\"\\s*:\\s*\"([^\"]+)\"").matcher(body);
                    if (!tokenMatcher.find()) {
                        System.err.println("Réponse SSO : access_token introuvable.");
                        return null;
                    }
                    SessionManager.getInstance().setAccessToken(tokenMatcher.group(1));

                    // ← on stocke AUSSI le refresh_token (pour /auth/refresh au bout d'1 h)
                    Matcher refreshMatcher = Pattern.compile("\"refresh_token\"\\s*:\\s*\"([^\"]+)\"").matcher(body);
                    if (refreshMatcher.find()) {
                        SessionManager.getInstance().setRefreshToken(refreshMatcher.group(1));
                    }

                    Matcher emailMatcher = Pattern.compile("\"email\"\\s*:\\s*\"([^\"]+)\"").matcher(body);
                    return emailMatcher.find() ? emailMatcher.group(1) : "";
                });
    }

    /** GET /sync — pull des incidents (réservé admin/modérateur → token obligatoire). */
    public static CompletableFuture<String> pullChangements() {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/sync"))   // option : "/sync?since=" + dernierSyncIso
                .header("Accept", "application/json")
                .header("Authorization", "Bearer " + SessionManager.getInstance().getAccessToken())  // ← manquait
                .GET()
                .build();

        return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .thenApply(response -> {
                    if (response.statusCode() != 200) {
                        System.err.println("Échec pull /sync — HTTP " + response.statusCode());
                        return "";
                    }
                    return response.body();
                });
    }



    /**
     * POST /sync - Push des changements locaux vers le serveur (Résolution de conflits)
     */
    public static CompletableFuture<Boolean> pushChangements(String jsonBody) {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/sync"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .build();

        return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .thenApply(response -> response.statusCode() == 200 || response.statusCode() == 201);
    }

//    public static CompletableFuture<String> fetchStatsIncidents() {
//        String token = SessionManager.getInstance().getAccessToken();
//        HttpClient client = HttpClient.newHttpClient();
//        HttpRequest request = HttpRequest.newBuilder()
//                .uri(URI.create("http://51.77.245.139:3000/stats/incidents"))
//                .header("Authorization", "Bearer " + token)
//                .GET()
//                .build();
//
//        return client.sendAsync(request, HttpResponse.BodyHandlers.ofString())
//                .thenApply(response -> {
//                    if (response.statusCode() == 200) {
//                        return response.body();
//                    } else {
//                        throw new RuntimeException("Erreur serveur stats : " + response.statusCode());
//                    }
//                });
//    }
//
//    public static CompletableFuture<String> fetchPresenceUsers() {
//        String token = SessionManager.getInstance().getAccessToken();
//        HttpClient client = HttpClient.newHttpClient();
//        HttpRequest request = HttpRequest.newBuilder()
//                .uri(URI.create("http://51.77.245.139:3000/stats/participations"))
//                .header("Authorization", "Bearer " + token)
//                .GET()
//                .build();
//
//        return client.sendAsync(request, HttpResponse.BodyHandlers.ofString())
//                .thenApply(response -> {
//                    if (response.statusCode() == 200) {
//                        return response.body();
//                    } else {
//                        throw new RuntimeException("Erreur serveur présence : " + response.statusCode());
//                    }
//                });
//    }

    public static CompletableFuture<String> fetchStatsIncidents() {
        String token = SessionManager.getInstance().getAccessToken();

        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/stats/incidents"))
                .header("Accept", "application/json");

        if (token != null) {
            builder.header("Authorization", "Bearer " + token);
        }

        return httpClient.sendAsync(builder.GET().build(), HttpResponse.BodyHandlers.ofString())
                .thenApply(response -> {
                    if (response.statusCode() == 200) {
                        return response.body();
                    } else {
                        throw new RuntimeException("Erreur serveur stats : " + response.statusCode());
                    }
                });
    }

    /**
     * GET /incidents - Liste tous les incidents
     */
    public static CompletableFuture<String> fetchIncidents() {
        String token = SessionManager.getInstance().getAccessToken();
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/incidents"))
                .header("Accept", "application/json");
        if (token != null) builder.header("Authorization", "Bearer " + token);
        return httpClient.sendAsync(builder.GET().build(), HttpResponse.BodyHandlers.ofString())
                .thenApply(response -> {
                    if (response.statusCode() == 200) return response.body();
                    throw new RuntimeException("Erreur /incidents : " + response.statusCode());
                });
    }

    /**
     * PUT /incidents/{id}/statut - Met à jour le statut d'un incident
     */
    public static CompletableFuture<Boolean> updateIncidentStatut(int id) {
        String token = SessionManager.getInstance().getAccessToken();
        String jsonBody = "{\"statut\": \"traite\"}";
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/incidents/" + id + "/statut"))
                .header("Accept", "application/json")
                .header("Content-Type", "application/json");
        if (token != null) builder.header("Authorization", "Bearer " + token);
        return httpClient.sendAsync(
                builder.PUT(HttpRequest.BodyPublishers.ofString(jsonBody)).build(),
                HttpResponse.BodyHandlers.ofString())
                .thenApply(response -> {
                    if (response.statusCode() == 200) return true;
                    System.err.println("Erreur traitement incident : " + response.statusCode() + " - " + response.body());
                    return false;
                });
    }

    /**
     * GET /presence - Récupère uniquement les utilisateurs actuellement en ligne
     */
    public static CompletableFuture<String> fetchPresenceUsers() {
        String token = SessionManager.getInstance().getAccessToken();

        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/presence")) // La vraie route de ton Swagger
                .header("Accept", "application/json");

        if (token != null) {
            builder.header("Authorization", "Bearer " + token);
        }

        return httpClient.sendAsync(builder.GET().build(), HttpResponse.BodyHandlers.ofString())
                .thenApply(response -> {
                    if (response.statusCode() == 200) {
                        return response.body();
                    } else {
                        throw new RuntimeException("Erreur serveur présence : " + response.statusCode());
                    }
                });
    }
}