package com.neighborhood_manager;

import javafx.application.Platform;
import javafx.scene.control.Alert;
import javafx.scene.control.ButtonType;
import javafx.scene.control.Label;
import javafx.scene.control.ProgressBar;
import javafx.scene.layout.VBox;

import java.io.*;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Properties;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class UpdateService {

    private static final String VERSION_URL = "http://51.77.245.139:3000/app/version";

    private static final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    public record UpdateInfo(String version, String downloadUrl) {}

    public static String getCurrentVersion() {
        try (InputStream is = UpdateService.class.getResourceAsStream("/version.properties")) {
            if (is == null) return "1.0";
            Properties p = new Properties();
            p.load(is);
            return p.getProperty("app.version", "1.0");
        } catch (IOException e) {
            return "1.0";
        }
    }

    /** Vérifie si une mise à jour est disponible. Retourne null si pas de mise à jour ou erreur réseau. */
    public static CompletableFuture<UpdateInfo> checkForUpdate() {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(VERSION_URL))
                .GET()
                .build();
        return client.sendAsync(req, HttpResponse.BodyHandlers.ofString())
                .thenApply(resp -> {
                    if (resp.statusCode() != 200) return null;
                    String body = resp.body();
                    Matcher mv = Pattern.compile("\"version\"\\s*:\\s*\"([^\"]+)\"").matcher(body);
                    Matcher mu = Pattern.compile("\"url\"\\s*:\\s*\"([^\"]+)\"").matcher(body);
                    if (!mv.find() || !mu.find()) return null;
                    String serverVersion = mv.group(1);
                    String downloadUrl   = mu.group(1);
                    return isNewer(serverVersion, getCurrentVersion())
                            ? new UpdateInfo(serverVersion, downloadUrl)
                            : null;
                })
                .exceptionally(ex -> null);
    }

    /**
     * Vérifie et, si une mise à jour existe, affiche un dialogue.
     * silent=true → aucun dialogue si l'app est déjà à jour (vérif silencieuse au démarrage).
     * silent=false → affiche toujours le résultat (vérif manuelle depuis Settings).
     */
    public static void checkAndPrompt(boolean silent) {
        checkForUpdate().thenAccept(info -> Platform.runLater(() -> {
            if (info == null) {
                if (!silent) {
                    Alert a = new Alert(Alert.AlertType.INFORMATION);
                    a.setTitle("Mises à jour");
                    a.setHeaderText("Application à jour");
                    a.setContentText("Vous utilisez la version " + getCurrentVersion() + ", aucune mise à jour disponible.");
                    a.showAndWait();
                }
                return;
            }

            Alert confirm = new Alert(Alert.AlertType.CONFIRMATION);
            confirm.setTitle("Mise à jour disponible");
            confirm.setHeaderText("Version " + info.version() + " disponible");
            confirm.setContentText(
                    "Votre version : " + getCurrentVersion() + "\n" +
                    "Nouvelle version : " + info.version() + "\n\n" +
                    "Télécharger et redémarrer l'application ?");
            confirm.showAndWait().ifPresent(bt -> {
                if (bt == ButtonType.OK) downloadAndRestart(info);
            });
        }));
    }

    private static void downloadAndRestart(UpdateInfo info) {
        // Vérifie qu'on tourne bien depuis un JAR (pas en dev)
        File currentJar = getCurrentJarFile();

        Alert progress = new Alert(Alert.AlertType.INFORMATION);
        progress.setTitle("Mise à jour");
        progress.setHeaderText("Téléchargement en cours…");
        ProgressBar bar = new ProgressBar();
        bar.setMaxWidth(Double.MAX_VALUE);
        Label lbl = new Label("Connexion au serveur…");
        VBox content = new VBox(8, lbl, bar);
        content.setPrefWidth(350);
        progress.getDialogPane().setContent(content);
        progress.getDialogPane().lookupButton(ButtonType.OK).setDisable(true);
        progress.show();

        CompletableFuture.runAsync(() -> {
            try {
                lbl.setText("Téléchargement de la version " + info.version() + "…");
                Path tmpJar = Files.createTempFile("psv_update_", ".jar");

                HttpRequest req = HttpRequest.newBuilder()
                        .uri(URI.create(info.downloadUrl()))
                        .GET()
                        .build();
                client.send(req, HttpResponse.BodyHandlers.ofFile(tmpJar));

                Platform.runLater(() -> {
                    lbl.setText("Téléchargement terminé. Redémarrage…");
                    bar.setProgress(1.0);
                });

                // Script de remplacement + redémarrage
                String script = System.getenv("TEMP") + "\\psv_update.bat";
                String pid = String.valueOf(ProcessHandle.current().pid());
                String dest = currentJar != null ? currentJar.getAbsolutePath() : tmpJar.toAbsolutePath().toString();

                try (FileWriter w = new FileWriter(script)) {
                    w.write("@echo off\n");
                    w.write(":wait\n");
                    w.write("tasklist /fi \"PID eq " + pid + "\" | find \"" + pid + "\" >nul 2>&1\n");
                    w.write("if not errorlevel 1 (timeout /t 1 /nobreak >nul & goto wait)\n");
                    if (currentJar != null) {
                        w.write("copy /Y \"" + tmpJar.toAbsolutePath() + "\" \"" + dest + "\"\n");
                    }
                    w.write("start javaw -jar \"" + dest + "\"\n");
                    w.write("del /F /Q \"%~f0\"\n");
                }
                new ProcessBuilder("cmd", "/c", "start", "", script).start();

                Platform.runLater(() -> {
                    progress.close();
                    Platform.exit();
                    System.exit(0);
                });

            } catch (Exception e) {
                Platform.runLater(() -> {
                    progress.close();
                    new Alert(Alert.AlertType.ERROR,
                            "Échec de la mise à jour : " + e.getMessage()).showAndWait();
                });
            }
        });
    }

    /** Retourne le fichier JAR courant, ou null si on tourne en mode développement (classpath directory). */
    private static File getCurrentJarFile() {
        try {
            java.security.CodeSource cs = UpdateService.class.getProtectionDomain().getCodeSource();
            if (cs == null) return null;
            File f = new File(cs.getLocation().toURI());
            return f.isFile() && f.getName().endsWith(".jar") ? f : null;
        } catch (Exception e) {
            return null;
        }
    }

    private static boolean isNewer(String server, String current) {
        try {
            return Double.parseDouble(server) > Double.parseDouble(current);
        } catch (NumberFormatException e) {
            return !server.equals(current);
        }
    }
}
