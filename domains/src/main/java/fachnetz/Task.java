package fachnetz;

import java.io.PrintStream;
import java.util.List;

/**
 * Created by holger on 21.12.14.
 */
public abstract class Task<T>
    implements Runnable
{
    protected PrintStream output = System.out;

    public void setOutput(PrintStream output) {
        this.output = output;
    }

    public abstract T execute();
}
