// ═══════════════════════════════════════════════════════════════
// BotForge — One-time backfill: stamp each tenant's userId on every
// existing conversation and order document, so the locked-down
// security rules (owner-only access) cover historical data too.
//
// Run ONCE on the VPS, from the repository root, AFTER the engines
// are deployed with the Admin SDK (patch F3) and BEFORE the new
// firestore.rules are deployed (patch F1):
//
//   FIREBASE_SERVICE_ACCOUNT_B64="..." node scripts/backfill-owner.cjs
//
// (or with GOOGLE_APPLICATION_CREDENTIALS pointing at the key file)
// ═══════════════════════════════════════════════════════════════

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
const BATCH_SIZE = 400;

async function backfillCollection(name, botOwners) {
  let stamped = 0;
  let skipped = 0;
  const snapshot = await db.collection(name).get();

  let batch = db.batch();
  let ops = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.userId) {
      skipped++;
      continue;
    }
    const owner = botOwners[data.botId];
    if (!owner) {
      // No owning bot found (orphan document) — leave it untouched
      skipped++;
      continue;
    }
    batch.update(doc.ref, { userId: owner });
    stamped++;
    if (++ops >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
      console.log(`  ${name}: ${stamped} stamped so far...`);
    }
  }

  if (ops > 0) await batch.commit();
  console.log(`✅ ${name}: ${stamped} documents stamped with userId, ${skipped} skipped (already stamped or orphaned)`);
}

async function main() {
  console.log('🔄 Backfilling owner userId onto conversations and orders...');

  const botsSnap = await db.collection('bots').get();
  const botOwners = {};
  const botsWithoutOwner = [];
  botsSnap.forEach(d => {
    const userId = d.data().userId;
    if (userId) {
      botOwners[d.id] = userId;
    } else {
      botsWithoutOwner.push(d.id);
    }
  });
  console.log(`Found ${Object.keys(botOwners).length} bot(s) with a known owner.`);
  if (botsWithoutOwner.length) {
    console.warn(`⚠️  ${botsWithoutOwner.length} bot(s) have NO userId field: ${botsWithoutOwner.join(', ')}`);
    console.warn('   After the new rules deploy, their owners cannot control them.');
    console.warn('   Fix each by setting bots/<id>.userId manually (Admin SDK) BEFORE deploying the rules.');
  }

  await backfillCollection('conversations', botOwners);
  await backfillCollection('orders', botOwners);

  console.log('🎉 Backfill complete — the new security rules now cover historical data.');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Backfill failed:', err.message);
  process.exit(1);
});
