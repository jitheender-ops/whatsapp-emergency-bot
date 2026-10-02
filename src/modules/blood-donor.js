import { sendTextMessage } from '../whatsapp/client.js';
import { getSession, setSession, clearSession } from '../services/session.js';
import { findDonors, findDonorsNearby, registerDonor } from '../db/models/user.js';
import { createBloodRequest } from '../db/models/blood-request.js';
import { reverseGeocode } from '../services/geocoding.js';
import { contactLink } from './requests.js';

function extractBloodGroup(input) {
  const bg = (input || '').trim().toUpperCase().replace(/\s/g, '');
  const valid = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
  return valid.includes(bg) ? bg : null;
}

export async function handleBloodDonor(msg) {
  try {
    const { from, text, location } = msg;
    const session = getSession(from);

    if (!session.step) {
      setSession(from, 'blood_donor', 'select_group');
      await sendTextMessage(from, '🩸 *Blood Donor Search*\n\nPlease type the required blood group (e.g., A+, O-, B+):');
      return;
    }

    if (session.step === 'select_group') {
      const bloodGroup = extractBloodGroup(text);

      if (!bloodGroup) {
        await sendTextMessage(from, '❌ Please enter a valid blood group like A+, O-, or B+.');
        return;
      }

      setSession(from, 'blood_donor', 'select_location', { bloodGroup });
      await sendTextMessage(
        from,
        `✅ Blood group *${bloodGroup}* selected.\n\n📍 Please tap the 📎 icon and share your Location, or just type your city name:`
      );
      return;
    }

    if (session.step === 'select_location') {
      const { bloodGroup } = session.data;
      await sendTextMessage(from, '🔍 Searching for donors…');
      let donors = [];
      let request;

      if (location && location.latitude && location.longitude) {
        donors = findDonorsNearby(bloodGroup, location.latitude, location.longitude);
        // Most donors register with a city only, so fall back to the city at that GPS point.
        const city = donors.length ? undefined : (await reverseGeocode(location.latitude, location.longitude))?.city;
        if (city) donors = findDonors(bloodGroup, city);
        request = createBloodRequest({ requester_phone: from, blood_group: bloodGroup, city, latitude: location.latitude, longitude: location.longitude });
      } else {
        const city = (text || '').trim();
        donors = findDonors(bloodGroup, city || undefined);
        request = createBloodRequest({ requester_phone: from, blood_group: bloodGroup, city: city || undefined });
      }

      donors = donors.filter((d) => d.phone !== from);
      const requestLine = `🆔 Request ID: *#${request.id}* — status: *${request.status}*\nType *status ${request.id}* anytime to check it.`;

      if (donors.length > 0) {
        const donorLines = donors.map((d, i) => {
          const parts = [`${i + 1}. *${d.name || 'Anonymous'}*`, `   🩸 ${d.blood_group}`, `   📞 ${contactLink(d.phone)}`];
          if (d.city) parts.push(`   🏙️ ${d.city}`);
          if (d.distance_km != null) parts.push(`   📍 ${d.distance_km} km away`);
          return parts.join('\n');
        });

        const resultMsg = [
          `✅ Found *${donors.length}* donor(s) who can give to *${bloodGroup}*:\n`,
          ...donorLines,
          '',
          '_Please contact them directly._',
          '',
          requestLine,
          '',
          'Type *menu* to go back to the main menu.',
        ].join('\n');

        await sendTextMessage(from, resultMsg);
      } else {
        await sendTextMessage(from, `😔 No donors found for *${bloodGroup}* yet.\n🔔 Your request is recorded.\n\n${requestLine}\n\n🏥 Blood Bank helpline: *1910*\nType *menu* to go back.`);
      }

      clearSession(from);
      return;
    }

    clearSession(from);
    await handleBloodDonor(msg);
  } catch (error) {
    console.error('[BloodDonor] Error:', error);
    clearSession(msg.from);
    await sendTextMessage(msg.from, '⚠️ Something went wrong. Please type *blood* to try again.');
  }
}

export async function handleDonorRegistration(msg) {
  try {
    const { from, text } = msg;
    const session = getSession(from);

    if (!session.step) {
      setSession(from, 'donor_registration', 'enter_name');
      await sendTextMessage(from, '📝 *Donor Registration*\n\nPlease enter your *full name*:');
      return;
    }

    if (session.step === 'enter_name') {
      const name = (text || '').trim();
      if (!name || name.length < 2) {
        await sendTextMessage(from, '❌ Please enter a valid name.');
        return;
      }
      setSession(from, 'donor_registration', 'select_blood_group', { name });
      await sendTextMessage(from, `👍 Great, *${name}*! Now please type your blood group (e.g., O+, B-):`);
      return;
    }

    if (session.step === 'select_blood_group') {
      const bloodGroup = extractBloodGroup(text);
      if (!bloodGroup) {
        await sendTextMessage(from, '❌ Please enter a valid blood group like A+, O-, B+.');
        return;
      }
      setSession(from, 'donor_registration', 'enter_city', { ...session.data, bloodGroup });
      await sendTextMessage(from, `🩸 Blood group *${bloodGroup}* selected.\n\n🏙️ Please enter your *city or town*:`);
      return;
    }

    if (session.step === 'enter_city') {
      const city = (text || '').trim();
      if (!city || city.length < 2) {
        await sendTextMessage(from, '❌ Please enter a valid city.');
        return;
      }
      const { name, bloodGroup } = session.data;
      setSession(from, 'donor_registration', 'confirm', { ...session.data, city });

      const summary = `📋 *Summary*\n📛 Name: ${name}\n🩸 Blood Group: ${bloodGroup}\n🏙️ City: ${city}\n\nType *yes* to confirm or *no* to cancel.`;
      await sendTextMessage(from, summary);
      return;
    }

    if (session.step === 'confirm') {
      const answer = (text || '').trim().toLowerCase();
      if (answer === 'yes' || answer === 'y') {
        const { name, bloodGroup, city } = session.data;
        registerDonor(from, name, bloodGroup, city);
        clearSession(from);
        await sendTextMessage(from, `🎉 *Registration Successful!*\nThank you, *${name}*! You are now registered.\nType *menu* to go back.`);
      } else if (answer === 'no' || answer === 'n') {
        clearSession(from);
        await sendTextMessage(from, '❌ Registration cancelled. Type *register* to start again.');
      } else {
        await sendTextMessage(from, 'Please type *yes* to confirm or *no* to cancel.');
      }
      return;
    }

    clearSession(from);
    await handleDonorRegistration(msg);
  } catch (error) {
    console.error('[DonorRegistration] Error:', error);
    clearSession(msg.from);
    await sendTextMessage(msg.from, '⚠️ Something went wrong. Please type *register* to try again.');
  }
}
