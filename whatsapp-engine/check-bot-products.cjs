require('dotenv').config({ path: '../.env' });
const admin = require('firebase-admin');

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_B64
  ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8')
  : null;

if (!admin.apps.length) {
  const credential = serviceAccountJson
    ? admin.credential.cert(JSON.parse(serviceAccountJson))
    : admin.credential.applicationDefault();
  admin.initializeApp({ credential });
}

const db = admin.firestore();

async function checkBots() {
  const snap = await db.collection('bots').get();
  console.log(`Found ${snap.size} bots:`);
  snap.forEach(doc => {
    const data = doc.data();
    console.log(`\n=== Bot ID: ${doc.id} (${data.businessName || data.botName}) ===`);
    console.log('Products:', JSON.stringify(data.products || [], null, 2));
  });
}

checkBots().catch(console.error);
