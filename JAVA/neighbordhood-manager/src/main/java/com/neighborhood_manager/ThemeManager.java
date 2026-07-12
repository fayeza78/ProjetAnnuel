package com.neighborhood_manager;

import javafx.scene.Scene;
import java.net.URL;
import java.util.prefs.Preferences;

public class ThemeManager {

    public enum Theme {
        NUIT("Nuit Profonde",  "theme-nuit.css",   "#1a2638", "#F29C38", "#0CA789"),
        AUBE("Aube Claire",    "theme-aube.css",   "#F0F4F8", "#E67E22", "#1ABC9C"),
        MARINE("Bleu Marine",  "theme-marine.css", "#0D1B2E", "#4A90E2", "#5DADE2"),
        FORET("Forêt",         "theme-foret.css",  "#0D1F12", "#F1C40F", "#27AE60");

        public final String label;
        public final String filename;
        public final String bgColor;
        public final String accentColor;
        public final String primaryColor;

        Theme(String label, String filename, String bgColor, String accentColor, String primaryColor) {
            this.label = label; this.filename = filename;
            this.bgColor = bgColor; this.accentColor = accentColor; this.primaryColor = primaryColor;
        }
    }

    public enum FontSize {
        COMPACT("Compacte", "font-compact.css"),
        NORMAL("Normale",   null),
        LARGE("Grande",     "font-large.css");

        public final String label;
        public final String filename;
        FontSize(String label, String filename) { this.label = label; this.filename = filename; }
    }

    public enum Layout {
        COMPACT("Compacte", "layout-compact.css"),
        NORMAL("Normale",   null),
        AIRY("Aérée",       "layout-airy.css");

        public final String label;
        public final String filename;
        Layout(String label, String filename) { this.label = label; this.filename = filename; }
    }

    private static ThemeManager instance;
    private final Preferences prefs = Preferences.userNodeForPackage(ThemeManager.class);

    private Theme currentTheme;
    private FontSize currentFontSize;
    private Layout currentLayout;

    private ThemeManager() {
        currentTheme    = safeValueOf(Theme.class,    prefs.get("theme",    Theme.NUIT.name()),    Theme.NUIT);
        currentFontSize = safeValueOf(FontSize.class, prefs.get("fontSize", FontSize.NORMAL.name()), FontSize.NORMAL);
        currentLayout   = safeValueOf(Layout.class,   prefs.get("layout",   Layout.NORMAL.name()),  Layout.NORMAL);
    }

    public static synchronized ThemeManager getInstance() {
        if (instance == null) instance = new ThemeManager();
        return instance;
    }

    public Theme    getCurrentTheme()    { return currentTheme; }
    public FontSize getCurrentFontSize() { return currentFontSize; }
    public Layout   getCurrentLayout()   { return currentLayout; }

    public void applyTo(Scene scene) {
        scene.getStylesheets().clear();
        addCSS(scene, "/com/neighborhood_manager/style.css");
        addCSS(scene, "/com/neighborhood_manager/themes/" + currentTheme.filename);
        if (currentFontSize.filename != null)
            addCSS(scene, "/com/neighborhood_manager/themes/" + currentFontSize.filename);
        if (currentLayout.filename != null)
            addCSS(scene, "/com/neighborhood_manager/themes/" + currentLayout.filename);
    }

    public void setTheme(Theme theme, Scene scene) {
        currentTheme = theme;
        prefs.put("theme", theme.name());
        applyTo(scene);
    }

    public void setFontSize(FontSize fontSize, Scene scene) {
        currentFontSize = fontSize;
        prefs.put("fontSize", fontSize.name());
        applyTo(scene);
    }

    public void setLayout(Layout layout, Scene scene) {
        currentLayout = layout;
        prefs.put("layout", layout.name());
        applyTo(scene);
    }

    public void resetToDefaults(Scene scene) {
        currentTheme    = Theme.NUIT;
        currentFontSize = FontSize.NORMAL;
        currentLayout   = Layout.NORMAL;
        prefs.remove("theme");
        prefs.remove("fontSize");
        prefs.remove("layout");
        applyTo(scene);
    }

    private void addCSS(Scene scene, String resourcePath) {
        URL url = ThemeManager.class.getResource(resourcePath);
        if (url != null) scene.getStylesheets().add(url.toExternalForm());
    }

    private <E extends Enum<E>> E safeValueOf(Class<E> cls, String name, E fallback) {
        try { return Enum.valueOf(cls, name); } catch (IllegalArgumentException e) { return fallback; }
    }
}