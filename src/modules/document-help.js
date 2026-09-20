import { sendTextMessage } from '../whatsapp/client.js';
import { getSession, setSession, clearSession } from '../services/session.js';

const DOCUMENT_GUIDES = {
  aadhaar: { title: 'Aadhaar Card', emoji: '🆔', steps: ['1️⃣ Visit uidai.gov.in or nearest centre.', '2️⃣ Select "Order Aadhaar Reprint".', '3️⃣ Provide biometrics.'] },
  pan: { title: 'PAN Card', emoji: '💳', steps: ['1️⃣ Visit incometax.gov.in.', '2️⃣ Select "Reprint of PAN Card".', '3️⃣ Submit identity/address proof.'] },
  voter_id: { title: 'Voter ID Card', emoji: '🗳️', steps: ['1️⃣ Visit nvsp.in.', '2️⃣ Fill Form 001.', '3️⃣ Upload passport-size photo.'] },
  passport: { title: 'Passport', emoji: '🛂', steps: ['1️⃣ File FIR (mandatory).', '2️⃣ Visit passportindia.gov.in.', '3️⃣ Book PSK appointment.'] },
  driving_license: { title: 'Driving License', emoji: '🚗', steps: ['1️⃣ File FIR.', '2️⃣ Visit parivahan.gov.in.', '3️⃣ Apply for Form DL-D.'] },
  ration_card: { title: 'Ration Card', emoji: '🏪', steps: ['1️⃣ Visit state food department website.', '2️⃣ Submit affidavit and ID proof.'] },
};

function extractDocument(input) {
  const text = (input || '').trim().toLowerCase();
  if (text.includes('1') || text.includes('aadhaar')) return 'aadhaar';
  if (text.includes('2') || text.includes('pan')) return 'pan';
  if (text.includes('3') || text.includes('voter')) return 'voter_id';
  if (text.includes('4') || text.includes('passport')) return 'passport';
  if (text.includes('5') || text.includes('driving') || text.includes('license')) return 'driving_license';
  if (text.includes('6') || text.includes('ration')) return 'ration_card';
  return null;
}

export async function handleDocumentHelp(msg) {
  try {
    const { from, text } = msg;
    const session = getSession(from);

    if (!session.step) {
      setSession(from, 'document_help', 'select_document');
      const menu = `📄 *Lost Document Assistance*\nReply with the number of the document:\n\n1. Aadhaar Card\n2. PAN Card\n3. Voter ID\n4. Passport\n5. Driving License\n6. Ration Card`;
      await sendTextMessage(from, menu);
      return;
    }

    if (session.step === 'select_document') {
      const docKey = extractDocument(text);
      if (!docKey) {
        await sendTextMessage(from, '❌ Please select a valid document number (1-6).');
        return;
      }
      setSession(from, 'document_help', 'show_guide', { documentKey: docKey });
      const guide = DOCUMENT_GUIDES[docKey];
      const guideMessage = `${guide.emoji} *How to Replace Your ${guide.title}*\n\n${guide.steps.join('\n')}\n\n📋 Need an FIR template? Type *fir*.\nType *menu* to go back.`;
      await sendTextMessage(from, guideMessage);
      clearSession(from); // Simplified: we can just clear it here and rely on global intent if they type FIR later
      return;
    }

    clearSession(from);
    await handleDocumentHelp(msg);
  } catch (error) {
    console.error('[DocumentHelp] Error:', error);
    clearSession(msg.from);
    await sendTextMessage(msg.from, '⚠️ Something went wrong. Type *menu* to try again.');
  }
}
