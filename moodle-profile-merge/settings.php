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
 * Plugin settings for local_profilemerge.
 *
 * @package    local_profilemerge
 * @copyright  2026 Fachnetz BS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

if ($hassiteconfig) {
    $settings = new admin_settingpage('local_profilemerge',
        get_string('pluginname', 'local_profilemerge'));
    $ADMIN->add('localplugins', $settings);

    // Enable/disable the plugin.
    $settings->add(new admin_setting_configcheckbox(
        'local_profilemerge/enabled',
        get_string('enabled', 'local_profilemerge'),
        get_string('enabled_desc', 'local_profilemerge'),
        1 // Enabled by default.
    ));

    // Dialog title (configurable text).
    $settings->add(new admin_setting_configtext(
        'local_profilemerge/dialog_title',
        get_string('dialog_title_setting', 'local_profilemerge'),
        get_string('dialog_title_setting_desc', 'local_profilemerge'),
        get_string('dialog_title', 'local_profilemerge')
    ));

    // Dialog body text (configurable, HTML allowed).
    $settings->add(new admin_setting_configtextarea(
        'local_profilemerge/dialog_body',
        get_string('dialog_body_setting', 'local_profilemerge'),
        get_string('dialog_body_setting_desc', 'local_profilemerge'),
        get_string('dialog_body', 'local_profilemerge')
    ));

    // Maximum failed merge attempts (brute-force protection).
    $settings->add(new admin_setting_configtext(
        'local_profilemerge/max_attempts',
        get_string('max_attempts_setting', 'local_profilemerge'),
        get_string('max_attempts_setting_desc', 'local_profilemerge'),
        5,
        PARAM_INT
    ));

    // Time limit in days (0 = unlimited).
    $settings->add(new admin_setting_configtext(
        'local_profilemerge/days_limit',
        get_string('days_limit_setting', 'local_profilemerge'),
        get_string('days_limit_setting_desc', 'local_profilemerge'),
        0,
        PARAM_INT
    ));
}
