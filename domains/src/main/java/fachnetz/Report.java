package fachnetz;

import java.util.*;

/**
 * Created by holger on 25.01.17.
 */
public class Report
        extends ArrayList<Map.Entry<String, Object>> {
    public Report() {
        add(new AbstractMap.SimpleEntry<>("Zeitstempel", System.currentTimeMillis()));
    }

    public void add(String key, Object value) {
        add(new AbstractMap.SimpleEntry<>(key, value));
    }
}
