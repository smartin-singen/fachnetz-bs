package fachnetz;

import java.util.HashMap;

/**
 * Created by holger on 25.01.17.
 */
public class Report
    extends HashMap<String, Object>
{
    public Report() {
        put("timestamp", System.currentTimeMillis());
    }
}
