package fachnetz;

import java.util.List;

/**
 * Hello world!
 *
 */
public class App 
{
    public static void main( String[] args ) {
        Configuration.getInstance().setConfigPath(args[0]);
        //ScheduleManager.getInstance().rescheduleBackgroundJobs();
        DomainMaintenanceTask maintenanceTask = new DomainMaintenanceTask();
        maintenanceTask.run();
    }
}
