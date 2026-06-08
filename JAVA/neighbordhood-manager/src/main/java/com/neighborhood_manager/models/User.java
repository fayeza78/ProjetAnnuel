package com.neighborhood_manager.models;

public class User {
    private String id;
    private String name;
    private String email;
    private String status; // "PENDING", "VALIDATED"

    public User(String id, String name, String email, String status) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.status = status;
    }

    // Getters (obligatoires pour le TableView)
    public String getName() { return name; }
    public String getEmail() { return email; }
    public String getStatus() { return status; }
    public String getId() { return id; }
}