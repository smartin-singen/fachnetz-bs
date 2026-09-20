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

namespace local_profilemerge;

defined('MOODLE_INTERNAL') || die();

/**
 * Profile merge manager class.
 *
 * Contains the core business logic for merging user profiles.
 * Orchestrates credential validation, user merging via tool_mergeusers,
 * old account suspension, and merge logging.
 *
 * @package    local_profilemerge
 * @copyright  2026 Fachnetz BS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class manager {

    /**
     * Check whether the given user is a merge candidate.
     *
     * A user is a merge candidate when:
     * 1. The plugin is enabled.
     * 2. The user authenticates via OIDC.
     * 3. The user has not already performed a successful merge.
     * 4. The optional time limit (days since first access) has not expired.
     *
     * @param int $userid The user ID to check.
     * @return bool True if the user is eligible for a profile merge.
     */
    public static function is_merge_candidate(int $userid): bool {
        global $DB;

        // Check if plugin is enabled.
        if (!get_config('local_profilemerge', 'enabled')) {
            return false;
        }

        // Get user record.
        $user = $DB->get_record('user', ['id' => $userid], 'id, auth, firstaccess, suspended, deleted');
        if (!$user || $user->suspended || $user->deleted) {
            return false;
        }

        // Must be an OIDC-authenticated user.
        if ($user->auth !== 'oidc') {
            return false;
        }

        // Check if the user has already performed a successful merge.
        if ($DB->record_exists('local_profilemerge_log', ['target_userid' => $userid, 'status' => 'success'])) {
            return false;
        }

        // Check optional time limit (days since first access).
        $dayslimit = (int) get_config('local_profilemerge', 'days_limit');
        if ($dayslimit > 0 && $user->firstaccess > 0) {
            $deadline = $user->firstaccess + ($dayslimit * DAYSECS);
            if (time() > $deadline) {
                return false;
            }
        }

        return true;
    }

    /**
     * Validate the credentials of the old user account.
     *
     * Uses Moodle's authenticate_user_login() to verify the credentials.
     * Performs additional checks: account must not be suspended/deleted,
     * must not be the same as the current user, and must not use OIDC auth.
     *
     * @param string $username The username of the old account.
     * @param string $password The password of the old account.
     * @param int $currentuserid The ID of the currently logged-in user.
     * @return object|null The old user object on success, or null with error info.
     * @throws \moodle_exception With a specific error string key on failure.
     */
    public static function validate_old_credentials(string $username, string $password, int $currentuserid): object {
        global $DB;

        // Check max attempts (brute-force protection).
        $maxattempts = (int) get_config('local_profilemerge', 'max_attempts');
        if ($maxattempts > 0) {
            $failedcount = self::get_failed_attempts($currentuserid);
            if ($failedcount >= $maxattempts) {
                throw new \moodle_exception('max_attempts_reached', 'local_profilemerge');
            }
        }

        // Use Moodle's authentication API to verify credentials.
        // This works against all enabled auth plugins (manual, ldap, db, etc.).
        $olduser = authenticate_user_login($username, $password, false, $reason, false);

        if (!$olduser) {
            // Log the failed attempt.
            self::log_merge(0, $currentuserid, $username, 'unknown', 'failed');
            throw new \moodle_exception('invalid_credentials', 'local_profilemerge');
        }

        // Ensure the old user is not the same as the current user.
        if ((int) $olduser->id === $currentuserid) {
            throw new \moodle_exception('user_same', 'local_profilemerge');
        }

        // Ensure the old user is not suspended.
        if ($olduser->suspended) {
            throw new \moodle_exception('user_suspended', 'local_profilemerge');
        }

        // Ensure the old user is not using OIDC auth (must be a non-OIDC account).
        if ($olduser->auth === 'oidc') {
            throw new \moodle_exception('user_already_oidc', 'local_profilemerge');
        }

        return $olduser;
    }

    /**
     * Save the old username in the new user's custom profile field.
     *
     * Stores the old username in the custom profile field 'old_moodle_username'
     * so that dependent systems can reference the old user identity.
     *
     * @param object $olduser The old user object.
     * @param object $newuser The new (OIDC) user object.
     */
    public static function save_old_username(object $olduser, object $newuser): void {
        global $DB;

        // Find the custom profile field 'old_moodle_username'.
        $field = $DB->get_record('user_info_field', ['shortname' => 'old_moodle_username']);
        if (!$field) {
            // Field does not exist; skip silently but log a debugging message.
            debugging('Custom profile field "old_moodle_username" not found. ' .
                      'Create it under Site Admin → Users → Profile Fields.', DEBUG_DEVELOPER);
            return;
        }

        // Check if a value already exists for this user.
        $existing = $DB->get_record('user_info_data', [
            'userid' => $newuser->id,
            'fieldid' => $field->id,
        ]);

        $value = $olduser->username;

        if ($existing) {
            // Append if there's already a value (unlikely but safe).
            if (!empty($existing->data) && $existing->data !== $value) {
                $value = $existing->data . ', ' . $value;
            }
            $existing->data = $value;
            $existing->dataformat = 0;
            $DB->update_record('user_info_data', $existing);
        } else {
            $record = new \stdClass();
            $record->userid = $newuser->id;
            $record->fieldid = $field->id;
            $record->data = $value;
            $record->dataformat = 0;
            $DB->insert_record('user_info_data', $record);
        }
    }

    /**
     * Execute the profile merge via tool_mergeusers.
     *
     * This is the main merge operation. It:
     * 1. Saves the old username in the new profile.
     * 2. Calls tool_mergeusers to migrate all data (courses, forum posts, grades, etc.).
     * 3. Suspends the old user account.
     * 4. Logs the result.
     *
     * @param object $olduser The old user object (source – data flows FROM here).
     * @param object $newuser The new OIDC user object (target – data flows TO here).
     * @return bool True on success.
     * @throws \moodle_exception On failure.
     */
    public static function execute_merge(object $olduser, object $newuser): bool {
        global $CFG;

        // Step 1: Save old username in the new user's profile field.
        self::save_old_username($olduser, $newuser);

        // Step 2: Load and call tool_mergeusers.
        $mergetoolpath = $CFG->dirroot . '/admin/tool/mergeusers/lib/mergeusertool.php';
        if (!file_exists($mergetoolpath)) {
            self::log_merge((int) $olduser->id, (int) $newuser->id,
                            $olduser->username, $olduser->auth, 'failed');
            throw new \moodle_exception('merge_failed', 'local_profilemerge');
        }

        require_once($mergetoolpath);

        try {
            $mut = new \MergeUserTool();
            $result = $mut->merge($olduser->id, $newuser->id);

            // Check the result. tool_mergeusers returns an array/object with success info.
            $success = true;
            if (is_array($result)) {
                // The merge tool may return error details.
                if (isset($result['success']) && !$result['success']) {
                    $success = false;
                }
            }

            if (!$success) {
                self::log_merge((int) $olduser->id, (int) $newuser->id,
                                $olduser->username, $olduser->auth, 'failed');
                throw new \moodle_exception('merge_failed', 'local_profilemerge');
            }
        } catch (\moodle_exception $e) {
            // Re-throw moodle_exceptions from our own code.
            throw $e;
        } catch (\Exception $e) {
            self::log_merge((int) $olduser->id, (int) $newuser->id,
                            $olduser->username, $olduser->auth, 'failed');
            throw new \moodle_exception('merge_failed', 'local_profilemerge');
        }

        // Step 3: Suspend the old user account.
        self::suspend_old_user($olduser);

        // Step 4: Log the successful merge.
        self::log_merge((int) $olduser->id, (int) $newuser->id,
                        $olduser->username, $olduser->auth, 'success');

        return true;
    }

    /**
     * Suspend (deactivate) the old user account.
     *
     * Sets the suspended flag to 1 so the old account can no longer be used
     * to log in, while preserving the account data for reference.
     *
     * @param object $olduser The old user object to suspend.
     */
    public static function suspend_old_user(object $olduser): void {
        global $DB;

        $DB->set_field('user', 'suspended', 1, ['id' => $olduser->id]);

        // Trigger user_updated event so Moodle knows about the change.
        \core\event\user_updated::create_from_userid($olduser->id)->trigger();
    }

    /**
     * Log a merge operation in the local_profilemerge_log table.
     *
     * @param int $sourceid The user ID of the old account (0 if unknown).
     * @param int $targetid The user ID of the new OIDC account.
     * @param string $oldusername The username of the old account.
     * @param string $oldauth The auth method of the old account.
     * @param string $status The result: 'success' or 'failed'.
     */
    public static function log_merge(int $sourceid, int $targetid,
                                      string $oldusername, string $oldauth,
                                      string $status): void {
        global $DB;

        $record = new \stdClass();
        $record->source_userid = $sourceid;
        $record->target_userid = $targetid;
        $record->old_username = $oldusername;
        $record->old_auth = $oldauth;
        $record->status = $status;
        $record->timecreated = time();

        $DB->insert_record('local_profilemerge_log', $record);
    }

    /**
     * Get the number of failed merge attempts for a user.
     *
     * Counts all log entries with status 'failed' for the given target user.
     * Used for brute-force protection.
     *
     * @param int $userid The target user ID.
     * @return int The number of failed attempts.
     */
    public static function get_failed_attempts(int $userid): int {
        global $DB;

        return $DB->count_records('local_profilemerge_log', [
            'target_userid' => $userid,
            'status' => 'failed',
        ]);
    }
}
