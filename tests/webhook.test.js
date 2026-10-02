import { jest, describe, test, expect, beforeAll } from '@jest/globals';
import crypto from 'crypto';

jest.unstable_mockModule('../src/config.js', () => ({
  APP_SECRET: 'test_secret'
}));

const { verifySignature, parseWebhookMessages } = await import('../src/whatsapp/webhook.js');

describe('Webhook Verification', () => {
  test('verifySignature with valid signature', () => {
    const rawBody = Buffer.from(JSON.stringify({ test: 'data' }));
    const hash = crypto.createHmac('sha256', 'test_secret').update(rawBody).digest('hex');
    const signature = `sha256=${hash}`;
    expect(verifySignature(rawBody, signature)).toBe(true);
  });

  test('verifySignature with invalid signature', () => {
    const rawBody = Buffer.from(JSON.stringify({ test: 'data' }));
    const signature = `sha256=invalidhash`;
    expect(verifySignature(rawBody, signature)).toBe(false);
  });

  test('verifySignature with missing header', () => {
    const rawBody = Buffer.from(JSON.stringify({ test: 'data' }));
    expect(verifySignature(rawBody, undefined)).toBe(false);
  });
});

describe('Message Parsing', () => {
  test('parse text message', () => {
    const body = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            contacts: [{ profile: { name: 'John Doe' }, wa_id: '919999999999' }],
            messages: [{
              from: '919999999999',
              id: 'wamid.123',
              timestamp: '1726660000',
              type: 'text',
              text: { body: 'hello' }
            }]
          }
        }]
      }]
    };
    
    const messages = parseWebhookMessages(body);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      from: '919999999999',
      id: 'wamid.123',
      name: 'John Doe',
      type: 'text',
      text: 'hello'
    });
  });

  test('ignore status updates', () => {
    const body = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            statuses: [{ id: 'wamid.123', status: 'delivered' }]
          }
        }]
      }]
    };
    const messages = parseWebhookMessages(body);
    expect(messages).toHaveLength(0);
  });
});
