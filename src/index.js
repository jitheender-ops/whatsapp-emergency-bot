import './config.js'; // loads .env (BOT_TRIGGER)
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { handleMessage } from './modules/router.js';
import { handleAdmin } from './modules/requests.js';
import { getDb } from './db/database.js';
import { runMigrations } from './db/migrations.js';

// Initialize WhatsApp client with local auth (persists session)
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

// Show QR code in terminal for scanning
client.on('qr', (qr) => {
  console.log('\n📱 Scan this QR code with WhatsApp:\n');
  qrcode.generate(qr, { small: true });
  console.log('\nOpen WhatsApp → Settings → Linked Devices → Link a Device\n');
});

client.on('ready', () => {
  console.log('✅ WhatsApp Bot is ready!');
  console.log(`💬 Others start the bot with "${process.env.BOT_TRIGGER || '#help'}".`);
  console.log('🛠️  Admin: type "admin" in your own "Message yourself" chat.\n');
});

client.on('authenticated', () => {
  console.log('🔐 Authenticated successfully.');
});

client.on('auth_failure', (msg) => {
  console.error('❌ Authentication failed:', msg);
});

// Record when the bot started (in seconds) so we ignore historical messages
const startupTime = Math.floor(Date.now() / 1000);

// Handle incoming messages
client.on('message', async (message) => {
  try {
    // Ignore messages sent before the bot started
    if (message.timestamp < startupTime) {
      return;
    }

    // Only 1:1 chats from people — skip groups, status, broadcast lists, channels.
    if (!/@(c\.us|lid)$/.test(message.from) || message.isStatus || message.broadcast) {
      return;
    }
    // Only text and location; ignore calls, reactions, media, system notices.
    if (!['chat', 'location'].includes(message.type)) {
      return;
    }

    // Parse the message into our standard format
    const parsedMsg = {
      from: message.from,
      id: message.id._serialized,
      name: message._data?.notifyName || 'User',
      type: 'text',
      text: message.body || '',
    };

    // Check for location messages
    if (message.location) {
      parsedMsg.type = 'location';
      parsedMsg.text = ''; // body is a base64 map thumbnail, not text
      parsedMsg.location = {
        latitude: message.location.latitude,
        longitude: message.location.longitude,
      };
    }

    console.log(`[msg] From ${parsedMsg.name} (${parsedMsg.from}): ${parsedMsg.text || '[location]'}`);

    // Route to handler
    await handleMessage(parsedMsg);
  } catch (error) {
    console.error('[msg] Error handling message:', error);
  }
});

// Admin = the account that scanned the QR. 'message' never fires for our own
// messages, so listen to 'message_create' and accept only "admin ..." typed
// in the owner's "Message yourself" chat (not chats with other people).
// The self-chat may be addressed by phone id (…@c.us) or hidden id (…@lid).
let ownIdsCache;
async function ownIds() {
  if (ownIdsCache) return ownIdsCache;
  const me = client.info.wid._serialized;
  const [{ lid } = {}] = await client.getContactLidAndPhone([me]).catch(() => []);
  return (ownIdsCache = [me, lid].filter(Boolean));
}

client.on('message_create', async (message) => {
  try {
    if (!message.fromMe || !/^admin\b/i.test((message.body || '').trim())) return;
    if (!(await ownIds()).includes(message.to)) return; // not the "Message yourself" chat
    console.log(`[admin] ${message.body}`);
    await handleAdmin({ from: message.to, text: message.body });
  } catch (error) {
    console.error('[admin] Error handling command:', error);
  }
});

// Export sendTextMessage for use by modules
export async function sendTextMessage(to, text) {
  try {
    await client.sendMessage(to, text);
  } catch (error) {
    console.error(`[send] Failed to send to ${to}:`, error.message);
  }
}

export async function sendLocationRequest(to, text) {
  const message = `${text}\n\n📍 _To share your location, tap the 📎 (attachment) icon, select *Location*, and send your current location._`;
  await sendTextMessage(to, message);
}

export async function sendLocation(to, lat, lng, name, address) {
  const mapLink = `https://maps.google.com/?q=${lat},${lng}`;
  const message = `🏥 *${name}*\n📍 ${address}\n🗺️ ${mapLink}`;
  await sendTextMessage(to, message);
}

export async function markAsRead() {}
export async function sendReaction() {}

// Boot up
async function start() {
  try {
    console.log('🚀 Starting WhatsApp Emergency Bot...\n');

    // Initialize database
    await getDb();
    await runMigrations();
    console.log('[boot] Database ready.');

    // Initialize WhatsApp
    await client.initialize();
  } catch (error) {
    console.error('[boot] Startup failed:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[shutdown] Shutting down...');
  await client.destroy();
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.log('[system] Unhandled Rejection at:', promise, 'reason:', reason);
});

start();
