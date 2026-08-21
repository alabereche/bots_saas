import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(
  fs.readFileSync('./whatsapp-engine/serviceAccountKey.json', 'utf8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkBots() {
  const snap = await db.collection('bots').get();
  console.log(`Found ${snap.size} bots:`);
  snap.forEach(doc => {
    const data = doc.data();
    console.log(`\n--- Bot ID: ${doc.id} (${data.businessName || data.botName}) ---`);
    console.log('Products:', JSON.stringify(data.products || [], null, 2));
  });
}

checkBots().catch(console.error);
