import {journeyNav,readingGuide,articleBridge} from './journey.mjs';
import {articleMeta,readingEntry,analysisBody,analysisExcerpt,recapBlock,otherReading} from './analysis.mjs';
import {characterFor,characters,characterProfile,characterPath,characterTabs,characterStrip,characterDisclosure,portrait,guideCopy,nextCharacterPaid} from './characters.mjs';
// Shared editorial journey. Themes change presentation, never content or access rules.
export function previewNav(c, active, r) {
  const day=c.selectedDay(),p=r?characterFor(r):characters.ojisan,free=r?.free?r.id:(c.races.find(x=>x.free&&x.market===c.state.market&&characterFor(x).id===p.id)?.id||p.free),paid=r?(r.free?nextCharacterPaid(c,r):r.id):nextCharacterPaid(c,c.rBy(free));
  return `<nav class="oj-preview" aria-label="3画面を比較">${[['types','01','予想タイプ'],['sample/'+free,'02','無料予想'],['product/'+paid,'03','有料詳細']].map(([path,n,label],i)=>`<button data-go="${path}" ${active===i?'aria-current="page"':''}><small>${n}</small>${label}</button>`).join('')}</nav>`;
}
export function byline(c,r) {
  const p=characterFor(r);
  return `<button class="oj-byline cast-byline" data-persona="${p.id}" data-go="${characterPath(p)}"><span class="cast-avatar" aria-hidden="true">${portrait(p)}</span><span><small>予想タイプ · ${p.role}</small><b>${p.name}</b><em>予想提供：提携予想家</em></span><span class="oj-byline-arrow">内容へ ›</span></button>`;
}
const note='';
const heading=(n,t)=>`<h2 class="oj-heading"><span>${n}</span>${t}</h2>`;
export function expertPage(c){return characterProfile(c,'solid');}
export function flagshipPage(c,r,preview=false) {return editorialArticle(c,r,preview);}
export function expertPaidArticle(c,r) {return editorialArticle(c,r);}
function editorialArticle(c,r,preview=false) {
  const {state,btn,title,date,raceBanner,courseLabel,budget}=c;
  const paid=nextCharacterPaid(c,r),p=characterFor(r),m=articleMeta(r);
  return `${r.free?journeyNav(c,r):previewNav(c,2,r)}<article class="oj-page oj-article analysis-article" data-persona="${p.id}"><div class="oj-body">
    <div class="oj-section-label"><span>${r.free?'無料予想':'購入済み'}</span><b>${m.series}</b></div>
    ${raceBanner(r)}
    <header class="oj-article-title"><p>${date(r)} · ${title(r)} · ${courseLabel(r)}</p><h1>${m.title}</h1><div><span>馬連２点</span><span>${r.free?'情報料０円':'有料分析・全文'}</span><span>${r.free?'基本の見立て':'候補比較まで'}</span></div></header>
    ${byline(c,r)}${note}
    ${r.free?readingGuide():''}${readingEntry(r)}<p class="analysis-lead">${m.lead}</p>
    <div class="oj-summary"><div><span>30秒でわかる</span><b>今回の見立て</b></div><p>${m.verdict}</p><small id="article-risk" tabindex="-1">懸念：${m.risk}</small></div>
    <section id="article-budget" tabindex="-1">${heading('01','買い目と予算を、確認。')}${budget(r)}</section>
    <div id="article-reasons" tabindex="-1">${analysisBody(r,!r.free)}</div>${r.free?articleBridge(c,r):''}<div id="article-recap" tabindex="-1">${recapBlock(c,r)}</div>
    ${preview&&!state.member?`<div class="oj-register"><b>読んだ予想は、マイページから。</b><p>無料予想と購入した記事を、まとめて確認。</p><button class="cta-green oj-main-cta" data-auth="read/${r.id}">無料登録して予想を読む ${c.icon('arrow')}</button><small>${c.memberNote||'登録は操作デモです。LINE連携・個人情報の入力は不要です。'}</small></div>`:''}
    ${r.free?'':btn('購入済みの予想へ','mypage','secondary')}
    ${otherReading(c,r)}</div></article>`;
}
export function expertProduct(c,id) {
  const {state,btn,title,date,publicTime,bannerImage,raceBanner,courseLabel,remaining,quote}=c;
  const r=c.rBy(id),p=characterFor(r),copy=guideCopy(r),m=articleMeta(r),bill=quote(state,id),owned=remaining(state,id).length===0,closed=['closed','results'].includes(state.phase);
  return `${previewNav(c,2,r)}<article class="oj-page oj-product" data-persona="${p.id}"><div class="oj-body">
    <div class="oj-section-label"><span>有料・単品</span><b>${p.name}の詳細分析</b></div>
    <div class="oj-price-strip"><span>${title(r)}<small>詳細分析・単品</small></span><b>980<small>円／税込</small></b></div>
    ${raceBanner(r)}
    <header class="oj-product-title"><p>${date(r)} · ${title(r)} · ${courseLabel(r)}</p><h1>${copy?.productTitle||'選ぶ理由も、<br><span>外す理由</span>も。'}</h1><p>${m.paidDetail}</p></header>
    ${byline(c,r)}
    <div class="oj-price"><div><span>この１レースの情報料</span><strong>980<small>円</small></strong><small>税込・情報料</small></div><ul><li>単発購入</li><li>自動更新なし</li><li>馬券代は別</li></ul></div>
    ${owned?btn('購入した予想を読む','read/'+id,'cta-green oj-main-cta'):closed?'<div class="oj-caution"><b>販売は終了しました</b><p>購入済みの情報は引き続き読めます。</p></div>':btn('購入内容を確認する','checkout/'+id,'primary oj-main-cta')}
    <p class="oj-micro">購入の操作デモです。実際の課金はありません。</p>${note}
    ${heading('01',p.short+'の分析、全４項目。')}
    <div class="oj-product-chapters">${(copy?.chapters||[['01','レースの想定展開','先行争いとペースをどう読むか。見立ての前提を整理。'],['02','軸と相手の比較','候補の評価ポイントと懸念を並べ、選択の理由を解説。'],['03','有力候補を外した理由','採用しなかった候補も比較。判断が変わる条件を記載。'],['04','買い目・予算・振り返り','点数と金額を明示。終了後も元の予想を残して記録。']]).map(([n,h,p])=>`<div><span>${n}</span><div><h3>${h}</h3><p>${p}</p></div></div>`).join('')}</div>
    ${analysisExcerpt(r)}
    ${heading('02','無料と有料、ここが違う。')}
    <div class="oj-comparison"><div><b>共通するもの</b><p>担当者・予想への姿勢・買い目・根拠・懸念・結果の公開。</p></div><div><b>有料で追加されるもの</b><p>別の対象レースと、詳しい展開・候補比較・外した理由。</p></div></div><p class="oj-micro">高い料金ほど当たりやすい、という商品ではありません。</p>
    ${heading('03','対象レースと提供内容。')}
    <dl class="oj-terms"><div><dt>対象レース</dt><dd>${title(r)}<small>${date(r)}</small></dd></div><div><dt>コース</dt><dd>${courseLabel(r)}</dd></div><div><dt>予想公開</dt><dd>${publicTime(r)}</dd></div><div><dt>発走</dt><dd>${r.time}${r.market==='local'?'（仮）':''}</dd></div><div><dt>販売締切</dt><dd>対象レースの発走30分前</dd></div><div><dt>馬券代の目安</dt><dd>1,200円<small>馬連２点 × 600円</small></dd></div></dl>
    ${r.market==='local'?'<p class="oj-micro">地方の会場・開催日・時刻は未確定です。</p>':''}<p class="oj-micro">未提供時の返金・減額規定は本番販売前に確定します。</p>
    <div class="oj-bundle-link"><b>同じ日の２レースを読むなら</b><p>単品と同じ予想をまとめて、1,780円（税込）。</p>${btn('当日２本セットの内容を見る','product/day-'+r.day,'secondary')}</div>
    ${owned?btn('購入した予想を読む','read/'+id,'cta-green oj-main-cta'):closed?btn('公開中の予想一覧へ','home','secondary'):`<div class="oj-final-order"><span>追加情報料 <b>${c.money(bill.due)}</b>（税込）</span>${btn('購入内容を確認する','checkout/'+id,'primary oj-main-cta')}<small>次の画面で内容を確認できます。実際の課金はありません。</small></div>`}
    </div></article>`;
}
