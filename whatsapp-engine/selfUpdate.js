// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — Self-Update Module
//
// THE root cause of WhatsApp breakages: WhatsApp Web's protocol drifts
// ahead of the installed whatsapp-web.js copy — auth keeps working but
// sync hangs and message events die. This module closes the loop:
//
//   checkForUpdate()  — installed vs latest on the npm registry
//   performUpdate()   — npm install @latest, then exit(0); PM2 revives
//                       the engine on the new code automatically
//
// Scheduled from index.js (boot + every 24h). Update NOTICES go to the
// super admin's dashboard; the one-click execution endpoint is gated to
// the super admin uid — silent auto-updates are deliberately NOT done
// (a bad library release must not take every bot down unattended).
// ═══════════════════════════════════════════════════════════════

const { execFile } = require('child_process');
const path = require('path');
const https = require('https');

const ENGINE_DIR = __dirname;
const NPM_TIMEOUT_MS = 3 * 60 * 1000;

// Dedupe key of the last version pair we alerted about — the daily cron
// must not re-notify for the same stale version every day
let lastNotifiedKey = null;

function notifiedKey(installed, latest) {
  return `${installed}->${latest}`;
}

function markNotified(installed, latest) {
  lastNotifiedKey = notifiedKey(installed, latest);
}

function alreadyNotified(installed, latest) {
  return lastNotifiedKey === notifiedKey(installed, latest);
}

function installedVersion() {
  try {
    return require('whatsapp-web.js/package.json').version;
  } catch {
    return null;
  }
}

// Query the npm registry directly (no npm CLI, no login, fast)
function fetchLatestVersion() {
  return new Promise((resolve, reject) => {
    const req = https.get('https://registry.npmjs.org/whatsapp-web.js/latest', { timeout: 15000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body).version || null);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('timeout', () => { req.destroy(new Error('npm registry timeout')); });
    req.on('error', reject);
  });
}

async function checkForUpdate() {
  const installed = installedVersion();
  let latest = null;
  try {
    latest = await fetchLatestVersion();
  } catch (e) {
    return { installed, latest: null, updateAvailable: false, error: e.message };
  }
  if (!installed || !latest) {
    return { installed, latest, updateAvailable: false };
  }
  // Plain inequality on purpose: any drift (even a downgrade fight with a
  // caret range that self-resolved wrongly) deserves the admin's eyes.
  const updateAvailable = installed !== latest;
  return { installed, latest, updateAvailable };
}

// Runs `npm install whatsapp-web.js@latest` inside the engine dir, then
// exits so PM2 revives the engine on the fresh node_modules. Resolves
// BEFORE the exit so the HTTP caller gets his answer first.
async function performUpdate() {
  const latest = (await checkForUpdate()).latest;
  if (!latest) {
    return { success: false, error: 'تعذر جلب أحدث إصدار من سجل npm' };
  }
  const installed = installedVersion();
  if (installed === latest) {
    return { success: true, message: `المحرك محدّث بالفعل إلى ${latest}`, restarted: false };
  }

  await new Promise((resolve, reject) => {
    execFile('npm', ['install', `whatsapp-web.js@${latest}`, '--no-audit', '--no-fund'], {
      cwd: ENGINE_DIR,
      timeout: NPM_TIMEOUT_MS,
      windowsHide: true,
    }, (err, stdout, stderr) => {
      if (err) {
        console.error('[SelfUpdate] npm install failed:', (stderr || err.message || '').slice(0, 300));
        reject(new Error('فشل تثبيت التحديث — راجع سجلات المحرك'));
      } else {
        console.log(`[SelfUpdate] ✅ whatsapp-web.js upgraded to ${latest} — restarting engine via PM2`);
        resolve();
      }
    });
  });

  // Give the HTTP response a beat to reach the dashboard, then let PM2
  // revive us on the new libraries.
  setTimeout(() => process.exit(0), 800);
  return { success: true, message: `تم التحديث إلى ${latest} — المحرك يعيد تشغيل نفسه الآن`, restarted: true };
}

module.exports = { checkForUpdate, performUpdate, installedVersion, markNotified, alreadyNotified };
