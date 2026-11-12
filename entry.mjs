import {articleMeta} from './analysis.mjs';
import {characterFor,characterStrip} from './characters.mjs';
import {raceImage} from './race-art.mjs';

// The selected demo date determines one featured free race, never a paid upsell.
export function firstRead(c){
 const r=c.rBy(c.freeId()),m=articleMeta(r),before=c.state.phase==='before',results=c.state.phase==='results';
 return `<section class="oj-page first-read" aria-labelledby="first-read-title" data-race="${r.id}" data-persona="${characterFor(r).id}"><header><span>初めての方は、この１本から</span><h2 id="first-read-title">${r.market==='central'?'今週':'地方で'}まず読む無料予想</h2><p>買い目・理由・気になる懸念まで、ひとつの記事で。</p></header><div class="first-read-status"><b>情報料 0円</b><span>${before?'公開前':results?'結果も確認できます':'公開中'}</span></div>${raceImage(r,{theme:c.state.theme})}<div class="first-read-body"><p class="first-read-race"><span>${c.date(r)}</span><strong>${c.title(r)}</strong><b>${c.courseLabel(r)}</b></p><p class="first-read-benefit">${m.benefit}</p>${c.btn(before?'このレースの公開予定を見る':'この無料予想を読む','read/'+r.id,'cta-green')}<small>${before?c.publicTime(r)+' 公開予定':'買い目・根拠・予算・振り返り項目まで。'}</small></div>${characterStrip(r)}</section>`;
}
export function lineEntry(c){
 const r=c.rBy(c.freeId()),p=characterFor(r),m=articleMeta(r),before=c.state.phase==='before';
 const href=`?theme=${c.state.theme}&market=${r.market}#/read/${r.id}`;
 return `<div class="line-demo inner-line"><div class="line-caption">LINE経由の入口を再現したデモ</div><div class="chat-title">${c.icon('chat')} ${r.market==='local'?'地方競馬のお知らせ':'週末競馬ノート'}</div>${c.tabs()}<div class="chat-date">${c.date(r)} ${c.publicTime(r)} · 配信見本</div><div class="bubble"><b>${before?'無料予想の公開予定をお知らせします。':'無料予想を公開しました。'}</b><p>${c.title(r)}・${c.courseLabel(r)}。<br>${m.benefit}</p><a class="message-link campaign-message direct-article-link" href="${href}">${raceImage(r,{floating:false,theme:c.state.theme})}<span>${c.date(r)} / 情報料0円</span><strong>${c.title(r)}・${c.courseLabel(r)}</strong><span>${p.name}の分析</span><b>${before?'このレースの公開予定を見る':'この無料予想を読む'} →</b></a><div class="line-reading-points"><b>この１本で確認できること</b><ol><li>買い目と、必要な馬券代</li><li>選んだ根拠と、気になる懸念</li><li>レース後の結果と振り返り</li></ol></div></div><p class="small line-explain">紹介ページを経由せず、案内したレースの記事を開きます。未登録でも無料予想の全文を読めます。記事内でデモ登録すると、同じレースに戻ります。</p><p class="small line-explain">実際のLINE認証・配信は未接続です。</p></div>`;
}
