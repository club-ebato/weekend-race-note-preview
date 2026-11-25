// 料金と商品（3段階の案）。2026-11-25 のユーザー指示「この案で作って」による画面の下書き。
// ・値段はすべて案。決済は未接続で、購入の操作は置かない（課金できると誤認させない）。
// ・上位商品も、的中・不的中の両方を掲載する。的中や利益を保証する表現、当たりだけを見せる表現は使わない。
// ・記事管理（データベース）には「上位」の区分をまだ作っていない。このページは案内だけ。
export const tiers = [
  {key: 'free', label: '無料', price: '0円', note: '登録なしで読めます',
    points: ['買い目と、選んだ理由', '懸念と、予算の目安', 'レース後の結果（的中・不的中とも）'],
    schedule: '中央競馬：土日 各1レース／地方競馬：開催日に毎日2レース', status: '公開中', go: ['公開中の予想を見る', 'articles']},
  {key: 'standard', label: '通常', price: '1本 980円', sub: '当日2本 1,780円／当日3本 2,980円', note: '税込・設定案',
    points: ['無料とは別のレースの詳細分析', '買い目・理由・懸念を、無料より詳しく', 'レース後の結果（的中・不的中とも）'],
    schedule: '地方競馬：開催日に毎日2〜3レース／中央競馬：週末', status: '準備中'},
  {key: 'premium', label: '上位', price: '20,000円〜25,000円', note: '税込・設定案',
    points: ['週末のメインレースと、南関東の厳選レース', '買い目ごとの資金配分まで書いた詳細版', 'レース後の結果（的中・不的中とも）'],
    schedule: '週末と、南関東の開催日', status: '準備中'},
];

// 上位の情報料の表示（設定案）。記事の画面でも同じ文言を使う。
export const premiumPrice = tiers.find(t => t.key === 'premium').price;

const draft = '<div class="lg-draft" role="note"><b>準備中の案です</b><p>値段は確定していません。決済は未接続で、有料の商品はまだ購入できません。課金は発生しません。</p></div>';

// c：app.js の部品（routeBack, innerHero, bar, btn）
export function plansPage(c) {
  const cards = tiers.map(t => `<section class="pl-card" data-tier="${t.key}"><header><span class="pl-label">${t.label}</span><span class="pl-status${t.status === '公開中' ? ' on' : ''}">${t.status}</span></header>
    <p class="pl-price"><b>${t.price}</b>${t.sub ? `<small>${t.sub}</small>` : ''}<em>${t.note}</em></p>
    <ul class="pl-points">${t.points.map(p => `<li>${p}</li>`).join('')}</ul>
    <p class="pl-schedule"><span>提供日</span>${t.schedule}</p>${t.go ? c.btn(t.go[0], t.go[1], 'secondary') : ''}</section>`).join('');
  return `<div class="content inner-page pl-page">${c.routeBack('about', 'このサイトについてに戻る')}${c.innerHero('週末競馬ノート', '料金と商品', '無料の予想から、じっくり読む上位版まで。', 'guide')}${draft}${cards}
    ${c.bar('どの商品でも同じこと')}<ul class="lg-list"><li>的中や利益を保証するものではありません。</li><li>結果は、どの商品でも的中・不的中の両方を掲載します。</li><li>情報料と馬券代は別です。</li><li>20歳以上の方向けです。</li></ul>
    ${c.btn('ホームへ戻る', 'home', 'secondary')}</div>`;
}
