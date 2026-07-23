package com.neighborhood_manager;

import com.neighborhood_manager.models.Incident;
import com.neighborhood_manager.models.IncidentEntry;
import com.neighborhood_manager.models.User;

import java.util.*;
import java.util.regex.*;

public class JsonParser {

    public static List<Incident> parseSignalements(String json) {
        List<Incident> list = new ArrayList<>();
        String[] blocks = json.split("\\{\\s*\"id_signalement\"");
        for (int i = 1; i < blocks.length; i++) {
            String block = blocks[i];
            Matcher mId     = Pattern.compile("^\\s*:\\s*(\\d+)").matcher(block);
            Matcher mMotif  = Pattern.compile("\"motif\"\\s*:\\s*\"([^\"]+)\"").matcher(block);
            Matcher mStatut = Pattern.compile("\"statut\"\\s*:\\s*\"([^\"]+)\"").matcher(block);

            String id     = mId.find()     ? mId.group(1)     : "";
            String motif  = mMotif.find()  ? mMotif.group(1)  : "Aucun motif spécifié";
            String statut = mStatut.find() ? (mStatut.group(1).equals("ouvert") ? "En cours" : "Résolu") : "En cours";

            if (!id.isEmpty()) {
                try { list.add(new Incident(Integer.parseInt(id), motif, statut)); }
                catch (NumberFormatException ignored) {}
            }
        }
        return list;
    }

    public static List<IncidentEntry> parseIncidents(String json) {
        List<IncidentEntry> list = new ArrayList<>();
        String[] blocks = json.split("\\{\\s*\"id_incident\"");
        for (int i = 1; i < blocks.length; i++) {
            String block = blocks[i];
            Matcher mId     = Pattern.compile("^\\s*:\\s*(\\d+)").matcher(block);
            Matcher mDesc   = Pattern.compile("\"description\"\\s*:\\s*\"([^\"]+)\"").matcher(block);
            Matcher mStatut = Pattern.compile("\"statut\"\\s*:\\s*\"([^\"]+)\"").matcher(block);
            Matcher mEmail  = Pattern.compile("\"email\"\\s*:\\s*\"([^\"]+)\"").matcher(block);
            Matcher mDate   = Pattern.compile("\"createdAt\"\\s*:\\s*\"([^\"T]+)").matcher(block);

            String id          = mId.find()     ? mId.group(1)     : "";
            String description = mDesc.find()   ? mDesc.group(1)   : "Aucune description";
            String statut      = mStatut.find() ? (mStatut.group(1).equals("ouvert") ? "En cours" : "Résolu") : "En cours";
            String email       = mEmail.find()  ? mEmail.group(1)  : "";
            String createdAt   = mDate.find()   ? mDate.group(1)   : "";

            if (!id.isEmpty()) {
                try { list.add(new IncidentEntry(Integer.parseInt(id), description, statut, email, createdAt)); }
                catch (NumberFormatException ignored) {}
            }
        }
        return list;
    }

    public static List<User> parseUsers(String json) {
        List<User> list = new ArrayList<>();
        String[] blocks = json.split("\\{\\s*\"id_user\"");
        for (int i = 1; i < blocks.length; i++) {
            String block = blocks[i];
            Matcher mId      = Pattern.compile("^\\s*:\\s*(\\d+)").matcher(block);
            Matcher mEmail   = Pattern.compile("\"email\"\\s*:\\s*\"([^\"]+)\"").matcher(block);
            Matcher mRole    = Pattern.compile("\"role\"\\s*:\\s*\"([^\"]+)\"").matcher(block);
            Matcher mVille   = Pattern.compile("\"ville\"\\s*:\\s*\"([^\"]*)\"").matcher(block);
            Matcher mQuart   = Pattern.compile("\"nom_quartier\"\\s*:\\s*\"([^\"]+)\"").matcher(block);

            int    id    = mId.find()    ? Integer.parseInt(mId.group(1)) : 0;
            String email = mEmail.find() ? mEmail.group(1) : "";
            String role  = mRole.find()  ? mRole.group(1)  : "";
            String ville = (mVille.find() && !mVille.group(1).equalsIgnoreCase("null")) ? mVille.group(1).trim() : "";
            String quart = mQuart.find() ? mQuart.group(1) : "";

            String adresse = quart.isEmpty() ? "Quartier non renseigné" : quart;
            if (!ville.isEmpty()) adresse += " - " + ville;

            if (id != 0) list.add(new User(id, email, role, adresse, ville));
        }
        return list;
    }

    public static Map<String, Integer> parseRoles(String json) {
        Map<String, Integer> map = new LinkedHashMap<>();
        String[] blocks = json.split("\\{\\s*\"id_user\"");
        for (int i = 1; i < blocks.length; i++) {
            Matcher m = Pattern.compile("\"role\"\\s*:\\s*\"([^\"]+)\"").matcher(blocks[i]);
            String role = m.find() ? m.group(1) : "inconnu";
            map.merge(role, 1, Integer::sum);
        }
        return map;
    }

    public static Map<Integer, String> parseUserEmailsById(String json) {
        Map<Integer, String> map = new LinkedHashMap<>();
        String[] blocks = json.split("\\{\\s*\"id_user\"");
        for (int i = 1; i < blocks.length; i++) {
            String block = blocks[i];
            Matcher mId    = Pattern.compile("^\\s*:\\s*(\\d+)").matcher(block);
            Matcher mEmail = Pattern.compile("\"email\"\\s*:\\s*\"([^\"]+)\"").matcher(block);
            if (mId.find() && mEmail.find())
                map.put(Integer.parseInt(mId.group(1)), mEmail.group(1));
        }
        return map;
    }

    public static Map<Integer, Integer> parseParUtilisateur(String json) {
        Map<Integer, Integer> map = new LinkedHashMap<>();
        Matcher mBlock = Pattern.compile("\"parUtilisateur\"\\s*:\\s*\\{([^}]*)\\}").matcher(json);
        if (mBlock.find()) {
            Matcher mPair = Pattern.compile("\"(\\d+)\"\\s*:\\s*(\\d+)").matcher(mBlock.group(1));
            while (mPair.find())
                map.put(Integer.parseInt(mPair.group(1)), Integer.parseInt(mPair.group(2)));
        }
        return map;
    }
}
