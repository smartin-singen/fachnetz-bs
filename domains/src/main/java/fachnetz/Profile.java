package fachnetz;

public class Profile {
    public String id;
    String anmeldename;
    String email;
    String schulname;
    String schulort;
    String rp;

    public Profile(String anmeldename, String email, String schulname, String schulort, String rp) {
        this.anmeldename = anmeldename;
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
