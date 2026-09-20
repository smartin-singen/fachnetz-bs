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
 * Library functions for local_profilemerge.
 *
 * This file is automatically loaded by Moodle core. It provides:
 * - before_footer hook: shows the merge dialog on the dashboard for OIDC users.
 * - extend_navigation hook: adds "Import old profile" to the avatar/user menu.
 *
 * @package    local_profilemerge
 * @copyright  2026 Fachnetz BS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

/**
 * Hook: Inject the merge dialog on the dashboard page.
 *
 * Called by Moodle before rendering the page footer. If the current user
 * is a merge candidate and has not suppressed the dialog, this loads
 * the merge_dialog AMD module which opens a modal.
 */
function local_profilemerge_before_footer() {
    global $PAGE, $USER;

    // Only show on the dashboard page.
    if ($PAGE->pagetype !== 'my-index') {
        return;
    }

    // Must be logged in.
    if (!isloggedin() || isguestuser()) {
        return;
    }

    // Check if user is a merge candidate.
    if (!\local_profilemerge\manager::is_merge_candidate($USER->id)) {
        return;
    }

    // Check if user has suppressed the dialog.
    if (get_user_preferences('local_profilemerge_suppress_dialog', false)) {
        return;
    }

    // Load configurable dialog texts.
    $dialogtitle = get_config('local_profilemerge', 'dialog_title');
    if (empty($dialogtitle)) {
        $dialogtitle = get_string('dialog_title', 'local_profilemerge');
    }

    $dialogbody = get_config('local_profilemerge', 'dialog_body');
    if (empty($dialogbody)) {
        $dialogbody = get_string('dialog_body', 'local_profilemerge');
    }

    // Load the merge dialog AMD module with configuration.
    $PAGE->requires->js_call_amd('local_profilemerge/merge_dialog', 'init', [[
        'mergeUrl' => (new moodle_url('/local/profilemerge/index.php'))->out(false),
        'dialogTitle' => $dialogtitle,
        'dialogBody' => format_text($dialogbody, FORMAT_HTML),
        'suppressLabel' => get_string('suppress_dialog', 'local_profilemerge'),
        'mergeNowLabel' => get_string('merge_now', 'local_profilemerge'),
        'laterLabel' => get_string('later', 'local_profilemerge'),
        'menuHint' => get_string('merge_available_in_menu', 'local_profilemerge'),
    ]]);
}

/**
 * Hook: Add "Import old profile" to the user navigation (avatar menu).
 *
 * This makes the merge page accessible even when the dialog has been
 * suppressed. The menu item is only shown for merge candidates.
 *
 * @param navigation_node $parentnode The parent navigation node.
 * @param stdClass $user The user object.
 * @param context_user $usercontext The user context.
 * @param stdClass $course The course object.
 * @param context_course $coursecontext The course context.
 */
function local_profilemerge_extend_navigation_user_settings(navigation_node $parentnode,
                                                              stdClass $user,
                                                              context_user $usercontext,
                                                              stdClass $course,
                                                              context_course $coursecontext) {
    global $USER;

    // Only show for the current user viewing their own settings.
    if ($user->id !== $USER->id) {
        return;
    }

    // Check if user is a merge candidate.
    if (!\local_profilemerge\manager::is_merge_candidate($USER->id)) {
        return;
    }

    // Add the navigation node.
    $url = new moodle_url('/local/profilemerge/index.php');
    $node = navigation_node::create(
        get_string('menu_item', 'local_profilemerge'),
        $url,
        navigation_node::TYPE_SETTING,
        null,
        'local_profilemerge_merge',
        new pix_icon('i/reload', '')
    );
    $parentnode->add_node($node);
}

/**
 * Hook: Add "Import old profile" to the flat navigation / user menu.
 *
 * This hook is used on Moodle 4.x+ to add items to the user menu
 * that appears when clicking on the user avatar.
 *
 * @param global_navigation $navigation The global navigation object.
 */
function local_profilemerge_extend_navigation(global_navigation $navigation) {
    global $USER, $PAGE;

    // Must be logged in.
    if (!isloggedin() || isguestuser()) {
        return;
    }

    // Check if user is a merge candidate.
    if (!\local_profilemerge\manager::is_merge_candidate($USER->id)) {
        return;
    }

    // Add to the user menu section of the navigation.
    $url = new moodle_url('/local/profilemerge/index.php');
    $node = $navigation->add(
        get_string('menu_item', 'local_profilemerge'),
        $url,
        navigation_node::TYPE_CUSTOM,
        null,
        'local_profilemerge_merge',
        new pix_icon('i/reload', '')
    );
    $node->showinflatnavigation = true;
}
