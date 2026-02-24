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

public class ArbeitsheftStatsTask extends Task {
    private String XWIKI_DOMAIN = "xwiki";

    @Override
    public Object execute() {
        return null;
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

        Map<String, Integer> activeAuthorsMap = fetchActiveAuthorsFromSolr();

        List<Map.Entry<String, Integer>> sortedAuthors = new java.util.ArrayList<>(activeAuthorsMap.entrySet());
        sortedAuthors.sort((e1, e2) -> e2.getValue().compareTo(e1.getValue())); // Sort descending by count

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

    private Map<String, Integer> fetchActiveAuthorsFromSolr() {
        Map<String, Set<String>> userPages = new HashMap<>();

        try (CloseableHttpClient client = HttpClientBuilder.create().build()) {
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

            // URL encoding query parameters
            String q = URLEncoder.encode("-space:\"XWiki\" AND type:DOCUMENT", StandardCharsets.UTF_8);
            String url = xwikiUrl + rest + "wikis/xwiki/query?q=" + q + "&type=solr&number=100000";

            HttpGet get = new HttpGet(url);
            get.setHeader("Accept", "application/json");
            get.setHeader("Authorization", "Basic " + encodedAuth);

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
                                JsonObject doc = el.getAsJsonObject();
                                String pageFullName = doc.has("pageFullName") ? doc.get("pageFullName").getAsString()
                                        : "unknown";

                                Set<String> docAuthors = new HashSet<>();
                                if (doc.has("author") && !doc.get("author").isJsonNull()) {
                                    docAuthors.add(extractUsername(doc.get("author").getAsString()));
                                }
                                if (doc.has("creator") && !doc.get("creator").isJsonNull()) {
                                    docAuthors.add(extractUsername(doc.get("creator").getAsString()));
                                }

                                for (String a : docAuthors) {
                                    if (a == null || a.equals("admin") || a.equals("superadmin"))
                                        continue;
                                    userPages.computeIfAbsent(a, k -> new HashSet<>()).add(pageFullName);
                                }
                            }
                        }
                    }
                } else {
                    System.err.println("Fehler beim Abrufen der Solr-Suche. Statuscode: " + statusCode);
                }
                EntityUtils.consume(response.getEntity());
                return (Void) null;
            });
        } catch (Exception e) {
            System.err.println("Fehler bei der Kommunikation mit XWiki Solr: " + e.getMessage());
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
