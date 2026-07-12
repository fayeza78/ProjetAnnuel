package com.neighborhood_manager;

import com.neighborhood_manager.database.SessionManager;
import javafx.fxml.FXML;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.shape.Circle;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class ProfileController {

    @FXML private Label lblAvatar;
    @FXML private Label lblEmail;
    @FXML private Label lblRole;
    @FXML private Label lblStatutValeur;
    @FXML private Label lblConnexionValeur;
    @FXML private Label lblTokenValeur;
    @FXML private Label lblMessage;
    @FXML private Button btnLogout;

    @FXML
    public void initialize() {
        SessionManager session = SessionManager.getInstance();
        String email = session.getAdminEmail();

        // Avatar : initiale en majuscule
        lblAvatar.setText(String.valueOf(email.charAt(0)).toUpperCase());

        // Email et rôle
        lblEmail.setText(email);
        lblRole.setText("Administrateur");

        if (session.isLoggedIn()) {
            lblStatutValeur.setText("En ligne");
            lblStatutValeur.setStyle("-fx-text-fill: #27AE60; -fx-font-weight: bold;");

            // Heure de connexion
            LocalDateTime loginTime = session.getLoginTime();
            if (loginTime != null) {
                lblConnexionValeur.setText(loginTime.format(DateTimeFormatter.ofPattern("dd/MM/yyyy à HH:mm:ss")));
            } else {
                lblConnexionValeur.setText("Session active");
            }

            // Token JWT tronqué
            String token = session.getAccessToken();
            if (token != null && token.length() > 20) {
                lblTokenValeur.setText(token.substring(0, 20) + "…");
            }
        } else {
            lblStatutValeur.setText("Hors ligne");
            lblStatutValeur.setStyle("-fx-text-fill: #E74C3C; -fx-font-weight: bold;");
            lblConnexionValeur.setText("Aucune session active");
            lblTokenValeur.setText("—");
        }
    }

    @FXML
    private void handleLogout() {
        SessionManager.getInstance().logout();
        try {
            App.setRoot("login");
        } catch (IOException e) {
            lblMessage.setText("Erreur lors de la redirection vers la page de connexion.");
            lblMessage.setVisible(true);
        }
    }
}