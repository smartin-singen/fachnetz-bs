package fachnetz;

import org.apache.hc.client5.http.classic.methods.HttpPut;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClientBuilder;
import org.apache.hc.core5.http.io.entity.StringEntity;
import org.apache.hc.core5.http.io.entity.EntityUtils;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ArbeitsheftSyncTask extends Task {
    private String DOMAIN = "moodle";
    private String XWIKI_DOMAIN = "xwiki";

    protected String getConfigString(String key) {
        return Configuration.getInstance().getString(DOMAIN, key);
    }

    protected String getConfigString(String domain, String key) {
        return Configuration.getInstance().getString(domain, key);
    }

    protected Integer getConfigInteger(String key) {
        return Configuration.getInstance().getInteger(DOMAIN, key);
    }

    private long millis = System.currentTimeMillis();

    public void start() {
        millis = System.currentTimeMillis();
    }

    protected void stop(String text) {
        System.out
                .println(getClass().getSimpleName() + " " + text + " " + (System.currentTimeMillis() - millis) + "ms");
        millis = System.currentTimeMillis();
    }

    @Override
    public Object execute() {
        return null;
    }

    @Override
    public void run() {
        System.out.println("Lese Profile vom Fachnetz...");
        List<Profile> fachnetzProfiles = new Fachnetz().readProfiles();

        System.out.println("Lese Profile vom Arbeitsheft...");
        List<Profile> arbeitsheftProfiles = new Arbeitsheft().readProfiles();

        Map<String, Profile> ahMap = new HashMap<>();
        for (Profile p : arbeitsheftProfiles) {
            ahMap.put(p.getAnmeldename(), p);
        }

        try (CloseableHttpClient client = HttpClientBuilder.create().build()) {
            for (Profile fnProfile : fachnetzProfiles) {
                // Testing constraint requested by user
                if (!"holgerengels".equals(fnProfile.getAnmeldename())) {
                    continue;
                }

                Profile ahProfile = ahMap.get(fnProfile.getAnmeldename());
                if (ahProfile != null) {
                    boolean changed = false;

                    if (!equalsTrimmed(fnProfile.getVorname(), ahProfile.getVorname())) {
                        System.out.println("Vornameabweichung für " + fnProfile.getAnmeldename() + ": Fachnetz='"
                                + fnProfile.getVorname() + "', Arbeitsheft='" + ahProfile.getVorname() + "'");
                        changed = true;
                    }
                    if (!equalsTrimmed(fnProfile.getNachname(), ahProfile.getNachname())) {
                        System.out.println("Nachnameabweichung für " + fnProfile.getAnmeldename() + ": Fachnetz='"
                                + fnProfile.getNachname() + "', Arbeitsheft='" + ahProfile.getNachname() + "'");
                        changed = true;
                    }
                    if (!equalsTrimmed(fnProfile.getSchulname(), ahProfile.getSchulname())) {
                        System.out.println("Schulnamenabweichung für " + fnProfile.getAnmeldename() + ": Fachnetz='"
                                + fnProfile.getSchulname() + "', Arbeitsheft='" + ahProfile.getSchulname() + "'");
                        changed = true;
                    }
                    if (!equalsTrimmed(fnProfile.getSchulort(), ahProfile.getSchulort())) {
                        System.out.println("Schulortabweichung für " + fnProfile.getAnmeldename() + ": Fachnetz='"
                                + fnProfile.getSchulort() + "', Arbeitsheft='" + ahProfile.getSchulort() + "'");
                        changed = true;
                    }

                    if (changed) {
                        System.out.println("Aktualisiere " + fnProfile.getAnmeldename() + " im Arbeitsheft...");
                        updateArbeitsheftProfile(client, fnProfile);
                        System.out.println("Aktualisierung abgeschlossen für " + fnProfile.getAnmeldename() + ".");
                    } else {
                        System.out.println("Keine Abweichungen für " + fnProfile.getAnmeldename() + " gefunden.");
                    }
                } else {
                    System.out.println("Profil " + fnProfile.getAnmeldename() + " nicht im Arbeitsheft gefunden.");
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private boolean equalsTrimmed(String s1, String s2) {
        if (s1 == null)
            s1 = "";
        if (s2 == null)
            s2 = "";
        return s1.trim().equals(s2.trim());
    }

    private void updateArbeitsheftProfile(CloseableHttpClient client, Profile profile) {
        String xwikiUrl = getConfigString(XWIKI_DOMAIN, "url");
        if (!xwikiUrl.endsWith("/")) {
            xwikiUrl += "/";
        }
        String rest = getConfigString(XWIKI_DOMAIN, "rest");
        if (!rest.endsWith("/")) {
            rest += "/";
        }
        String basePropUrl = xwikiUrl + rest + "wikis/xwiki/spaces/XWiki/pages/" + profile.getAnmeldename()
                + "/objects/XWiki.XWikiUsers/0/properties/";

        updateProperty(client, basePropUrl, "first_name", profile.getVorname());
        updateProperty(client, basePropUrl, "last_name", profile.getNachname());
        updateProperty(client, basePropUrl, "schule", profile.getSchulname());
        updateProperty(client, basePropUrl, "schulort", profile.getSchulort());
    }

    private void updateProperty(CloseableHttpClient client, String baseUrl, String propName, String propValue) {
        String url = baseUrl + propName;
        HttpPut put = new HttpPut(url);
        put.setHeader("Accept", "application/json");
        put.setHeader("Content-Type", "application/json");

        String safeValue = (propValue == null) ? "" : propValue.replace("\"", "\\\"");
        String payload = String.format("{\"name\":\"%s\",\"value\":\"%s\"}", propName, safeValue);
        put.setEntity(new StringEntity(payload, StandardCharsets.UTF_8));

        try {
            client.execute(put, response -> {
                EntityUtils.consume(response.getEntity());
                return null;
            });
        } catch (Exception e) {
            System.err.println("Fehler beim Aktualisieren der Eigenschaft " + propName + ": " + e.getMessage());
        }
    }
}