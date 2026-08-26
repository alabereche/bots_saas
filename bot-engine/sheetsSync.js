// ═══════════════════════════════════════════════════════════════
// AuraBot Telegram Engine — Google Sheets & Webhook Live Sync
// ═══════════════════════════════════════════════════════════════

const TIMEOUT_MS = 7000;

export async function syncToGoogleSheets(config, payload) {
  const webhookUrl = config?.googleSheetsWebhookUrl || config?.webhookUrl;
  if (!webhookUrl || typeof webhookUrl !== 'string') {
    return false;
  }

  const cleanUrl = webhookUrl.trim();
  if (!cleanUrl.startsWith('https://') && !cleanUrl.startsWith('http://')) {
    console.warn(`[SheetsSync] Invalid Webhook URL for bot ${config.id || config.botName}`);
    return false;
  }

  const fullPayload = {
    ...payload,
    botId: config.id || '',
    botName: config.botName || config.businessName || '',
    syncedAt: new Date().toISOString(),
  };

  try {
    const res = await fetch(cleanUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AuraBot-Sheets-Sync/1.0',
      },
      body: JSON.stringify(fullPayload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (res.ok) {
      console.log(`[SheetsSync] Successfully synced "${payload.event}" to Google Sheets for bot "${config.botName}"`);
      return true;
    } else {
      const errText = await res.text().catch(() => '');
      console.warn(`[SheetsSync] Google Sheets Webhook returned HTTP ${res.status} for bot "${config.botName}": ${errText.slice(0, 150)}`);
      return false;
    }
  } catch (err) {
    console.error(`[SheetsSync] Failed to sync to Google Sheets for bot "${config.botName}": ${err.message}`);
    return false;
  }
}
