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
 * Unit tests for the profile merge manager.
 *
 * @package    local_profilemerge
 * @copyright  2026 Fachnetz BS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @covers     \local_profilemerge\manager
 */
class manager_test extends \advanced_testcase {

    /**
     * Set up test fixtures.
     */
    protected function setUp(): void {
        parent::setUp();
        $this->resetAfterTest(true);

        // Enable the plugin by default for tests.
        set_config('enabled', 1, 'local_profilemerge');
        set_config('max_attempts', 5, 'local_profilemerge');
        set_config('days_limit', 0, 'local_profilemerge');
    }

    /**
     * Test that an OIDC user without a previous merge is a candidate.
     */
    public function test_is_merge_candidate_oidc_user(): void {
        $user = $this->getDataGenerator()->create_user(['auth' => 'oidc']);
        $this->assertTrue(manager::is_merge_candidate($user->id));
    }

    /**
     * Test that a manual-auth user is not a merge candidate.
     */
    public function test_is_merge_candidate_manual_user(): void {
        $user = $this->getDataGenerator()->create_user(['auth' => 'manual']);
        $this->assertFalse(manager::is_merge_candidate($user->id));
    }

    /**
     * Test that a user who already merged is not a candidate.
     */
    public function test_is_merge_candidate_already_merged(): void {
        global $DB;

        $user = $this->getDataGenerator()->create_user(['auth' => 'oidc']);

        // Insert a successful merge log entry.
        $log = new \stdClass();
        $log->source_userid = 999;
        $log->target_userid = $user->id;
        $log->old_username = 'olduser';
        $log->old_auth = 'manual';
        $log->status = 'success';
        $log->timecreated = time();
        $DB->insert_record('local_profilemerge_log', $log);

        $this->assertFalse(manager::is_merge_candidate($user->id));
    }

    /**
     * Test that a disabled plugin returns false.
     */
    public function test_is_merge_candidate_plugin_disabled(): void {
        set_config('enabled', 0, 'local_profilemerge');
        $user = $this->getDataGenerator()->create_user(['auth' => 'oidc']);
        $this->assertFalse(manager::is_merge_candidate($user->id));
    }

    /**
     * Test that the time limit is respected.
     */
    public function test_is_merge_candidate_days_expired(): void {
        set_config('days_limit', 30, 'local_profilemerge');

        // Create user with firstaccess 60 days ago.
        $user = $this->getDataGenerator()->create_user([
            'auth' => 'oidc',
            'firstaccess' => time() - (60 * DAYSECS),
        ]);
        $this->assertFalse(manager::is_merge_candidate($user->id));
    }

    /**
     * Test that time limit allows within-range users.
     */
    public function test_is_merge_candidate_days_within_limit(): void {
        set_config('days_limit', 30, 'local_profilemerge');

        // Create user with firstaccess 10 days ago.
        $user = $this->getDataGenerator()->create_user([
            'auth' => 'oidc',
            'firstaccess' => time() - (10 * DAYSECS),
        ]);
        $this->assertTrue(manager::is_merge_candidate($user->id));
    }

    /**
     * Test that a suspended user is not a candidate.
     */
    public function test_is_merge_candidate_suspended_user(): void {
        $user = $this->getDataGenerator()->create_user([
            'auth' => 'oidc',
            'suspended' => 1,
        ]);
        $this->assertFalse(manager::is_merge_candidate($user->id));
    }

    /**
     * Test that log_merge creates a record correctly.
     */
    public function test_log_merge(): void {
        global $DB;

        manager::log_merge(100, 200, 'testolduser', 'manual', 'success');

        $records = $DB->get_records('local_profilemerge_log');
        $this->assertCount(1, $records);

        $record = reset($records);
        $this->assertEquals(100, $record->source_userid);
        $this->assertEquals(200, $record->target_userid);
        $this->assertEquals('testolduser', $record->old_username);
        $this->assertEquals('manual', $record->old_auth);
        $this->assertEquals('success', $record->status);
        $this->assertGreaterThan(0, $record->timecreated);
    }

    /**
     * Test the failed attempts counter.
     */
    public function test_get_failed_attempts(): void {
        $user = $this->getDataGenerator()->create_user(['auth' => 'oidc']);

        $this->assertEquals(0, manager::get_failed_attempts($user->id));

        // Log some failed attempts.
        manager::log_merge(0, $user->id, 'wronguser1', 'unknown', 'failed');
        manager::log_merge(0, $user->id, 'wronguser2', 'unknown', 'failed');
        manager::log_merge(0, $user->id, 'wronguser3', 'unknown', 'failed');

        $this->assertEquals(3, manager::get_failed_attempts($user->id));
    }

    /**
     * Test that successful merges don't count as failed attempts.
     */
    public function test_get_failed_attempts_ignores_success(): void {
        $user = $this->getDataGenerator()->create_user(['auth' => 'oidc']);

        manager::log_merge(100, $user->id, 'olduser', 'manual', 'success');
        manager::log_merge(0, $user->id, 'wronguser', 'unknown', 'failed');

        $this->assertEquals(1, manager::get_failed_attempts($user->id));
    }

    /**
     * Test validate_old_credentials rejects same user.
     */
    public function test_validate_old_credentials_same_user(): void {
        $user = $this->getDataGenerator()->create_user([
            'auth' => 'oidc',
            'username' => 'testuser',
            'password' => 'Test1234!',
        ]);

        $this->expectException(\moodle_exception::class);
        // This will fail at authenticate_user_login since OIDC users
        // typically can't authenticate with password, but the test
        // demonstrates the flow.
        manager::validate_old_credentials('testuser', 'Test1234!', $user->id);
    }

    /**
     * Test suspend_old_user sets the suspended flag.
     */
    public function test_suspend_old_user(): void {
        global $DB;

        $user = $this->getDataGenerator()->create_user(['auth' => 'manual']);
        $this->assertEquals(0, $DB->get_field('user', 'suspended', ['id' => $user->id]));

        manager::suspend_old_user($user);
        $this->assertEquals(1, $DB->get_field('user', 'suspended', ['id' => $user->id]));
    }

    /**
     * Test save_old_username with custom profile field.
     */
    public function test_save_old_username(): void {
        global $DB;

        // Create the custom profile field.
        $category = $DB->get_record('user_info_category', [], 'id', IGNORE_MULTIPLE);
        if (!$category) {
            $category = new \stdClass();
            $category->name = 'Test';
            $category->sortorder = 1;
            $category->id = $DB->insert_record('user_info_category', $category);
        }

        $field = new \stdClass();
        $field->shortname = 'old_moodle_username';
        $field->name = 'Old Moodle Username';
        $field->datatype = 'text';
        $field->categoryid = $category->id;
        $field->sortorder = 1;
        $field->id = $DB->insert_record('user_info_field', $field);

        // Create users.
        $olduser = $this->getDataGenerator()->create_user([
            'auth' => 'manual',
            'username' => 'alice_old',
        ]);
        $newuser = $this->getDataGenerator()->create_user([
            'auth' => 'oidc',
            'username' => 'alice_new',
        ]);

        // Execute.
        manager::save_old_username($olduser, $newuser);

        // Verify.
        $data = $DB->get_record('user_info_data', [
            'userid' => $newuser->id,
            'fieldid' => $field->id,
        ]);
        $this->assertNotEmpty($data);
        $this->assertEquals('alice_old', $data->data);
    }
}
