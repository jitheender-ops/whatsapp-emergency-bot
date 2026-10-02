/**
 * In-memory session manager for multi-step conversation flows.
 * Tracks which module a user is interacting with, what step they're on,
 * and any partially collected data.
 *
 * Sessions auto-expire after 30 minutes of inactivity.
 */

/** @type {Map<string, {module: string, step: string, data: Object, lastActivity: number}>} */
const sessions = new Map();

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Get or create a session for a user.
 * @param {string} phone - User's phone number
 * @returns {{module: string|null, step: string|null, data: Object, lastActivity: number}}
 */
export function getSession(phone) {
  cleanExpiredSessions();

  if (sessions.has(phone)) {
    const session = sessions.get(phone);
    session.lastActivity = Date.now();
    return session;
  }

  const session = {
    module: null,
    step: null,
    data: {},
    lastActivity: Date.now(),
  };
  sessions.set(phone, session);
  return session;
}

/**
 * Set the active module and step for a user's session.
 * @param {string} phone
 * @param {string} module - Module name ('blood', 'ambulance', 'documents', 'onboarding', 'register')
 * @param {string} step - Step within the module
 * @param {Object} [data] - Optional data to merge into session
 */
export function setSession(phone, module, step, data) {
  const session = getSession(phone);
  session.module = module;
  session.step = step;
  if (data) {
    Object.assign(session.data, data);
  }
  session.lastActivity = Date.now();
}

/**
 * Update session data without changing module/step.
 * @param {string} phone
 * @param {Object} data - Data to merge
 */
export function updateSessionData(phone, data) {
  const session = getSession(phone);
  Object.assign(session.data, data);
  session.lastActivity = Date.now();
}

/**
 * Clear a user's session (reset to fresh state).
 * @param {string} phone
 */
export function clearSession(phone) {
  sessions.delete(phone);
}

/**
 * Check if a user has an active session in a specific module.
 * @param {string} phone
 * @param {string} module
 * @returns {boolean}
 */
export function isInModule(phone, module) {
  if (!sessions.has(phone)) return false;
  const session = sessions.get(phone);
  return session.module === module && (Date.now() - session.lastActivity) < SESSION_TTL_MS;
}

/**
 * Clean up sessions that have been inactive longer than TTL.
 */
function cleanExpiredSessions() {
  const now = Date.now();
  for (const [phone, session] of sessions) {
    if (now - session.lastActivity > SESSION_TTL_MS) {
      sessions.delete(phone);
    }
  }
}

/**
 * Get the total number of active sessions (for monitoring).
 * @returns {number}
 */
export function getActiveSessionCount() {
  cleanExpiredSessions();
  return sessions.size;
}
