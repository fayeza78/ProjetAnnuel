package com.neighborhood_manager.plugins;

import com.neighborhood_manager.database.ApiService;
import javafx.application.Platform;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Scene;
import javafx.scene.control.*;
import javafx.scene.layout.*;
import javafx.stage.Modality;
import javafx.stage.Stage;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.*;
import java.util.regex.*;

public class CalendrierPlugin implements Plugin {

    private YearMonth currentMonth;
    private Map<LocalDate, List<String>> incidentsByDate = new HashMap<>();
    private GridPane calendarGrid;
    private Label monthLabel;
    private VBox detailPanel;

    private static final String[] DATE_FIELDS = {"date_creation", "created_at", "date_signalement", "date"};
    private static final String[] JOURS = {"Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"};

    @Override
    public String getName() { return "Calendrier"; }

    @Override
    public String getDescription() {
        return "Visualisez les incidents du quartier positionnés sur un calendrier mensuel.";
    }

    @Override
    public void execute() {
        currentMonth = YearMonth.now();
        incidentsByDate = new HashMap<>();

        Stage stage = new Stage();
        stage.initModality(Modality.APPLICATION_MODAL);
        stage.setTitle("Calendrier des Incidents");
        stage.setWidth(880);
        stage.setHeight(620);

        Label title = new Label("Calendrier des Incidents");
        title.setStyle("-fx-font-size: 20px; -fx-font-weight: bold; -fx-text-fill: #0CA789;");

        // Navigation mensuelle
        Button btnPrev = new Button("◀");
        Button btnNext = new Button("▶");
        monthLabel = new Label();
        monthLabel.setStyle("-fx-font-size: 15px; -fx-font-weight: bold; -fx-text-fill: white; -fx-min-width: 200; -fx-alignment: center;");
        styleNavBtn(btnPrev);
        styleNavBtn(btnNext);
        btnPrev.setOnAction(e -> { currentMonth = currentMonth.minusMonths(1); renderCalendar(); });
        btnNext.setOnAction(e -> { currentMonth = currentMonth.plusMonths(1); renderCalendar(); });

        HBox navBar = new HBox(10, btnPrev, monthLabel, btnNext);
        navBar.setAlignment(Pos.CENTER);

        // Grille du calendrier
        calendarGrid = new GridPane();
        calendarGrid.setHgap(6);
        calendarGrid.setVgap(6);
        calendarGrid.setAlignment(Pos.TOP_LEFT);

        // Panneau de détail
        detailPanel = new VBox(8);
        detailPanel.setStyle("-fx-background-color: #233348; -fx-padding: 15; -fx-background-radius: 10;");
        detailPanel.setPrefWidth(230);
        detailPanel.setMinWidth(230);
        resetDetailPanel();

        HBox content = new HBox(20, calendarGrid, detailPanel);
        content.setAlignment(Pos.TOP_LEFT);
        VBox.setVgrow(content, Priority.ALWAYS);

        // Légende
        HBox legend = new HBox(20,
                buildLegendItem("#1a5659", "Aujourd'hui"),
                buildLegendItem("#3d2a1a", "Incident signalé"),
                buildLegendItem("#233348", "Jour normal")
        );
        legend.setAlignment(Pos.CENTER_LEFT);

        Label statusLabel = new Label("Chargement des incidents...");
        statusLabel.setStyle("-fx-text-fill: #8BA0B8;");

        Button btnClose = new Button("Fermer");
        btnClose.setStyle("-fx-background-color: #2E435E; -fx-text-fill: white; -fx-cursor: hand; -fx-background-radius: 5; -fx-padding: 8 18;");
        btnClose.setOnAction(e -> stage.close());
        HBox btnBar = new HBox(btnClose);
        btnBar.setAlignment(Pos.CENTER_RIGHT);

        VBox root = new VBox(12, title, navBar, legend, statusLabel, content, btnBar);
        root.setPadding(new Insets(25));
        root.setStyle("-fx-background-color: #1a2638;");

        renderCalendar();

        ApiService.fetchSignalements()
                .thenAccept(json -> {
                    Map<LocalDate, List<String>> parsed = parseIncidentsWithDates(json);
                    Platform.runLater(() -> {
                        incidentsByDate = parsed;
                        renderCalendar();
                        int total = parsed.values().stream().mapToInt(List::size).sum();
                        if (total > 0) {
                            statusLabel.setText(total + " incident(s) placé(s) sur le calendrier.");
                            statusLabel.setStyle("-fx-text-fill: #0CA789; -fx-font-weight: bold;");
                        } else {
                            statusLabel.setText("Aucune date détectée dans les données — dates non fournies par l'API.");
                            statusLabel.setStyle("-fx-text-fill: #F29C38;");
                        }
                    });
                })
                .exceptionally(ex -> {
                    Platform.runLater(() -> {
                        statusLabel.setText("Erreur de chargement : " + ex.getMessage());
                        statusLabel.setStyle("-fx-text-fill: #E74C3C;");
                    });
                    return null;
                });

        Scene scene = new Scene(root);
        applyStylesheet(scene);
        stage.setScene(scene);
        stage.show();
    }

    private void renderCalendar() {
        calendarGrid.getChildren().clear();

        String nomMois = currentMonth.getMonth().getDisplayName(TextStyle.FULL, Locale.FRENCH);
        monthLabel.setText(nomMois.substring(0, 1).toUpperCase() + nomMois.substring(1) + " " + currentMonth.getYear());

        for (int i = 0; i < 7; i++) {
            Label h = new Label(JOURS[i]);
            h.setStyle("-fx-text-fill: #8BA0B8; -fx-font-weight: bold; -fx-min-width: 58; -fx-alignment: center;");
            calendarGrid.add(h, i, 0);
        }

        LocalDate firstDay = currentMonth.atDay(1);
        int startCol = firstDay.getDayOfWeek().getValue() - 1;
        int daysInMonth = currentMonth.lengthOfMonth();
        LocalDate today = LocalDate.now();

        int col = startCol;
        int row = 1;

        for (int day = 1; day <= daysInMonth; day++) {
            LocalDate date = currentMonth.atDay(day);
            List<String> incidents = incidentsByDate.getOrDefault(date, Collections.emptyList());
            calendarGrid.add(buildDayCell(day, date, incidents, today), col, row);
            col++;
            if (col == 7) { col = 0; row++; }
        }
    }

    private VBox buildDayCell(int day, LocalDate date, List<String> incidents, LocalDate today) {
        VBox cell = new VBox(2);
        cell.setAlignment(Pos.TOP_CENTER);
        cell.setPrefSize(58, 58);
        cell.setMaxSize(58, 58);

        String bg = "#233348";
        if (date.equals(today)) bg = "#1a5659";
        if (!incidents.isEmpty()) bg = "#3d2a1a";

        boolean hasIncidents = !incidents.isEmpty();
        cell.setStyle("-fx-background-color: " + bg + "; -fx-background-radius: 8; -fx-cursor: " + (hasIncidents ? "hand" : "default") + ";");

        Label dayLabel = new Label(String.valueOf(day));
        dayLabel.setStyle("-fx-text-fill: " + (date.equals(today) ? "#0CA789" : "white") + "; -fx-font-weight: bold; -fx-font-size: 13px;");
        cell.getChildren().add(dayLabel);

        if (hasIncidents) {
            Label dot = new Label(incidents.size() + " ⚠");
            dot.setStyle("-fx-text-fill: #F29C38; -fx-font-size: 10px;");
            cell.getChildren().add(dot);
            cell.setOnMouseClicked(e -> showDayDetail(date, incidents));
        }
        return cell;
    }

    private void showDayDetail(LocalDate date, List<String> incidents) {
        detailPanel.getChildren().clear();

        Label dateLabel = new Label(date.format(DateTimeFormatter.ofPattern("dd MMMM yyyy", Locale.FRENCH)));
        dateLabel.setStyle("-fx-text-fill: #0CA789; -fx-font-weight: bold; -fx-font-size: 13px;");
        dateLabel.setWrapText(true);

        Label count = new Label(incidents.size() + " incident(s) signalé(s)");
        count.setStyle("-fx-text-fill: #F29C38; -fx-font-size: 12px;");

        detailPanel.getChildren().addAll(dateLabel, count, new Separator());

        for (String inc : incidents) {
            Label item = new Label("• " + inc);
            item.setStyle("-fx-text-fill: white; -fx-font-size: 11px;");
            item.setWrapText(true);
            detailPanel.getChildren().add(item);
        }
    }

    private void resetDetailPanel() {
        detailPanel.getChildren().clear();
        Label hint = new Label("Cliquez sur un jour\nmarqué ⚠ pour voir\nles incidents.");
        hint.setStyle("-fx-text-fill: #8BA0B8; -fx-font-size: 12px;");
        hint.setWrapText(true);
        detailPanel.getChildren().add(hint);
    }

    private Map<LocalDate, List<String>> parseIncidentsWithDates(String json) {
        Map<LocalDate, List<String>> map = new HashMap<>();
        String[] blocks = json.split("\\{\\s*\"id_signalement\"");

        for (int i = 1; i < blocks.length; i++) {
            String block = blocks[i];
            String motif = extractField(block, "motif");
            if (motif.isEmpty()) motif = "Incident #" + i;

            LocalDate date = null;
            for (String field : DATE_FIELDS) {
                Matcher m = Pattern.compile("\"" + field + "\"\\s*:\\s*\"(\\d{4}-\\d{2}-\\d{2})").matcher(block);
                if (m.find()) {
                    try { date = LocalDate.parse(m.group(1)); break; } catch (Exception ignored) {}
                }
            }

            if (date != null) {
                map.computeIfAbsent(date, k -> new ArrayList<>()).add(motif);
            }
        }
        return map;
    }

    private HBox buildLegendItem(String color, String text) {
        HBox item = new HBox(6);
        item.setAlignment(Pos.CENTER_LEFT);
        Label square = new Label("  ");
        square.setStyle("-fx-background-color: " + color + "; -fx-background-radius: 3; -fx-min-width: 14; -fx-min-height: 14;");
        Label label = new Label(text);
        label.setStyle("-fx-text-fill: #8BA0B8; -fx-font-size: 11px;");
        item.getChildren().addAll(square, label);
        return item;
    }

    private String extractField(String block, String key) {
        Matcher m = Pattern.compile("\"" + key + "\"\\s*:\\s*\"([^\"]+)\"").matcher(block);
        return m.find() ? m.group(1) : "";
    }

    private void styleNavBtn(Button btn) {
        btn.setStyle("-fx-background-color: #2E435E; -fx-text-fill: white; -fx-cursor: hand; -fx-background-radius: 6; -fx-font-size: 14px; -fx-padding: 6 14;");
    }

    private void applyStylesheet(Scene scene) {
        java.net.URL css = getClass().getResource("/com/neighborhood_manager/style.css");
        if (css != null) scene.getStylesheets().add(css.toExternalForm());
    }
}
