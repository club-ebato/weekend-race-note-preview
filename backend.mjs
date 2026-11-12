// 会員認証（Supabase Auth 互換の /auth/v1）と、権限判定つきのサーバー関数（/rest/v1/rpc）への接続。
// 画面側は権限を判断しない。サーバーが返した内容だけを表示する。
import config from './backend-config.mjs';

export const enabled = !!(config?.url && config?.anonKey);
export const localPreview = !!config?.localPreview;
// 本番記事モード：見本の12レースを出さず、記事管理から公開した記事だけで画面を構成する。
export const managedOnly = enabled && config?.content === 'managed';
const base = enabled ? String(config.url).replace(/\/$/, '') : '';
const KEY = 'race-note-session';
const listeners = new Set();

export class BackendError extends Error {
  constructor(code, message, status = 0) { super(message); this.code = code; this.status = status; }
}
const authMessages = {
  invalid_credentials: 'メールアドレスまたはパスワードが違います。',
  email_not_confirmed: 'メールアドレスの確認がまだ終わっていません。確認メールのリンクを開いてください。',
  weak_password: 'パスワードは8文字以上で入力してください。',
  validation_failed: 'メールアドレスの形式を確認してください。',
  email_address_invalid: 'メールアドレスの形式を確認してください。',
  otp_expired: 'リンクの有効期限が切れているか、すでに使用されています。もう一度お試しください。',
  same_password: '現在とは違うパスワードを入力してください。',
  over_email_send_rate_limit: '短時間に操作が続きました。しばらく待ってからお試しください。',
  over_request_rate_limit: '短時間に操作が続きました。しばらく待ってからお試しください。',
  refresh_token_not_found: 'ログインの有効期限が切れました。もう一度ログインしてください。'
};
const generic = 'うまく処理できませんでした。時間をおいてもう一度お試しください。';
const offline = '通信できませんでした。電波の状況を確認して、もう一度お試しください。';

let session = null;
try {
  const raw = enabled ? JSON.parse(localStorage.getItem(KEY) || 'null') : null;
  if (raw?.access_token && raw?.refresh_token && raw?.user?.id) session = raw;
} catch {}
let account = null;

function store(next) {
  session = next ? {access_token: next.access_token, refresh_token: next.refresh_token,
    expires_at: next.expires_at || Math.floor(Date.now() / 1000) + (next.expires_in || 3600),
    user: {id: next.user?.id, email: next.user?.email}} : null;
  account = null;
  try { session ? localStorage.setItem(KEY, JSON.stringify(session)) : localStorage.removeItem(KEY); } catch {}
  for (const fn of listeners) fn(session);
}
export const onAuthChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export const isSignedIn = () => !!session;
export const email = () => session?.user?.email || '';

async function request(path, {method = 'POST', body, token, query} = {}) {
  let res;
  try {
    res = await fetch(base + path + (query ? '?' + new URLSearchParams(query) : ''), {
      method, headers: {apikey: config.anonKey, authorization: `Bearer ${token || config.anonKey}`,
        ...(body === undefined ? {} : {'content-type': 'application/json'})},
      body: body === undefined ? undefined : JSON.stringify(body)});
  } catch { throw new BackendError('NETWORK', offline); }
  let data = null;
  if (res.status !== 204) { try { data = await res.json(); } catch {} }
  return {res, data};
}
async function auth(path, options) {
  const {res, data} = await request('/auth/v1' + path, options);
  if (!res.ok) {
    const code = data?.error_code || data?.code || 'auth_error';
    throw new BackendError(String(code), authMessages[code] || generic, res.status);
  }
  return data;
}

let refreshing = null;
async function refresh() {
  if (!session) return false;
  refreshing ||= (async () => {
    try {
      store(await auth('/token', {query: {grant_type: 'refresh_token'}, body: {refresh_token: session.refresh_token}}));
      return true;
    } catch (error) {
      if (error.code !== 'NETWORK') store(null);
      return false;
    } finally { refreshing = null; }
  })();
  return refreshing;
}

// サーバー関数の呼び出し。期限切れが近ければ先に更新し、401 のときは一度だけ更新して再試行する。
export async function rpc(name, args = {}) {
  if (!enabled) throw new BackendError('DISABLED', 'サーバーに接続していません。');
  if (session && session.expires_at - 60 < Date.now() / 1000) await refresh();
  let {res, data} = await request('/rest/v1/rpc/' + name, {body: args, token: session?.access_token});
  if (res.status === 401 && session && await refresh()) ({res, data} = await request('/rest/v1/rpc/' + name, {body: args, token: session?.access_token}));
  if (res.ok) return data;
  if (res.status === 401 && data?.code !== '42501') throw new BackendError('KB_LOGIN', 'ログインが必要です。', 401);
  if (data?.code === '42501') throw new BackendError(session ? 'KB_FORBIDDEN' : 'KB_LOGIN', session ? 'この操作を行う権限がありません。' : 'ログインが必要です。', res.status);
  if (typeof data?.message === 'string' && data.message.startsWith('KB_')) throw new BackendError(data.message, data.details || generic, res.status);
  throw new BackendError('SERVER', generic, res.status);
}

const redirectUrl = next => {
  const url = new URL(location.origin + location.pathname);
  const theme = new URLSearchParams(location.search).get('theme');
  if (theme) url.searchParams.set('theme', theme);
  if (next) url.searchParams.set('next', next);
  return url.toString();
};
export const signUp = (mail, password, next) => auth('/signup', {query: {redirect_to: redirectUrl(next)}, body: {email: mail, password, data: {adult_confirmed: true}}});
export const resend = (mail, next) => auth('/resend', {query: {redirect_to: redirectUrl(next)}, body: {type: 'signup', email: mail}});
export const recover = mail => auth('/recover', {query: {redirect_to: redirectUrl('')}, body: {email: mail}});
export async function signIn(mail, password) { store(await auth('/token', {query: {grant_type: 'password'}, body: {email: mail, password}})); }
export async function verifyLink(type, tokenHash) { store(await auth('/verify', {body: {type, token_hash: tokenHash}})); }
export async function adoptTokens(accessToken, refreshToken, expiresIn) {
  const user = await auth('/user', {method: 'GET', token: accessToken});
  store({access_token: accessToken, refresh_token: refreshToken, expires_in: Number(expiresIn) || 3600, user});
}
export async function updatePassword(password) {
  if (session && session.expires_at - 60 < Date.now() / 1000) await refresh();
  if (!session) throw new BackendError('KB_LOGIN', 'ログインが必要です。');
  await request('/auth/v1/user', {method: 'PUT', body: {password}, token: session.access_token}).then(({res, data}) => {
    if (!res.ok) throw new BackendError(String(data?.error_code || 'auth_error'), authMessages[data?.error_code] || generic, res.status);
  });
}
// 現在のパスワードを確かめる（セッションは入れ替えない）。
export async function checkPassword(password) {
  await auth('/token', {query: {grant_type: 'password'}, body: {email: email(), password}});
}
export async function signOut() {
  const token = session?.access_token;
  store(null);
  if (token) { try { await request('/auth/v1/logout', {token, query: {scope: 'global'}}); } catch {} }
}

// 会員情報（メール・スタッフ権限・閲覧できる記事）。表示の出し分け用で、権限の判定はサーバーが行う。
export async function myAccount(force = false) {
  if (!session) return null;
  if (!account || force) account = await rpc('my_account');
  return account;
}
export const cachedAccount = () => account;

let sessionId = '';
export function track(name, article = null, props = {}) {
  if (!enabled) return;
  try {
    sessionId ||= sessionStorage.getItem('race-note-sid') || (crypto.randomUUID?.() || String(Math.random()).slice(2));
    sessionStorage.setItem('race-note-sid', sessionId);
  } catch { sessionId ||= String(Math.random()).slice(2); }
  rpc('track_event', {p_name: name, p_session: sessionId, p_article: article, p_props: props}).catch(() => {});
}
