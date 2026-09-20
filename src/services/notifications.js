import { findDonorsNearby, findDonors } from '../db/models/user.js';
import {
  recordDonorNotification,
  recordDonorResponse,
  getBloodRequestById,
} from '../db/models/blood-request.js';
import { sendTextMessage } from '../whatsapp/client.js';

/**
 * Build the alert message sent to potential donors.
 * @param {object} bloodRequest - The blood request record.
 * @returns {string} Formatted WhatsApp message.
 */
function buildDonorAlert(bloodRequest) {
  const { id, blood_group, city, hospital_name } = bloodRequest;
  return (
    `🆘 *Blood Needed!*\n\n` +
    `Someone near you needs *${blood_group}* blood.\n` +
    `📍 Location: ${city || 'Unknown'}\n` +
    `🏥 Hospital: ${hospital_name || 'Not specified'}\n\n` +
    `Can you help? Reply "HELP ${id}" to connect.`
  );
}

/**
 * Notify donors who match a blood request's group and are close to its
 * location. Each donor receives a WhatsApp message and a notification
 * record is persisted. The requester's own number is skipped.
 *
 * @param {object} bloodRequest - Row from the `blood_requests` table.
 * @returns {Promise<{notified: number, donors: string[]}>}
 */
export async function notifyMatchingDonors(bloodRequest) {
  const notifiedDonors = [];

  try {
    // Prefer location-based search; fall back to blood-group-only search.
    let donors;
    if (bloodRequest.latitude && bloodRequest.longitude) {
      donors = findDonorsNearby(
        bloodRequest.blood_group,
        bloodRequest.latitude,
        bloodRequest.longitude,
      );
    } else {
      donors = findDonors(bloodRequest.blood_group);
    }

    if (!donors || donors.length === 0) {
      console.log('[notifications] No matching donors found.');
      return { notified: 0, donors: [] };
    }

    const message = buildDonorAlert(bloodRequest);

    for (const donor of donors) {
      // Don't notify the requester about their own request.
      if (donor.phone === bloodRequest.requester_phone) {
        continue;
      }

      try {
        await sendTextMessage(donor.phone, message);
        recordDonorNotification(bloodRequest.id, donor.phone);
        notifiedDonors.push(donor.phone);
      } catch (donorError) {
        console.error(
          `[notifications] Failed to notify donor ${donor.phone}:`,
          donorError.message,
        );
        // Continue with remaining donors even if one fails.
      }
    }
  } catch (error) {
    console.error('[notifications] notifyMatchingDonors error:', error.message);
  }

  return { notified: notifiedDonors.length, donors: notifiedDonors };
}

/**
 * Handle a donor's "HELP {requestId}" response.
 *
 * 1. Records the donor's acceptance.
 * 2. Notifies the requester that someone has responded.
 * 3. Shares the requester's contact info with the donor.
 *
 * @param {string} donorPhone - Phone number of the responding donor.
 * @param {number|string} requestId - ID of the blood request.
 * @returns {Promise<boolean>} `true` if processed successfully.
 */
export async function processHelperResponse(donorPhone, requestId) {
  try {
    // Mark the donor's notification as accepted.
    recordDonorResponse(Number(requestId), donorPhone, 'accepted');

    // Retrieve the original request to find the requester.
    const request = getBloodRequestById(Number(requestId));
    if (!request) {
      console.error(
        `[notifications] Blood request ${requestId} not found.`,
      );
      await sendTextMessage(
        donorPhone,
        '⚠️ Sorry, that blood request could not be found. It may have been fulfilled already.',
      );
      return false;
    }

    const requesterPhone = request.requester_phone;

    // Notify the requester.
    await sendTextMessage(
      requesterPhone,
      `🎉 *Great news!* A donor has responded to your blood request!\n\n` +
        `They will be in touch shortly. Donor contact: ${donorPhone}`,
    );

    // Share the requester's contact with the donor.
    await sendTextMessage(
      donorPhone,
      `🙏 *Thank you for volunteering!*\n\n` +
        `Here are the requester's details:\n` +
        `📞 Contact: ${requesterPhone}\n` +
        `🩸 Blood Group: ${request.blood_group}\n` +
        `🏥 Hospital: ${request.hospital_name || 'Not specified'}\n\n` +
        `Please reach out to them directly.`,
    );

    return true;
  } catch (error) {
    console.error(
      '[notifications] processHelperResponse error:',
      error.message,
    );
    return false;
  }
}
