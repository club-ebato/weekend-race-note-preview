// 記事管理（一覧・編集・プレビュー・確認・公開・公開停止・履歴・結果）とスタッフ権限。
// ここでの表示の出し分けは案内のため。実際に操作できるかどうかは、毎回サーバーが権限を確認して決める。
import * as backend from './backend.mjs';
import {renderArticle, mountArticle, esc, types, dateLabel, timeLabel, raceLabel, courseLabel, closeManagedHorse} from './managed.mjs';
import {roleLabel} from './account.mjs';
import {parsePayouts} from './payouts.mjs';

const rank = role => ({editor: 1, publisher: 2, admin: 3})[role] || 0;
const loading = '<div class="status-card" role="status"><b>読み込んでいます…</b></div>';
const actionLabels = {create: '作成', save: '下書きを保存', submit: '確認を依頼', return: '差し戻し', publish: '公開', unpublish: '公開を停止',
  result: '結果を登録', grant_access: 'テスト用の閲覧権限を付与', revoke_access: 'テスト用の閲覧権限を取り消し', delete: '削除'};
let me = null, dirty = false, guardInstalled = false;

function status(a) {
  const published = a.revision_no != null || a.published;
  if (a.is_public) {
    const scheduled = a.scheduled ?? a.published?.scheduled;
    const head = scheduled ? `公開予約（${timeLabel(a.visible_from || a.published?.visible_from)}）` : '公開中';
    return a.state === 'editing' ? [head, '未公開の変更あり'] : a.state === 'in_review' ? [head, '変更の確認待ち'] : [head];
  }
  if (published) return a.state === 'in_review' ? ['公開停止', '確認待ち'] : ['公開停止'];
  return a.state === 'in_review' ? ['確認待ち'] : ['下書き'];
}
const statusBadges = a => status(a).map((s, i) => `<span class="ad-status ${i ? 'ad-status-sub' : s.startsWith('公開中') ? 'ad-live' : s.startsWith('公開予約') ? 'ad-scheduled' : s === '確認待ち' ? 'ad-review' : s === '公開停止' ? 'ad-stopped' : ''}">${s}</span>`).join('');
const shell = (title, body, c) => `<div class="content inner-page ad-page"><header class="ad-head"><span>記事管理</span><h1>${title}</h1><small>${esc(me.email)}（${roleLabel(me.role)}）</small></header><nav class="ad-nav" aria-label="記事管理メニュー"><button data-go="admin">記事一覧</button><button data-go="admin/edit/new">新規作成</button>${rank(me.role) >= 3 ? '<button data-go="admin/staff">スタッフ・権限</button>' : ''}<button data-go="mypage">マイページ</button></nav>${body}</div>`;
const errorBox = message => `<div class="error" role="alert"><b>処理できませんでした</b><p>${esc(message)}</p></div>`;

export const adminPage = () => `<div id="ad-root">${loading}</div>`;
export async function mountAdmin(root, route, c) {
  const box = root.querySelector('#ad-root');
  if (!box) return;
  installGuard();
  dirty = false;
  closeManagedHorse();
  if (!backend.isSignedIn()) {
    box.innerHTML = `<div class="content inner-page"><div class="status-card"><b>ログインが必要です</b><p>記事管理は、権限のあるスタッフだけが使えます。</p></div><button class="primary" data-auth="${esc(route.join('/'))}" data-auth-mode="signin">ログインする${c.icon('arrow')}</button></div>`;
    return;
  }
  try { me = await backend.myAccount(true); }
  catch (error) { if (box.isConnected) box.innerHTML = `<div class="content inner-page">${errorBox(error.message)}</div>`; return; }
  if (!box.isConnected) return;
  if (!me?.role) {
    box.innerHTML = `<div class="content inner-page"><div class="status-card"><b>このページを表示する権限がありません</b><p>一般会員のアカウントでは記事管理を使えません。</p></div>${c.btn('マイページへ', 'mypage', 'secondary')}</div>`;
    return;
  }
  try {
    if (route[1] === 'edit') await editor(box, route[2], c);
    else if (route[1] === 'article') await detail(box, route[2], c);
    else if (route[1] === 'staff') await staff(box, c);
    else await list(box, c);
  } catch (error) {
    if (box.isConnected) box.innerHTML = shell('表示できませんでした', errorBox(error.message) + c.btn('記事一覧へ', 'admin', 'secondary'), c);
  }
}

function installGuard() {
  if (guardInstalled) return;
  guardInstalled = true;
  // 保存していない入力があるまま画面を離れようとしたら確認する。
  document.addEventListener('click', event => {
    if (!dirty || !document.querySelector('#ad-form')) return;
    if (!event.target.closest('button[data-go],button[data-market],button[data-theme],button[data-auth]')) return;
    if (confirm('保存していない変更があります。このまま移動しますか？')) dirty = false;
    else { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  window.addEventListener('beforeunload', event => { if (dirty && document.querySelector('#ad-form')) event.preventDefault(); });
}

// ---- 一覧 ----
let listFilter = 'all';
async function list(box, c) {
  const items = await backend.rpc('admin_list_articles');
  if (!box.isConnected) return;
  const group = a => a.is_public ? 'live' : a.revision_no != null ? 'stopped' : a.state === 'in_review' ? 'review' : 'draft';
  const counts = {all: items.length, draft: 0, review: 0, live: 0, stopped: 0};
  for (const a of items) { counts[group(a)]++; if (a.is_public && a.state === 'in_review') counts.review++; }
  const draw = () => {
    const shown = items.filter(a => listFilter === 'all' || group(a) === listFilter || (listFilter === 'review' && a.state === 'in_review'));
    const days = [...new Set(shown.map(a => a.draft.race_date || ''))];
    box.innerHTML = shell('記事一覧', `
      <div class="ad-filter" role="group" aria-label="状態で絞り込む">${[['all', 'すべて'], ['draft', '下書き'], ['review', '確認待ち'], ['live', '公開中'], ['stopped', '公開停止']].map(([id, label]) => `<button data-ad-filter="${id}" aria-pressed="${listFilter === id}">${label}<b>${counts[id]}</b></button>`).join('')}</div>
      ${c.btn('新しい記事を作成する', 'admin/edit/new', 'primary')}
      ${shown.length ? days.map(day => {
        const rows = shown.filter(a => (a.draft.race_date || '') === day);
        const tally = m => { const x = items.filter(a => a.draft.race_date === day && a.draft.market === m); return x.length ? `${m === 'local' ? '地方' : '中央'} 無料${x.filter(a => a.draft.access === 'free').length}・有料${x.filter(a => a.draft.access === 'paid').length}` : ''; };
        return `<section class="ad-day"><h2>${day ? dateLabel(day) : 'レース日未設定'}<small>${[tally('central'), tally('local')].filter(Boolean).join(' ／ ')}</small></h2>${rows.map(a => {
          const d = a.draft, t = types[d.type];
          return `<article class="ad-card"><div class="ad-card-status">${statusBadges(a)}${a.result ? `<span class="ad-status ad-status-sub">結果：${({hit: '的中', miss: '不的中', pending: '確認中', cancel: '未提供'})[a.result]}</span>` : ''}</div><h3>${esc(d.title) || '（タイトル未入力）'}</h3><p>${d.market === 'local' ? '地方' : d.market === 'central' ? '中央' : '区分未設定'} ・ ${esc(raceLabel(d))} ・ ${esc(courseLabel(d))} ・ ${d.access === 'paid' ? (d.tier === 'premium' ? '有料・上位' : '有料') : d.access === 'free' ? '無料' : '区分未設定'} ・ ${t ? t.name : 'タイプ未設定'}</p>${a.error_count ? `<p class="ad-warn">未入力・不整合 ${a.error_count}件（公開前に解消が必要）</p>` : ''}<small>最終保存 ${timeLabel(a.updated_at)} ${esc(a.updated_by || '')}</small><div class="ad-card-actions"><button class="secondary" data-go="admin/edit/${a.id}">編集</button><button class="secondary" data-go="admin/article/${a.id}">プレビュー・公開</button></div></article>`;
        }).join('')}</section>`;
      }).join('') : '<div class="empty"><b>該当する記事はありません</b></div>'}
      <p class="small">初期仕様の目安：中央は土日それぞれ無料1・有料2、地方は提供日ごとに無料1・有料2。</p>`, c);
  };
  draw();
  box.onclick = event => {
    const button = event.target.closest('[data-ad-filter]');
    if (button) { listFilter = button.dataset.adFilter; draw(); }
  };
}

// ---- 編集 ----
const blank = () => ({market: 'central', race_date: '', venue: '', race_number: null, race_name: '', surface: '芝', distance_m: null, post_time: '', type: 'solid', access: 'free',
  title: '', summary: '', publish_at: '', sales_close_at: '', ticket_type: '馬連', unit_amount: 600, viewpoints: '', conclusion: '', bets: [], reasons: ['', '', ''], concern: '',
  horses: [{}, {}, {}], scenario: '', comparison: '', excluded: '', break_conditions: '', references: [{}]});
const field = (name, label, control, {hint = '', required = true, cls = ''} = {}) => `<div class="ad-field ${cls}" data-field="${name}"><label for="ad-${name}">${label}${required ? '' : '<em>任意</em>'}</label>${control}${hint ? `<small>${hint}</small>` : ''}<p class="ad-error" role="alert" hidden></p></div>`;
const input = (name, value, attrs = '') => `<input id="ad-${name}" name="${name}" value="${esc(value ?? '')}" ${attrs}>`;
const area = (name, value, rows = 3) => `<textarea id="ad-${name}" name="${name}" rows="${rows}">${esc(value ?? '')}</textarea>`;
const select = (name, value, options) => `<select id="ad-${name}" name="${name}">${options.map(([v, l]) => `<option value="${v}"${v === value ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
const horseRow = (h = {}) => `<div class="ad-row" data-horse-row><div class="ad-row-grid"><label>馬番<input data-k="number" inputmode="numeric" value="${esc(h.number ?? '')}"></label><label>枠番<input data-k="frame" inputmode="numeric" value="${esc(h.frame ?? '')}"></label><label class="ad-wide">馬名<input data-k="name" value="${esc(h.name ?? '')}"></label></div><label><span>今回の役割<em>任意</em></span><input data-k="role" value="${esc(h.role ?? '')}" placeholder="例：今回の軸／相手候補／見送り候補"></label><label>理由<textarea data-k="reason" rows="2">${esc(h.reason ?? '')}</textarea></label><label>懸念<textarea data-k="concern" rows="2">${esc(h.concern ?? '')}</textarea></label><p class="ad-error" role="alert" hidden></p><button type="button" class="text-button" data-ad-remove>この馬を削除</button></div>`;
const reasonRow = (text = '') => `<div class="ad-row ad-row-inline" data-reason-row><textarea data-reason rows="2" aria-label="選定理由">${esc(text)}</textarea><button type="button" class="text-button" data-ad-remove aria-label="この理由を削除">削除</button></div>`;
const refRow = (r = {}) => `<div class="ad-row" data-ref-row><label>事実・資料<input data-k="text" value="${esc(r.text ?? '')}" placeholder="例：出馬表、当日の馬場発表"></label><label><span>確認した日時<em>任意</em></span><input data-k="checked_at" type="datetime-local" value="${esc(r.checked_at ?? '')}"></label><button type="button" class="text-button" data-ad-remove>この行を削除</button></div>`;

function formHtml(d) {
  return `<form id="ad-form" novalidate>
    <fieldset><legend>1. 対象レース</legend>
      ${field('market', '競馬の区分', select('market', d.market, [['central', '中央競馬'], ['local', '地方競馬']]))}
      <div class="ad-grid">${field('race_date', 'レース日', input('race_date', d.race_date, 'type="date"'))}${field('post_time', '発走予定時刻', input('post_time', d.post_time, 'type="time"'))}</div>
      <div class="ad-grid">${field('venue', '競馬場', input('venue', d.venue, 'placeholder="例：東京"'))}${field('race_number', 'レース番号', input('race_number', d.race_number, 'inputmode="numeric" placeholder="例：11"'), {hint: '1〜12'})}</div>
      <div class="ad-grid">${field('surface', '芝／ダート', select('surface', d.surface, [['芝', '芝'], ['ダート', 'ダート']]))}${field('distance_m', '距離（m）', input('distance_m', d.distance_m, 'inputmode="numeric" placeholder="例：1600"'))}</div>
      ${field('race_name', 'レース名', input('race_name', d.race_name), {required: false})}
    </fieldset>
    <fieldset><legend>2. 記事の区分</legend>
      <div class="ad-grid">${field('type', '予想タイプ', select('type', d.type, Object.entries(types).map(([k, t]) => [k, t.name])))}${field('access', '無料／有料', select('access', d.access, [['free', '無料'], ['paid', '有料']]))}</div>
      ${field('tier', '通常／上位', select('tier', d.tier || 'standard', [['standard', '通常'], ['premium', '上位']]), {cls: 'ad-paid', hint: '上位＝週末のメインレースや南関東の厳選レース向けの詳細版です。値段が未確定のため、公開しても読者はまだ購入できません。'})}
      <p class="small">無料＝登録していない人も全文を読めます。有料＝購入した会員だけが本文を読めます。</p>
      <p class="small">同じ予想を、タイプを変えて重複して販売しないでください。</p>
    </fieldset>
    <fieldset><legend>3. 公開と販売の日時</legend>
      ${field('publish_at', '公開日時', input('publish_at', d.publish_at, 'type="datetime-local"'), {required: false, hint: '空欄なら、公開の操作をした時点で公開されます。先の日時を入れると公開予約になります。'})}
      ${field('sales_close_at', '販売締切', input('sales_close_at', d.sales_close_at, 'type="datetime-local"') + '<button type="button" class="text-button" data-ad-close30>発走30分前を入れる</button>', {cls: 'ad-paid', hint: '初期仕様は発走30分前です。'})}
    </fieldset>
    <fieldset><legend>4. 購入前にも表示する内容</legend>
      <p class="small">ここは有料記事でも、だれでも見られます。買い目の核心は書かないでください。</p>
      ${field('title', 'タイトル', input('title', d.title))}
      ${field('summary', '概要', area('summary', d.summary, 3), {hint: 'なぜこのレースか、を短く。'})}
      <div class="ad-grid">${field('ticket_type', '券種', input('ticket_type', d.ticket_type, 'placeholder="例：馬連"'))}${field('unit_amount', '1点の金額（円）', input('unit_amount', d.unit_amount, 'inputmode="numeric"'), {hint: '100円単位'})}</div>
      ${field('viewpoints', '選定の着眼点', area('viewpoints', d.viewpoints, 3), {cls: 'ad-paid', hint: '購入前に「どんな判断材料が増えるか」を伝えます。'})}
    </fieldset>
    <fieldset><legend>5. 予想の本文</legend>
      <p class="small ad-body-note"></p>
      <p class="small">本文に <code>{{horse:6}}</code> と書くと、馬番・枠色・馬名を自動で表示します。</p>
      ${field('conclusion', '30秒で読める結論', area('conclusion', d.conclusion, 3))}
      ${field('bets', '買い目', area('bets', (d.bets || []).map(b => Array.isArray(b) ? b.join('-') : '').join('\n'), 3), {hint: '1行に1点。馬番を「6-2」のようにハイフンでつなぎます。'})}
      <p class="ad-budget" aria-live="polite"></p>
      <div class="ad-field" data-field="reasons"><label>選定理由（3点）</label><div data-reasons>${[...(d.reasons || []), '', '', ''].slice(0, Math.max(3, (d.reasons || []).length)).map(reasonRow).join('')}</div><button type="button" class="text-button" data-ad-add="reason">＋ 理由を追加</button><p class="ad-error" role="alert" hidden></p></div>
      ${field('concern', '最大の懸念', area('concern', d.concern, 2), {hint: '想定が外れる条件を1つ。'})}
    </fieldset>
    <fieldset><legend>6. 登場する馬</legend>
      <p class="small">買い目や本文に出てくる馬を登録します。<b>馬番と枠番は別の数字</b>です。読者は馬名をタップして、理由と懸念を比較できます。</p>
      <div class="ad-field" data-field="horses"><div data-horses>${(d.horses?.length ? d.horses : [{}]).map(horseRow).join('')}</div><button type="button" class="text-button" data-ad-add="horse">＋ 馬を追加</button><p class="ad-error" role="alert" hidden></p></div>
    </fieldset>
    <fieldset class="ad-paid"><legend>7. 有料の詳細分析</legend>
      ${field('scenario', 'レースの想定展開', area('scenario', d.scenario, 4))}
      ${field('comparison', '選んだ馬の比較', area('comparison', d.comparison, 4))}
      ${field('excluded', '有力候補を外した理由', area('excluded', d.excluded, 3))}
      ${field('break_conditions', '想定が崩れる条件', area('break_conditions', d.break_conditions, 3))}
    </fieldset>
    <fieldset><legend>8. 参考にした事実・資料</legend>
      <p class="small">確認できた事実と、担当者の判断を分けるための欄です。</p>
      <div class="ad-field" data-field="references"><div data-refs>${(d.references?.length ? d.references : [{}]).map(refRow).join('')}</div><button type="button" class="text-button" data-ad-add="ref">＋ 行を追加</button><p class="ad-error" role="alert" hidden></p></div>
    </fieldset>
    <div class="ad-savebar"><p class="ad-save-state" role="status" aria-live="polite"></p><button type="submit" class="secondary" data-ad-save="stay">下書きを保存</button><button type="submit" class="primary" data-ad-save="next">保存して確認へ</button></div>
  </form>`;
}

function collect(form) {
  const v = name => (form.elements[name]?.value ?? '').trim();
  const num = name => { const x = v(name); return x === '' ? null : /^-?\d+$/.test(x) ? Number(x) : x; };
  const rows = (selector, map) => [...form.querySelectorAll(selector)].map(row => map(k => (row.querySelector(`[data-k="${k}"]`)?.value ?? '').trim()));
  const n = x => x === '' ? null : /^\d+$/.test(x) ? Number(x) : x;
  const access = v('access');
  return {
    market: v('market'), race_date: v('race_date'), venue: v('venue'), race_number: num('race_number'), race_name: v('race_name'),
    surface: v('surface'), distance_m: num('distance_m'), post_time: v('post_time'), type: v('type'), access,
    title: v('title'), summary: v('summary'), publish_at: v('publish_at'), sales_close_at: access === 'paid' ? v('sales_close_at') : '', ...(access === 'paid' ? {tier: v('tier') === 'premium' ? 'premium' : 'standard'} : {}),
    ticket_type: v('ticket_type'), unit_amount: num('unit_amount'), viewpoints: v('viewpoints'), conclusion: v('conclusion'),
    bets: v('bets').split(/[\n,、]+/).map(line => line.trim()).filter(Boolean).map(line => line.split(/[-－ー―→>\s]+/).filter(Boolean).map(x => /^\d+$/.test(x) ? Number(x) : 0)),
    reasons: [...form.querySelectorAll('[data-reason]')].map(x => x.value.trim()).filter(Boolean), concern: v('concern'),
    horses: rows('[data-horse-row]', g => ({number: n(g('number')), frame: n(g('frame')), name: g('name'), role: g('role'), reason: g('reason'), concern: g('concern')}))
      .filter(h => h.number !== null || h.name || h.reason || h.concern),
    scenario: v('scenario'), comparison: v('comparison'), excluded: v('excluded'), break_conditions: v('break_conditions'),
    references: rows('[data-ref-row]', g => ({text: g('text'), checked_at: g('checked_at')})).filter(r => r.text || r.checked_at)
  };
}

function showIssues(form, issues) {
  for (const slot of form.querySelectorAll('.ad-error')) { slot.hidden = true; slot.textContent = ''; }
  for (const el of form.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');
  const place = (holder, message, level) => {
    const slot = holder?.querySelector(':scope > .ad-error');
    if (!slot) return;
    slot.hidden = false;
    slot.classList.toggle('ad-error-warn', level === 'warn');
    slot.textContent = slot.textContent ? slot.textContent + ' ' + message : message;
  };
  for (const issue of issues) {
    const horse = /^horses\.(\d+)\.(\w+)$/.exec(issue.field);
    if (horse) {
      const row = form.querySelectorAll('[data-horse-row]')[Number(horse[1])];
      row?.querySelector(`[data-k="${horse[2]}"]`)?.setAttribute('aria-invalid', 'true');
      place(row, issue.message, issue.level);
    } else {
      const holder = form.querySelector(`[data-field="${issue.field}"]`);
      if (issue.level !== 'warn') holder?.querySelector('input,select,textarea')?.setAttribute('aria-invalid', 'true');
      place(holder, issue.message, issue.level);
    }
  }
}
const issueSummary = (issues, jump = true) => {
  const errors = issues.filter(i => i.level !== 'warn'), warns = issues.filter(i => i.level === 'warn');
  if (!issues.length) return '<div class="ad-ok"><b>入力チェック：問題ありません</b><p>確認依頼・公開に進めます。</p></div>';
  return `<div class="ad-issues" tabindex="-1">${errors.length ? `<b>未入力・不整合が ${errors.length} 件あります</b><p>下書きとしては保存済みです。公開前にすべて解消してください。</p><ul>${errors.map(i => `<li>${jump ? `<button type="button" data-ad-jump="${esc(i.field)}">${esc(i.message)}</button>` : esc(i.message)}</li>`).join('')}</ul>` : ''}${warns.length ? `<b class="ad-warn-title">確認してください（公開は可能）</b><ul>${warns.map(i => `<li>${esc(i.message)}</li>`).join('')}</ul>` : ''}</div>`;
};

async function editor(box, id, c) {
  const isNew = !id || id === 'new';
  let article = isNew ? {id: null, version: null, draft: blank(), issues: [], state: 'editing', is_public: false} : await backend.rpc('admin_get_article', {p_id: id});
  if (!box.isConnected) return;
  const backupKey = 'race-note-draft-' + (isNew ? 'new' : id);
  const readBackup = () => { try { return JSON.parse(sessionStorage.getItem(backupKey) || 'null'); } catch { return null; } };
  const clearBackup = () => { try { sessionStorage.removeItem(backupKey); } catch {} };
  const backup = readBackup();
  const hasBackup = backup && JSON.stringify(backup.draft) !== JSON.stringify(article.draft);

  box.innerHTML = shell(isNew ? '新しい記事' : '記事の編集', `
    <div class="ad-card-status" id="ad-state">${isNew ? '<span class="ad-status">未保存</span>' : statusBadges(article)}</div>
    ${!isNew && article.is_public ? '<div class="notice"><b>この記事は公開中です。</b><p>ここで保存しても、公開中の内容は変わりません。確認依頼 → 公開（改訂理由つき）で反映されます。</p></div>' : ''}
    ${hasBackup ? `<div class="ad-conflict" id="ad-backup"><b>保存していない入力が残っています</b><p>前回この画面を離れたときの入力です。</p><button type="button" class="secondary" data-ad-restore>入力を復元する</button><button type="button" class="text-button" data-ad-discard>破棄する</button></div>` : ''}
    <div id="ad-banner"></div><div id="ad-issue-summary"></div>${formHtml(article.draft)}`, c);
  const form = box.querySelector('#ad-form'), banner = box.querySelector('#ad-banner'), summary = box.querySelector('#ad-issue-summary'), saveState = form.querySelector('.ad-save-state');
  if (!isNew) { summary.innerHTML = issueSummary(article.issues); showIssues(form, article.issues); }

  const sync = () => {
    const paid = form.elements.access.value === 'paid';
    for (const el of form.querySelectorAll('.ad-paid')) el.hidden = !paid;
    form.querySelector('.ad-body-note').textContent = paid ? '有料記事：ここから下は、購入した会員だけに表示されます。' : '無料記事：ここから下も、登録していない人を含む全員に表示されます。';
    const d = collect(form), points = d.bets.length, unit = Number(d.unit_amount) || 0;
    form.querySelector('.ad-budget').textContent = points ? `点数 ${points}点 × ${unit.toLocaleString('ja-JP')}円 ＝ 馬券代の目安 ${(points * unit).toLocaleString('ja-JP')}円` : '買い目を入力すると、点数と馬券代の目安を計算します。';
  };
  sync();
  let timer;
  form.addEventListener('input', () => {
    dirty = true;
    saveState.textContent = '保存していない変更があります';
    sync();
    clearTimeout(timer);
    timer = setTimeout(() => { try { sessionStorage.setItem(backupKey, JSON.stringify({draft: collect(form)})); } catch {} }, 600);
  });

  async function save(mode, force = false) {
    clearTimeout(timer);
    const draft = collect(form);
    const buttons = form.querySelectorAll('[data-ad-save]');
    buttons.forEach(b => { b.disabled = true; });
    saveState.textContent = '保存しています…';
    banner.innerHTML = '';
    try {
      if (force && article.id) article.version = (await backend.rpc('admin_get_article', {p_id: article.id})).version;
      article = await backend.rpc('admin_save_draft', {p_id: article.id, p_draft: draft, p_version: article.version});
      dirty = false;
      clearTimeout(timer);
      clearBackup();
      box.querySelector('#ad-backup')?.remove();
      if (isNew || location.hash.endsWith('/new')) history.replaceState(null, '', location.pathname + location.search + '#/admin/edit/' + article.id);
      box.querySelector('#ad-state').innerHTML = statusBadges(article);
      summary.innerHTML = issueSummary(article.issues);
      showIssues(form, article.issues);
      saveState.textContent = `下書きを保存しました（${new Date().toLocaleTimeString('ja-JP', {hour: '2-digit', minute: '2-digit'})}）`;
      if (mode === 'next') return c.go('admin/article/' + article.id);
      if (article.issues.some(i => i.level !== 'warn')) { summary.querySelector('.ad-issues')?.focus({preventScroll: true}); summary.scrollIntoView({block: 'center'}); }
      c.toast('下書きを保存しました');
    } catch (error) {
      saveState.textContent = '保存できていません';
      if (error.code === 'KB_CONFLICT') {
        banner.innerHTML = `<div class="ad-conflict" role="alert"><b>ほかの人が先に保存しています</b><p>${esc(error.message)}</p><p>あなたの入力はこの画面に残っています。どちらを残すか選んでください。</p><button type="button" class="secondary" data-ad-latest>最新の内容を読み込む（この画面の入力は破棄）</button><button type="button" class="secondary" data-ad-force>自分の入力で上書き保存する</button></div>`;
      } else {
        banner.innerHTML = `<div class="error" role="alert"><b>保存できませんでした</b><p>${esc(error.message)}</p><p>入力内容はこの画面に残っています。通信状況を確認して、もう一度保存してください。</p></div>`;
      }
      banner.scrollIntoView({block: 'center'});
    } finally { buttons.forEach(b => { b.disabled = false; }); }
  }

  box.onsubmit = event => { event.preventDefault(); save(event.submitter?.dataset.adSave || 'stay'); };
  box.onclick = async event => {
    const t = event.target;
    if (t.closest('[data-ad-add]')) {
      const kind = t.closest('[data-ad-add]').dataset.adAdd;
      const target = form.querySelector(kind === 'horse' ? '[data-horses]' : kind === 'reason' ? '[data-reasons]' : '[data-refs]');
      target.insertAdjacentHTML('beforeend', kind === 'horse' ? horseRow() : kind === 'reason' ? reasonRow() : refRow());
      target.lastElementChild.querySelector('input,textarea')?.focus();
    } else if (t.closest('[data-ad-remove]')) {
      t.closest('.ad-row').remove();
      form.dispatchEvent(new Event('input', {bubbles: true}));
    } else if (t.closest('[data-ad-close30]')) {
      const date = form.elements.race_date.value, time = form.elements.post_time.value;
      if (!date || !time) return c.toast('先にレース日と発走予定時刻を入力してください');
      const at = new Date(`${date}T${time}:00Z`).getTime() - 30 * 60000;
      form.elements.sales_close_at.value = new Date(at).toISOString().slice(0, 16);
      form.dispatchEvent(new Event('input', {bubbles: true}));
    } else if (t.closest('[data-ad-jump]')) {
      const name = t.closest('[data-ad-jump]').dataset.adJump, horse = /^horses\.(\d+)\.(\w+)$/.exec(name);
      const el = horse ? form.querySelectorAll('[data-horse-row]')[Number(horse[1])]?.querySelector(`[data-k="${horse[2]}"]`) : form.querySelector(`[data-field="${name}"] input, [data-field="${name}"] select, [data-field="${name}"] textarea`);
      el?.focus();
      el?.scrollIntoView({block: 'center'});
    } else if (t.closest('[data-ad-latest]')) {
      dirty = false;
      clearBackup();
      c.rerender();
    } else if (t.closest('[data-ad-force]')) {
      save('stay', true);
    } else if (t.closest('[data-ad-restore]')) {
      const scroll = window.scrollY;
      for (const [key, value] of Object.entries(backup.draft)) if (form.elements[key] && typeof value !== 'object') form.elements[key].value = value ?? '';
      form.elements.bets.value = (backup.draft.bets || []).map(b => b.join('-')).join('\n');
      form.querySelector('[data-reasons]').innerHTML = (backup.draft.reasons?.length ? backup.draft.reasons : ['']).map(reasonRow).join('');
      form.querySelector('[data-horses]').innerHTML = (backup.draft.horses?.length ? backup.draft.horses : [{}]).map(horseRow).join('');
      form.querySelector('[data-refs]').innerHTML = (backup.draft.references?.length ? backup.draft.references : [{}]).map(refRow).join('');
      box.querySelector('#ad-backup').remove();
      form.dispatchEvent(new Event('input', {bubbles: true}));
      window.scrollTo({top: scroll, behavior: 'instant'});
      c.toast('入力を復元しました。保存はまだです');
    } else if (t.closest('[data-ad-discard]')) {
      clearBackup();
      box.querySelector('#ad-backup').remove();
    }
  };
}

// ---- プレビュー・確認・公開・履歴・結果 ----
async function detail(box, id, c) {
  let a = await backend.rpc('admin_get_article', {p_id: id});
  if (!box.isConnected) return;
  let source = 'draft', view = 'buyer';
  const canPublish = rank(me.role) >= 2;

  const content = () => source === 'draft' ? a.draft : source === 'published' ? a.published?.content : a.revisions.find(r => String(r.no) === source)?.content;
  const previewArticle = () => {
    const d = content() || {}, points = Array.isArray(d.bets) ? d.bets.length : 0, locked = view === 'locked' && d.access === 'paid';
    return {id: '', public: {...d, points, budget_jpy: points * (Number(d.unit_amount) || 0)}, body: locked ? null : d, locked, signed_in: true,
      revision_no: a.published?.revision_no, price: a.price, result: a.result, sales_open: true,
      revisions: [...a.revisions].reverse().map(r => ({no: r.no, at: r.visible_from, reason: r.reason, after_post_time: r.after_post_time}))};
  };
  const errors = () => a.issues.filter(i => i.level !== 'warn');
  const afterPost = () => { const t = Date.parse(`${a.draft.race_date}T${a.draft.post_time}:00+09:00`); return Number.isFinite(t) && Date.now() >= t; };
  const actionForm = (action, title, body, button, cls = 'primary') => `<form class="ad-action" data-ad-action="${action}"><h3>${title}</h3>${body}<p class="ad-error" role="alert" hidden></p><button type="submit" class="${cls}">${button}</button></form>`;
  const reasonField = (label, hint, required = true) => `<label><span>${label}${required ? '' : '<em>任意</em>'}</span><textarea name="reason" rows="2"></textarea></label><small>${hint}</small>`;

  function actions() {
    const blocks = [];
    if (a.state === 'editing') {
      const changed = a.is_public || a.published;
      blocks.push(errors().length
        ? `<div class="ad-action"><h3>確認依頼の前に</h3><p>未入力・不整合を解消すると、確認を依頼できます。</p>${c.btn('編集画面で直す', 'admin/edit/' + a.id, 'secondary')}</div>`
        : actionForm('submit', changed ? '変更の確認を依頼する' : '確認を依頼する', `<p>公開管理者に、この下書きの確認と公開を依頼します。${a.is_public ? '公開中の内容は、公開されるまで変わりません。' : ''}</p>`, '確認を依頼する'));
    }
    if (a.state === 'in_review') {
      if (canPublish) {
        const revised = !!a.published, late = afterPost() || ['hit', 'miss'].includes(a.result?.status);
        const pub = a.draft.publish_at && Date.parse(a.draft.publish_at + ':00+09:00') > Date.now() && !(a.published && !a.published.scheduled);
        blocks.push(actionForm('publish', revised ? '改訂を公開する' : '公開する',
          `<p>${pub ? `<b>公開予約：${timeLabel(a.draft.publish_at)}</b> に公開されます。それまで読者には表示されません。` : '<b>この操作と同時に公開</b>されます。'}</p>
           ${late ? '<p class="ad-warn">発走時刻を過ぎている、または結果が登録済みです。「発走後の更新」として公開履歴に表示されます。事前の予想は以前の版として残ります。</p>' : ''}
           ${revised || late ? reasonField('改訂・公開の理由', '読者が見る公開履歴に表示されます。') : ''}
           <p class="small">確認依頼：${esc(a.submitted_by || '')} ${timeLabel(a.submitted_at)}</p>`, revised ? '改訂を公開する' : '公開する', 'cta-green ad-publish'));
        blocks.push(actionForm('return', '差し戻す', reasonField('差し戻しの理由', '編集者に伝える内容です。読者には表示されません。'), '差し戻す', 'secondary'));
      } else {
        blocks.push('<div class="ad-action"><h3>確認待ちです</h3><p>公開は公開管理者が行います。内容を直す場合は、編集して保存すると確認依頼が取り下げられます。</p></div>');
      }
    }
    if (a.is_public && canPublish) blocks.push(actionForm('unpublish', '公開を停止する', `<p>読者から見えなくなります。公開した版と履歴は残ります。</p>${reasonField('公開停止の理由', '運営内の記録に残ります。')}`, '公開を停止する', 'secondary ad-danger'));
    if (!a.published && canPublish) blocks.push(actionForm('delete', '下書きを削除する', '<p>一度も公開していない下書きだけ削除できます。元に戻せません。</p>', '下書きを削除する', 'secondary ad-danger'));
    return blocks.join('');
  }
  function resultForm() {
    if (!a.published) return '';
    const r = a.result || {};
    if (!canPublish) return `<section class="ad-section"><h2>結果</h2><p class="small">結果の登録は公開管理者が行います。${r.status ? '現在：' + ({hit: '的中', miss: '不的中', pending: '確認中', cancel: '未提供'})[r.status] : '未登録'}</p></section>`;
    return `<section class="ad-section"><h2>結果の登録</h2><p class="small">事前の予想（公開した版）は変更されません。結果だけを別に記録し、的中・不的中を同じ形式で表示します。</p>
      <form class="ad-action" data-ad-action="payouts"><h3>払戻から自動で判定する</h3><p class="small">レースの払戻を入れると、公開した買い目と照らして、的中・不的中と払戻額を自動で計算します。同じレースの公開記事すべてに反映します。手で登録した的中・不的中・未提供は変更しません。</p><label><span>払戻（1行に「券種 馬番 100円あたりの払戻額」）</span><textarea name="payouts" rows="4" placeholder="馬連 2-6 1230&#10;ワイド 2-6 450&#10;3連単 6→2→8 12340"></textarea></label><small>この記事の券種：${esc(a.published.content.ticket_type || '—')}。払戻にこの券種がないときは判定しません。</small><p class="ad-error" role="alert" hidden></p><button type="submit" class="secondary">払戻を登録して判定する</button></form>
      <h3>手で登録する</h3>
      <form class="ad-action" data-ad-action="result"><label>結果<select name="status">${[['pending', '確認中'], ['hit', '的中'], ['miss', '不的中'], ['cancel', '未提供（見送り・中止）']].map(([v, l]) => `<option value="${v}"${r.status === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="ad-grid"><label>想定馬券代（円）<input name="stake" inputmode="numeric" value="${esc(r.stake_jpy ?? (a.published.content.bets?.length || 0) * (a.published.content.unit_amount || 0))}"></label><label>払戻額（円）<input name="payout" inputmode="numeric" value="${esc(r.payout_jpy ?? '')}"></label></div>
      <label><span>振り返り<em>任意</em></span><textarea name="recap" rows="3">${esc(r.recap ?? '')}</textarea></label><small>想定と結果の違いを記録します。実際に確認した内容だけを書いてください。</small>
      <p class="ad-error" role="alert" hidden></p><button type="submit" class="secondary">結果を保存して公開する</button></form></section>`;
  }
  function draw(keepScroll = false) {
    const scroll = window.scrollY, d = content() || {}, paid = d.access === 'paid';
    box.innerHTML = shell('プレビュー・公開', `
      <div class="ad-card-status">${statusBadges({...a, revision_no: a.published?.revision_no})}</div>
      <h2 class="ad-title">${esc(a.draft.title) || '（タイトル未入力）'}</h2>
      <p class="small">最終保存 ${timeLabel(a.updated_at)} ${esc(a.updated_by || '')} ／ 下書き 第${a.version}稿${a.published ? ` ／ 公開中の版 第${a.published.revision_no}版` : ''}</p>
      ${c.btn('内容を編集する', 'admin/edit/' + a.id, 'secondary')}
      <div id="ad-banner"></div>
      ${issueSummary(a.issues, false)}
      <section class="ad-section"><h2>操作</h2>${actions() || '<p class="small">いま行える操作はありません。内容を変える場合は編集してください。</p>'}</section>
      <section class="ad-section"><h2>プレビュー</h2>
        <div class="ad-filter" role="group" aria-label="表示する内容"><button data-ad-source="draft" aria-pressed="${source === 'draft'}">下書き（最新）</button>${a.published ? `<button data-ad-source="published" aria-pressed="${source === 'published'}">現在の公開内容</button>` : ''}</div>
        ${paid ? `<div class="ad-filter" role="group" aria-label="読者の状態"><button data-ad-view="buyer" aria-pressed="${view === 'buyer'}">購入後の見え方</button><button data-ad-view="locked" aria-pressed="${view === 'locked'}">購入前の見え方</button></div>` : ''}
        <p class="small">${source === 'draft' ? '保存済みの下書きです。公開するまで読者には見えません。' : source === 'published' ? '読者に表示されている内容です。' : `第${source}版の内容です。`} スマホ幅で表示しています。</p>
        <div class="ad-preview" data-theme-preview>${renderArticle(previewArticle(), {...c, preview: true})}</div></section>
      ${resultForm()}
      <section class="ad-section"><h2>公開した版</h2>${a.revisions.length ? `<ol class="ad-log">${a.revisions.map(r => `<li><b>第${r.no}版</b> ${timeLabel(r.published_at)} ${esc(r.published_by || '')}${r.visible_from && Date.parse(r.visible_from) > Date.parse(r.published_at) + 1000 ? `（${timeLabel(r.visible_from)} 公開予約）` : ''}${r.after_post_time ? ' <strong>発走後の更新</strong>' : ''}${r.reason ? `<p>理由：${esc(r.reason)}</p>` : ''}<button type="button" class="text-button" data-ad-source="${r.no}">この版をプレビューに表示</button></li>`).join('')}</ol>` : '<p class="small">まだ公開していません。</p>'}</section>
      <section class="ad-section"><h2>操作の履歴</h2><ol class="ad-log">${a.log.map(l => `<li><b>${actionLabels[l.action] || esc(l.action)}</b> ${timeLabel(l.at)} ${esc(l.actor || '')}${l.detail?.note ? `<p>理由：${esc(l.detail.note)}</p>` : ''}${l.detail?.reason ? `<p>理由：${esc(l.detail.reason)}</p>` : ''}</li>`).join('')}</ol></section>`, c);
    mountArticle(box, previewArticle());
    if (keepScroll) window.scrollTo({top: scroll, behavior: 'instant'});
  }
  draw();

  box.onclick = event => {
    const s = event.target.closest('[data-ad-source]'), v = event.target.closest('[data-ad-view]');
    if (s) { source = s.dataset.adSource; draw(true); box.querySelector('.ad-preview')?.scrollIntoView({block: 'start'}); }
    if (v) { view = v.dataset.adView; draw(true); }
  };
  box.onsubmit = async event => {
    const form = event.target.closest('[data-ad-action]');
    if (!form) return;
    event.preventDefault();
    const action = form.dataset.adAction, slot = form.querySelector('.ad-error'), data = Object.fromEntries(new FormData(form));
    const fail = message => { slot.textContent = message; slot.hidden = false; };
    slot.hidden = true;
    if (action === 'publish' && !confirm(a.published ? '改訂を公開します。よろしいですか？' : '記事を公開します。よろしいですか？')) return;
    if (action === 'unpublish' && !confirm('公開を停止します。読者から見えなくなります。よろしいですか？')) return;
    if (action === 'delete' && !confirm('この下書きを削除します。元に戻せません。よろしいですか？')) return;
    const yen = value => String(value ?? '').trim() === '' ? null : /^\d+$/.test(String(value).trim()) ? Number(value) : NaN;
    if (action === 'result' && (Number.isNaN(yen(data.stake)) || Number.isNaN(yen(data.payout)))) return fail('金額は数字で入力してください。');
    const parsed = action === 'payouts' ? parsePayouts(data.payouts) : null;
    if (parsed?.error) return fail(parsed.error);
    let judged = null;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const calls = {
        submit: () => backend.rpc('admin_submit', {p_id: a.id, p_version: a.version}),
        publish: () => backend.rpc('admin_publish', {p_id: a.id, p_version: a.version, p_reason: data.reason || null}),
        return: () => backend.rpc('admin_return', {p_id: a.id, p_note: data.reason || ''}),
        unpublish: () => backend.rpc('admin_unpublish', {p_id: a.id, p_reason: data.reason || ''}),
        delete: () => backend.rpc('admin_delete_draft', {p_id: a.id}),
        payouts: async () => { judged = await backend.rpc('admin_record_race_result', {p_id: a.id, p_payouts: parsed.payouts}); },
        result: () => backend.rpc('admin_set_result', {p_id: a.id, p_status: data.status, p_stake: yen(data.stake), p_payout: yen(data.payout), p_recap: data.recap || ''})
      };
      await calls[action]();
      const mine = judged?.find(x => x.id === a.id);
      if (mine && !['hit', 'miss'].includes(mine.outcome)) { fail(mine.reason || '判定できませんでした。'); return; }
      if (action === 'delete') { c.toast('下書きを削除しました'); return c.go('admin'); }
      a = await backend.rpc('admin_get_article', {p_id: a.id});
      source = 'draft';
      draw();
      window.scrollTo({top: 0, behavior: 'instant'});
      c.toast(({submit: '確認を依頼しました', publish: '公開しました', return: '差し戻しました', unpublish: '公開を停止しました', result: '結果を保存しました', payouts: mine ? `自動判定：${mine.outcome === 'hit' ? '的中' : '不的中'}（${judged.filter(x => ['hit', 'miss'].includes(x.outcome)).length}記事に反映）` : '払戻を登録しました'})[action]);
    } catch (error) {
      fail(error.message);
      if (error.code === 'KB_CONFLICT') fail(error.message + ' 画面を読み込み直してください。');
    } finally { button.disabled = false; }
  };
}

// ---- スタッフ・権限（管理者のみ） ----
async function staff(box, c) {
  if (rank(me.role) < 3) { box.innerHTML = shell('スタッフ・権限', '<div class="status-card"><b>管理者だけが使える画面です</b></div>', c); return; }
  const roles = [['editor', '編集者（下書き・確認依頼）'], ['publisher', '公開管理者（公開・停止・結果）'], ['admin', '管理者（権限の管理）']];
  const draw = async message => {
    const [data, articles] = await Promise.all([backend.rpc('admin_list_staff'), backend.rpc('admin_list_articles')]);
    if (!box.isConnected) return;
    const paid = articles.filter(x => x.draft.access === 'paid' && x.revision_no != null);
    box.innerHTML = shell('スタッフ・権限', `
      ${message ? `<div class="ad-ok" role="status"><b>${esc(message)}</b></div>` : ''}
      <div class="notice"><b>権限はここでだけ変更できます。</b><p>会員登録しただけでは、だれも管理者になりません。対象の人は、先に会員登録とメール確認を済ませてください。</p></div>
      <section class="ad-section"><h2>スタッフ</h2>${data.staff.map(s => `<div class="ad-card"><h3>${esc(s.email)}${s.is_self ? '（自分）' : ''}</h3><p>${roleLabel(s.role)} ／ 付与 ${timeLabel(s.granted_at)} ${esc(s.granted_by || 'サーバー設定')}</p>${s.is_self ? '<small>自分自身の権限は変更できません。</small>' : `<form class="ad-inline" data-ad-staff><input type="hidden" name="email" value="${esc(s.email)}"><select name="role" aria-label="権限">${roles.map(([v, l]) => `<option value="${v}"${v === s.role ? ' selected' : ''}>${l}</option>`).join('')}<option value="">権限を外す（一般会員に戻す）</option></select><button class="secondary" type="submit">変更</button><p class="ad-error" role="alert" hidden></p></form>`}</div>`).join('')}
        <form class="ad-action" data-ad-staff><h3>スタッフを追加する</h3><label>メールアドレス<input name="email" type="email" autocomplete="off" required></label><label>権限<select name="role">${roles.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label><p class="ad-error" role="alert" hidden></p><button class="primary" type="submit">権限を付与する</button></form></section>
      <section class="ad-section"><h2>テスト用の閲覧権限</h2><p class="small">決済の接続前に、有料記事の表示を社内で確認するための機能です。購入とは区別して記録します。</p>
        ${data.grants.map(g => `<div class="ad-card"><h3>${esc(g.email)}</h3><p>${esc(g.title || '')} ／ ${esc(g.note || '')}</p><small>${timeLabel(g.granted_at)} ${esc(g.granted_by || '')}</small><form class="ad-inline" data-ad-revoke><input type="hidden" name="email" value="${esc(g.email)}"><input type="hidden" name="article" value="${esc(g.article_id)}"><button class="secondary ad-danger" type="submit">取り消す</button><p class="ad-error" role="alert" hidden></p></form></div>`).join('')}
        ${paid.length ? `<form class="ad-action" data-ad-grant><h3>閲覧権限を付与する</h3><label>会員のメールアドレス<input name="email" type="email" autocomplete="off" required></label><label>有料記事<select name="article">${paid.map(x => `<option value="${x.id}">${esc(dateLabel(x.draft.race_date))} ${esc(raceLabel(x.draft))} ${esc(x.draft.title)}</option>`).join('')}</select></label><label>理由<input name="note" placeholder="例：社内テスト" required></label><p class="ad-error" role="alert" hidden></p><button class="secondary" type="submit">閲覧権限を付与する</button></form>` : '<p class="small">公開した有料記事がまだありません。</p>'}</section>
      <section class="ad-section"><h2>権限変更の履歴</h2>${data.log.length ? `<ol class="ad-log">${data.log.map(l => `<li><b>${esc(l.target)}</b> ${l.old_role ? roleLabel(l.old_role) : '一般会員'} → ${l.new_role ? roleLabel(l.new_role) : '一般会員'}<p>${timeLabel(l.at)} ${esc(l.actor)}</p></li>`).join('')}</ol>` : '<p class="small">履歴はありません。</p>'}</section>`, c);
  };
  await draw();
  box.onsubmit = async event => {
    const form = event.target.closest('[data-ad-staff],[data-ad-grant],[data-ad-revoke]');
    if (!form) return;
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form)), slot = form.querySelector('.ad-error');
    slot.hidden = true;
    try {
      if (form.matches('[data-ad-staff]')) {
        if (!data.role && !confirm(`${data.email} のスタッフ権限を外します。よろしいですか？`)) return;
        await backend.rpc('admin_set_staff', {p_email: data.email, p_role: data.role || null});
        await draw('権限を変更しました');
      } else if (form.matches('[data-ad-grant]')) {
        await backend.rpc('admin_grant_access', {p_email: data.email, p_article: data.article, p_note: data.note});
        await draw('テスト用の閲覧権限を付与しました');
      } else {
        await backend.rpc('admin_revoke_access', {p_email: data.email, p_article: data.article});
        await draw('閲覧権限を取り消しました');
      }
      window.scrollTo({top: 0, behavior: 'instant'});
    } catch (error) { slot.textContent = error.message; slot.hidden = false; }
  };
}
