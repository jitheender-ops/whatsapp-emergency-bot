/**
 * @module router
 * @description Intent router for incoming WhatsApp messages.
 * Routes parsed messages to the correct feature module based on
 * active session state or keyword matching.
 *
 * The bot shares a number with real conversations, so it stays silent
 * until someone sends the trigger word (BOT_TRIGGER). Nothing is ever
 * sent as a fallback to an unrecognised message.
 */

import { getSession, clearSession } from '../services/session.js';
import { handleOnboarding, showProfile } from './onboarding.js';
import { handleBloodDonor, handleDonorRegistration } from './blood-donor.js';
import { handleAmbulanceFinder } from './ambulance-finder.js';
import { handleDocumentHelp } from './document-help.js';
import { handleStatus, handleCancel } from './requests.js';
import { upsertUser } from '../db/models/user.js';
import { sendTextMessage } from '../whatsapp/client.js';

/**
 * The ONLY way to start the bot. Set BOT_TRIGGER in .env; matched
 * case-insensitively against the whole message. Read lazily because
 * .env loads after this module is imported.
 */
const triggerWord = () => (process.env.BOT_TRIGGER || '#help').trim().toLowerCase();

/** After the trigger, a person can use the bot this long since their last bot message. */
const ACTIVE_MS = 30 * 60 * 1000;
const activeUntil = new Map();

/** Menu choices and shortcuts — only honoured while a person is active. */
const INTENTS = {
  menu: 'onboarding',
  0: 'onboarding',
  1: 'blood_donor',
  2: 'ambulance_finder',
  3: 'donor_registration',
  4: 'status',
  5: 'document_help',
  blood: 'blood_donor',
  donor: 'blood_donor',
  hospital: 'ambulance_finder',
  ambulance: 'ambulance_finder',
  register: 'donor_registration',
  document: 'document_help',
  profile: 'profile',
};

const HANDLERS = {
  blood_donor: handleBloodDonor,
  donor_registration: handleDonorRegistration,
  ambulance_finder: handleAmbulanceFinder,
  document_help: handleDocumentHelp,
};

/**
 * Routes an incoming parsed message to the appropriate feature handler.
 *
 * Routing priority:
 * (Admin commands never come through here — see index.js.)
 * 1. Nobody gets a reply until they send the trigger word; then they
 *    stay active for ACTIVE_MS after their last message.
 * 2. An in-progress flow continues ("menu" escapes it).
 * 3. Menu choices, "status [id]", "cancel <id>". Anything else is ignored.
 *
 * @async
 * @param {object} parsedMessage - { from, id, name, type, text?, location? }
 * @returns {Promise<void>}
 */
export async function handleMessage(parsedMessage) {
  try {
    const { from } = parsedMessage;
    const input = (parsedMessage.text || '').trim().toLowerCase();

    const now = Date.now();
    if (input === triggerWord()) {
      upsertUser({ phone: from }); // required before a blood request (FK on users.phone)
      activeUntil.set(from, now + ACTIVE_MS);
      clearSession(from);
      return await handleOnboarding(parsedMessage);
    }
    if (!(activeUntil.get(from) > now)) {
      activeUntil.delete(from);
      clearSession(from);
      return; // not triggered — stay silent
    }
    activeUntil.set(from, now + ACTIVE_MS);

    const session = getSession(from);
    if (session.module) {
      if (input !== 'menu' && HANDLERS[session.module]) {
        return await HANDLERS[session.module](parsedMessage);
      }
      clearSession(from);
    }

    const cmd = input.match(/^(status|cancel)(?:\s+#?(\d+))?$/);
    if (cmd) {
      return cmd[1] === 'status'
        ? await handleStatus(parsedMessage, cmd[2])
        : await handleCancel(parsedMessage, cmd[2]);
    }

    const intent = INTENTS[input];
    if (!intent) return;

    if (intent === 'onboarding') return await handleOnboarding(parsedMessage);
    if (intent === 'status') return await handleStatus(parsedMessage);
    if (intent === 'profile') return await showProfile(from);
    return await HANDLERS[intent](parsedMessage);
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
