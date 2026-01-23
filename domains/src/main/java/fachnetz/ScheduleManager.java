package fachnetz;

import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.lang.reflect.InvocationTargetException;
import java.util.*;

public class ScheduleManager {
    public static final Map<String, Class<? extends Task>> TASKS = new HashMap<>();
    static {
        ScheduleManager.TASKS.put("domain-maintenance", DomainMaintenanceTask.class);
    }

    private Map<Class, Task> tasks = new HashMap<>();
    private String oldConfig;
    private List<TaskScheduler> schedulers = new ArrayList<>();
    private Map<String, Report> reports = Collections.synchronizedMap(new HashMap<>());

    public synchronized <S extends Task> S getTask(Class<S> clazz) {
        System.out.println("task " + clazz.getSimpleName());
        return (S)tasks.computeIfAbsent(clazz, s -> createTask(clazz));
    }

    protected <G extends Task> G createTask(Class<G> clazz) {
        try {
            G instance = clazz.getConstructor().newInstance();
            return instance;
        }
        catch (IllegalAccessException | InstantiationException | NoSuchMethodException | InvocationTargetException e) {
            e.printStackTrace();
            throw new RuntimeException(e);
        }
    }

    private static ScheduleManager INSTANCE = null;
    private boolean initialized = false;

    public synchronized static ScheduleManager getInstance() {
        if (INSTANCE == null)
            INSTANCE = new ScheduleManager();

        return INSTANCE;
    }

    public synchronized void rescheduleBackgroundJobs() {
        JsonArray array = Configuration.getInstance().getConfig().getAsJsonArray("task-scheduler");
        String newConfig = new GsonBuilder().setPrettyPrinting().create().toJson(array);
        System.out.println("initialize schedules from " + newConfig);
        if (newConfig.equals(oldConfig))
            return;

        for (TaskScheduler scheduler : this.schedulers) {
            scheduler.stop();
        }
        this.schedulers.clear();

        for (JsonElement element : array) {
            JsonObject object = (JsonObject)element;
            Map.Entry<String, JsonElement> line = object.entrySet().iterator().next();
            String key = line.getKey();
            String time = line.getValue().getAsString();
            int hour = Integer.parseInt(time.split(":")[0]);
            int minute = Integer.parseInt(time.split(":")[1]);
            Class<? extends Task> clazz = TASKS.get(key);
            if (clazz == null)
                System.out.println(".. not found in\n" + TASKS);
            Task<Report> task = getTask(clazz);
            TaskScheduler scheduler = new TaskScheduler(key, task);
            scheduler.startExecutionAt(hour, minute, 0);
            schedulers.add(scheduler);
            System.out.println("schedule " + key + " for " + time);
        }
        oldConfig = newConfig;
    }

    public void report(String name, Report report) {
        reports.put(name, report);
    }
}
