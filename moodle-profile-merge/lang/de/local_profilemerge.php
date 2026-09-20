<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Sprachstrings für local_profilemerge (Deutsch).
 *
 * @package    local_profilemerge
 * @copyright  2026 Fachnetz BS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Allgemein.
$string['pluginname'] = 'Profil-Zusammenführung';

// Dialog.
$string['dialog_title'] = 'Altes Profil importieren';
$string['dialog_body'] = 'Sie haben sich zum ersten Mal mit Ihrem neuen Konto angemeldet. Falls Sie bereits ein Moodle-Konto hatten, können Sie Ihre Kurse, Forenbeiträge und Bewertungen jetzt in Ihr neues Profil übernehmen.';
$string['merge_now'] = 'Jetzt zusammenführen';
$string['later'] = 'Später';
$string['suppress_dialog'] = 'Nach dem Login nicht mehr anzeigen';
$string['merge_available_in_menu'] = 'Sie können den Import jederzeit über Ihr Profilmenü starten.';

// Menü.
$string['menu_item'] = 'Altes Profil importieren';

// Merge-Formular.
$string['oldusername'] = 'Benutzername des alten Kontos';
$string['oldpassword'] = 'Passwort des alten Kontos';
$string['merge_explanation'] = 'Geben Sie die Zugangsdaten Ihres alten Moodle-Kontos ein. Ihre Kurse, Forenbeiträge und Bewertungen werden in Ihr neues Profil übernommen. Nach der Zusammenführung werden Sie ausgeloggt und müssen sich erneut anmelden.';

// Ergebnisse.
$string['merge_success'] = 'Ihr Profil wurde erfolgreich zusammengeführt! Bitte melden Sie sich ab und erneut über OIDC an.';
$string['merge_failed'] = 'Die Zusammenführung ist fehlgeschlagen. Bitte wenden Sie sich an den Support, falls das Problem bestehen bleibt.';
$string['old_username_saved'] = 'Der alte Benutzername wurde gesichert.';

// Validierungsfehler.
$string['invalid_credentials'] = 'Ungültige Zugangsdaten. Bitte überprüfen Sie Benutzername und Passwort.';
$string['user_suspended'] = 'Dieses Konto ist deaktiviert und kann nicht zusammengeführt werden.';
$string['user_same'] = 'Sie können Ihr Profil nicht mit sich selbst zusammenführen.';
$string['user_already_oidc'] = 'Das angegebene Konto ist bereits ein OIDC-Konto und kann nicht als Quelle verwendet werden.';
$string['not_eligible'] = 'Die Profil-Zusammenführung ist für Ihr Konto nicht verfügbar.';
$string['max_attempts_reached'] = 'Maximale Anzahl an Versuchen erreicht. Bitte wenden Sie sich an den Support.';

// Einstellungen.
$string['enabled'] = 'Plugin aktivieren';
$string['enabled_desc'] = 'Aktiviert oder deaktiviert die Profil-Zusammenführung global.';
$string['dialog_title_setting'] = 'Dialog-Titel';
$string['dialog_title_setting_desc'] = 'Der Titel, der im Zusammenführungs-Dialog nach dem Login angezeigt wird.';
$string['dialog_body_setting'] = 'Dialog-Text';
$string['dialog_body_setting_desc'] = 'Der erklärende Text im Zusammenführungs-Dialog. HTML ist erlaubt.';
$string['max_attempts_setting'] = 'Max. Fehlversuche';
$string['max_attempts_setting_desc'] = 'Maximale Anzahl fehlgeschlagener Anmeldeversuche, bevor die Zusammenführung für einen Benutzer gesperrt wird. 0 = unbegrenzt.';
$string['days_limit_setting'] = 'Zeitbegrenzung (Tage)';
$string['days_limit_setting_desc'] = 'Anzahl der Tage nach der Erstanmeldung, in denen der Zusammenführungs-Dialog angezeigt wird. 0 = unbegrenzt.';

// Datenschutz.
$string['privacy:metadata'] = 'Das Plugin Profil-Zusammenführung speichert personenbezogene Daten in seiner Protokolltabelle.';
$string['privacy:metadata:log'] = 'Protokolliert Zusammenführungen einschließlich Quell-User-ID, Ziel-User-ID und altem Benutzernamen.';
$string['privacy:metadata:log:source_userid'] = 'Die User-ID des alten Kontos, das zusammengeführt wurde.';
$string['privacy:metadata:log:target_userid'] = 'Die User-ID des neuen Kontos, das die zusammengeführten Daten erhalten hat.';
$string['privacy:metadata:log:old_username'] = 'Der Benutzername des alten Kontos.';
$string['privacy:metadata:log:timecreated'] = 'Der Zeitpunkt, zu dem die Zusammenführung durchgeführt wurde.';
