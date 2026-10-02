import axios from 'axios';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const OVERPASS_BASE = 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'EmergencyBot/1.0';
const REQUEST_TIMEOUT = 10_000;

/** Timestamp of the last Overpass request (for rate limiting). */
let lastOverpassRequest = 0;

/**
 * Calculate the great-circle distance between two points using the
 * Haversine formula.
 * @param {number} lat1 - Latitude of point 1 (degrees).
 * @param {number} lng1 - Longitude of point 1 (degrees).
 * @param {number} lat2 - Latitude of point 2 (degrees).
 * @param {number} lng2 - Longitude of point 2 (degrees).
 * @returns {number} Distance in kilometres.
 */
export function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's mean radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Reverse-geocode a latitude/longitude pair into a human-readable address
 * via the OpenStreetMap Nominatim API.
 * @param {number} lat - Latitude (decimal degrees).
 * @param {number} lng - Longitude (decimal degrees).
 * @returns {Promise<{city: string, state: string, country: string, display_name: string} | null>}
 *   Parsed location or `null` on failure.
 */
export async function reverseGeocode(lat, lng) {
  try {
    const { data } = await axios.get(`${NOMINATIM_BASE}/reverse`, {
      params: { lat, lon: lng, format: 'json' },
      headers: { 'User-Agent': USER_AGENT },
      timeout: REQUEST_TIMEOUT,
    });

    const addr = data.address || {};

    return {
      city: addr.city || addr.town || addr.village || addr.county || '',
      state: addr.state || '',
      country: addr.country || '',
      display_name: data.display_name || '',
    };
  } catch (error) {
    console.error('[geocoding] reverseGeocode failed:', error.message);
    return null;
  }
}

/**
 * Enforce a minimum 1-second gap between Overpass API requests to respect
 * the public instance's rate limit.
 * @returns {Promise<void>}
 */
async function enforceRateLimit() {
  const elapsed = Date.now() - lastOverpassRequest;
  if (elapsed < 1000) {
    await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
  }
  lastOverpassRequest = Date.now();
}

/**
 * Search for hospitals near a given coordinate using the Overpass API.
 * @param {number} lat - Latitude (decimal degrees).
 * @param {number} lng - Longitude (decimal degrees).
 * @param {number} [radiusKm=5] - Search radius in kilometres.
 * @returns {Promise<Array<{name: string, latitude: number, longitude: number, distance_km: number, address: string, phone: string}>>}
 *   Hospitals sorted by distance (closest first), capped at 10.
 */
export async function searchNearbyHospitals(lat, lng, radiusKm = 5) {
  try {
    await enforceRateLimit();

    const radiusMeters = radiusKm * 1000;
    const query = `
[out:json][timeout:10];
(
  node["amenity"="hospital"](around:${radiusMeters},${lat},${lng});
  way["amenity"="hospital"](around:${radiusMeters},${lat},${lng});
);
out center body;
`.trim();

    const { data } = await axios.post(
      OVERPASS_BASE,
      `data=${encodeURIComponent(query)}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
        },
        timeout: REQUEST_TIMEOUT,
      },
    );

    const elements = data.elements || [];

    const hospitals = elements.map((el) => {
      // Ways store their computed centre in el.center
      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      const tags = el.tags || {};

      const addressParts = [
        tags['addr:street'],
        tags['addr:city'],
        tags['addr:state'],
      ].filter(Boolean);

      return {
        name: tags.name || 'Unnamed Hospital',
        latitude: elLat,
        longitude: elLng,
        distance_km: parseFloat(
          calculateDistance(lat, lng, elLat, elLng).toFixed(2),
        ),
        address: addressParts.join(', ') || '',
        phone: tags.phone || tags['contact:phone'] || '',
      };
    });

    // Sort by distance and return the 10 closest results.
    hospitals.sort((a, b) => a.distance_km - b.distance_km);
    return hospitals.slice(0, 10);
  } catch (error) {
    console.error('[geocoding] searchNearbyHospitals failed:', error.message);
    return [];
  }
}
