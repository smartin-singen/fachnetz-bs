package fachnetz;

import org.apache.hc.client5.http.classic.methods.HttpPost;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;

import org.apache.hc.client5.http.impl.classic.HttpClientBuilder;
import org.apache.hc.core5.http.HttpEntity;
import org.apache.hc.core5.http.NameValuePair;
import org.apache.hc.core5.http.io.entity.EntityUtils;
import org.apache.hc.core5.http.message.BasicNameValuePair;
import org.apache.hc.core5.net.URIBuilder;

import java.io.IOException;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;

public class DomainMaintenanceTask extends Task<Report> {
    private String DOMAIN = "moodle";

    protected String getConfigString(String key) {
        return Configuration.getInstance().getString(DOMAIN, key);
    }

    protected Integer getConfigInteger(String key) {
        return Configuration.getInstance().getInteger(DOMAIN, key);
    }

    @Override
    public Report execute() {
        return null;
    }

    @Override
    public void run() {
        List<Profile> profiles = new Fachnetz().readProfiles();
        DomainMap domainMap = readDomainMap();
        Map<String, String> cityMap = domainMap.values().stream().collect(Collectors.toMap(DomainMap.School::getCity,
                DomainMap.School::getRp, (existing, replacement) -> existing));

        List<Profile> noschools = new ArrayList<>();
        List<Profile> patches = new ArrayList<>();
        List<Profile> normalized = new ArrayList<>();

        profiles.forEach(profile -> {
            String domain = profile.email.split("@")[1];
            DomainMap.School school = domainMap.get(domain);
            String rp = cityMap.get(profile.schulort);

            if (school == null && rp == null) {
                noschools.add(profile);
                return;
            }
            if (school != null && school.name.equals(profile.schulname) && school.city.equals(profile.schulort)
                    && school.rp.equals(profile.rp)) {
                normalized.add(profile);
                return;
            }
            if (rp != null && rp.equals(profile.rp)) {
                normalized.add(profile);
                return;
            }

            patches.add(profile);
        });

        patches.forEach(profile -> {
            String domain = profile.email.split("@")[1];
            DomainMap.School school = domainMap.get(domain);
            String rp = cityMap.get(profile.schulort);

            Map<String, String> map = new HashMap<>();
            if (school != null) {
                if (!school.name.equals(profile.schulname)) {
                    // System.out.print(" .. " + profile.schulname + " -> " + school.name);
                    map.put("Schulname", school.name);
                }
                if (!school.city.equals(profile.schulort)) {
                    // System.out.print(" .. " + profile.schulort + " -> " + school.city);
                    map.put("Schulort", school.city);
                }
                if (!school.rp.equals(profile.rp)) {
                    // System.out.print(" .. " + profile.schulort + " -> " + school.city);
                    map.put("RP", school.rp);
                }
            } else if (rp != null) {
                map.put("RP", rp);
            }
            fix(profile, map);
        });
        noschools.forEach(profile -> {
            System.out.println("no school for = " + profile.getEmail());
        });
        System.out.println("patches " + patches.size());
        System.out.println("noschools = " + noschools.size());
        System.out.println("normalized = " + normalized.size());
    }

    public DomainMap readDomainMap() {
        List<String> paths = Configuration.getInstance().getStrings("domains", "path");
        return new DomainMap(paths);
    }

    // curl -X POST "https://fachnetz-bs.zsl-bw.de/webservice/rest/server.php"
    // -d "wstoken=lalala"
    // -d "wsfunction=core_user_update_users"
    // -d "users[0][id]=108"
    // -d "users[0][customfields][0][type]=schulname"
    // -d "users[0][customfields][0][value]=12345"
    void fix(Profile profile, Map<String, String> attributes) {
        String url = getConfigString("url");
        if (!url.endsWith("/"))
            url += "/";
        String service = getConfigString("servicepath");
        String token = getConfigString("servicetoken");
        String function = getConfigString("servicefunction");

        CloseableHttpClient client = HttpClientBuilder.create().build();

        try {
            List<NameValuePair> nameValuePairs = new ArrayList<>(5);
            nameValuePairs.add(new BasicNameValuePair("wstoken", token));
            nameValuePairs.add(new BasicNameValuePair("wsfunction", function));
            nameValuePairs.add(new BasicNameValuePair("moodlewsrestformat", "json"));
            nameValuePairs.add(new BasicNameValuePair("users[0][id]", profile.getId()));
            int i = 0;
            for (Iterator<Map.Entry<String, String>> iterator = attributes.entrySet().iterator(); iterator.hasNext();) {
                Map.Entry<String, String> entry = iterator.next();
                nameValuePairs.add(new BasicNameValuePair("users[0][customfields][" + i + "][type]", entry.getKey()));
                nameValuePairs
                        .add(new BasicNameValuePair("users[0][customfields][" + i + "][value]", entry.getValue()));
                i++;
            }

            HttpPost post = new HttpPost(url + service);
            post.setUri(new URIBuilder(post.getUri()).addParameters(nameValuePairs).build());

            client.execute(post, response -> {
                HttpEntity entity = response.getEntity();
                String string = new String(entity.getContent().readAllBytes(), StandardCharsets.UTF_8);
                if (string.equals("{\"warnings\":[]}"))
                    System.out.println("fixed " + profile.getId() + ": " + profile.getAnmeldename() + " " + attributes);
                else
                    System.out.println("error " + profile.getId() + ": " + profile.getAnmeldename() + " " + string);
                EntityUtils.consume(entity);
                return null;
            });
        } catch (IOException | URISyntaxException e) {
            throw new RuntimeException(e);
        }
    }
}
