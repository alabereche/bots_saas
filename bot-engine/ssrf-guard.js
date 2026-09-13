// ═══════════════════════════════════════════════════════════════
// BotForge — SSRF guard for user-supplied webhook URLs
// The /api/sheets/test-sync endpoints accept an arbitrary URL from
// an authenticated bot owner; without this check the VPS could be
// pivoted against localhost, the private LAN, or the cloud metadata
// service (169.254.169.254). Only public https(s) hosts are allowed.
// ═══════════════════════════════════════════════════════════════

const PRIVATE_V4 = /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;
const PRIVATE_HOSTNAMES = /^(localhost|metadata|metadata\.google\.internal|instance-data)$/i;

function isPrivateV4(hostname) {
  if (PRIVATE_HOSTNAMES.test(hostname)) return true;
  if (PRIVATE_V4.test(hostname)) return true;
  // 169.254.169.254-style link-local / unspecified / loopback, numeric
  const parts = hostname.split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => /^\d{1,3}$/.test(p)) &&
    parts.some(p => {
      const octet = parseInt(p, 10);
      return p.length > 1 && p.startsWith('0') ? true : octet > 255;
    }) ||
    (parts[0] === '127' || parts[0] === '10' || parts[0] === '0' ||
      (parts[0] === '192' && parts[1] === '168') ||
      (parts[0] === '169' && parts[1] === '254') ||
      (parts[0] === '172' && parseInt(parts[1], 10) >= 16 && parseInt(parts[1], 10) <= 31));
}

function isPrivateV6(hostname) {
  const h = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return h === '::1' || h === '::' || h.startsWith('fc') || h.startsWith('fd') ||
    h.startsWith('fe80') || h.startsWith('::ffff:127.') || h.startsWith('::ffff:10.') ||
    h.startsWith('::ffff:169.254') || h.startsWith('::ffff:192.168');
}

/**
 * Returns an error string if the URL must be rejected, or null if OK.
 * Rules: absolute http(s) URL, hostname is a public DNS name or public IP.
 * (DNS-rebinding to a private IP is out of scope here — engines run on a
 * single VPS whose egress the attacker already cannot read responses from;
 * this guard kills the direct internal-probe primitive.)
 */
function validateWebhookUrl(raw) {
  if (!raw || typeof raw !== 'string') return 'رابط الويبهوك مطلوب';
  let url;
  try {
    url = new URL(raw);
  } catch {
    return 'رابط الويبهوك غير صالح';
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return 'مسموح فقط بروابط http/https';
  }
  const host = url.hostname;
  if (!host) return 'رابط الويبهوك غير صالح';
  if (isPrivateV4(host) || isPrivateV6(host)) {
    return 'روابط الشبكات الداخلية غير مسموح بها';
  }
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) {
    return 'روابط الشبكات الداخلية غير مسموح بها';
  }
  return null;
}

export { validateWebhookUrl };
