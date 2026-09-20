// Re-export send functions from the main index.js (where the WhatsApp client lives)
export {
  sendTextMessage,
  sendLocationRequest,
  sendLocation,
  markAsRead,
  sendReaction,
} from '../index.js';
