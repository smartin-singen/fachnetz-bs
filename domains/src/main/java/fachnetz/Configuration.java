package fachnetz;

import com.google.gson.*;
import com.google.gson.stream.JsonReader;

import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;
import java.io.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.StreamSupport;

/**
 * Created by holger on 22.10.16.
 */
public class Configuration {
    private static Configuration INSTANCE = null;

    private JsonObject config;
    private JsonObject settings;
    private String configPath;
    private String settingsPath;

    public Configuration() {}

    public synchronized static Configuration getInstance() {
        if (INSTANCE == null)
            INSTANCE = new Configuration();

        return INSTANCE;
    }

    public void setConfigPath(String configPath) {
        this.configPath = configPath;
        testSSLConnection();
    }

    public void invalidate() {
        config = null;
    }

    public String getString(String domain, String key) {
        ensureConfig();
        JsonElement jsonElement = config.getAsJsonObject(domain).get(key);
        if (jsonElement == null || jsonElement.isJsonNull()) {
            System.err.println("WARNING: Property " + key + " is not configured");
            return null;
        }
        else
            return jsonElement.getAsString();
    }

    public List<String> getStrings(String domain, String key) {
        ensureConfig();
        JsonElement jsonElement = config.getAsJsonObject(domain).get(key);
        if (jsonElement == null || jsonElement.isJsonNull()) {
            System.err.println("WARNING: Property " + key + " is not configured");
            return null;
        }
        else
            return StreamSupport.stream(jsonElement.getAsJsonArray().spliterator(), false).map(JsonElement::getAsString).toList();
    }

    public Integer getInteger(String domain, String key) {
        ensureConfig();
        JsonElement jsonElement = config.getAsJsonObject(domain).get(key);
        if (jsonElement == null || jsonElement.isJsonNull()) {
            System.err.println("WARNING: Property " + key + " is not configured");
            return null;
        }
        else
            return jsonElement.getAsInt();
    }

    public JsonObject getConfig() {
        ensureConfig();
        return config;
    }

    private void ensureConfig() {
        if (config == null) {
            FileReader reader = null;
            try {
                reader = new FileReader(configPath);
                config = new Gson().fromJson(new JsonReader(reader), JsonObject.class);
                applySettings();
            }
            catch (FileNotFoundException e) {
                e.printStackTrace();
            }
        }
    }

    private void applySettings() throws FileNotFoundException {
        settingsPath = getString("settings", "path");
        FileReader reader = new FileReader(settingsPath);
        settings = new Gson().fromJson(new JsonReader(reader), JsonObject.class);

        for (Map.Entry<String, JsonElement> entry : settings.entrySet()) {
            if (entry.getValue() instanceof JsonObject) {
                JsonObject settingsPart = (JsonObject) entry.getValue();
                JsonObject configPart = config.getAsJsonObject(entry.getKey());
                if (configPart == null) {
                    configPart = new JsonObject();
                    config.add(entry.getKey(), configPart);
                }
                for (Map.Entry<String, JsonElement> partEntry : settingsPart.entrySet()) {
                    configPart.add(partEntry.getKey(), partEntry.getValue());
                }
            }
            else if (entry.getValue() instanceof JsonArray) {
                JsonArray settingsPart = (JsonArray) entry.getValue();
                JsonArray configPart = new JsonArray();
                config.add(entry.getKey(), configPart);
                configPart.addAll(settingsPart);
            }
        }
        System.out.println("### ### ###");
        System.out.println("config in effect\n" + config);
    }

    public void writeSettings(JsonObject settings) {
        try {
            FileWriter writer = new FileWriter(settingsPath);
            writer.write(new GsonBuilder().setPrettyPrinting().create().toJson(settings));
            writer.close();
            this.settings = settings;
            applySettings();
            ScheduleManager.getInstance().rescheduleBackgroundJobs();
        }
        catch (IOException e) {
            e.printStackTrace();
        }
    }

    public JsonObject readSettings() {
        ensureConfig();
        return settings;
    }

    // echo -n | openssl s_client -connect dc01:636 | sed -ne '/-BEGIN CERTIFICATE-/,/-END CERTIFICATE-/p' > ldapserver.pem
    protected void testSSLConnection() {
        List<String> urls = getStrings("ssl", "urls");
        if (urls != null) {
            urls.forEach(url -> {
                try {
                    int pos = url.indexOf(":");
                    String host = url.substring(0, pos);
                    String port = url.substring(pos + 1);
                    System.out.println("host = " + host);
                    System.out.println("port = " + port);
                    System.out.println("trustStore = " + System.getProperty("javax.net.ssl.trustStore"));

                    SSLSocketFactory sslsocketfactory = (SSLSocketFactory) SSLSocketFactory.getDefault();
                    InputStream in;
                    OutputStream out;
                    try (SSLSocket sslsocket = (SSLSocket) sslsocketfactory.createSocket(host, Integer.parseInt(port))) {
                        in = sslsocket.getInputStream();
                        out = sslsocket.getOutputStream();
                        out.write(1);
                    }
                    while (in.available() > 0) {
                        System.out.print(in.read());
                    }
                    System.out.println("Successfully connected " + url);
                }
                catch (Exception exception) {
                    System.out.println("Error connecting " + url);
                    exception.printStackTrace();
                }
            });
        }
    }
}
