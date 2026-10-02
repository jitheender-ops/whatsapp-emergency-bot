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

const FRIEND = '911111111111@c.us';
const PATIENT = '912222222222@c.us';
const ADMIN = '919999999999@c.us';
const say = (from, text) => handleMessage({ from, id: 'x', name: 'User', type: 'text', text });
const lastTo = (to) => sent.filter((m) => m.to === to).at(-1)?.text || '';

describe('Router', () => {
  beforeAll(async () => {
    process.env.ADMIN_PHONES = '91 99999 99999';
    await initDb(':memory:');
    await runMigrations();
    registerDonor('913333333333@c.us', 'Ravi', 'O-', 'Delhi');
    registerDonor('914444444444@c.us', 'Sita', 'B+', 'Delhi');
  });
  afterAll(() => closeDb());
  beforeEach(() => { sent.length = 0; });

  test('ignores ordinary chats from people who never asked for the bot', async () => {
    for (const t of ['hi', 'hello bro', '1', 'lost my keys', 'status', 'ok']) await say(FRIEND, t);
    expect(sent).toEqual([]);
  });

  test('menu opts in; afterwards digits work', async () => {
    await say(PATIENT, 'menu');
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
    await say(FRIEND, 'menu');
    await say(FRIEND, 'status 1');
    expect(lastTo(FRIEND)).toContain('No request');
  });

  test('admin can list and close requests; requester is told', async () => {
    await say(FRIEND, 'admin list');        // not an admin → silent
    expect(sent.filter((m) => m.text.includes('Active requests'))).toEqual([]);

    await say(ADMIN, 'admin list');
    expect(lastTo(ADMIN)).toContain('#1');
    await say(ADMIN, 'admin done 1');
    expect(lastTo(PATIENT)).toContain('fulfilled');
    await say(PATIENT, 'status 1');
    expect(lastTo(PATIENT)).toContain('*fulfilled*');
  });

  test('menu escapes a half-finished flow', async () => {
    await say(PATIENT, 'blood');
    await say(PATIENT, 'menu');
    expect(lastTo(PATIENT)).toContain('Main Menu');
  });
});
