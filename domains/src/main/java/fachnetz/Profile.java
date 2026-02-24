package fachnetz;

public class Profile {
    public String id;
    String anmeldename;
    String vorname;
    String nachname;
    String email;
    String schulname;
    String schulort;
    String rp;

    public Profile(String anmeldename, String vorname, String nachname, String email, String schulname, String schulort,
            String rp) {
        this.anmeldename = anmeldename;
        this.vorname = vorname;
        this.nachname = nachname;
        this.email = email;
        this.schulname = schulname;
        this.schulort = schulort;
        this.rp = rp;
    }

    public String getId() {
        return id;
    }

    public String getAnmeldename() {
        return anmeldename;
    }

    public String getVorname() {
        return vorname;
    }

    public String getNachname() {
        return nachname;
    }

    public String getEmail() {
        return email;
    }

    public String getSchulname() {
        return schulname;
    }

    public String getSchulort() {
        return schulort;
    }

    public String getRp() {
        return rp;
    }

    @Override
    public String toString() {
        return email;
    }
}
