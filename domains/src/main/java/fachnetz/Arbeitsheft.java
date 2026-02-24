package fachnetz;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.CloseableHttpResponse;
import org.apache.hc.client5.http.impl.classic.HttpClientBuilder;
import org.apache.hc.core5.http.HttpEntity;
import org.apache.hc.core5.http.io.entity.EntityUtils;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public class Arbeitsheft extends Endpoint {
    private String DOMAIN = "xwiki";

    protected String getConfigString(String key) {
        return Configuration.getInstance().getString(DOMAIN, key);
    }

    public List<Profile> readProfiles() {
        String url = getConfigString("url");
        if (url == null)
            return new ArrayList<>();
        if (!url.endsWith("/"))
            url += "/";

        String rest = getConfigString("rest");
        if (rest == null)
            rest = "xwiki/rest";
        if (rest.startsWith("/"))
            rest = rest.substring(1);
        if (!rest.endsWith("/"))
            rest += "/";
        String queryUrl = url + rest + "wikis/xwiki/classes/XWiki.XWikiUsers/objects?number=10000";

        String user = getConfigString("user");
        String pass = getConfigString("password");
        String auth = user + ":" + pass;
        String encodedAuth = java.util.Base64.getEncoder().encodeToString(auth.getBytes(StandardCharsets.UTF_8));

        List<Profile> profiles = new ArrayList<>();
        try (CloseableHttpClient client = HttpClientBuilder.create().build()) {
            HttpGet get = new HttpGet(queryUrl);
            get.addHeader("Accept", "application/json");
            get.addHeader("Authorization", "Basic " + encodedAuth);

            try (CloseableHttpResponse response = client.execute(get)) {
                HttpEntity entity = response.getEntity();
                String jsonString = EntityUtils.toString(entity, StandardCharsets.UTF_8);

                JsonObject root;
                try {
                    root = JsonParser.parseString(jsonString).getAsJsonObject();
                } catch (Exception e) {
                    System.err.println("Failed to parse JSON. HTTP Status: " + response.getCode());
                    System.err.println("Response body:\n" + jsonString);
                    throw e;
                }

                // XWiki often returns "objectSummaries" for search results or queries
                JsonArray objects = root.getAsJsonArray("objectSummaries");
                if (objects == null) {
                    objects = root.getAsJsonArray("objects");
                }

                if (objects != null) {
                    for (JsonElement element : objects) {
                        JsonObject obj = element.getAsJsonObject();
                        String pageName = obj.get("pageName").getAsString();

                        // Each obj might have 'properties' if requested or if it's the right endpoint
                        // If not, we might need to fetch the individual object details:
                        // rest/wikis/xwiki/spaces/XWiki/pages/{pageName}/objects/XWiki.XWikiUsers/0

                        Profile profile = fetchProfileDetails(client, url + rest, pageName, encodedAuth);
                        if (profile != null) {
                            profiles.add(profile);
                        }
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return profiles;
    }

    private Profile fetchProfileDetails(CloseableHttpClient client, String restBaseUrl, String pageName,
            String encodedAuth) {
        String detailUrl = restBaseUrl + "wikis/xwiki/spaces/XWiki/pages/" + pageName + "/objects/XWiki.XWikiUsers/0";
        HttpGet get = new HttpGet(detailUrl);
        get.addHeader("Accept", "application/json");
        get.addHeader("Authorization", "Basic " + encodedAuth);

        try (CloseableHttpResponse response = client.execute(get)) {
            HttpEntity entity = response.getEntity();
            String jsonString = EntityUtils.toString(entity, StandardCharsets.UTF_8);
            JsonObject obj = JsonParser.parseString(jsonString).getAsJsonObject();
            JsonArray properties = obj.getAsJsonArray("properties");

            String vorname = "";
            String nachname = "";
            String email = "";
            String schulname = "";
            String schulort = "";
            String rp = "";

            if (properties != null) {
                for (JsonElement propElem : properties) {
                    JsonObject prop = propElem.getAsJsonObject();
                    String name = prop.get("name").getAsString();
                    JsonElement valElem = prop.get("value");
                    String value = (valElem == null || valElem.isJsonNull()) ? "" : valElem.getAsString();

                    if ("email".equals(name))
                        email = value;
                    else if ("first_name".equals(name))
                        vorname = value;
                    else if ("last_name".equals(name))
                        nachname = value;
                    else if ("schule".equals(name))
                        schulname = value;
                    else if ("schulort".equals(name))
                        schulort = value;
                    else if ("rp".equals(name))
                        rp = value;
                }
            }

            Profile profile = new Profile(pageName, vorname, nachname, email, schulname, schulort, rp);
            profile.id = pageName;
            return profile;
        } catch (Exception e) {
            System.err.println("Error fetching details for " + pageName + ": " + e.getMessage());
            return null;
        }
    }
}
