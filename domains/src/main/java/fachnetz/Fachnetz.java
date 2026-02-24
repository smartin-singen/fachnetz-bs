package fachnetz;

import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.classic.methods.HttpPost;
import org.apache.hc.client5.http.entity.UrlEncodedFormEntity;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;

import org.apache.hc.client5.http.impl.classic.HttpClientBuilder;
import org.apache.hc.core5.http.HttpEntity;
import org.apache.hc.core5.http.NameValuePair;
import org.apache.hc.core5.http.io.entity.EntityUtils;
import org.apache.hc.core5.http.message.BasicNameValuePair;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Node;
import org.jsoup.select.NodeVisitor;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

public class Fachnetz extends Endpoint {
    private String DOMAIN = "moodle";

    protected String getConfigString(String key) {
        return Configuration.getInstance().getString(DOMAIN, key);
    }

    public List<Profile> readProfiles() {
        String url = getConfigString("url");
        if (!url.endsWith("/"))
            url += "/";
        String plogin = getConfigString("plogin");
        if (plogin.startsWith("/"))
            plogin = plogin.substring(1);
        String puser = getConfigString("puser");
        if (puser.startsWith("/"))
            puser = puser.substring(1);
        String preport = getConfigString("preport");
        if (preport.startsWith("/"))
            preport = preport.substring(1);
        String user = getConfigString("user");
        String password = getConfigString("password");

        CloseableHttpClient client = HttpClientBuilder.create().build();

        start();

        List<Profile> profiles = new ArrayList<>();
        try {
            HttpGet get = new HttpGet(url + plogin);
            String token = client.execute(get, response -> {
                HttpEntity entity = response.getEntity();
                String string = new String(entity.getContent().readAllBytes(), StandardCharsets.UTF_8);
                Document document = Jsoup.parse(string);
                String t = document.body().select("input[name=logintoken]").attr("value");
                System.out.println("token = " + t);
                EntityUtils.consume(entity);
                return t;
            });

            // authentication
            List<NameValuePair> nameValuePairs = new ArrayList<>(2);
            nameValuePairs.add(new BasicNameValuePair("username", user));
            nameValuePairs.add(new BasicNameValuePair("password", password));
            nameValuePairs.add(new BasicNameValuePair("logintoken", token));

            HttpPost post = new HttpPost(url + plogin);
            post.setEntity(new UrlEncodedFormEntity(nameValuePairs));
            client.execute(post, response -> {
                HttpEntity entity = response.getEntity();
                String string = new String(entity.getContent().readAllBytes(), StandardCharsets.UTF_8);
                Document document = Jsoup.parse(string);
                EntityUtils.consume(entity);
                return null;
            });

            get = new HttpGet(url + puser);
            String sesskey = client.execute(get, response -> {
                HttpEntity entity = response.getEntity();
                String string = new String(entity.getContent().readAllBytes(), StandardCharsets.UTF_8);
                Document document = Jsoup.parse(string);
                String s = document.body().select("input[name=sesskey]").attr("value");
                System.out.println("sesskey = " + s);
                EntityUtils.consume(entity);
                return s;
            });

            // generate report
            get = new HttpGet(url + preport
                    + "?id=26&download=html&parameters=%7B%22withcheckboxes%22%3Atrue%7D&sesskey=" + sesskey);
            client.execute(get, response -> {
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
                                        el.child(2).text(),
                                        el.child(3).text(),
                                        el.child(1).text(),
                                        el.child(4).text(),
                                        el.child(5).text(),
                                        el.child(6).text());
                                String href = el.child(7).child(0).attr("href");
                                String param = href.substring(href.indexOf("?") + 1);
                                profile.id = param.substring(param.indexOf("=") + 1);
                                profiles.add(profile);
                            }
                        }
                    }
                });
                EntityUtils.consume(entity);
                return null;
            });
            return profiles;
        } catch (IOException e) {
            Logger.getLogger(getClass().getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            throw new RuntimeException(e.getMessage());
        } finally {
            stop("read students");
        }
    }
}
