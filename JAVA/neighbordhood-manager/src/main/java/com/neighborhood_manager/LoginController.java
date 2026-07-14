package com.neighborhood_manager;

import com.neighborhood_manager.database.ApiService;
import com.neighborhood_manager.database.SessionManager;
import javafx.application.Platform;
import javafx.fxml.FXML;
import javafx.scene.control.*;

import java.io.IOException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class LoginController {

    @FXML private TextField emailField;
    @FXML private PasswordField passwordField;
    @FXML private Label errorLabel;
    @FXML private Button loginButton;

    @FXML private TextField ssoTicketField;
    @FXML private Label ssoErrorLabel;
    @FXML private Button ssoLoginButton;
    @FXML private Button offlineButton;

    @FXML
    private void handleLogin() {
        String email = emailField.getText().trim();
        String password = passwordField.getText();

        if (email.isEmpty() || password.isEmpty()) {
            showError("Veuillez remplir tous les champs.");
            return;
        }

        setLoading(true);

        ApiService.login(email, password)
                .thenAccept(success -> Platform.runLater(() -> {
                    if (!success) {
                        setLoading(false);
                        showError("Email ou mot de passe incorrect.");
                        return;
                    }
                    SessionManager.getInstance().setAdminEmail(email);
                    verifyAdminRole(email);
                }))
                .exceptionally(ex -> {
                    Throwable cause = ex.getCause() != null ? ex.getCause() : ex;
                    System.err.println("[LOGIN ERROR] " + cause.getClass().getSimpleName() + " : " + cause.getMessage());
                    Platform.runLater(() -> {
                        setLoading(false);
                        showError("Erreur : " + cause.getMessage());
                    });
                    return null;
                });
    }

    @FXML
    private void handleSSOLogin() {
        String ticket = ssoTicketField.getText().trim();
        if (ticket.isEmpty()) {
            showSSOError("Veuillez coller votre ticket SSO.");
            return;
        }

        setSSOLoading(true);

        ApiService.exchangeSSOTicket(ticket)
                .thenAccept(email -> Platform.runLater(() -> {
                    if (email == null) {
                        setSSOLoading(false);
                        showSSOError("Ticket invalide ou expiré. Générez-en un nouveau sur le site.");
                        return;
                    }
                    // Le ticket est émis uniquement pour les admins côté site web,
                    // le serveur garantit déjà le rôle — on navigue directement.
                    if (!email.isEmpty()) {
                        SessionManager.getInstance().setAdminEmail(email);
                    }
                    navigateToApp();
                }))
                .exceptionally(ex -> {
                    Throwable cause = ex.getCause() != null ? ex.getCause() : ex;
                    System.err.println("[SSO ERROR] " + cause.getClass().getSimpleName() + " : " + cause.getMessage());
                    Platform.runLater(() -> {
                        setSSOLoading(false);
                        showSSOError("Erreur réseau. Vérifiez votre connexion.");
                    });
                    return null;
                });
    }

    private void setSSOLoading(boolean loading) {
        ssoLoginButton.setDisable(loading);
        ssoLoginButton.setText(loading ? "Vérification en cours..." : "Se connecter via ticket");
        if (loading) ssoErrorLabel.setVisible(false);
    }

    private void showSSOError(String message) {
        ssoErrorLabel.setText(message);
        ssoErrorLabel.setVisible(true);
    }

    private void verifyAdminRole(String email) {
        ApiService.fetchVoisinsFromServer()
                .thenAccept(json -> Platform.runLater(() -> {
                    if (isAdminInJson(json, email)) {
                        navigateToApp();
                    } else {
                        SessionManager.getInstance().logout();
                        setLoading(false);
                        showError("Accès refusé. Ce compte n'a pas le rôle administrateur.");
                    }
                }))
                .exceptionally(ex -> {
                    // Si le serveur ne répond pas pour la vérification du rôle,
                    // on refuse l'accès par sécurité
                    Platform.runLater(() -> {
                        SessionManager.getInstance().logout();
                        setLoading(false);
                        showError("Impossible de vérifier les droits. Réessayez.");
                    });
                    return null;
                });
    }

    private boolean isAdminInJson(String json, String email) {
        String[] blocks = json.split("\\{\\s*\"id_user\"");
        for (int i = 1; i < blocks.length; i++) {
            String block = blocks[i];
            if (block.contains(email)) {
                Matcher m = Pattern.compile("\"role\"\\s*:\\s*\"([^\"]+)\"").matcher(block);
                if (m.find()) {
                    return m.group(1).toLowerCase().contains("admin");
                }
            }
        }
        return false;
    }

    @FXML
    private void handleOfflineMode() {
        // Aucun token — PrimaryController détecte !isLoggedIn() et bascule sur SQLite
        try {
            App.setRoot("primary");
        } catch (IOException e) {
            showError("Erreur lors du chargement de l'application.");
        }
    }

    private void navigateToApp() {
        SessionManager.getInstance().setLoginTime(java.time.LocalDateTime.now());
        try {
            App.setRoot("primary");
        } catch (IOException e) {
            setLoading(false);
            showError("Erreur chargement : " + e.getMessage());
            System.err.println("[LOGIN] IOException : " + e.getMessage());
            e.printStackTrace();
        } catch (RuntimeException e) {
            setLoading(false);
            showError("Erreur inattendue : " + e.getMessage());
            System.err.println("[LOGIN] RuntimeException : " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void setLoading(boolean loading) {
        loginButton.setDisable(loading);
        loginButton.setText(loading ? "Connexion en cours..." : "Se connecter");
        if (loading) errorLabel.setVisible(false);
    }

    private void showError(String message) {
        errorLabel.setText(message);
        errorLabel.setVisible(true);
    }
}