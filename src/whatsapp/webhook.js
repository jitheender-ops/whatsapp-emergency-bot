/**
 * Parse an incoming webhook payload from Twilio.
 * Twilio sends `application/x-www-form-urlencoded` payloads.
 *
 * @param {object} body - The parsed urlencoded form body.
 * @returns {Array<object>} Array containing the parsed message (normalized format).
 */
export function parseWebhookMessages(body) {
  if (!body || !body.From) return [];

  // Twilio passes 'whatsapp:+1234567890'. We strip 'whatsapp:'
  const from = body.From.replace('whatsapp:', '');
  
  // Basic message skeleton
  const msg = {
    from,
    id: body.MessageSid,
    name: body.ProfileName || 'User',
    type: 'text',
    text: body.Body || ''
  };

  // Check if Twilio attached location coordinates
  if (body.Latitude && body.Longitude) {
    msg.type = 'location';
    msg.location = {
      latitude: parseFloat(body.Latitude),
      longitude: parseFloat(body.Longitude)
    };
  }

  return [msg];
}
