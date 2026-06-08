package com.neighborhood_manager.database;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;

public class ApiService {

    // Base URL de ton API Node.js
    private static final String BASE_URL = "http://51.77.245.139:3000";

    private static final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    /**
     * GET /users - Liste les utilisateurs du back office (Pour l'écran Voisins)
     */
    public static CompletableFuture<String> fetchVoisinsFromServer() {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/users"))
                .header("Accept", "application/json")
                .GET()
                .build();

        return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .thenApply(response -> {
                    if (response.statusCode() == 200) {
                        return response.body();
                    } else {
                        throw new RuntimeException("Erreur : Code " + response.statusCode());
                    }
                });
    }

    /**
     * GET /sync - Pull des changements du serveur (Données globales Offline-First)
     */
    public static CompletableFuture<String> pullChangements() {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/sync"))
                .header("Accept", "application/json")
                .GET()
                .build();

        return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .thenApply(response -> response.statusCode() == 200 ? response.body() : "");
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

    /**
     * GET /signalements - Récupère les incidents signalés dans le quartier
     */
    public static CompletableFuture<String> fetchSignalements() {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/signalements"))
                .header("Accept", "application/json")
                .GET()
                .build();

        return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .thenApply(response -> response.statusCode() == 200 ? response.body() : "[]");
    }

    /**
     * PUT /signalements/{id}/traiter - Traiter/Résoudre un incident (Action sensible)
     */
    public static CompletableFuture<Boolean> traiterSignalement(String id) {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/signalements/" + id + "/traiter"))
                .header("Accept", "application/json")
                .PUT(HttpRequest.BodyPublishers.noBody())
                .build();

        return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .thenApply(response -> response.statusCode() == 200);
    }
}