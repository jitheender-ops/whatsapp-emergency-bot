import { sendTextMessage } from '../whatsapp/client.js';
import { getUserByPhone } from '../db/models/user.js';
import { clearSession } from '../services/session.js';

export async function handleOnboarding(msg) {
  try {
    const { from, name } = msg;
    const greeting = `👋 Hello${name ? ` ${name}` : ''}! Welcome to the *Emergency Assistance Bot*.\n\nI can help you with:\n🩸 Finding blood donors\n🚑 Locating nearby hospitals\n📝 Registering as a donor\n📋 Tracking your blood request`;
    await sendTextMessage(from, greeting);
    await showMainMenu(from);
  } catch (error) {
    console.error('[Onboarding] Error:', error);
    await sendTextMessage(msg.from, '⚠️ Something went wrong. Type *menu* to try again.');
  }
}

export async function showMainMenu(phone) {
  try {
    clearSession(phone);
    const menu = `*Main Menu*\nPlease reply with a number:\n\n1. 🩸 Find Blood Donors\n2. 🚑 Find Nearest Hospital\n3. 📝 Register as a Donor\n4. 📋 My Request Status\n5. 📄 Lost Document Help\n\n_Type your choice (e.g. 1). Type *menu* anytime to come back here._`;
    await sendTextMessage(phone, menu);
  } catch (error) {
    console.error('[Onboarding] Error showing menu:', error);
    await sendTextMessage(phone, '⚠️ Could not display the menu. Type *menu* to try again.');
  }
}

export async function showProfile(phone) {
  try {
    const user = await getUserByPhone(phone);
    if (!user) {
      await sendTextMessage(phone, '🔍 No profile found. Type *register* to sign up.');
      return;
    }
    const profile = `👤 *Your Profile*\n📛 Name: ${user.name || 'Not set'}\n📞 Phone: ${user.phone}\n🩸 Blood Group: ${user.blood_group || 'Not set'}\n🏙️ City: ${user.city || 'Not set'}\n🤝 Donor Status: ${user.is_donor ? '✅ Registered' : '❌ Not registered'}\n\n_Type *menu* to go back._`;
    await sendTextMessage(phone, profile);
  } catch (error) {
    console.error('[Onboarding] Error showing profile:', error);
    await sendTextMessage(phone, '⚠️ Could not retrieve profile.');
  }
}
