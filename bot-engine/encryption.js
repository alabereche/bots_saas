// ═══════════════════════════════════════════════════════════════
// BotForge Engine — AES-256-GCM Secure Encryption (ESM)
// ═══════════════════════════════════════════════════════════════

import crypto from 'crypto';

const secretSeed = process.env.ENCRYPTION_KEY || process.env.API_KEY;
if (!secretSeed) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL SECURITY ERROR: ENCRYPTION_KEY environment variable is required in production!');
  }
  console.warn('[SECURITY WARNING] ENCRYPTION_KEY is not set. Using dev fallback key.');
}
const KEY = crypto.createHash('sha256').update(secretSeed || 'botforge_dev_fallback_salt_2026').digest();

export function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `gcm:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(encryptedText) {
  if (!encryptedText) return '';
  if (!encryptedText.includes(':')) return encryptedText;

  const parts = encryptedText.split(':');
  
  if (parts[0] === 'gcm' && parts.length === 4) {
    try {
      const iv = Buffer.from(parts[1], 'hex');
      const tag = Buffer.from(parts[2], 'hex');
      const encrypted = parts[3];
      const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
      decipher.setAuthTag(tag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (e) {
      console.error('[Encryption] GCM Decrypt failed:', e.message);
      return '';
    }
  }

  return encryptedText;
}
