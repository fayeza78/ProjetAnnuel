package com.neighborhood_manager.database;

public class SessionManager {
    private static SessionManager instance;
    private String accessToken;
    private String adminEmail;
    private java.time.LocalDateTime loginTime;

    private SessionManager() {}

    public static synchronized SessionManager getInstance() {
        if (instance == null) instance = new SessionManager();
        return instance;
    }

    public String getAccessToken() { return accessToken; }
    public void setAccessToken(String accessToken) { this.accessToken = accessToken; }

    public String getAdminEmail() { return adminEmail != null ? adminEmail : "admin@quartier.fr"; }
    public void setAdminEmail(String email) { this.adminEmail = email; }

    public java.time.LocalDateTime getLoginTime() { return loginTime; }
    public void setLoginTime(java.time.LocalDateTime t) { this.loginTime = t; }

    public boolean isLoggedIn() { return accessToken != null; }

    public void logout() {
        this.accessToken = null;
        this.loginTime = null;
    }

    public void setRefreshToken(String group) {
    }
}