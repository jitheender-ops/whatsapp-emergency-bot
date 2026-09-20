/**
 * @module ambulance-finder
 * @description Locates nearby hospitals and ambulance services based on
 * the user's shared location. Displays results with distance info,
 * sends location pins for the top 3 hospitals, and shows emergency numbers.
 */

import { sendTextMessage, sendLocationRequest, sendLocation } from '../whatsapp/client.js';
import { getSession, setSession, clearSession } from '../services/session.js';
import { searchNearbyHospitals } from '../services/geocoding.js';

/** Maximum number of hospital location pins to send */
const MAX_LOCATION_PINS = 3;

/**
 * Handles the ambulance / hospital finder flow.
 *
 * Session steps:
 *  1. `request_location` — Ask the user to share their location.
 *  2. `searching`        — Search for nearby hospitals, display results, clear session.
 *
 * @async
 * @param {object} msg - Parsed incoming message.
 */
export async function handleAmbulanceFinder(msg) {
  try {
    const { from, location } = msg;
    const session = getSession(from);

    // ── No active step → start flow ──
    if (!session.step) {
      setSession(from, 'ambulance_finder', 'request_location');

      await sendTextMessage(
        from,
        '🚑 *Hospital & Ambulance Finder*\n\nI\'ll help you find the nearest hospitals and emergency services.\n\n📍 Please share your current location:'
      );
      await sendLocationRequest(from, 'Share your location to find nearby hospitals.');
      return;
    }

    // ── Step: request_location → waiting for location ──
    if (session.step === 'request_location') {
      if (!location || !location.latitude || !location.longitude) {
        await sendTextMessage(
          from,
          '📍 I need your location to search for nearby hospitals.\n\nPlease tap the 📎 attachment icon → *Location* → *Send your current location*.'
        );
        await sendLocationRequest(from, 'Share your location to continue.');
        return;
      }

      await sendTextMessage(from, '🔍 Searching for nearby hospitals…');

      // Search for hospitals
      const hospitals = await searchNearbyHospitals(location.latitude, location.longitude);

      if (hospitals && hospitals.length > 0) {
        // Format results as text
        const resultLines = hospitals.map((h, i) => {
          const parts = [`*${i + 1}. ${h.name || 'Hospital'}*`];
          if (h.distance_km != null) parts.push(`   📍 Distance: ${h.distance_km} km`);
          if (h.address) parts.push(`   🏠 ${h.address}`);
          if (h.phone) parts.push(`   📞 ${h.phone}`);
          return parts.join('\n');
        });

        const resultMsg = [
          `🏥 Found *${hospitals.length}* hospital(s) near you:\n`,
          ...resultLines,
        ].join('\n');

        await sendTextMessage(from, resultMsg);

        // Send location pins for top hospitals
        const topHospitals = hospitals.slice(0, MAX_LOCATION_PINS);
        for (const hospital of topHospitals) {
          if (hospital.latitude && hospital.longitude) {
            await sendLocation(
              from,
              hospital.latitude,
              hospital.longitude,
              hospital.name || 'Hospital',
              hospital.address || ''
            );
          }
        }
      } else {
        await sendTextMessage(
          from,
          '😔 No hospitals found near your location. Please try again or call emergency services directly.'
        );
      }

      // Always show emergency numbers
      const emergencyMsg = [
        '',
        '📞 *Emergency Helplines:*',
        '',
        '🚨 *Emergency:*  112',
        '🚑 *Ambulance:*  108',
        '🏥 *Blood Bank:* 1910',
        '',
        '_Call these numbers for immediate assistance._',
        '',
        'Type *menu* to go back to the main menu.',
      ].join('\n');

      await sendTextMessage(from, emergencyMsg);

      clearSession(from);
      return;
    }

    // ── Unknown step — reset ──
    clearSession(from);
    await handleAmbulanceFinder(msg);
  } catch (error) {
    console.error('[AmbulanceFinder] Error:', error);
    clearSession(msg.from);

    // Even on error, show emergency numbers
    await sendTextMessage(
      msg.from,
      [
        '⚠️ Something went wrong while searching for hospitals.',
        '',
        '📞 *Emergency Helplines:*',
        '🚨 *Emergency:*  112',
        '🚑 *Ambulance:*  108',
        '🏥 *Blood Bank:* 1910',
        '',
        'Type *ambulance* to try again or *menu* to go back.',
      ].join('\n')
    );
  }
}
