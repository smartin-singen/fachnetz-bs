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
 * JavaScript module for the profile merge dialog.
 *
 * Displays a modal dialog on the dashboard prompting OIDC users
 * to merge their old profile. Supports a "don't show again" checkbox
 * that sets a user preference via AJAX.
 *
 * @module     local_profilemerge/merge_dialog
 * @copyright  2026 Fachnetz BS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import ModalFactory from 'core/modal_factory';
import ModalEvents from 'core/modal_events';
import Templates from 'core/templates';
import Ajax from 'core/ajax';
import Notification from 'core/notification';

/**
 * Initialise the merge dialog.
 *
 * @param {object} config Configuration object.
 * @param {string} config.mergeUrl URL to the merge page.
 * @param {string} config.dialogTitle Title for the modal dialog.
 * @param {string} config.dialogBody HTML body text for the dialog.
 * @param {string} config.suppressLabel Label for the "don't show again" checkbox.
 * @param {string} config.mergeNowLabel Label for the "Merge now" button.
 * @param {string} config.laterLabel Label for the "Later" button.
 * @param {string} config.menuHint Message shown when dialog is suppressed.
 */
export const init = (config) => {
    // Render the dialog body template, then create the modal.
    Templates.render('local_profilemerge/merge_dialog', {
        dialogBody: config.dialogBody,
        suppressLabel: config.suppressLabel,
    }).then((html) => {
        return ModalFactory.create({
            type: ModalFactory.types.SAVE_CANCEL,
            title: config.dialogTitle,
            body: html,
        });
    }).then((modal) => {
        // Customize button labels.
        modal.setSaveButtonText(config.mergeNowLabel);
        modal.setCancelButtonText(config.laterLabel);

        // Handle "Merge now" click → navigate to merge page.
        modal.getRoot().on(ModalEvents.save, (e) => {
            e.preventDefault();
            window.location.href = config.mergeUrl;
        });

        // Handle "Later" click → check suppress checkbox.
        modal.getRoot().on(ModalEvents.cancel, () => {
            const suppressCheckbox = modal.getRoot().find('[data-suppress-checkbox]');
            if (suppressCheckbox.length && suppressCheckbox.is(':checked')) {
                // Set user preference to suppress the dialog.
                Ajax.call([{
                    methodname: 'core_user_set_user_preferences',
                    args: {
                        preferences: [{
                            name: 'local_profilemerge_suppress_dialog',
                            value: '1',
                            userid: 0, // 0 = current user.
                        }],
                    },
                }])[0].then(() => {
                    // Show a notification that merge is available in the menu.
                    Notification.addNotification({
                        message: config.menuHint,
                        type: 'info',
                    });
                    return null;
                }).catch(Notification.exception);
            }
        });

        // Show the modal.
        modal.show();

        return modal;
    }).catch(Notification.exception);
};
