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

namespace local_profilemerge\form;

defined('MOODLE_INTERNAL') || die();

require_once($CFG->libdir . '/formslib.php');

/**
 * Profile merge form.
 *
 * Presents username and password fields for the user to enter the
 * credentials of their old (non-OIDC) Moodle account.
 *
 * @package    local_profilemerge
 * @copyright  2026 Fachnetz BS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class merge_form extends \moodleform {

    /**
     * Define the form elements.
     */
    protected function definition() {
        $mform = $this->_form;

        // Explanatory text.
        $mform->addElement('html', '<div class="alert alert-info">' .
            get_string('merge_explanation', 'local_profilemerge') . '</div>');

        // Old account username.
        $mform->addElement('text', 'oldusername',
            get_string('oldusername', 'local_profilemerge'));
        $mform->setType('oldusername', PARAM_USERNAME);
        $mform->addRule('oldusername', get_string('required'), 'required', null, 'client');

        // Old account password.
        $mform->addElement('password', 'oldpassword',
            get_string('oldpassword', 'local_profilemerge'));
        $mform->setType('oldpassword', PARAM_RAW);
        $mform->addRule('oldpassword', get_string('required'), 'required', null, 'client');

        // Submit buttons.
        $this->add_action_buttons(true, get_string('merge_now', 'local_profilemerge'));
    }

    /**
     * Validate the form data.
     *
     * @param array $data The submitted form data.
     * @param array $files The submitted files.
     * @return array Associative array of error messages.
     */
    public function validation($data, $files) {
        $errors = parent::validation($data, $files);

        if (empty(trim($data['oldusername']))) {
            $errors['oldusername'] = get_string('required');
        }

        if (empty($data['oldpassword'])) {
            $errors['oldpassword'] = get_string('required');
        }

        return $errors;
    }
}
