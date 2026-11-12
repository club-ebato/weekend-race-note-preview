// 「本番記事モード」のホームと全結果。見本の12レースを使わず、記事管理から公開した記事だけで組み立てる。
// 結果の数は、公開した記事に登録された結果をそのまま数える。画面側で実績を作らない。
import * as backend from './backend.mjs';
import {articleCard, esc, dateLabel, raceLabel, types} from './managed.mjs';
import {characters, characterDisclosure, characterHome, characterTabs, characterHero, characterPath, typeByKey} from './characters.mjs';

const settled = ['hit', 'miss', 'cancel'];
const resultLabel = {hit: '的中', miss: '不的中', pending: '結果確認中', cancel: '未提供'};
const loading = '<div class="status-card" role="status"><b>読み込んでいます…</b></div>';
const marketName = m => m === 'local' ? '地方競馬' : '中央競馬';

// 日本時間の「今日」（YYYY-MM-DD）。
export const todayJst = (now = Date.now()) => new Date(now + 9 * 3600e3).toISOString().slice(0, 10);

// これから・当日の予想（upcoming）と、終わったレース（past）に分ける。
export function splitArticles(items, today) {
  const upcoming = [], past = [];
  for (const x of items) (String(x.public?.race_date || '') >= today && !settled.includes(x.result) ? upcoming : past).push(x);
  const key = x => `${x.public.race_date} ${x.public.post_time || ''}`;
  upcoming.sort((a, b) => key(a).localeCompare(key(b)));
  past.sort((a, b) => key(b).localeCompare(key(a)));
  return {upcoming, past};
}


// 提供元の説明。ユーザーが確認した範囲（20年以上の経験があるプロ）だけを書く。実績・人数・名前は書かない。
export const providerNote = '<aside class="mh-provider"><span>予想の提供</span><b>20年以上の経験があるプロの予想家。</b><p>提携する予想家の予想を、買い目と理由をそろえて掲載します。AIによる予想ではありません。的中や利益を保証するものではありません。</p></aside>';

function signup(c) {
  if (c.signedIn()) return '';
  return `<div class="registration-box"><p class="registration-lead">＼ 無料予想は登録なしで読めます ／</p><button class="cta-green" data-auth="home"><span class="cta-chat">${c.icon('chat')}</span><span><small>メールアドレスで登録</small><b>無料会員登録はこちら</b></span>${c.icon('arrow')}</button><p class="registration-note">会員登録は、有料記事の購入（準備中）に使います。決済は未接続で、課金はありません。LINE連携は不要です。</p></div>`;
}

function resultTeaser(past, c) {
  const done = past.filter(x => ['hit', 'miss'].includes(x.result)).slice(0, 3);
  return `<section class="results-promo"><h2 class="sales-heading">予想の結果も<span>公開</span></h2><p class="section-intro">的中・不的中、どちらも記録します</p>${done.length
    ? `<div class="result-examples">${done.map(x => `<div><b>${dateLabel(x.public.race_date)} ${esc(raceLabel(x.public))}</b><span class="${x.result === 'hit' ? 'example-hit' : ''}">${resultLabel[x.result]}</span></div>`).join('')}</div>`
    : '<p class="small">結果は、レースの確定後にここへ記録します。</p>'}${c.btn('全結果を見る', 'results', 'secondary')}</section>`;
}

const faq = `<section class="sales-faq"><h2 class="sales-heading">よくある<span>ご質問</span></h2><details><summary>無料でどこまで見られますか？</summary><p>無料予想は、買い目・選んだ理由・懸念・予算の目安・結果まで、登録なしで読めます。</p></details><details><summary>有料記事との違いは？</summary><p>無料とは別のレースが対象で、展開の想定や候補の比較などを詳しく書きます。情報料は各記事のページに表示します（設定案）。決済は準備中で、まだ購入できません。</p></details><details><summary>LINE連携は必要ですか？</summary><p>必要ありません。案内されたリンクから、そのまま記事を読めます。</p></details></section>`;

// items = list_articles の結果。c = {market, signedIn, icon, btn, localPreview}
export function homeHtml(items, c, today = todayJst()) {
  const {upcoming, past} = splitArticles(items.filter(x => x.public?.market === c.market()), today);
  const lead = upcoming.find(x => x.public.access !== 'paid');
  const rest = upcoming.filter(x => x !== lead);
  const days = [...new Set(rest.map(x => x.public.race_date))];
  const leadHtml = lead ? `<section class="catalog-section mh-lead"><h2 class="sales-heading"><span>まず読む</span>無料予想</h2><p class="section-intro">登録なしで読めます・情報料0円</p><div class="race-list">${articleCard(lead)}</div></section>` : '';
  const listHtml = rest.length
    ? `<section class="catalog-section"><h2 class="sales-heading"><span>公開中の</span>予想</h2><p class="section-intro">${marketName(c.market())}・レースの日付順</p>${days.map(d => `<h3 class="mh-day">${dateLabel(d)}</h3><div class="race-list">${rest.filter(x => x.public.race_date === d).map(articleCard).join('')}</div>`).join('')}</section>`
    : lead ? '' : `<section class="catalog-section"><h2 class="sales-heading"><span>公開中の</span>予想</h2><div class="empty"><b>公開中の予想はまだありません</b><p>${marketName(c.market())}の次回の予想を公開すると、ここに表示されます。</p></div></section>`;
  return `${leadHtml}${listHtml}${providerNote}${characterHome()}${signup(c)}${resultTeaser(past, c)}${faq}<p class="art-disclaimer">画像はイメージ素材です。${c.localPreview ? '検証環境の記事は仮データです。' : ''}<br>20歳以上の方向け。情報料と馬券代は別です。的中や利益を保証しません。</p>`;
}

export function resultsHtml(items, c, today = todayJst()) {
  const {past} = splitArticles(items.filter(x => x.public?.market === c.market()), today);
  const count = s => past.filter(x => x.result === s).length;
  if (!past.length) return `<div class="empty"><b>まだ結果はありません</b><p>${marketName(c.market())}のレースが終わると、公開した予想の結果をここに記録します。</p></div>${c.btn('公開中の予想を見る', 'articles', 'secondary')}`;
  return `<div class="mh-tally" role="group" aria-label="結果の件数"><span>的中<b>${count('hit')}</b></span><span>不的中<b>${count('miss')}</b></span><span>確認中<b>${past.length - count('hit') - count('miss') - count('cancel')}</b></span></div>
    <p class="small">公開した予想の結果を、的中・不的中のどちらも掲載しています。未提供のレース（${count('cancel')}件）は件数に含めません。払戻額と振り返りは各記事で確認できます。</p>
    <div class="mh-results">${past.map(resultRow).join('')}</div>
    <p class="small">的中や利益を保証するものではありません。${c.localPreview ? '検証環境の記事は仮データです。' : ''}</p>`;
}

const resultRow = x => { const p = x.public, t = types[p.type]; return `<button class="mh-result" data-go="article/${esc(x.id)}"><span class="mh-result-date">${dateLabel(p.race_date)}</span><span class="mh-result-race"><b>${esc(raceLabel(p))}</b><small>${t ? t.name : '予想'}・${p.access === 'paid' ? '有料' : '無料'}</small></span><span class="mh-result-status ${esc(x.result || 'pending')}">${resultLabel[x.result] || '結果確認中'}</span></button>`; };

// タイプ別ページ。説明は固定の文章、記事と結果は公開した記事だけ。items が null のあいだは読み込み中。
const ofType = (items, c, p, today) => splitArticles((items || []).filter(x => x.public?.market === c.market() && x.public?.type === p.key), today);

export function typesHtml(items, c, today = todayJst()) {
  return `<article class="oj-page cast-hub"><header class="cast-heading"><span>本命・穴馬・データ</span><h1>読みたい予想を、<br>３つのタイプから。</h1><p>重視することと、読める内容で選べます。</p></header>${characterTabs('')}<div class="cast-hub-list">${Object.values(characters).map((p, i) => {
    const n = ofType(items, c, p, today).upcoming.length;
    return `<section class="cast-card" data-persona="${p.id}"><h2 class="sr-only">${p.name}</h2><button class="cast-art-link" data-go="${characterPath(p)}" aria-label="${p.name}の内容を見る"><img src="${characterHero(p)}" alt="${p.name}／${p.catch}" width="1536" height="1024" ${i ? 'loading="lazy"' : 'fetchpriority="high"'}></button><div class="cast-card-copy"><span class="cast-role">${p.tag}</span><p>${p.intro}</p><ul class="type-points">${p.points.map(([h]) => `<li>${h}</li>`).join('')}</ul><div class="cast-actions">${c.btn('内容と公開中の予想を見る', characterPath(p), 'secondary')}</div><small class="mh-type-count">${items ? `${marketName(c.market())}で公開中：${n}本` : '公開中の予想を確認しています…'}</small></div></section>`;
  }).join('')}${providerNote}${characterDisclosure}</div></article>`;
}

export function typeHtml(items, c, key, today = todayJst()) {
  const p = typeByKey(key), {upcoming, past} = ofType(items, c, p, today);
  const free = upcoming.find(x => x.public.access !== 'paid');
  const days = [...new Set(upcoming.map(x => x.public.race_date))];
  const list = !items ? loading : upcoming.length
    ? days.map(d => `<h3 class="mh-day">${dateLabel(d)}</h3><div class="race-list">${upcoming.filter(x => x.public.race_date === d).map(articleCard).join('')}</div>`).join('')
    : `<div class="empty"><b>このタイプの公開中の予想はまだありません</b><p>${marketName(c.market())}で次回の予想を公開すると、ここに表示されます。</p></div>`;
  return `${characterTabs(p.id)}<article class="oj-page cast-profile" data-persona="${p.id}"><h1 class="sr-only">${p.name}</h1><figure class="oj-hero"><img src="${characterHero(p)}" alt="${p.name}・${p.catch}" width="1536" height="1024" fetchpriority="high"><figcaption>予想タイプのイメージ</figcaption></figure><div class="oj-body"><div class="cast-promise"><span class="cast-role">${p.tag}</span><h2>${p.catch}</h2><p>${p.intro}</p></div>${free ? `${c.btn('このタイプの無料予想を読む', 'article/' + esc(free.id), 'cta-green oj-main-cta')}<p class="oj-micro">${dateLabel(free.public.race_date)} ${esc(raceLabel(free.public))}。登録なしで読めます。情報料0円。</p>` : ''}<h2 class="oj-heading">このタイプで読む、３つのこと。</h2><div class="oj-values">${p.points.map(([h, d], i) => `<div><span>0${i + 1}</span><div><h3>${h}</h3><p>${d}</p></div></div>`).join('')}</div><p class="cast-disclosure">${p.notice}</p>${providerNote}<h2 class="oj-heading">${marketName(c.market())}の公開中の予想</h2><p class="oj-micro">同じ予想をタイプ違いで重複販売しません。</p>${list}${past.length ? `<h2 class="oj-heading">このタイプの結果</h2><p class="oj-micro">的中・不的中のどちらも掲載します。</p><div class="mh-results">${past.slice(0, 5).map(resultRow).join('')}</div>` : ''}${c.btn('3つのタイプを比べる', 'types', 'secondary')}</div></article>`;
}

export const typesShell = c => `<div id="mh-types-root">${typesHtml(null, c)}</div>`;
export const typeShell = (c, key) => `<div id="mh-type-root">${typeHtml(null, c, key)}</div>`;
export const homeShell = () => `<div id="mh-root">${loading}</div>`;
export const resultsShell = () => `<div id="mh-results-root">${loading}</div>`;

async function mount(root, selector, render, c) {
  const box = root.querySelector(selector);
  if (!box) return;
  try {
    const items = await backend.rpc('list_articles');
    if (box.isConnected) box.innerHTML = render(items, c);
  } catch (error) {
    if (box.isConnected) box.innerHTML = `<div class="error" role="alert"><b>表示できませんでした</b><p>${esc(error.message)}</p></div>${c.btn('もう一度読み込む', c.current(), 'secondary')}`;
  }
}
export const mountHome = (root, c) => mount(root, '#mh-root', homeHtml, c);
export const mountResults = (root, c) => mount(root, '#mh-results-root', resultsHtml, c);
export const mountTypes = (root, c) => mount(root, '#mh-types-root', typesHtml, c);
export const mountType = (root, c, key) => mount(root, '#mh-type-root', (items, ctx) => typeHtml(items, ctx, key), c);
