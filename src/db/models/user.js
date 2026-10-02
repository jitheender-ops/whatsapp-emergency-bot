import { runSql, queryOne, queryAll } from '../database.js';

/**
 * User model — handles CRUD for users and blood donors.
 */

/** Recipient blood group → donor groups that can safely give to it. */
export const COMPATIBLE_DONORS = {
  'O-': ['O-'],
  'O+': ['O+', 'O-'],
  'A-': ['A-', 'O-'],
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'B-': ['B-', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'AB-': ['AB-', 'A-', 'B-', 'O-'],
  'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
};

/** SQL fragment + params matching compatible donor groups, exact group ranked first. */
function groupFilter(bloodGroup) {
  const groups = COMPATIBLE_DONORS[bloodGroup] || [bloodGroup];
  return {
    where: `blood_group IN (${groups.map(() => '?').join(', ')})`,
    order: '(blood_group = ?) DESC, updated_at DESC',
    params: groups,
  };
}

/**
 * Create or update a user by phone number.
 * Uses upsert pattern (INSERT ... ON CONFLICT UPDATE).
 * @param {Object} data
 * @param {string} data.phone
 * @param {string} [data.name]
 * @param {string} [data.blood_group]
 * @param {string} [data.city]
 * @param {number} [data.latitude]
 * @param {number} [data.longitude]
 * @param {boolean} [data.is_donor]
 * @returns {Object} The upserted user row
 */
export function upsertUser(data) {
  runSql(`
    INSERT INTO users (phone, name, blood_group, city, latitude, longitude, is_donor)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(phone) DO UPDATE SET
      name = COALESCE(?, users.name),
      blood_group = COALESCE(?, users.blood_group),
      city = COALESCE(?, users.city),
      latitude = COALESCE(?, users.latitude),
      longitude = COALESCE(?, users.longitude),
      is_donor = COALESCE(?, users.is_donor),
      updated_at = datetime('now')
  `, [
    data.phone,
    data.name || null,
    data.blood_group || null,
    data.city || null,
    data.latitude ?? null,
    data.longitude ?? null,
    data.is_donor ? 1 : (data.is_donor === false ? 0 : null),
    // Repeat for the ON CONFLICT SET clause
    data.name || null,
    data.blood_group || null,
    data.city || null,
    data.latitude ?? null,
    data.longitude ?? null,
    data.is_donor ? 1 : (data.is_donor === false ? 0 : null),
  ]);

  return getUserByPhone(data.phone);
}

/**
 * Get a user by phone number.
 * @param {string} phone
 * @returns {Object|undefined}
 */
export function getUserByPhone(phone) {
  return queryOne('SELECT * FROM users WHERE phone = ?', [phone]);
}

/**
 * Find available donors compatible with a blood group, optionally filtered by city.
 * @param {string} bloodGroup
 * @param {string} [city]
 * @returns {Object[]}
 */
export function findDonors(bloodGroup, city) {
  const g = groupFilter(bloodGroup);
  if (city) {
    return queryAll(`
      SELECT * FROM users 
      WHERE ${g.where} AND is_donor = 1 AND is_available = 1 
        AND LOWER(city) = LOWER(?)
      ORDER BY ${g.order}
      LIMIT 20
    `, [...g.params, city, bloodGroup]);
  }

  return queryAll(`
    SELECT * FROM users 
    WHERE ${g.where} AND is_donor = 1 AND is_available = 1
    ORDER BY ${g.order}
    LIMIT 20
  `, [...g.params, bloodGroup]);
}

/**
 * Find donors near a given lat/lng using bounding box approximation.
 * sql.js doesn't support custom math functions easily, so we do the
 * Haversine calculation in JavaScript after a bounding-box pre-filter.
 * @param {string} bloodGroup
 * @param {number} lat
 * @param {number} lng
 * @param {number} [radiusKm=15] - Search radius in kilometers
 * @returns {Array<Object & {distance_km: number}>}
 */
export function findDonorsNearby(bloodGroup, lat, lng, radiusKm = 15) {
  // Rough bounding box filter (1 degree ≈ 111km)
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

  const g = groupFilter(bloodGroup);
  const candidates = queryAll(`
    SELECT * FROM users
    WHERE ${g.where}
      AND is_donor = 1 
      AND is_available = 1
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND latitude BETWEEN ? AND ?
      AND longitude BETWEEN ? AND ?
    ORDER BY ${g.order}
    LIMIT 50
  `, [
    ...g.params,
    lat - latDelta, lat + latDelta,
    lng - lngDelta, lng + lngDelta,
    bloodGroup,
  ]);

  // Calculate actual Haversine distance and filter
  const donors = candidates
    .map((d) => ({
      ...d,
      distance_km: haversineDistance(lat, lng, d.latitude, d.longitude),
    }))
    .filter((d) => d.distance_km <= radiusKm)
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, 10);

  return donors;
}

/**
 * Haversine distance between two coordinates in km.
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} Distance in kilometers
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Set donor availability status.
 * @param {string} phone
 * @param {boolean} available
 */
export function setDonorAvailability(phone, available) {
  runSql(
    "UPDATE users SET is_available = ?, updated_at = datetime('now') WHERE phone = ?",
    [available ? 1 : 0, phone]
  );
}

/**
 * Register a user as a blood donor.
 * @param {string} phone
 * @param {string} name
 * @param {string} bloodGroup
 * @param {string} city
 * @returns {Object} The updated user
 */
export function registerDonor(phone, name, bloodGroup, city) {
  return upsertUser({
    phone,
    name,
    blood_group: bloodGroup,
    city,
    is_donor: true,
  });
}
