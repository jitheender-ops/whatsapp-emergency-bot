/**
 * @module router
 * @description Intent router for incoming WhatsApp messages.
 * Routes parsed messages to the correct feature module based on
 * active session state or keyword matching.
 *
 * The bot shares a number with real conversations, so it stays silent
 * unless someone explicitly asks for the service. Nothing is ever sent
 * as a fallback to an unrecognised message.
 */

import { getSession, clearSession } from '../services/session.js';
import { handleOnboarding, showProfile } from './onboarding.js';
import { handleBloodDonor, handleDonorRegistration } from './blood-donor.js';
import { handleAmbulanceFinder } from './ambulance-finder.js';
import { handleDocumentHelp } from './document-help.js';
import { handleStatus, handleCancel, handleAdmin, isAdmin } from './requests.js';
import { getUserByPhone, upsertUser } from '../db/models/user.js';
import { sendTextMessage } from '../whatsapp/client.js';

/** Unambiguous service requests — anyone can start the bot with these. */
const OPEN_TRIGGERS = {
  menu: 'onboarding',
  start: 'onboarding',
  blood: 'blood_donor',
  donor: 'blood_donor',
  hospital: 'ambulance_finder',
  ambulance: 'ambulance_finder',
  register: 'donor_registration',
};

/**
 * Everyday words and menu digits. Only honoured for people who have
 * already used the bot, so a friend's "hi" or "1" gets no bot reply.
 */
const MEMBER_TRIGGERS = {
  hi: 'onboarding',
  hello: 'onboarding',
  hey: 'onboarding',
  help: 'onboarding',
  0: 'onboarding',
  1: 'blood_donor',
  2: 'ambulance_finder',
  3: 'donor_registration',
  4: 'status',
  5: 'document_help',
  emergency: 'ambulance_finder',
  signup: 'donor_registration',
  document: 'document_help',
  lost: 'document_help',
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
 * 1. Admin commands from numbers in ADMIN_PHONES.
 * 2. An active session continues in its module ("menu" escapes it).
 * 3. Keyword intent — open triggers for anyone; member triggers and
 *    "status [id]" / "cancel <id>" for people who already used the bot.
 * 4. Anything else is ignored.
 *
 * @async
 * @param {object} parsedMessage - { from, id, name, type, text?, location? }
 * @returns {Promise<void>}
 */
export async function handleMessage(parsedMessage) {
  try {
    const { from } = parsedMessage;
    const input = (parsedMessage.text || '').trim().toLowerCase();

    if (/^admin\b/.test(input) && isAdmin(from)) {
      return await handleAdmin(parsedMessage);
    }

    const session = getSession(from);
    if (session.module) {
      if (input !== 'menu' && HANDLERS[session.module]) {
        return await HANDLERS[session.module](parsedMessage);
      }
      clearSession(from);
    }

    const known = Boolean(getUserByPhone(from));

    const cmd = known && input.match(/^(status|cancel)(?:\s+#?(\d+))?$/);
    if (cmd) {
      return cmd[1] === 'status'
        ? await handleStatus(parsedMessage, cmd[2])
        : await handleCancel(parsedMessage, cmd[2]);
    }

    const intent = OPEN_TRIGGERS[input] || (known && MEMBER_TRIGGERS[input]);
    if (!intent) return; // not for the bot — stay silent

    // Asking for the service = opt-in; also required before a blood request (FK on users.phone).
    if (!known) upsertUser({ phone: from });

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
