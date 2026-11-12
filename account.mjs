// サイト内の会員登録・ログイン・パスワード再設定・マイページの会員欄。
// LINE連携は使わない。無料記事は登録しなくても読める。
import * as backend from './backend.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const safeNext = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9\-/]{0,120}$/.test(value) && !value.startsWith('account') && !value.startsWith('login') ? value : '';
const remember = (key, value) => { try { value ? sessionStorage.setItem(key, value) : sessionStorage.removeItem(key); } catch {} };
const recall = key => { try { return sessionStorage.getItem(key) || ''; } catch { return ''; } };
export const roleLabel = role => ({editor: '編集者', publisher: '公開管理者', admin: '管理者'})[role] || '';

// メール内のリンクで戻ってきたときの情報を取り出し、URL からは消す。
export function pendingAuthLink() {
  if (!backend.enabled) return null;
  const query = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  let link = null;
  if (query.get('token_hash') && ['signup', 'recovery', 'email'].includes(query.get('type'))) {
    link = {tokenHash: query.get('token_hash'), type: query.get('type') === 'recovery' ? 'recovery' : 'signup', next: safeNext(query.get('next'))};
  } else if (hash.get('access_token') && hash.get('refresh_token')) {
    link = {accessToken: hash.get('access_token'), refreshToken: hash.get('refresh_token'), expiresIn: hash.get('expires_in'),
      type: hash.get('type') === 'recovery' ? 'recovery' : 'signup', next: safeNext(query.get('next'))};
  } else if (hash.get('error_code') || hash.get('error')) {
    link = {failed: true};
  }
  if (!link) return null;
  for (const key of ['token_hash', 'type', 'next']) query.delete(key);
  const rest = query.toString();
  history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '') + '#/account/confirming');
  return link;
}
export async function completeAuthLink(link) {
  if (link.failed) return {path: 'account/link-expired'};
  try {
    if (link.tokenHash) await backend.verifyLink(link.type, link.tokenHash);
    else await backend.adoptTokens(link.accessToken, link.refreshToken, link.expiresIn);
  } catch { return {path: 'account/link-expired'}; }
  if (link.type === 'recovery') { remember('race-note-next', ''); return {path: 'account/new-password'}; }
  backend.track('login_complete', null, {via: 'email_link'});
  return {path: link.next || 'mypage', toast: '登録が完了しました'};
}

const field = (id, label, control, hint = '') => `<div class="ac-field"><label for="${id}">${label}</label>${control}${hint ? `<small id="${id}-hint">${hint}</small>` : ''}<p class="ac-error" id="${id}-error" role="alert" hidden></p></div>`;
const emailInput = (id, value = '') => `<input id="${id}" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" required value="${esc(value)}" aria-describedby="${id}-error">`;
const passwordInput = (id, name, autocomplete) => `<span class="ac-password"><input id="${id}" name="${name}" type="password" autocomplete="${autocomplete}" required minlength="8" maxlength="72" aria-describedby="${id}-hint ${id}-error"><button type="button" class="ac-reveal" data-ac-reveal="${id}" aria-pressed="false">表示</button></span>`;
const formError = '<p class="ac-form-error" role="alert" hidden></p>';
const previewNote = () => backend.localPreview ? '<div class="notice"><b>検証環境です。</b><p>メールは実際には送信されません。決済は未接続で、課金は発生しません。</p></div>' : '<p class="small">決済は準備中です。登録しても課金は発生しません。</p>';

export function accountPage(route, c) {
  const [view, sub] = route;
  const next = safeNext(c.returnTo());
  if (view === 'login') {
    if (backend.isSignedIn()) return `<div class="content inner-page ac-page">${c.innerHero('会員メニュー', 'ログイン済みです', esc(backend.email()))}${c.btn('マイページへ', 'mypage', 'cta-green')}${next ? c.btn('元のページに戻る', next, 'secondary') : ''}</div>`;
    const signin = sub === 'signin';
    return `<div class="content inner-page registration-page ac-page">${c.innerHero('メールアドレスで、かんたん登録', signin ? 'ログイン' : '無料会員登録', '購入した記事を、どの端末からでも確認。')}
      <div class="ac-tabs" role="group" aria-label="登録とログインの切り替え"><button data-go="login" aria-pressed="${!signin}">新規登録</button><button data-go="login/signin" aria-pressed="${signin}">ログイン</button></div>
      ${next ? `<p class="ac-return">${signin ? 'ログイン' : '登録'}後、<b>元のページ</b>に戻ります。</p>` : ''}
      ${signin ? `<form class="ac-form" data-ac="signin" novalidate>${formError}
          ${field('ac-email', 'メールアドレス', emailInput('ac-email', recall('race-note-email')))}
          ${field('ac-password', 'パスワード', passwordInput('ac-password', 'password', 'current-password'))}
          <button class="primary ac-submit" type="submit">ログインする${c.icon('arrow')}</button>
          <button type="button" class="text-button" data-go="account/reset">パスワードを忘れた方はこちら</button></form>`
        : `<form class="ac-form" data-ac="signup" novalidate>${formError}
          ${field('ac-email', 'メールアドレス', emailInput('ac-email'), '確認メールをお送りします。')}
          ${field('ac-password', 'パスワード', passwordInput('ac-password', 'password', 'new-password'), '8文字以上。ほかのサービスと違うものをおすすめします。')}
          <div class="ac-field ac-check"><label><input type="checkbox" name="adult" id="ac-adult" aria-describedby="ac-adult-error"> <span>20歳以上です</span></label><p class="ac-error" id="ac-adult-error" role="alert" hidden></p></div>
          <button class="cta-green ac-submit" type="submit"><span><small>情報料0円・すぐに使えます</small><b>確認メールを送る</b></span>${c.icon('arrow')}</button>
          <p class="small">無料予想は、登録しなくても読めます。</p></form>`}
      ${previewNote()}</div>`;
  }
  if (sub === 'sent') {
    const mail = recall('race-note-email');
    return `<div class="content inner-page ac-page">${c.innerHero('あと1ステップで完了', '確認メールを送りました', 'メール内のリンクを開くと、登録が完了します。')}
      <div class="status-card"><b>${mail ? esc(mail) : 'ご入力のメールアドレス'}</b><p>届いたメールのリンクを開いてください。${next ? '開いたあと、元のページに戻ります。' : ''}</p></div>
      ${backend.localPreview ? '<div class="notice"><b>検証環境ではメールを送信しません。</b><p>下のボタンから、届くはずのメールを確認できます。</p><p><a class="ac-link" href="/__dev/mailbox">検証用の受信箱を開く</a></p></div>' : ''}
      <details><summary>メールが届かないとき</summary><p>迷惑メールフォルダをご確認ください。すでに登録済みのアドレスには確認メールを送りません。その場合はログインをお試しください。</p></details>
      <button class="secondary" type="button" data-ac-resend>確認メールをもう一度送る</button>${c.btn('ログイン画面へ', 'login/signin', 'secondary')}</div>`;
  }
  if (sub === 'reset') {
    return `<div class="content inner-page ac-page">${c.routeBack('login/signin', 'ログインに戻る')}${c.innerHero('ログインできないとき', 'パスワードの再設定', '登録したメールアドレスに、再設定用のリンクを送ります。')}
      <form class="ac-form" data-ac="reset" novalidate>${formError}${field('ac-email', 'メールアドレス', emailInput('ac-email', recall('race-note-email')))}
      <button class="primary ac-submit" type="submit">再設定メールを送る${c.icon('arrow')}</button></form></div>`;
  }
  if (sub === 'reset-sent') {
    return `<div class="content inner-page ac-page">${c.innerHero('メールをご確認ください', '再設定メールを送りました', '登録済みのアドレスの場合に届きます。')}
      <div class="status-card"><p>メール内のリンクを開いて、新しいパスワードを設定してください。リンクは1回だけ使えます。</p></div>
      ${backend.localPreview ? '<div class="notice"><b>検証環境ではメールを送信しません。</b><p><a class="ac-link" href="/__dev/mailbox">検証用の受信箱を開く</a></p></div>' : ''}${c.btn('ログイン画面へ', 'login/signin', 'secondary')}</div>`;
  }
  if (sub === 'new-password' || sub === 'password') {
    if (!backend.isSignedIn()) return `<div class="content inner-page ac-page">${c.innerHero('会員メニュー', 'ログインが必要です')}${c.btn('ログイン画面へ', 'login/signin', 'primary')}</div>`;
    const change = sub === 'password';
    return `<div class="content inner-page ac-page">${change ? c.routeBack('mypage', 'マイページに戻る') : ''}${c.innerHero(change ? '会員メニュー' : 'もう少しで完了', change ? 'パスワードの変更' : '新しいパスワードの設定', esc(backend.email()))}
      <form class="ac-form" data-ac="${change ? 'change-password' : 'new-password'}" novalidate>${formError}
      ${change ? field('ac-current', '現在のパスワード', passwordInput('ac-current', 'current', 'current-password')) : ''}
      ${field('ac-password', '新しいパスワード', passwordInput('ac-password', 'password', 'new-password'), '8文字以上。')}
      <button class="primary ac-submit" type="submit">パスワードを保存する${c.icon('arrow')}</button></form></div>`;
  }
  if (sub === 'link-expired') {
    return `<div class="content inner-page ac-page">${c.innerHero('リンクを確認できませんでした', 'リンクの期限切れ', '有効期限が切れているか、すでに使用されたリンクです。')}
      <div class="status-card"><p>登録が済んでいる場合は、そのままログインできます。</p></div>${c.btn('ログイン画面へ', 'login/signin', 'primary')}${c.btn('パスワードを再設定する', 'account/reset', 'secondary')}${c.btn('確認メールを送り直す', 'login', 'secondary')}</div>`;
  }
  return `<div class="content inner-page ac-page"><div class="status-card" role="status"><b>確認しています…</b><p>そのままお待ちください。</p></div></div>`;
}

function showError(form, id, message) {
  const slot = id ? form.querySelector(`#${id}-error`) : form.querySelector('.ac-form-error');
  if (!slot) return;
  slot.textContent = message;
  slot.hidden = !message;
  if (id) form.querySelector(`#${id}`)?.setAttribute('aria-invalid', message ? 'true' : 'false');
}
function validate(form, kind) {
  let firstBad = null;
  const check = (id, message) => { showError(form, id, message); if (message && !firstBad) firstBad = form.querySelector(`#${id}`); };
  const data = Object.fromEntries(new FormData(form));
  if ('email' in data) check('ac-email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email).trim()) ? '' : 'メールアドレスを入力してください。');
  if ('current' in data) check('ac-current', data.current ? '' : '現在のパスワードを入力してください。');
  if ('password' in data) check('ac-password', !data.password ? 'パスワードを入力してください。' : kind !== 'signin' && String(data.password).length < 8 ? 'パスワードは8文字以上で入力してください。' : '');
  if (kind === 'signup') check('ac-adult', data.adult ? '' : '20歳以上の方のみ登録できます。');
  firstBad?.focus();
  return firstBad ? null : {...data, email: String(data.email || '').trim()};
}

let installed = false;
export function installAccount(c) {
  if (installed || !backend.enabled) return;
  installed = true;
  document.addEventListener('click', event => {
    const reveal = event.target.closest('[data-ac-reveal]');
    if (reveal) {
      const input = document.getElementById(reveal.dataset.acReveal), show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      reveal.textContent = show ? '隠す' : '表示';
      reveal.setAttribute('aria-pressed', String(show));
    }
    const again = event.target.closest('[data-ac-resend]');
    if (again) {
      const mail = recall('race-note-email');
      if (!mail) return c.go('login');
      again.disabled = true;
      backend.resend(mail, safeNext(c.returnTo())).then(() => c.toast('確認メールをもう一度送りました'), error => c.toast(error.message))
        .finally(() => setTimeout(() => { again.disabled = false; }, 15000));
    }
    if (event.target.closest('[data-ac-signout]')) backend.signOut().then(() => { c.toast('ログアウトしました'); c.go('home'); });
  });
  document.addEventListener('submit', async event => {
    const form = event.target.closest('form[data-ac]');
    if (!form) return;
    event.preventDefault();
    const kind = form.dataset.ac, data = validate(form, kind);
    showError(form, '', '');
    if (!data) return;
    const button = form.querySelector('.ac-submit');
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try {
      const next = safeNext(c.returnTo());
      if (kind === 'signup') {
        await backend.signUp(data.email, data.password, next);
        backend.track('signup_submit');
        remember('race-note-email', data.email);
        c.go('account/sent');
      } else if (kind === 'signin') {
        await backend.signIn(data.email, data.password);
        backend.track('login_complete', null, {via: 'password'});
        remember('race-note-email', '');
        c.toast('ログインしました');
        c.clearReturn();
        c.go(next || 'mypage');
      } else if (kind === 'reset') {
        await backend.recover(data.email);
        remember('race-note-email', data.email);
        c.go('account/reset-sent');
      } else {
        if (kind === 'change-password') {
          try { await backend.checkPassword(data.current); }
          catch (error) { showError(form, 'ac-current', error.code === 'invalid_credentials' ? '現在のパスワードが違います。' : error.message); form.querySelector('#ac-current').focus(); return; }
        }
        await backend.updatePassword(data.password);
        c.toast('パスワードを保存しました');
        c.go('mypage');
      }
    } catch (error) {
      showError(form, '', error.message);
      form.querySelector('.ac-form-error')?.focus?.();
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  });
}

// マイページ上部の会員欄。閲覧できる有料記事は、サーバーが確認した内容だけを表示する。
export const accountPanel = () => backend.enabled ? '<section id="account-panel" class="ac-panel" aria-live="polite"></section>' : '';
export async function mountAccountPanel(root, c) {
  const panel = root.querySelector('#account-panel');
  if (!panel) return;
  if (!backend.isSignedIn()) {
    panel.innerHTML = `<div class="ac-guest"><b>会員登録・ログイン</b><p>購入した記事を、どの端末からでも確認できます。無料予想は登録なしで読めます。</p><button class="cta-green" data-auth="mypage"><span><small>メールアドレスで登録</small><b>無料会員登録はこちら</b></span>${c.icon('arrow')}</button>${c.btn('ログインする', 'login/signin', 'secondary')}</div>`;
    return;
  }
  panel.innerHTML = `<div class="ac-member"><small>ログイン中</small><b>${esc(backend.email())}</b></div>`;
  let account;
  try { account = await backend.myAccount(true); }
  catch (error) {
    if (!backend.isSignedIn()) return c.rerender();
    panel.innerHTML += `<p class="ac-form-error" role="alert">${esc(error.message)}</p>`;
    return;
  }
  if (!panel.isConnected) return;
  const list = account.entitlements || [];
  panel.innerHTML = `<div class="ac-member"><small>ログイン中</small><b>${esc(account.email)}</b>${account.role ? `<span class="badge owned">${roleLabel(account.role)}</span>` : ''}</div>
    ${account.role ? c.btn('記事管理を開く', 'admin', 'primary') : ''}
    <h3 class="ac-subhead">閲覧できる有料記事</h3>
    ${list.length ? list.map(e => `<button class="member-menu" ${e.available ? `data-go="article/${esc(e.article_id)}"` : 'disabled'}><span><b>${esc(e.public?.title || '記事')}</b><small>${esc(e.public?.venue || '')} ${esc(e.public?.race_number || '')}R ／ ${e.source === 'staff_grant' ? '運営が付与（テスト用）' : '購入済み'}${e.available ? '' : ' ／ 現在は非公開'}</small></span>${c.icon('arrow')}</button>`).join('')
      : '<p class="small">まだありません。決済の接続後、購入した記事がここに表示されます。</p>'}
    <div class="ac-actions">${c.btn('パスワードを変更', 'account/password', 'secondary')}<button class="secondary" type="button" data-ac-signout>ログアウト</button></div>`;
}
