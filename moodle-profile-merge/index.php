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
 * Main page for profile merge operations.
 *
 * This page allows the user to enter the credentials of their old
 * Moodle account and merge it into their current OIDC profile.
 *
 * @package    local_profilemerge
 * @copyright  2026 Fachnetz BS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once(__DIR__ . '/../../config.php');

use local_profilemerge\manager;
use local_profilemerge\form\merge_form;

require_login();

$context = context_system::instance();
require_capability('local/profilemerge:merge', $context);

$PAGE->set_url(new moodle_url('/local/profilemerge/index.php'));
$PAGE->set_context($context);
$PAGE->set_title(get_string('dialog_title', 'local_profilemerge'));
$PAGE->set_heading(get_string('dialog_title', 'local_profilemerge'));
$PAGE->set_pagelayout('standard');

// Check if the current user is eligible for a merge.
if (!manager::is_merge_candidate($USER->id)) {
    redirect(
        new moodle_url('/my/'),
        get_string('not_eligible', 'local_profilemerge'),
        null,
        \core\output\notification::NOTIFY_WARNING
    );
}

// Prepare template data.
$templatedata = [
    'formhtml' => '',
    'success' => false,
    'successmessage' => '',
    'errormessage' => '',
    'logouturl' => (new moodle_url('/login/logout.php', ['sesskey' => sesskey()]))->out(false),
];

// Create the merge form.
$form = new merge_form();

if ($form->is_cancelled()) {
    redirect(new moodle_url('/my/'));
} else if ($data = $form->get_data()) {
    // Process the form submission.
    try {
        // Step 1: Validate the old account credentials.
        $olduser = manager::validate_old_credentials(
            $data->oldusername,
            $data->oldpassword,
            $USER->id
        );

        // Step 2: Execute the merge.
        $newuser = $DB->get_record('user', ['id' => $USER->id], '*', MUST_EXIST);
        manager::execute_merge($olduser, $newuser);

        // Success!
        $templatedata['success'] = true;
        $templatedata['successmessage'] = get_string('merge_success', 'local_profilemerge');
    } catch (\moodle_exception $e) {
        // Get the localised error message.
        $errorkey = $e->errorcode;
        if (get_string_manager()->string_exists($errorkey, 'local_profilemerge')) {
            $templatedata['errormessage'] = get_string($errorkey, 'local_profilemerge');
        } else {
            $templatedata['errormessage'] = $e->getMessage();
        }
    }
}

// Render the page.
echo $OUTPUT->header();

if ($templatedata['success']) {
    // Show success message with logout button.
    echo $OUTPUT->render_from_template('local_profilemerge/main', $templatedata);
} else if (!empty($templatedata['errormessage'])) {
    // Show error and form again.
    $templatedata['formhtml'] = $form->render();
    echo $OUTPUT->render_from_template('local_profilemerge/main', $templatedata);
} else {
    // Show the form.
    $templatedata['formhtml'] = $form->render();
    echo $OUTPUT->render_from_template('local_profilemerge/main', $templatedata);
}

echo $OUTPUT->footer();
