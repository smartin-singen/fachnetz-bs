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

public class ArbeitsheftSyncTask extends Task<Report> {
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
    public Report execute() {
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
            String uname = p.getAnmeldename();
            if (uname != null) {
                ahMap.put(uname.toLowerCase(), p);
            }
        }

        try (CloseableHttpClient client = HttpClientBuilder.create().build()) {
            for (Profile fnProfile : fachnetzProfiles) {
                String fnUname = fnProfile.getAnmeldename();
                if (fnUname == null)
                    continue;

                Profile ahProfile = ahMap.get(fnUname.toLowerCase());
                if (ahProfile == null) {
                    // Fallback to username matching without dots
                    ahProfile = ahMap.get(fnUname.replace(".", "").toLowerCase());
                }

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
        String user = getConfigString(XWIKI_DOMAIN, "user");
        String pass = getConfigString(XWIKI_DOMAIN, "password");

        String auth = user + ":" + pass;
        String encodedAuth = java.util.Base64.getEncoder().encodeToString(auth.getBytes(StandardCharsets.UTF_8));

        String url = xwikiUrl + rest + "wikis/xwiki/spaces/XWiki/pages/" + profile.getAnmeldename()
                + "/objects/XWiki.XWikiUsers/0";

        HttpPut put = new HttpPut(url);
        put.setHeader("Accept", "application/xml");
        put.setHeader("Content-Type", "application/xml");
        put.setHeader("Authorization", "Basic " + encodedAuth);

        String safeFirst = (profile.getVorname() == null) ? ""
                : profile.getVorname().replace("<", "&lt;").replace(">", "&gt;").replace("&", "&amp;");
        String safeLast = (profile.getNachname() == null) ? ""
                : profile.getNachname().replace("<", "&lt;").replace(">", "&gt;").replace("&", "&amp;");
        String safeSchule = (profile.getSchulname() == null) ? ""
                : profile.getSchulname().replace("<", "&lt;").replace(">", "&gt;").replace("&", "&amp;");
        String safeSchulort = (profile.getSchulort() == null) ? ""
                : profile.getSchulort().replace("<", "&lt;").replace(">", "&gt;").replace("&", "&amp;");

        String xmlPayload = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n" +
                "<object xmlns=\"http://www.xwiki.org\">\n" +
                "  <className>XWiki.XWikiUsers</className>\n" +
                "  <property name=\"first_name\"><value>" + safeFirst + "</value></property>\n" +
                "  <property name=\"last_name\"><value>" + safeLast + "</value></property>\n" +
                "  <property name=\"schule\"><value>" + safeSchule + "</value></property>\n" +
                "  <property name=\"schulort\"><value>" + safeSchulort + "</value></property>\n" +
                "</object>";

        put.setEntity(new StringEntity(xmlPayload, StandardCharsets.UTF_8));

        try {
            client.execute(put, response -> {
                int statusCode = response.getCode();
                if (statusCode < 200 || statusCode >= 300) {
                    System.err.println("Warnung: Unerwarteter Status " + statusCode + " von XWiki API bei "
                            + profile.getAnmeldename());
                }
                EntityUtils.consume(response.getEntity());
                return null;
            });
        } catch (Exception e) {
            System.err.println("Fehler beim Aktualisieren der Eigenschaften für " + profile.getAnmeldename() + ": "
                    + e.getMessage());
        }
    }
}