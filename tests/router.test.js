import { describe, test, expect, beforeAll, beforeEach, afterAll, jest } from '@jest/globals';

// Replace the real WhatsApp client (it would launch Chrome) with a recorder.
const sent = [];
jest.unstable_mockModule('../src/whatsapp/client.js', () => ({
  sendTextMessage: jest.fn(async (to, text) => { sent.push({ to, text }); }),
  sendLocationRequest: jest.fn(),
  sendLocation: jest.fn(),
  markAsRead: jest.fn(),
  sendReaction: jest.fn(),
}));

const { initDb, closeDb } = await import('../src/db/database.js');
const { runMigrations } = await import('../src/db/migrations.js');
const { registerDonor } = await import('../src/db/models/user.js');
const { handleMessage } = await import('../src/modules/router.js');
const { handleAdmin } = await import('../src/modules/requests.js');

const FRIEND = '911111111111@c.us';
const PATIENT = '912222222222@c.us';
const say = (from, text) => handleMessage({ from, id: 'x', name: 'User', type: 'text', text });
const lastTo = (to) => sent.filter((m) => m.to === to).at(-1)?.text || '';

describe('Router', () => {
  beforeAll(async () => {
    process.env.BOT_TRIGGER = '#Help';
    await initDb(':memory:');
    await runMigrations();
    registerDonor('913333333333@c.us', 'Ravi', 'O-', 'Delhi');
    registerDonor('914444444444@c.us', 'Sita', 'B+', 'Delhi');
  });
  afterAll(() => closeDb());
  beforeEach(() => { sent.length = 0; });

  test('ignores everything until the trigger word, even service words', async () => {
    for (const t of ['hi', 'menu', 'blood', 'hospital', '1', 'status', 'help', 'ok']) await say(FRIEND, t);
    expect(sent).toEqual([]);
  });

  test('trigger word opts in (case-insensitive); afterwards digits work', async () => {
    await say(PATIENT, '#HELP');
    expect(lastTo(PATIENT)).toContain('Main Menu');
    await say(PATIENT, '1');
    expect(lastTo(PATIENT)).toContain('blood group');
  });

  test('blood search matches compatible donors, shows contact + request id', async () => {
    await say(PATIENT, 'A+');
    await say(PATIENT, 'delhi');
    const reply = lastTo(PATIENT);
    expect(reply).toContain('Ravi');                 // O- can give to A+
    expect(reply).not.toContain('Sita');             // B+ cannot
    expect(reply).toContain('wa.me/913333333333');
    expect(reply).toMatch(/Request ID: \*#1\* — status: \*active\*/);
  });

  test('status shows the request; others cannot see it', async () => {
    await say(PATIENT, 'status 1');
    expect(lastTo(PATIENT)).toContain('*#1*');
    await say(FRIEND, '#help');
    await say(FRIEND, 'status 1');
    expect(lastTo(FRIEND)).toContain('No request');
  });

  test('admin commands from other people are ignored', async () => {
    await say(FRIEND, 'admin done 1');
    expect(sent.filter((m) => m.text.includes('fulfilled'))).toEqual([]);
  });

  test('owner (self-chat) can list and close requests; requester is told', async () => {
    const OWNER = '919999999999@c.us';
    await handleAdmin({ from: OWNER, text: 'admin list' });
    expect(lastTo(OWNER)).toContain('#1');
    await handleAdmin({ from: OWNER, text: 'Admin done 1' });
    expect(lastTo(PATIENT)).toContain('fulfilled');
    await say(PATIENT, 'status 1');
    expect(lastTo(PATIENT)).toContain('*fulfilled*');
  });

  test('goes silent again after the active window', async () => {
    const realNow = Date.now;
    Date.now = () => realNow() + 31 * 60 * 1000;
    try {
      await say(PATIENT, 'menu');
      expect(sent).toEqual([]);
    } finally {
      Date.now = realNow;
    }
  });

  test('menu escapes a half-finished flow', async () => {
    await say(PATIENT, '#help');
    await say(PATIENT, 'blood');
    await say(PATIENT, 'menu');
    expect(lastTo(PATIENT)).toContain('Main Menu');
  });
});
