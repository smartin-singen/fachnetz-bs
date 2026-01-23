package fachnetz;

import com.opencsv.CSVReader;
import com.opencsv.exceptions.CsvValidationException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

public class DomainMap
    extends HashMap<String, DomainMap.School>
{
    Set<String> doubles = new HashSet<>();

    public DomainMap(List<String> paths) {
        CSVReader reader = null;
        try {
            for (String path : paths) {
                reader = new CSVReader(Files.newBufferedReader(Path.of(path)));
                reader.readNext();
                reader.forEach(line -> {
                    School school = new School(line[0].trim(), line[1].trim(), line[line.length-1].trim());
                    for (int i=2; i<line.length-1; i++) {
                        line[i] = line[i].trim();
                        if (line[i].isEmpty())
                            continue;
                        if (doubles.contains(line[i].trim()))
                            continue;
                        if (containsKey(line[i].trim())) {
                            doubles.add(line[i].trim());
                            remove(line[i].trim());
                            System.out.println("double " + line[i].trim());
                        }
                        else
                            put(line[i].trim(), school);
                    }
                });
            }
        }
        catch (IOException | CsvValidationException e) {
            throw new RuntimeException(e);
        }
    }

    static class School {
        String name;
        String city;
        String rp;

        public School(String name, String city, String rp) {
            this.name = name;
            this.city = city;
            this.rp = rp;
        }

        public String getName() {
            return name;
        }

        public String getCity() {
            return city;
        }

        public String getRp() {
            return rp;
        }

        @Override
        public String toString() {
            return name + ", " + city;
        }
    }
}
