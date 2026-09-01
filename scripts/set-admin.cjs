const path = require('path');
let dotenv;
try { dotenv = require('dotenv'); }
catch { dotenv = require('../whatsapp-engine/node_modules/dotenv'); }
let admin;
try { admin = require('firebase-admin'); }
catch { admin = require('../whatsapp-engine/node_modules/firebase-admin'); }

dotenv.config();
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', 'whatsapp-engine', '.env') });

const saB64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
if (!saB64) { console.error('FIREBASE_SERVICE_ACCOUNT_B64 missing'); process.exit(1); }
const sa = JSON.parse(Buffer.from(saB64, 'base64').toString('utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });

const email = process.argv[2];
if (!email) { console.error('Usage: node scripts/set-admin.cjs <email>'); process.exit(1); }

admin.auth().getUserByEmail(email.trim().toLowerCase()).then((user) => {
  return admin.auth().setCustomUserClaims(user.uid, { admin: true }).then(() => {
    console.log('OK — admin claim set for', email, '| uid:', user.uid);
  });
}).catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
