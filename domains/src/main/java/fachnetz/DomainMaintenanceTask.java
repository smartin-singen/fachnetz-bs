package fachnetz;

import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.classic.methods.HttpPost;
import org.apache.hc.client5.http.entity.UrlEncodedFormEntity;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.CloseableHttpResponse;
import org.apache.hc.client5.http.impl.classic.HttpClientBuilder;
import org.apache.hc.core5.http.HttpEntity;
import org.apache.hc.core5.http.NameValuePair;
import org.apache.hc.core5.http.io.entity.EntityUtils;
import org.apache.hc.core5.http.message.BasicNameValuePair;
import org.apache.hc.core5.net.URIBuilder;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Node;
import org.jsoup.select.NodeVisitor;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.logging.Level;
import java.util.logging.Logger;

public class DomainMaintenanceTask extends Task {
    private String DOMAIN = "moodle";

    protected String getConfigString(String key) {
        return Configuration.getInstance().getString(DOMAIN, key);
    }
    protected Integer getConfigInteger(String key) {
        return Configuration.getInstance().getInteger(DOMAIN, key);
    }

    private long millis = System.currentTimeMillis();

    public void start() {
        millis = System.currentTimeMillis();
    }

    protected void stop(String text) {
        System.out.println(getClass().getSimpleName() + " " + text + " " + (System.currentTimeMillis() - millis) + "ms");
        millis = System.currentTimeMillis();
    }

    @Override
    public Object execute() {
        return null;
    }

    @Override
    public void run() {
        List<Profile> profiles = readProfiles();
        DomainMap domainMap = readDomainMap();

        List<Profile> noschools = new ArrayList<>();
        List<Profile> patches = new ArrayList<>();
        List<Profile> normalized = new ArrayList<>();

        profiles.forEach(profile -> {
            String domain = profile.email.split("@")[1];
            DomainMap.School school = domainMap.get(domain);
            if (school == null) {
                noschools.add(profile);
                return;
            }
            if (school.name.equals(profile.schulname) && school.city.equals(profile.schulort) && school.rp.equals(profile.rp)) {
                normalized.add(profile);
                return;
            }

            patches.add(profile);
        });

        patches.forEach(profile -> {
            String domain = profile.email.split("@")[1];
            DomainMap.School school = domainMap.get(domain);

            //System.out.print(profile.email);
            Map<String, String> map = new HashMap<>();
            if (!school.name.equals(profile.schulname)) {
                //System.out.print(" .. " + profile.schulname + " -> " + school.name);
                map.put("Schulname", school.name);
            }
            if (!school.city.equals(profile.schulort)) {
                //System.out.print(" .. " + profile.schulort + " -> " + school.city);
                map.put("Schulort", school.city);
            }
            if (!school.rp.equals(profile.rp)) {
                //System.out.print(" .. " + profile.schulort + " -> " + school.city);
                map.put("RP", school.rp);
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

    public List<Profile> readProfiles() {
        String url = getConfigString("url"); if (!url.endsWith("/")) url += "/";
        String plogin = getConfigString("plogin"); if (plogin.startsWith("/")) plogin = plogin.substring(1);
        String puser = getConfigString("puser"); if (puser.startsWith("/")) puser = puser.substring(1);
        String preport = getConfigString("preport"); if (preport.startsWith("/")) preport = preport.substring(1);
        String user = getConfigString("user");
        String password = getConfigString("password");

        CloseableHttpClient client = HttpClientBuilder.create().build();

        start();

        List<Profile> profiles = new ArrayList<>();
        try {
            String token = null;
            HttpGet get = new HttpGet(url + plogin);
            try (final CloseableHttpResponse response = client.execute(get)) {
                HttpEntity entity = response.getEntity();
                String string = new String(entity.getContent().readAllBytes(), StandardCharsets.UTF_8);
                Document document = Jsoup.parse(string);
                token = document.body().select("input[name=logintoken]").attr("value");
                System.out.println("token = " + token);
                EntityUtils.consume(entity);
            }

            // authentication
            List<NameValuePair> nameValuePairs = new ArrayList<>(2);
            nameValuePairs.add(new BasicNameValuePair("username", user));
            nameValuePairs.add(new BasicNameValuePair("password", password));
            nameValuePairs.add(new BasicNameValuePair("logintoken", token));

            HttpPost post = new HttpPost(url + plogin);
            post.setEntity(new UrlEncodedFormEntity(nameValuePairs));
            try (final CloseableHttpResponse response = client.execute(post)) {
                HttpEntity entity = response.getEntity();
                String string = new String(entity.getContent().readAllBytes(), StandardCharsets.UTF_8);
                Document document = Jsoup.parse(string);
            }

            String sesskey = null;
            get = new HttpGet(url + puser);
            try (final CloseableHttpResponse response = client.execute(get)) {
                HttpEntity entity = response.getEntity();
                String string = new String(entity.getContent().readAllBytes(), StandardCharsets.UTF_8);
                Document document = Jsoup.parse(string);
                sesskey = document.body().select("input[name=sesskey]").attr("value");
                System.out.println("sesskey = " + sesskey);
                EntityUtils.consume(entity);
            }

            // generate report
            get = new HttpGet(url + preport + "?id=26&download=html&parameters=%7B%22withcheckboxes%22%3Atrue%7D&sesskey=" + sesskey);
            try (final CloseableHttpResponse response = client.execute(get)) {
                HttpEntity entity = response.getEntity();
                String string = new String(entity.getContent().readAllBytes(), StandardCharsets.UTF_8);

                Document document = Jsoup.parse(string);
                document.traverse(new NodeVisitor() {
                    boolean first = true;
                    @Override
                    public void head(Node node, int depth) {
                        if (node instanceof Element) {
                            Element el = (Element) node;
                            if (el.tagName().equals("tr")) {
                                if (first) {
                                    first = false;
                                    return;
                                }
                                Profile profile = new Profile(
                                        el.child(0).text(),
                                        el.child(1).text(),
                                        el.child(2).text(),
                                        el.child(3).text(),
                                        el.child(5).text());
                                String href = el.child(4).child(0).attr("href");
                                String param = href.substring(href.indexOf("?") + 1);
                                profile.id = param.substring(param.indexOf("=") + 1);
                                profiles.add(profile);
                            }
                        }
                    }
                });
                return profiles;
            }
        }
        catch (IOException e) {
            Logger.getLogger(getClass().getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            throw new RuntimeException(e.getMessage());
        }
        finally {
            stop("read students");
        }
    }

    public DomainMap readDomainMap() {
        List<String> paths = Configuration.getInstance().getStrings("domains", "path");
        return new DomainMap(paths);
    }

    //curl -X POST "https://fachnetz-bs.zsl-bw.de/webservice/rest/server.php"
    // -d "wstoken=lalala"
    // -d "wsfunction=core_user_update_users"
    // -d "users[0][id]=108"
    // -d "users[0][customfields][0][type]=schulname"
    // -d "users[0][customfields][0][value]=12345"
    void fix(Profile profile, Map<String,String> attributes) {
        String url = getConfigString("url"); if (!url.endsWith("/")) url += "/";
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
            int i=0;
            for (Iterator<Map.Entry<String, String>> iterator = attributes.entrySet().iterator(); iterator.hasNext(); ) {
                Map.Entry<String, String> entry = iterator.next();
                nameValuePairs.add(new BasicNameValuePair("users[0][customfields][" + i + "][type]", entry.getKey()));
                nameValuePairs.add(new BasicNameValuePair("users[0][customfields][" + i + "][value]", entry.getValue()));
                i++;
            }

            HttpPost post = new HttpPost(url + service);
            post.setUri(new URIBuilder(post.getUri()).addParameters(nameValuePairs).build());

            try (final CloseableHttpResponse response = client.execute(post)) {
                HttpEntity entity = response.getEntity();
                String string = new String(entity.getContent().readAllBytes(), StandardCharsets.UTF_8);
                if (string.equals("{\"warnings\":[]}"))
                    System.out.println("fixed " + profile.getId() + ": " + profile.getAnmeldename() + " " + attributes);
                else
                    System.out.println("error " + profile.getId() + ": " + profile.getAnmeldename() + " " + string);
                EntityUtils.consume(entity);
            }
        } catch (IOException | URISyntaxException e) {
            throw new RuntimeException(e);
        }
    }
}
