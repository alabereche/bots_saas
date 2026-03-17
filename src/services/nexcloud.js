// ═══════════════════════════════════════════════════════════════
// BotForge — NexCloud Service Layer
// All NexCloud API interactions go through this module
// ═══════════════════════════════════════════════════════════════

const API = import.meta.env.VITE_API_URL;
const KEY = import.meta.env.VITE_API_KEY;

// ─── Token Management ─────────────────────────────────────────
let accessToken = localStorage.getItem('bf_access_token');
let refreshToken = localStorage.getItem('bf_refresh_token');

function setTokens(access, refresh) {
  accessToken = access;
  refreshToken = refresh;
  if (access) localStorage.setItem('bf_access_token', access);
  else localStorage.removeItem('bf_access_token');
  if (refresh) localStorage.setItem('bf_refresh_token', refresh);
  else localStorage.removeItem('bf_refresh_token');
}

function getAccessToken() { return accessToken; }
function getRefreshToken() { return refreshToken; }

// ─── Core Request Helper ──────────────────────────────────────
async function nex(method, path, body, isForm) {
  const headers = { 'x-api-key': KEY };
  if (accessToken) headers['Authorization'] = 'Bearer ' + accessToken;
  if (!isForm && body) headers['Content-Type'] = 'application/json';
  const opt = { method, headers };
  if (body) opt.body = isForm ? body : JSON.stringify(body);
  const res = await fetch(API + path, opt);

  // Try to refresh if unauthorized
  if (res.status === 401 && refreshToken && path !== '/project-auth/refresh') {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      headers['Authorization'] = 'Bearer ' + accessToken;
      const retryOpt = { method, headers };
      if (body) retryOpt.body = isForm ? body : JSON.stringify(body);
      const retryRes = await fetch(API + path, retryOpt);
      const retryData = await retryRes.json();
      if (!retryRes.ok) throw new Error(retryData.error || 'HTTP ' + retryRes.status);
      return retryData;
    }
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
  return data;
}

// ─── Auth: Register ───────────────────────────────────────────
export async function register(name, email, password) {
  const res = await nex('POST', '/project-auth/register', { name, email, password });
  return res; // { success, userId, otpToken, botUrl }
}

// Poll registration OTP status
export function startRegistrationPolling(otpToken, onCodeSent, onExpired) {
  const timer = setInterval(async () => {
    try {
      const data = await nex('GET', '/otp/link/' + otpToken + '/status');
      if (data.status === 'otp_sent') {
        clearInterval(timer);
        onCodeSent();
      } else if (data.status === 'expired') {
        clearInterval(timer);
        if (onExpired) onExpired();
      }
    } catch (e) {
      console.error('Polling error:', e);
    }
  }, 3000);
  return timer;
}

export async function verifyRegistration(otpToken, code) {
  const res = await nex('POST', '/project-auth/verify', { token: otpToken, code });
  setTokens(res.accessToken, res.refreshToken);
  return res; // { success, user, accessToken, refreshToken }
}

// ─── Auth: Login ──────────────────────────────────────────────
export async function login(email, password) {
  const res = await nex('POST', '/project-auth/login', { email, password });
  return res; // { success, loginToken }
}

export async function verifyLogin(loginToken, code) {
  const res = await nex('POST', '/project-auth/login/verify', { loginToken, code });
  setTokens(res.accessToken, res.refreshToken);
  return res; // { success, user, accessToken, refreshToken }
}

// ─── Auth: Forgot Password ───────────────────────────────────
export async function forgotPassword(email) {
  return await nex('POST', '/project-auth/forgot-password', { email });
}

export async function resetPassword(resetToken, code, new_password) {
  return await nex('POST', '/project-auth/reset-password', { resetToken, code, new_password });
}

// ─── Auth: Session ────────────────────────────────────────────
async function tryRefreshSession() {
  if (!refreshToken) return false;
  try {
    const res = await nex('POST', '/project-auth/refresh', { refresh_token: refreshToken });
    setTokens(res.accessToken, res.refreshToken);
    return true;
  } catch {
    setTokens(null, null);
    return false;
  }
}

export async function refreshSession() {
  if (!refreshToken) throw new Error('No refresh token');
  const res = await nex('POST', '/project-auth/refresh', { refresh_token: refreshToken });
  setTokens(res.accessToken, res.refreshToken);
  return res;
}

export async function logout() {
  try {
    if (refreshToken) {
      await nex('POST', '/project-auth/logout', { refresh_token: refreshToken });
    }
  } catch { /* ignore */ }
  setTokens(null, null);
  localStorage.removeItem('bf_user');
}

// ─── Auth: Profile ────────────────────────────────────────────
export async function getProfile() {
  return await nex('GET', '/project-auth/me');
}

export async function updateProfile(data) {
  return await nex('PUT', '/project-auth/me', data);
}

// ─── Database ─────────────────────────────────────────────────
export async function getDocs(slug, filter, page = 1, limit = 50) {
  let path = '/database/ext/' + slug + '/documents?page=' + page + '&limit=' + limit;
  if (filter) path += '&filter=' + encodeURIComponent(JSON.stringify(filter));
  return await nex('GET', path);
}

export async function getDoc(slug, docId) {
  return await nex('GET', '/database/ext/' + slug + '/documents/' + docId);
}

export async function createDoc(slug, data) {
  return await nex('POST', '/database/ext/' + slug + '/documents', { data });
}

export async function updateDoc(slug, docId, data, merge = true) {
  return await nex('PATCH', '/database/ext/' + slug + '/documents/' + docId, { data, merge });
}

export async function deleteDoc(slug, docId) {
  return await nex('DELETE', '/database/ext/' + slug + '/documents/' + docId);
}

// ─── Storage ──────────────────────────────────────────────────
export async function uploadFile(file, folder) {
  const fd = new FormData();
  fd.append('file', file);
  if (folder) fd.append('folder', folder);
  return await nex('POST', '/files/upload', fd, true);
}

export async function getFileUrl(fileId) {
  const { url } = await nex('GET', '/files/' + fileId + '/url');
  return url;
}

export async function listFiles(folder, page = 1, limit = 50) {
  let path = '/files?page=' + page + '&limit=' + limit;
  if (folder) path += '&folder=' + folder;
  return await nex('GET', path);
}

// ─── Notify ───────────────────────────────────────────────────
export async function sendNotify(message) {
  return await nex('POST', '/notify', { message });
}

// ─── Utils ────────────────────────────────────────────────────
export function isAuthenticated() {
  return !!accessToken;
}

export function getSavedUser() {
  try {
    return JSON.parse(localStorage.getItem('bf_user'));
  } catch {
    return null;
  }
}

export function saveUser(user) {
  localStorage.setItem('bf_user', JSON.stringify(user));
}
