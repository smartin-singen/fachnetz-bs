package fachnetz;

import java.util.List;

public abstract class Endpoint {
    public abstract List<Profile> readProfiles();

    private long millis = System.currentTimeMillis();

    public void start() {
        millis = System.currentTimeMillis();
    }

    protected void stop(String text) {
        System.out
                .println(getClass().getSimpleName() + " " + text + " " + (System.currentTimeMillis() - millis) + "ms");
        millis = System.currentTimeMillis();
    }
}
