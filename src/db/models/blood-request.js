import { runSql, queryOne, queryAll } from '../database.js';

/**
 * Blood request model — manages active blood donation requests.
 */

/**
 * Create a new blood request.
 * @param {Object} data
 * @param {string} data.requester_phone
 * @param {string} data.blood_group
 * @param {string} [data.city]
 * @param {number} [data.latitude]
 * @param {number} [data.longitude]
 * @param {number} [data.units_needed]
 * @param {string} [data.hospital_name]
 * @returns {Object} The created blood request
 */
export function createBloodRequest(data) {
  const { lastInsertRowid } = runSql(`
    INSERT INTO blood_requests (requester_phone, blood_group, city, latitude, longitude, units_needed, hospital_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    data.requester_phone,
    data.blood_group,
    data.city || null,
    data.latitude ?? null,
    data.longitude ?? null,
    data.units_needed || 1,
    data.hospital_name || null,
  ]);

  return getBloodRequestById(lastInsertRowid);
}

/**
 * Get a blood request by ID.
 * @param {number} id
 * @returns {Object|undefined}
 */
export function getBloodRequestById(id) {
  return queryOne('SELECT * FROM blood_requests WHERE id = ?', [id]);
}

/**
 * Get active blood requests by requester phone.
 * @param {string} phone
 * @returns {Object[]}
 */
export function getActiveRequestsByPhone(phone) {
  return queryAll(`
    SELECT * FROM blood_requests 
    WHERE requester_phone = ? AND status = 'active'
    ORDER BY created_at DESC
  `, [phone]);
}

/**
 * Most recent requests (any status) made by a phone.
 * @param {string} phone
 * @returns {Object[]}
 */
export function getRecentRequestsByPhone(phone, limit = 5) {
  return queryAll(
    'SELECT * FROM blood_requests WHERE requester_phone = ? ORDER BY id DESC LIMIT ?',
    [phone, limit]
  );
}

/**
 * All active requests, newest first (admin view).
 * @returns {Object[]}
 */
export function listActiveRequests(limit = 20) {
  return queryAll(
    "SELECT * FROM blood_requests WHERE status = 'active' ORDER BY id DESC LIMIT ?",
    [limit]
  );
}

/**
 * Update the status of a blood request.
 * @param {number} id
 * @param {'fulfilled'|'expired'|'cancelled'} status
 */
export function updateRequestStatus(id, status) {
  runSql('UPDATE blood_requests SET status = ? WHERE id = ?', [status, id]);
}

/**
 * Record that a donor was notified about a request.
 * @param {number} requestId
 * @param {string} donorPhone
 */
export function recordDonorNotification(requestId, donorPhone) {
  runSql(`
    INSERT OR IGNORE INTO donor_notifications (request_id, donor_phone)
    VALUES (?, ?)
  `, [requestId, donorPhone]);
}

/**
 * Record a donor's response to a blood request notification.
 * @param {number} requestId
 * @param {string} donorPhone
 * @param {'accepted'|'declined'} response
 */
export function recordDonorResponse(requestId, donorPhone, response) {
  runSql(`
    UPDATE donor_notifications 
    SET responded = 1, response = ?, responded_at = datetime('now')
    WHERE request_id = ? AND donor_phone = ?
  `, [response, requestId, donorPhone]);
}

/**
 * Expire old blood requests (older than 24 hours).
 * @returns {number} Number of expired requests
 */
export function expireOldRequests() {
  const { changes } = runSql(`
    UPDATE blood_requests 
    SET status = 'expired' 
    WHERE status = 'active' AND expires_at < datetime('now')
  `);
  return changes;
}
