/**
 * @module requests
 * @description Blood request status for requesters, plus admin commands
 * to list and close requests. The admin is whoever linked the bot by
 * scanning the QR; they send commands in their "Message yourself" chat.
 */

import { sendTextMessage } from '../whatsapp/client.js';
import {
  getBloodRequestById,
  getRecentRequestsByPhone,
  listActiveRequests,
  updateRequestStatus,
  expireOldRequests,
} from '../db/models/blood-request.js';

/** WhatsApp id ("919876543210@c.us") → clickable chat link, or the raw id if it hides the number (@lid). */
export function contactLink(waId) {
  const [num, server] = String(waId).split('@');
  return !server || server === 'c.us' ? `wa.me/${num.replace(/\D/g, '')}` : waId;
}

function formatRequest(r) {
  return `*#${r.id}* · 🩸 ${r.blood_group} · ${r.city || 'GPS location'} · *${r.status}*\n   🕒 ${r.created_at} UTC`;
}

/** "status" → your recent requests; "status 12" → one request. */
export async function handleStatus(msg, id) {
  const { from } = msg;
  expireOldRequests();

  if (id) {
    const r = getBloodRequestById(Number(id));
    if (!r || r.requester_phone !== from) {
      await sendTextMessage(from, `🔍 No request *#${id}* found for your number.`);
      return;
    }
    await sendTextMessage(from, `📋 *Request status*\n\n${formatRequest(r)}\n\nType *cancel ${r.id}* if you no longer need blood.`);
    return;
  }

  const rows = getRecentRequestsByPhone(from);
  if (rows.length === 0) {
    await sendTextMessage(from, '📋 You have no blood requests yet.\nType *blood* to create one.');
    return;
  }
  await sendTextMessage(from, `📋 *Your recent requests*\n\n${rows.map(formatRequest).join('\n')}\n\nType *status <id>* for details.`);
}

/** "cancel 12" — requester closes their own active request. */
export async function handleCancel(msg, id) {
  const { from } = msg;
  const r = id && getBloodRequestById(Number(id));
  if (!r || r.requester_phone !== from) {
    await sendTextMessage(from, `🔍 No request *#${id ?? ''}* found for your number. Type *status* to see yours.`);
    return;
  }
  if (r.status !== 'active') {
    await sendTextMessage(from, `ℹ️ Request *#${r.id}* is already *${r.status}*.`);
    return;
  }
  updateRequestStatus(r.id, 'cancelled');
  await sendTextMessage(from, `✅ Request *#${r.id}* cancelled. Stay safe.`);
}

const ADMIN_HELP = [
  '🛠️ *Admin commands*',
  '',
  '*admin list* — active blood requests',
  '*admin done <id>* — mark fulfilled (requester is told)',
  '*admin cancel <id>* — cancel (requester is told)',
].join('\n');

const ADMIN_ACTIONS = {
  done: { status: 'fulfilled', notice: '🎉 Your blood request *#{id}* has been marked *fulfilled*. Wishing a speedy recovery!' },
  cancel: { status: 'cancelled', notice: 'ℹ️ Your blood request *#{id}* was *closed* by our team. Send *{trigger}* if you still need help.' },
};

/** Only call for the bot owner's self-chat — see index.js. */
export async function handleAdmin(msg) {
  const { from } = msg;
  const [, action, id] = (msg.text || '').trim().toLowerCase().split(/\s+/);

  if (action === 'list') {
    expireOldRequests();
    const rows = listActiveRequests();
    const body = rows.length
      ? rows.map((r) => `${formatRequest(r)}\n   📞 ${contactLink(r.requester_phone)}`).join('\n')
      : 'No active requests.';
    await sendTextMessage(from, `🛠️ *Active requests (${rows.length})*\n\n${body}`);
    return;
  }

  const act = ADMIN_ACTIONS[action];
  if (!act) {
    await sendTextMessage(from, ADMIN_HELP);
    return;
  }

  const r = id && getBloodRequestById(Number(id));
  if (!r) {
    await sendTextMessage(from, `🔍 No request *#${id ?? ''}*.`);
    return;
  }
  updateRequestStatus(r.id, act.status);
  await sendTextMessage(from, `✅ Request *#${r.id}* → *${act.status}*.`);
  await sendTextMessage(r.requester_phone, act.notice.replace('{id}', r.id).replace('{trigger}', process.env.BOT_TRIGGER || '#help'));
}
