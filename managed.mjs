// 記事管理から公開した記事の表示。公開ページと管理画面のプレビューで同じ描画を使う。
// 本文は、サーバーが「読める」と判定して返したときだけ手元にある。画面側で隠しているわけではない。
import * as backend from './backend.mjs';
import {horseBadge, horseProse, frameLegend, frameFor, frameColours} from './frames.mjs';
import {hologramMedia} from './hologram-media.mjs';

export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
export const types = {
  solid: {persona: 'ojisan', name: '本命・的中重視', mark: '本命'},
  longshot: {persona: 'ren', name: '穴馬・高配当狙い', mark: '穴馬'},
  data: {persona: 'zero', name: 'データ分析', mark: '比較'}
};
const typeOf = p => types[p?.type] || {persona: 'ojisan', name: '予想タイプ未設定', mark: '—'};
const yen = n => Number.isFinite(Number(n)) ? Number(n).toLocaleString('ja-JP') + '円' : '—';
const weekday = ['日', '月', '火', '水', '木', '金', '土'];
export function dateLabel(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!m) return '日付未設定';
  return `${Number(m[2])}/${Number(m[3])}（${weekday[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()]}）`;
}
export function timeLabel(value) {
  if (!value) return '';
  const local = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})$/.exec(String(value));
  if (local) return `${Number(local[2])}/${Number(local[3])} ${local[4]}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const j = new Date(d.getTime() + 9 * 3600e3);
  return `${j.getUTCMonth() + 1}/${j.getUTCDate()} ${String(j.getUTCHours()).padStart(2, '0')}:${String(j.getUTCMinutes()).padStart(2, '0')}`;
}
export const raceLabel = p => `${p?.venue || '会場未設定'} ${p?.race_number ? p.race_number + 'R' : ''}`.trim();
export const courseLabel = p => p?.surface && p?.distance_m ? `${p.surface} ${Number(p.distance_m).toLocaleString('ja-JP')}m` : '距離・馬場は未設定';
const marketLabel = p => p?.market === 'local' ? '地方競馬' : '中央競馬';

// 馬番・枠番・馬名は、その記事に登録された出走情報だけから引く（馬番と枠番を混同しない）。
const raceOf = body => ({draw: {source: 'managed', entries: (Array.isArray(body?.horses) ? body.horses : [])
  .filter(h => Number.isInteger(h?.number)).map(h => ({horse: h.number, frame: h.frame, name: h.name}))}});
const prose = (race, text) => horseProse(race, esc(text)).replace(/\n+/g, '<br>');
const heading = (n, t) => `<h2 class="oj-heading"><span>${n}</span>${t}</h2>`;

// 記事ごとの見出し画像。会場・レース番号・コース・日付・タイプ・区分から自動で組み立てる（設定や画像の用意は不要）。
// 背景は予想タイプと選択中のデザインに合わせた写真（member.css の --mg-photo）。文字は画像に焼き込まず、記事の内容と必ず一致させる。
export function eyecatch(p, className = 'baked-banner') {
  const t = typeOf(p), kind = p?.access === 'paid' ? '詳細分析' : '無料予想', day = p?.race_date ? dateLabel(p.race_date) : '';
  const label = `${day ? day + '・' : ''}${raceLabel(p)}・${courseLabel(p)}・${t.name}・${kind}`;
  const venue = String(p?.venue || '会場');
  const art = `<span class="mg-eyecatch${venue.length > 3 ? ' mg-eye-long' : ''}" role="img" aria-label="${esc(label)}"><span class="mg-eye-kind">${day ? `<i>${day}</i>` : ''}${kind}</span><span class="mg-eye-race"><b>${esc(venue)}</b><em>${p?.race_number ? esc(p.race_number) + 'R' : '—'}</em></span><span class="mg-eye-course">${esc(courseLabel(p))}</span><span class="mg-eye-type">${t.name}</span></span>`;
  return hologramMedia(art, `${className} race-specific-art type-race-art mg-art`, t.persona);
}

export function articleCard(item) {
  const p = item.public, t = typeOf(p), paid = p.access === 'paid';
  const result = ({hit: '的中', miss: '不的中', pending: '結果確認中', cancel: '未提供'})[item.result] || '';
  return `<button class="catalog-card type-race-card ${paid ? 'catalog-paid' : 'catalog-free'}" data-persona="${t.persona}" data-go="article/${esc(item.id)}"><span class="catalog-status"><span class="badge ${paid ? (item.readable ? 'owned' : '') : 'free'}">${paid ? (item.readable ? '閲覧できます' : '有料・単発') : '無料情報'}</span><span>${dateLabel(p.race_date)} ${result || '公開中'}</span></span>${eyecatch(p, 'baked-race-art')}<span class="cast-strip" data-persona="${t.persona}"><span class="type-mark" data-persona="${t.persona}" aria-hidden="true">${t.mark}</span><span><small>予想タイプ</small><b>${t.name}</b></span><em>提携予想家</em></span><span class="catalog-race-copy"><strong>${esc(raceLabel(p))}</strong><span class="race-course-line">${esc(courseLabel(p))}</span><span>${esc(p.title)}</span></span><span class="catalog-data"><span>発走 <b>${esc(p.post_time || '—')}</b></span><span>${esc(p.ticket_type || '券種')} <b>${p.points || 0}点</b></span><span>情報料 <b>${paid ? '有料' : '0円'}</b></span></span><span class="catalog-action">${paid && !item.readable ? '内容を確認する' : '予想を読む'} →</span></button>`;
}

function ticket(p, body, race, price) {
  const bets = Array.isArray(body?.bets) ? body.bets : [];
  return `<section class="betting-section"><div class="ticket"><div class="ticket-top"><b>買い目のご案内</b><span>買い目・予算</span></div><div><span>券種</span><b>${esc(p.ticket_type)}・${p.points}点</b></div><div class="picks"><span>組み合わせ</span><b class="bet-pairs">${bets.map(bet => `<span class="bet-pair">${bet.map(n => horseBadge(race, n)).join('<span aria-hidden="true">－</span>')}</span>`).join('')}</b></div><div><span>点数 × 1点の金額</span><b>${p.points}点 × ${yen(p.unit_amount)}</b></div><div class="total"><span>馬券代の目安</span><strong>${Number(p.budget_jpy || 0).toLocaleString('ja-JP')}<small>円</small></strong></div><div><span>情報料</span><b>${p.access === 'paid' ? `単品 ${yen(price?.amount_jpy)}（${esc(price?.note || '設定案')}）` : '0円'}</b></div></div><p class="small">金額は利用例です。馬券代は情報料と別です。</p>${frameLegend(race)}</section>`;
}

function historyBlock(a) {
  const revisions = a.revisions || [];
  if (!revisions.length) return '';
  return `<section class="mg-history">${heading('記録', '公開・更新の履歴。')}<ol>${revisions.map(r => `<li><b>${r.no === 1 ? '公開' : '改訂'} 第${r.no}版</b><span>${timeLabel(r.at)}${r.after_post_time ? ' ／ <strong>発走後の更新</strong>' : ''}</span>${r.reason ? `<p>理由：${esc(r.reason)}</p>` : ''}${a.id && r.no !== a.revision_no ? `<button type="button" class="text-button" data-mg-revision="${r.no}">この版の内容を見る</button>` : ''}</li>`).join('')}</ol><p class="small">公開した版はすべて保存しています。結果のあとで事前の予想を書き換えることはありません。</p><div id="mg-revision-view" tabindex="-1"></div></section>`;
}
function resultBlock(a) {
  const r = a.result;
  if (!r) return '';
  const label = ({hit: '的中', miss: '不的中', pending: '結果確認中', cancel: '未提供'})[r.status];
  const settled = ['hit', 'miss'].includes(r.status);
  return `<section class="result-receipt ${esc(r.status)} mg-result">${heading('結果', '結果と振り返り。')}<div class="result-status">${label}</div>${settled ? `<div class="summary-row"><span>想定馬券代</span><b>${yen(r.stake_jpy)}</b></div><div class="summary-row"><span>払戻額</span><b>${yen(r.payout_jpy)}</b></div><div class="summary-row"><span>馬券代のみの差引</span><b>${r.payout_jpy - r.stake_jpy >= 0 ? '+' : '−'}${yen(Math.abs(r.payout_jpy - r.stake_jpy))}</b></div><p class="small">掲載した買い目を目安の金額で購入した場合の計算です。情報料は含みません。</p>` : `<p>${r.status === 'pending' ? '結果の確認後に更新します。' : '提供を見送りました。結果の集計には含めません。'}</p>`}${r.recap ? `<div class="copy-box"><b>振り返り</b><p>${esc(r.recap).replace(/\n+/g, '<br>')}</p></div>` : ''}</section>`;
}

function bodyHtml(a, race) {
  const p = a.public, b = a.body, paid = p.access === 'paid';
  const reasons = (b.reasons || []).filter(x => String(x || '').trim());
  const horses = (b.horses || []).filter(h => Number.isInteger(h?.number));
  const refs = (b.references || []).filter(x => String(x?.text || '').trim());
  const extra = [['想定展開', b.scenario], ['選んだ馬の比較', b.comparison], ['有力候補を外した理由', b.excluded], ['想定が崩れる条件', b.break_conditions]].filter(([, text]) => String(text || '').trim());
  let n = 0;
  const no = () => String(++n).padStart(2, '0');
  return `<div class="oj-summary"><div><span>30秒でわかる</span><b>今回の見立て</b></div><p>${prose(race, b.conclusion)}</p><small id="article-risk" tabindex="-1">懸念：${prose(race, b.concern)}</small></div>
    <section id="article-budget" tabindex="-1">${heading(no(), '買い目と予算を、確認。')}${ticket(p, b, race, a.price)}</section>
    <section id="article-reasons" tabindex="-1">${heading(no(), '選んだ理由。')}<ol class="mg-reasons">${reasons.map(r => `<li>${prose(race, r)}</li>`).join('')}</ol></section>
    ${horses.length ? `<section>${heading(no(), '馬ごとの理由と懸念。')}<p class="horse-tap-guide">馬名をタップすると、選んだ理由と懸念点を確認できます。</p><div class="mg-horses">${horses.map(h => horseBadge(race, h.number)).join('')}</div></section>` : ''}
    ${paid && extra.length ? `<section>${heading(no(), '詳しい分析。')}${extra.map(([t, text]) => `<div class="copy-box"><b>${t}</b><p>${prose(race, text)}</p></div>`).join('')}</section>` : ''}
    ${refs.length ? `<section class="mg-refs">${heading(no(), '参考にした事実・資料。')}<ul>${refs.map(x => `<li>${esc(x.text)}${x.checked_at ? `<small>確認 ${timeLabel(x.checked_at)}</small>` : ''}</li>`).join('')}</ul></section>` : ''}`;
}

function lockedHtml(a, c) {
  const p = a.public, next = `article/${a.id}`;
  return `<div class="oj-price"><div><span>この1レースの情報料</span><strong>${Number(a.price?.amount_jpy || 0).toLocaleString('ja-JP')}<small>円</small></strong><small>税込・${esc(a.price?.note || '設定案')}</small></div><ul><li>単発購入</li><li>自動更新なし</li><li>馬券代は別</li></ul></div>
    ${heading('01', '購入前に確認できること。')}
    <dl class="oj-terms"><div><dt>対象レース</dt><dd>${esc(raceLabel(p))}<small>${dateLabel(p.race_date)}</small></dd></div><div><dt>コース</dt><dd>${esc(courseLabel(p))}</dd></div><div><dt>発走</dt><dd>${esc(p.post_time)}</dd></div><div><dt>券種・点数</dt><dd>${esc(p.ticket_type)}・${p.points}点</dd></div><div><dt>馬券代の目安</dt><dd>${yen(p.budget_jpy)}<small>${p.points}点 × ${yen(p.unit_amount)}</small></dd></div><div><dt>販売締切</dt><dd>${timeLabel(p.sales_close_at) || '—'}</dd></div></dl>
    ${p.viewpoints ? `<div class="copy-box"><b>選定の着眼点</b><p>${esc(p.viewpoints).replace(/\n+/g, '<br>')}</p></div>` : ''}
    ${heading('02', '購入後に読める内容。')}
    <ul class="check-list"><li>買い目・点数・1点ごとの金額</li><li>30秒で読める結論と最大の懸念</li><li>選定理由、馬ごとの理由と懸念</li><li>想定展開・候補比較・外した理由・崩れる条件</li><li>結果と振り返り、公開・更新の履歴</li></ul>
    <p class="oj-micro">高い料金ほど当たりやすい、という商品ではありません。的中や利益を保証しません。</p>
    <div class="oj-caution mg-locked" role="note"><b>${a.sales_open === false && p.sales_close_at ? '販売は終了しました' : '決済は準備中です'}</b><p>${a.sales_open === false && p.sales_close_at ? '購入済みの方は、ログインすると全文を読めます。' : 'まだ購入できません。決済の接続後、この画面から購入できるようになります。課金は発生しません。'}</p></div>
    ${c.preview ? '' : a.signed_in ? `<p class="small">ログイン中のアカウントには、この記事の閲覧権限がありません。</p>` : `<button class="secondary" data-auth="${esc(next)}" data-auth-mode="signin">購入済みの方はログイン${c.icon('arrow')}</button><p class="small">ログイン後、この記事に戻ります。</p>`}`;
}

// a = {id, public, body|null, locked, signed_in, revision_no, revisions, result, price, sales_open}
export function renderArticle(a, c) {
  const p = a.public || {}, t = typeOf(p), paid = p.access === 'paid', race = raceOf(a.body);
  const state = paid ? (a.locked ? '有料・詳細分析' : '閲覧できます') : '無料予想';
  return `<article class="oj-page oj-article analysis-article mg-article" data-persona="${t.persona}" data-mg-article="${esc(a.id || '')}"><div class="oj-body">
    <div class="oj-section-label"><span>${state}</span><b>${marketLabel(p)}・${t.name}</b></div>
    ${eyecatch(p)}
    <header class="oj-article-title"><p>${dateLabel(p.race_date)} · ${esc(raceLabel(p))} · ${esc(courseLabel(p))}${p.race_name ? ' · ' + esc(p.race_name) : ''}</p><h1>${esc(p.title) || 'タイトル未入力'}</h1><div><span>${esc(p.ticket_type || '券種')}${p.points || 0}点</span><span>${paid ? '有料分析' : '情報料0円'}</span><span>発走 ${esc(p.post_time || '—')}</span></div></header>
    <div class="cast-strip" data-persona="${t.persona}"><span class="type-mark" data-persona="${t.persona}" aria-hidden="true">${t.mark}</span><span><small>予想タイプ</small><b>${t.name}</b></span><em>予想提供：提携予想家</em></div>
    <p class="analysis-lead">${esc(p.summary).replace(/\n+/g, '<br>')}</p>
    ${a.locked || !a.body ? lockedHtml(a, c) : bodyHtml(a, race)}
    ${resultBlock(a)}${historyBlock(a)}
    <p class="oj-micro">馬券代と情報料は別です。20歳以上の方向け。的中や利益を保証するものではありません。</p>
    </div></article>`;
}

// 馬の詳細パネル。閉じずに候補馬を切り替えて比較できる。
let dialog, opener, lock;
function unlock() {
  if (!lock) return;
  const saved = lock;
  lock = null;
  Object.assign(document.body.style, saved.styles);
  window.scrollTo({top: saved.y, behavior: 'instant'});
  if (opener?.isConnected) opener.focus({preventScroll: true});
  opener = null;
}
export function closeManagedHorse() { if (dialog?.open) dialog.close(); unlock(); }
function showHorse(article, number, announce) {
  const race = raceOf(article.body), h = article.body.horses.find(x => x.number === number);
  if (!h) return;
  dialog.querySelector('#mg-horse-title').textContent = h.name;
  for (const b of dialog.querySelectorAll('[data-switch-horse]')) b.setAttribute('aria-pressed', String(Number(b.dataset.switchHorse) === number));
  const frame = frameFor(race, number);
  dialog.querySelector('.horse-detail-body').innerHTML = `<div class="horse-detail-role"><span>今回の役割</span><strong>${esc(h.role || '候補')}</strong></div><section><h3>理由</h3><p>${esc(h.reason)}</p></section><section class="horse-detail-risk"><h3>懸念点</h3><p>${esc(h.concern)}</p></section><p class="horse-detail-note">${number}番・${frame ? `${frame}枠（${frameColours[frame]}）` : '枠未確定'}。この記事の見立てを要約しています。</p>`;
  dialog.querySelector('.horse-detail-body').scrollTop = 0;
  dialog.querySelector('[role="status"]').textContent = announce ? `${number}番 ${h.name}の理由と懸念点を表示しました。` : '';
}
function openHorse(button, article, number) {
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.className = 'horse-detail-dialog';
    dialog.setAttribute('aria-labelledby', 'mg-horse-title');
    document.body.append(dialog);
    dialog.addEventListener('close', unlock);
    dialog.addEventListener('click', e => {
      const choice = e.target.closest('[data-switch-horse]');
      if (choice) { showHorse(dialog.article, Number(choice.dataset.switchHorse), true); backend.track('horse_switch', dialog.article.id || null); }
      else if (e.target.closest('[data-close-horse]') || e.target === dialog) closeManagedHorse();
    });
  }
  const race = raceOf(article.body), t = typeOf(article.public);
  dialog.article = article;
  dialog.dataset.persona = t.persona;
  dialog.innerHTML = `<header class="horse-detail-header"><div><p>記事内の馬メモ</p><h2 id="mg-horse-title"></h2></div><button type="button" class="horse-detail-close" data-close-horse aria-label="馬の詳細を閉じる">×</button></header><div class="horse-switcher"><p id="horse-detail-context">${esc(raceLabel(article.public))} · ${t.name}</p><div class="horse-switch-caption"><span>馬番・馬名で切り替え</span><small>✓ 表示中</small></div><div class="horse-switch-list" role="group" aria-label="比較する馬">${article.body.horses.filter(h => Number.isInteger(h.number)).map(h => `<button type="button" class="horse-switch-choice" data-switch-horse="${h.number}" aria-pressed="false" aria-label="${h.number}番 ${esc(h.name)}に切り替える"><b class="frame-badge frame-${frameFor(race, h.number) || 'unknown'}" aria-hidden="true">${h.number}</b><span class="horse-switch-name">${esc(h.name)}</span><span class="horse-switch-check" aria-hidden="true">✓</span></button>`).join('')}</div></div><div class="horse-detail-body"></div><span class="horse-switch-sr" role="status" aria-live="polite"></span><footer><button type="button" data-close-horse>閉じて記事の続きを読む</button></footer>`;
  showHorse(article, number, false);
  opener = button;
  lock = {y: window.scrollY, styles: Object.fromEntries(['position', 'top', 'width', 'overflow'].map(k => [k, document.body.style[k]]))};
  Object.assign(document.body.style, {position: 'fixed', top: `-${lock.y}px`, width: '100%', overflow: 'hidden'});
  dialog.showModal();
  backend.track('horse_detail_open', article.id || null);
}
export function mountArticle(root, article) {
  const node = root.querySelector('.mg-article');
  if (!node || !article.body || article.locked) return;
  const known = new Set((article.body.horses || []).map(h => h.number));
  for (const el of node.querySelectorAll('.horse-ref[data-horse],.horse-id[data-horse]')) {
    const number = Number(el.dataset.horse);
    if (!known.has(number) || el.closest('button,a')) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = el.className + ' horse-detail-trigger';
    button.innerHTML = el.innerHTML;
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-label', `${number}番 ${article.body.horses.find(h => h.number === number)?.name || ''}の理由と懸念点を開く`);
    button.addEventListener('click', () => openHorse(button, article, number));
    el.replaceWith(button);
  }
}

// ---- 公開ページ ----
const loading = '<div class="status-card" role="status"><b>読み込んでいます…</b></div>';
const failed = (message, c) => `<div class="error" role="alert"><b>表示できませんでした</b><p>${esc(message)}</p></div>${c.btn('もう一度読み込む', c.current(), 'secondary')}`;

export function articlePage() { return `<div class="mg-page" id="mg-root">${loading}</div>`; }
export async function mountArticlePage(root, id, c) {
  const box = root.querySelector('#mg-root');
  if (!box) return;
  let article;
  try { article = await backend.rpc('get_article', {p_id: id}); }
  catch (error) { if (box.isConnected) box.innerHTML = `<div class="content inner-page">${failed(error.message, c)}</div>`; return; }
  if (!box.isConnected) return;
  if (!article) {
    box.innerHTML = `<div class="content inner-page"><div class="status-card"><b>この記事は現在公開されていません</b><p>公開前、または公開を終了した記事です。</p></div>${c.btn('今週の予想へ', 'home', 'secondary')}</div>`;
    return;
  }
  box.innerHTML = `${c.routeBack('articles', '公開中の記事一覧に戻る')}${renderArticle(article, c)}`;
  mountArticle(box, article);
  backend.track(article.locked ? 'locked_article_open' : 'article_open', article.id, {access: article.public.access, revision: article.revision_no});
  box.addEventListener('click', async event => {
    const button = event.target.closest('[data-mg-revision]');
    if (!button) return;
    const view = box.querySelector('#mg-revision-view');
    view.innerHTML = loading;
    try {
      const old = await backend.rpc('get_article_revision', {p_id: article.id, p_no: Number(button.dataset.mgRevision)});
      if (!old) throw new Error('この版は表示できません。');
      const race = raceOf(old.body);
      view.innerHTML = `<div class="soft-box"><b>第${old.no}版（${timeLabel(old.at)} 公開）の内容</b>${old.body ? `<p>結論：${prose(race, old.body.conclusion)}</p><p>買い目：${(old.body.bets || []).map(bet => bet.join('－')).join('、')}（${esc(old.public.ticket_type)}・1点 ${yen(old.public.unit_amount)}）</p><p>懸念：${prose(race, old.body.concern)}</p>` : '<p>この版の本文は、閲覧権限のある方だけが確認できます。</p>'}</div>`;
      view.focus({preventScroll: false});
    } catch (error) { view.innerHTML = `<p class="ac-form-error" role="alert">${esc(error.message)}</p>`; }
  });
}

export function listPage(c) {
  return `<div class="content inner-page">${c.innerHero(c.real ? '無料予想は登録なしで読めます' : '記事管理から公開した記事', c.real ? '公開中の予想' : '公開中の記事', c.real ? '気になるレースから、お選びください。' : '無料予想は、登録しなくても読めます。')}<div id="mg-list">${loading}</div></div>`;
}
export async function mountList(root, c) {
  const box = root.querySelector('#mg-list');
  if (!box) return;
  try {
    const items = (await backend.rpc('list_articles')).filter(x => x.public.market === c.market());
    if (!box.isConnected) return;
    box.innerHTML = items.length ? `<div class="race-list">${items.map(articleCard).join('')}</div><p class="small">${c.real && !c.localPreview ? '価格は設定案です。決済は未接続で、課金はありません。' : '検証環境の記事です。レース・予想は仮データ、価格は設定案です。'}</p>`
      : `<div class="empty"><b>公開中の記事はまだありません</b><p>${c.market() === 'local' ? '地方競馬' : '中央競馬'}の記事を公開すると、ここに表示されます。</p></div>`;
  } catch (error) { if (box.isConnected) box.innerHTML = failed(error.message, c); }
}

// ホームに、公開中の記事への入口を差し込む（接続時のみ）。既存の「まず読む無料1本」と3タイプの並びは変えない。
export async function mountHomeShelf(root, c) {
  const anchor = root.querySelector('.catalog-section, .local-summary');
  if (!anchor) return;
  let items;
  try { items = (await backend.rpc('list_articles')).filter(x => x.public.market === c.market()); } catch { return; }
  if (!anchor.isConnected || !items.length) return;
  const section = document.createElement('section');
  section.className = 'catalog-section mg-shelf';
  section.innerHTML = `<h2 class="sales-heading"><span>記事管理から</span>公開中の記事</h2><p class="section-intro">管理画面で公開した記事を、そのまま読めます</p><div class="race-list">${items.slice(0, 3).map(articleCard).join('')}</div>${items.length > 3 ? c.btn('公開中の記事をすべて見る', 'articles', 'secondary') : ''}`;
  anchor.before(section);
}
