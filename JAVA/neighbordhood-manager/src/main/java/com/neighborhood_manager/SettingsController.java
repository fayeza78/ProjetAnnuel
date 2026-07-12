package com.neighborhood_manager;

import javafx.fxml.FXML;
import javafx.geometry.Pos;
import javafx.scene.control.*;
import javafx.scene.layout.*;

public class SettingsController {

    @FXML private HBox themeCardsContainer;
    @FXML private HBox fontButtonsContainer;
    @FXML private HBox layoutButtonsContainer;
    @FXML private Label statusLabel;

    @FXML
    public void initialize() {
        buildThemeCards();
        buildFontButtons();
        buildLayoutButtons();
    }

    // ──────────────────────────────────────────────
    //  Thèmes
    // ──────────────────────────────────────────────

    private void buildThemeCards() {
        themeCardsContainer.getChildren().clear();
        for (ThemeManager.Theme theme : ThemeManager.Theme.values()) {
            themeCardsContainer.getChildren().add(buildThemeCard(theme));
        }
    }

    private VBox buildThemeCard(ThemeManager.Theme theme) {
        boolean active = ThemeManager.getInstance().getCurrentTheme() == theme;
        boolean isLight = theme == ThemeManager.Theme.AUBE;
        String textColor = isLight ? "#2C3E50" : "white";

        VBox card = new VBox(10);
        card.setAlignment(Pos.CENTER);
        card.setPrefWidth(160);
        card.setStyle(
            "-fx-background-color: " + theme.bgColor + ";" +
            "-fx-background-radius: 14;" +
            "-fx-padding: 20 16;" +
            "-fx-cursor: hand;" +
            "-fx-border-color: " + (active ? theme.accentColor : "#3A5070") + ";" +
            "-fx-border-radius: 14;" +
            "-fx-border-width: " + (active ? "3" : "1") + ";"
        );

        // Bande de couleurs aperçu
        HBox swatches = new HBox(5);
        swatches.setAlignment(Pos.CENTER);
        swatches.getChildren().addAll(
            buildSwatch(theme.bgColor),
            buildSwatch(theme.accentColor),
            buildSwatch(theme.primaryColor)
        );

        Label name = new Label(theme.label);
        name.setStyle("-fx-text-fill: " + textColor + "; -fx-font-weight: bold; -fx-font-size: 12px;");

        card.getChildren().addAll(swatches, name);

        if (active) {
            Label badge = new Label("✓ Actif");
            badge.setStyle("-fx-text-fill: " + theme.accentColor + "; -fx-font-size: 10px; -fx-font-weight: bold;");
            card.getChildren().add(badge);
        }

        card.setOnMouseClicked(e -> {
            ThemeManager.getInstance().setTheme(theme, App.getScene());
            rebuildAll();
            showStatus("Thème « " + theme.label + " » appliqué.");
        });

        return card;
    }

    private Label buildSwatch(String color) {
        Label s = new Label();
        s.setMinSize(28, 28);
        s.setMaxSize(28, 28);
        s.setStyle("-fx-background-color: " + color + "; -fx-background-radius: 6;");
        return s;
    }

    // ──────────────────────────────────────────────
    //  Taille de police
    // ──────────────────────────────────────────────

    private void buildFontButtons() {
        fontButtonsContainer.getChildren().clear();
        ThemeManager.FontSize current = ThemeManager.getInstance().getCurrentFontSize();
        for (ThemeManager.FontSize fs : ThemeManager.FontSize.values()) {
            Button btn = buildOptionButton(fs.label, current == fs);
            btn.setOnAction(e -> {
                ThemeManager.getInstance().setFontSize(fs, App.getScene());
                rebuildAll();
                showStatus("Police « " + fs.label + " » appliquée.");
            });
            fontButtonsContainer.getChildren().add(btn);
        }
    }

    // ──────────────────────────────────────────────
    //  Disposition
    // ──────────────────────────────────────────────

    private void buildLayoutButtons() {
        layoutButtonsContainer.getChildren().clear();
        ThemeManager.Layout current = ThemeManager.getInstance().getCurrentLayout();
        for (ThemeManager.Layout layout : ThemeManager.Layout.values()) {
            Button btn = buildOptionButton(layout.label, current == layout);
            btn.setOnAction(e -> {
                ThemeManager.getInstance().setLayout(layout, App.getScene());
                rebuildAll();
                showStatus("Disposition « " + layout.label + " » appliquée.");
            });
            layoutButtonsContainer.getChildren().add(btn);
        }
    }

    private Button buildOptionButton(String text, boolean active) {
        Button btn = new Button(text);
        btn.getStyleClass().add(active ? "settings-option-btn-active" : "settings-option-btn");
        return btn;
    }

    // ──────────────────────────────────────────────
    //  Actions
    // ──────────────────────────────────────────────

    @FXML
    private void resetDefaults() {
        ThemeManager.getInstance().resetToDefaults(App.getScene());
        rebuildAll();
        showStatus("Paramètres réinitialisés aux valeurs par défaut.");
    }

    private void rebuildAll() {
        buildThemeCards();
        buildFontButtons();
        buildLayoutButtons();
    }

    private void showStatus(String msg) {
        if (statusLabel != null) {
            statusLabel.setText("✓  " + msg);
        }
    }
}