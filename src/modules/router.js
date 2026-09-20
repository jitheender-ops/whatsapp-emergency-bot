/**
 * @module router
 * @description Intent router for incoming WhatsApp messages.
 * Routes parsed messages to the correct feature module based on
 * active session state or keyword/button matching.
 */

import { getSession, clearSession } from '../services/session.js';
import { handleOnboarding, showMainMenu, showProfile } from './onboarding.js';
import { handleBloodDonor, handleDonorRegistration } from './blood-donor.js';
import { handleAmbulanceFinder } from './ambulance-finder.js';
import { handleDocumentHelp } from './document-help.js';
import { sendTextMessage } from '../whatsapp/client.js';

/**
 * Determines the intent from the parsed message text, buttonId, or listId.
 * @param {object} parsedMessage - The parsed incoming message.
 * @returns {string} The resolved intent key.
 */
function resolveIntent(parsedMessage) {
  const { text, buttonId, listId } = parsedMessage;
  const input = (text || '').trim().toLowerCase();
  const btnId = (buttonId || '').trim().toLowerCase();
  const lstId = (listId || '').trim().toLowerCase();

  // --- Blood donor search ---
  if (
    ['blood', 'donor', '1'].includes(input) ||
    btnId.startsWith('menu_blood') ||
    lstId.startsWith('menu_blood')
  ) {
    return 'blood_donor';
  }

  // --- Ambulance / emergency / hospital ---
  if (
    ['ambulance', 'emergency', 'hospital', '2'].includes(input) ||
    btnId === 'menu_ambulance' ||
    lstId === 'menu_ambulance'
  ) {
    return 'ambulance_finder';
  }

  // --- Document help ---
  if (
    ['document', 'lost', 'missing', '3'].includes(input) ||
    btnId === 'menu_documents' ||
    lstId === 'menu_documents'
  ) {
    return 'document_help';
  }

  // --- Donor registration ---
  if (
    ['register', 'signup', '4'].includes(input) ||
    btnId === 'menu_register_donor' ||
    lstId === 'menu_register_donor'
  ) {
    return 'donor_registration';
  }

  // --- Profile ---
  if (btnId === 'menu_my_profile' || lstId === 'menu_my_profile') {
    return 'profile';
  }

  // --- Main menu / onboarding ---
  if (['menu', 'hi', 'hello', 'hey', 'start', 'help', '0'].includes(input)) {
    return 'onboarding';
  }

  return 'unknown';
}

/**
 * Routes an incoming parsed message to the appropriate feature handler.
 *
 * Routing priority:
 * 1. If the user has an active session, delegate to that session's module handler.
 * 2. Otherwise, resolve intent via keyword / button / list matching.
 * 3. Fall back to showing the main menu.
 *
 * @async
 * @param {object} parsedMessage - Parsed incoming message.
 * @param {string} parsedMessage.from  - Sender phone number.
 * @param {string} parsedMessage.id    - Message ID.
 * @param {string} parsedMessage.name  - Sender profile name.
 * @param {string} parsedMessage.type  - Message type (text, button_reply, list_reply, location, etc.).
 * @param {string} [parsedMessage.text]     - Text body (if type is text).
 * @param {string} [parsedMessage.buttonId] - Button reply ID.
 * @param {string} [parsedMessage.listId]   - List reply ID.
 * @param {object} [parsedMessage.location] - Location payload { latitude, longitude }.
 * @returns {Promise<void>}
 */
export async function handleMessage(parsedMessage) {
  try {
    const { from } = parsedMessage;

    // 1. Check for an active session and route accordingly
    const session = getSession(from);

    if (session) {
      switch (session.module) {
        case 'blood_donor':
          return await handleBloodDonor(parsedMessage);
        case 'donor_registration':
          return await handleDonorRegistration(parsedMessage);
        case 'ambulance_finder':
          return await handleAmbulanceFinder(parsedMessage);
        case 'document_help':
          return await handleDocumentHelp(parsedMessage);
        default:
          // Unknown session module — clear it and fall through to intent routing
          clearSession(from);
          break;
      }
    }

    // 2. Resolve intent from message content
    const intent = resolveIntent(parsedMessage);

    switch (intent) {
      case 'blood_donor':
        return await handleBloodDonor(parsedMessage);
      case 'ambulance_finder':
        return await handleAmbulanceFinder(parsedMessage);
      case 'document_help':
        return await handleDocumentHelp(parsedMessage);
      case 'donor_registration':
        return await handleDonorRegistration(parsedMessage);
      case 'profile':
        return await showProfile(from);
      case 'onboarding':
        return await handleOnboarding(parsedMessage);
      default:
        // 3. Fallback — show the main menu
        return await showMainMenu(from);
    }
  } catch (error) {
    console.error('[Router] Error handling message:', error);
    try {
      await sendTextMessage(
        parsedMessage.from,
        '⚠️ Something went wrong while processing your message. Please try again or type *menu* to start over.'
      );
    } catch (sendError) {
      console.error('[Router] Failed to send error message:', sendError);
    }
  }
}
