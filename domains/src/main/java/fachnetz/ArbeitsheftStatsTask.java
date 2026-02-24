package fachnetz;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClientBuilder;
import org.apache.hc.core5.http.HttpEntity;
import org.apache.hc.core5.http.io.entity.EntityUtils;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.ArrayList;
import java.util.concurrent.ConcurrentHashMap;

public class ArbeitsheftStatsTask extends Task<Report> {
    private String XWIKI_DOMAIN = "xwiki";

    @Override
    public Report execute() {
        return new Report();
    }

    @Override
    public void run() {
        Arbeitsheft heft = new Arbeitsheft();
        List<Profile> ahProfiles = heft.readProfiles();

        Map<String, Profile> profileMap = new HashMap<>();
        if (ahProfiles != null) {
            for (Profile p : ahProfiles) {
                profileMap.put(p.getAnmeldename(), p);
            }
        }

        Map<String, Integer> activeAuthorsMap = fetchActiveAuthorsFromXwql();

        List<Map.Entry<String, Integer>> sortedAuthors = new java.util.ArrayList<>(activeAuthorsMap.entrySet());
        sortedAuthors.sort((e1, e2) -> e2.getValue().compareTo(e1.getValue())); // Sort descending by count

        Set<String> uniqueSchools = new java.util.HashSet<>();
        for (Map.Entry<String, Integer> e : sortedAuthors) {
            String username = e.getKey();
            Profile p = profileMap.get(username);
            String schule = p != null && p.getSchulname() != null ? p.getSchulname().trim() : "";
            String schulort = p != null && p.getSchulort() != null ? p.getSchulort().trim() : "";
            if (!schule.isEmpty() || !schulort.isEmpty()) {
                uniqueSchools.add(schule + "|" + schulort);
            }
        }

        System.out.println("Statistik Arbeitsheft");
        System.out.println("Anzahl der Autoren: " + sortedAuthors.size());
        System.out.println("Anzahl der beteiligten Schulen: " + uniqueSchools.size());
        System.out.println("=========================================");
        System.out.println();

        System.out.println("Benutzername;Vorname;Nachname;Schule;Schulort;Seiten");
        for (Map.Entry<String, Integer> e : sortedAuthors) {
            String username = e.getKey();
            int pages = e.getValue();
            Profile p = profileMap.get(username);

            String vorname = p != null && p.getVorname() != null ? p.getVorname() : "";
            String nachname = p != null && p.getNachname() != null ? p.getNachname() : "";
            String schule = p != null && p.getSchulname() != null ? p.getSchulname() : "";
            String schulort = p != null && p.getSchulort() != null ? p.getSchulort() : "";

            System.out
                    .println(String.format("%s;%s;%s;%s;%s;%d", username, vorname, nachname, schule, schulort, pages));
        }
    }

    private Map<String, Integer> fetchActiveAuthorsFromXwql() {
        Map<String, Set<String>> userPages = new ConcurrentHashMap<>();
        List<String> pageFullNames = new ArrayList<>();

        String xwikiUrl = Configuration.getInstance().getString(XWIKI_DOMAIN, "url");
        if (!xwikiUrl.endsWith("/")) {
            xwikiUrl += "/";
        }
        String rest = Configuration.getInstance().getString(XWIKI_DOMAIN, "rest");
        if (!rest.endsWith("/")) {
            rest += "/";
        }
        String user = Configuration.getInstance().getString(XWIKI_DOMAIN, "user");
        String pass = Configuration.getInstance().getString(XWIKI_DOMAIN, "password");

        String auth = user + ":" + pass;
        String encodedAuth = java.util.Base64.getEncoder().encodeToString(auth.getBytes(StandardCharsets.UTF_8));

        final String finalXwikiUrl = xwikiUrl;
        final String finalRest = rest;
        final String finalAuth = encodedAuth;

        try (CloseableHttpClient client = HttpClientBuilder.create().build()) {
            String xwql = "where doc.fullName not like 'XWiki.%'";
            String q = URLEncoder.encode(xwql, StandardCharsets.UTF_8);
            String url = finalXwikiUrl + finalRest + "wikis/xwiki/query?q=" + q + "&type=xwql&number=100000";

            HttpGet get = new HttpGet(url);
            get.setHeader("Accept", "application/json");
            get.setHeader("Authorization", "Basic " + finalAuth);

            System.out.println("Holt Dokumentenliste über XWQL...");
            long start = System.currentTimeMillis();

            client.execute(get, response -> {
                int statusCode = response.getCode();
                if (statusCode >= 200 && statusCode < 300) {
                    HttpEntity entity = response.getEntity();
                    if (entity != null) {
                        String jsonResponse = new String(entity.getContent().readAllBytes(), StandardCharsets.UTF_8);
                        JsonObject root = JsonParser.parseString(jsonResponse).getAsJsonObject();
                        if (root.has("searchResults")) {
                            JsonArray results = root.getAsJsonArray("searchResults");
                            for (JsonElement el : results) {
                                JsonObject obj = el.getAsJsonObject();
                                String pageFullName = obj.has("pageFullName") ? obj.get("pageFullName").getAsString()
                                        : "unknown";
                                pageFullNames.add(pageFullName);

                                Set<String> docAuthors = new HashSet<>();
                                if (obj.has("author") && !obj.get("author").isJsonNull()) {
                                    docAuthors.add(extractUsername(obj.get("author").getAsString()));
                                }
                                if (obj.has("creator") && !obj.get("creator").isJsonNull()) {
                                    docAuthors.add(extractUsername(obj.get("creator").getAsString()));
                                }

                                for (String a : docAuthors) {
                                    if (a == null || a.equals("admin") || a.equals("superadmin") || a.equals("vbs")
                                            || a.equals("hengels") || a.equals("XWikiGuest") || a.equals("Import"))
                                        continue;
                                    userPages.computeIfAbsent(a, k -> ConcurrentHashMap.newKeySet()).add(pageFullName);
                                }
                            }
                        }
                    }
                } else {
                    System.err.println("Fehler beim Abrufen der XWQL-Suche. Statuscode: " + statusCode);
                }
                EntityUtils.consume(response.getEntity());
                return (Void) null;
            });

            System.out.println(
                    "Gefunden " + pageFullNames.size() + " Pages in " + (System.currentTimeMillis() - start) + "ms.");
            System.out.println("Holt Historien der Dokumente sequenziell (mit HTTP Keep-Alive)...");
            start = System.currentTimeMillis();

            int count = 0;
            for (String pageFullName : pageFullNames) {
                try {
                    String[] parts = pageFullName.split("\\.");
                    StringBuilder historyUrlStr = new StringBuilder(finalXwikiUrl).append(finalRest)
                            .append("wikis/xwiki/");
                    for (int i = 0; i < parts.length - 1; i++) {
                        historyUrlStr.append("spaces/").append(URLEncoder.encode(parts[i], StandardCharsets.UTF_8))
                                .append("/");
                    }
                    historyUrlStr.append("pages/")
                            .append(URLEncoder.encode(parts[parts.length - 1], StandardCharsets.UTF_8))
                            .append("/history");

                    HttpGet histGet = new HttpGet(historyUrlStr.toString());
                    histGet.setHeader("Accept", "application/json");
                    histGet.setHeader("Authorization", "Basic " + finalAuth);

                    client.execute(histGet, histResp -> {
                        int histStatusCode = histResp.getCode();
                        if (histStatusCode >= 200 && histStatusCode < 300) {
                            HttpEntity hEnt = histResp.getEntity();
                            if (hEnt != null) {
                                String hJson = new String(hEnt.getContent().readAllBytes(), StandardCharsets.UTF_8);
                                JsonObject hRoot = JsonParser.parseString(hJson).getAsJsonObject();
                                if (hRoot.has("historySummaries")) {
                                    JsonArray hResults = hRoot.getAsJsonArray("historySummaries");
                                    for (JsonElement hel : hResults) {
                                        JsonObject hObj = hel.getAsJsonObject();
                                        if (hObj.has("modifier") && !hObj.get("modifier").isJsonNull()) {
                                            String mod = extractUsername(hObj.get("modifier").getAsString());
                                            if (mod != null && !mod.equals("admin") && !mod.equals("superadmin")
                                                    && !mod.equals("vbs") && !mod.equals("hengels")
                                                    && !mod.equals("XWikiGuest") && !mod.equals("Import")) {
                                                userPages.computeIfAbsent(mod, k -> ConcurrentHashMap.newKeySet())
                                                        .add(pageFullName);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        EntityUtils.consume(histResp.getEntity());
                        return null;
                    });

                    count++;
                    if (count % 100 == 0) {
                        System.out.print(".");
                        System.out.flush();
                    }
                    if (count % 500 == 0) {
                        System.out.println(" " + count + "/" + pageFullNames.size());
                    }
                } catch (Exception e) {
                    System.err.println("Fehler bei der Historienabfrage " + pageFullName + ": " + e.getMessage());
                }
            }
            System.out.println();

            System.out.println("Historienabruf beendet in " + (System.currentTimeMillis() - start) + "ms.");

        } catch (Exception e) {
            System.err.println("Fehler bei der Kommunikation mit XWiki XWQL oder History: " + e.getMessage());
        }

        Map<String, Integer> authorCounts = new HashMap<>();
        for (Map.Entry<String, Set<String>> entry : userPages.entrySet()) {
            authorCounts.put(entry.getKey(), entry.getValue().size());
        }

        return authorCounts;
    }

    private String extractUsername(String raw) {
        // format usually "xwiki:XWiki.holgerengels" or "XWiki.holgerengels"
        if (raw == null)
            return null;
        String clean = raw;
        if (clean.contains(":")) {
            clean = clean.substring(clean.lastIndexOf(":") + 1);
        }
        if (clean.startsWith("XWiki.")) {
            clean = clean.substring(6);
        }
        return clean;
    }
}
