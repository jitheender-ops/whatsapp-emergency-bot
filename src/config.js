import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

/**
 * Twilio Configuration setup
 */
export const config = {
  PORT: process.env.PORT || 3000,
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '', // The Sandbox number
};

export function validateConfig() {
  const missing = [];
  if (!config.TWILIO_ACCOUNT_SID) missing.push('TWILIO_ACCOUNT_SID');
  if (!config.TWILIO_AUTH_TOKEN) missing.push('TWILIO_AUTH_TOKEN');
  if (!config.TWILIO_PHONE_NUMBER) missing.push('TWILIO_PHONE_NUMBER');

  if (missing.length > 0) {
    console.warn(`[config] Missing Twilio environment variables: ${missing.join(', ')}`);
  }
}
