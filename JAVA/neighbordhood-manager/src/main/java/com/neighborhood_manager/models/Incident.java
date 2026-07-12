package com.neighborhood_manager.models; // Vérifie bien ton package

public class Incident {
    private int id_signalement;
    private String motif;
    private String statut;

    // Constructeur par défaut nécessaire pour certains parseurs
    public Incident() {}

    public Incident(int id_signalement, String motif, String statut) {
        this.id_signalement = id_signalement;
        this.motif = motif;
        this.statut = statut;
    }

    // Getters et Setters indispensables pour le TableView de JavaFX
    public int getId_signalement() { return id_signalement; }
    public void setId_signalement(int id_signalement) { this.id_signalement = id_signalement; }

    public String getMotif() { return motif; }
    public void setMotif(String motif) { this.motif = motif; }

    public String getStatut() { return statut; }
    public void setStatut(String statut) { this.statut = statut; }
}