package com.neighborhood_manager.models;

public class User {
    private int id_user;
    private String email;
    private String role;
    private String adresse;
    private String ville;

    public User(int id_user, String email, String role, String adresse, String ville) {
        this.id_user = id_user;
        this.email = email;
        this.role = role;
        this.adresse = adresse;
        this.ville = ville;
    }

    // Getters indispensables pour le TableView JavaFX
    public int getId_user() { return id_user; }
    public String getEmail() { return email; }
    public String getRole() { return role; }
    public String getAdresse() { return adresse; }
    public String getVille() { return ville; }
}