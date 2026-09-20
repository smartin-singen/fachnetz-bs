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
 * Language strings for local_profilemerge.
 *
 * @package    local_profilemerge
 * @copyright  2026 Fachnetz BS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// General.
$string['pluginname'] = 'Profile Merge';

// Dialog.
$string['dialog_title'] = 'Import old profile';
$string['dialog_body'] = 'You have logged in with your new account for the first time. If you already had a Moodle account, you can now import your courses, forum posts and grades into your new profile.';
$string['merge_now'] = 'Merge now';
$string['later'] = 'Later';
$string['suppress_dialog'] = 'Don\'t show again after login';
$string['merge_available_in_menu'] = 'You can start the import anytime from your profile menu.';

// Menu.
$string['menu_item'] = 'Import old profile';

// Merge form.
$string['oldusername'] = 'Old account username';
$string['oldpassword'] = 'Old account password';
$string['merge_explanation'] = 'Enter the credentials of your old Moodle account. Your courses, forum posts and grades will be transferred to your new profile. After the merge you will be logged out and need to sign in again.';

// Results.
$string['merge_success'] = 'Your profile has been successfully merged! Please log out and sign in again via OIDC.';
$string['merge_failed'] = 'The merge has failed. Please contact support if the problem persists.';
$string['old_username_saved'] = 'The old username has been saved.';

// Validation errors.
$string['invalid_credentials'] = 'Invalid credentials. Please check username and password.';
$string['user_suspended'] = 'This account is suspended and cannot be merged.';
$string['user_same'] = 'You cannot merge your profile with yourself.';
$string['user_already_oidc'] = 'The specified account is already an OIDC account and cannot be used as a source.';
$string['not_eligible'] = 'Profile merge is not available for your account.';
$string['max_attempts_reached'] = 'Maximum number of attempts reached. Please contact support.';

// Settings.
$string['enabled'] = 'Enable plugin';
$string['enabled_desc'] = 'Enable or disable the profile merge feature globally.';
$string['dialog_title_setting'] = 'Dialog title';
$string['dialog_title_setting_desc'] = 'The title displayed in the merge dialog after login.';
$string['dialog_body_setting'] = 'Dialog text';
$string['dialog_body_setting_desc'] = 'The explanatory text displayed in the merge dialog. HTML is allowed.';
$string['max_attempts_setting'] = 'Max. failed attempts';
$string['max_attempts_setting_desc'] = 'Maximum number of failed login attempts before the merge feature is locked for a user. Set to 0 for unlimited.';
$string['days_limit_setting'] = 'Time limit (days)';
$string['days_limit_setting_desc'] = 'Number of days after first login during which the merge dialog is shown. Set to 0 for unlimited.';

// Privacy.
$string['privacy:metadata'] = 'The Profile Merge plugin stores personal data in its log table.';
$string['privacy:metadata:log'] = 'Logs merge operations including source user ID, target user ID and old username.';
$string['privacy:metadata:log:source_userid'] = 'The user ID of the old account that was merged.';
$string['privacy:metadata:log:target_userid'] = 'The user ID of the new account that received the merged data.';
$string['privacy:metadata:log:old_username'] = 'The username of the old account.';
$string['privacy:metadata:log:timecreated'] = 'The time when the merge was performed.';
