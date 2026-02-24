package fachnetz;

/**
 * Hello world!
 *
 */
public class App {
    public static void main(String[] args) {
        Configuration.getInstance().setConfigPath(args[0]);
        // ScheduleManager.getInstance().rescheduleBackgroundJobs();

        // new ArbeitsheftSyncTask().run();
        new ArbeitsheftStatsTask().run();
        // new DomainMaintenanceTask().run();
    }
}
