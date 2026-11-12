import {races,included,price,quote,remaining} from './core.mjs';
import {raceImage,courseLabel} from './race-art.mjs';
import {articleMeta} from './analysis.mjs';
import {characterFor} from './characters.mjs';

export function freeContext(id,market='central',day='sat') {
 return races.find(r=>r.id===id&&r.free)||races.find(r=>r.free&&r.market===market&&r.day===day)||races.find(r=>r.free&&r.market===market)||races[0];
}
export function planChoices(r) {
 const singles=races.filter(x=>!x.free&&x.market===r.market&&x.day===r.day);
 return [...singles.map(x=>x.id),'day-'+r.day,...(r.market==='central'?['bundle']:[])];
}
export function selectedPlan(r,id) {return planChoices(r).includes(id)?id:planChoices(r)[0];}
const href=(c,path)=>`?theme=${c.state.theme}&market=${c.state.market}#/${path}`;
const link=(c,text,path,cls='primary')=>`<a class="journey-link ${cls}" href="${href(c,path)}">${text}${c.icon('arrow')}</a>`;
const jump=(label,id)=>`<button type="button" data-jump="${id}">${label}<span aria-hidden="true">↓</span></button>`;

export function journeyNav(c,r,compare=false) {
 return `<nav class="journey-nav" aria-label="記事からプラン比較への流れ">${link(c,'<small>01</small>無料記事','read/'+r.id,compare?'':'is-current')}${compare?link(c,'<small>02</small>根拠・予算','read/'+r.id,''):jump('<small>02</small>根拠・予算','article-budget')}${link(c,'<small>03</small>プラン比較','compare/'+r.id,compare?'is-current':'')}</nav>`;
}
export function readingGuide(){return `<section class="reading-guide" aria-label="無料記事の読み方"><b>判断に必要な３つを、この１本で。</b><div>${jump('買い目・予算','article-budget')}${jump('選んだ理由','article-reasons')}${jump('気になる懸念','article-risk')}</div></section>`;}

export function articleBridge(c,r) {
 const m=articleMeta(r),ended=['closed','results'].includes(c.state.phase);
 return `<section class="journey-bridge" aria-labelledby="bridge-title"><span class="journey-kicker">ここまで、情報料０円</span><h2 id="bridge-title">買い目だけでなく、<br>判断の理由まで。</h2><dl class="journey-receipt"><div><dt>買い目と予算</dt><dd>馬連２点・馬券代の目安1,200円</dd></div><div><dt>選んだ根拠</dt><dd>${m.benefit}</dd></div><div><dt>見立ての限界</dt><dd>${m.risk}</dd></div></dl><p class="journey-fine">情報料と馬券代は別です。</p><div class="journey-next"><span>ほかのレースも詳しく読むなら</span><h3>有料では、何が増える？</h3><p>別の対象レースで、展開の分岐・候補の比較・外した理由まで。１本ずつ、同日２本、中央の週末４本から選べます。</p>${ended?jump('このレースの振り返りを確認','article-recap'):''}${link(c,ended?'有料プランの内容を確認':'別レースの有料プランを比較','compare/'+r.id,ended?'secondary':'primary')}<small>単品980円〜／税込・試作価格。次の画面で対象と違いを確認できます。</small></div>${!ended?jump('このレースの結果・振り返りへ','article-recap'):''}</section>`;
}

export function planComparison(c,r,requested) {
 const id=selectedPlan(r,requested),ids=included(id),single=ids.length===1,week=id==='bundle',bill=quote(c.state,id),owned=remaining(c.state,id).length===0,ended=['closed','results'].includes(c.state.phase);
 const singles=planChoices(r).filter(x=>!x.startsWith('day-')&&x!=='bundle');
 const choices=[[singles.includes(id)?id:singles[0],'１レース','980円'],['day-'+r.day,'当日２本','1,780円'],...(r.market==='central'?[['bundle','週末４本','2,980円']]:[])];
 const planTitle=single?'気になる１レース':week?'中央・週末４本セット':'同じ日の２本セット';
 const days=r.market==='central'?['sat','sun']:['local1','local2'];
 return `${journeyNav(c,r,true)}<article class="oj-page journey-compare"><header class="journey-heading"><span>無料の次に、何を読む？</span><h1>対象と内容で、<br>プランを選ぶ。</h1><p>情報料は税込・初期検証価格です。<br>購入せず、内容を比較できます。</p></header><div class="oj-body">
 <div class="journey-origin"><span>比較の基準にする無料予想</span><b>${c.date(r)} · ${c.title(r)}</b><small>${courseLabel(r)}／${characterFor(r).name}</small>${link(c,'この無料記事を読む','read/'+r.id,'secondary')}</div>
 <section class="journey-difference"><h2>無料と有料、ここが違う。</h2><div class="difference-common"><b>どちらにも含まれます</b><p>買い目・点数・馬券代の目安・根拠・懸念・結果と振り返り。</p></div><div class="difference-pair"><div><span>無料 · ０円</span><h3>１レースで完結</h3><p>選定理由の要点と、見立ての前提を確認。</p></div><div><span>有料 · 980円〜</span><h3>別レースを深く比較</h3><p>展開の分岐・候補の比較・有力候補を外した理由まで。</p></div></div><p class="journey-fine">有料の価値は、対象と分析範囲の違いです。的中率や利益を保証するものではありません。</p></section>
 <section class="journey-plans" aria-labelledby="plan-choice-title"><span class="journey-kicker">必要な範囲から選べます</span><h2 id="plan-choice-title">何レース分、読む？</h2><nav class="journey-days" aria-label="比較する提供日">${days.map(day=>{const f=freeContext(day+'-free');return `<a href="${href(c,'compare/'+f.id)}" ${day===r.day?'aria-current="page"':''}>${c.date(f)}</a>`;}).join('')}</nav><div class="journey-plan-options" role="group" aria-label="プランの範囲">${choices.map(([pid,label,p])=>`<a href="${href(c,'compare/'+r.id+'/'+pid)}" ${pid===id?'aria-current="true"':''}><span>${label}</span><b>${p}</b><small>${pid===id?'選択中':'内容を比較'}</small></a>`).join('')}</div>
 <div class="journey-selection" aria-live="polite"><header><span>${week?'土日／中央の有料４本':c.date(r)}</span><h3>${planTitle}</h3><p>${week?'単品と同じ有料４本に、週末の見どころ・週次総括を追加。':single?'同じ日の有料対象から、気になる１本を選べます。':'単品と同じ有料２本をまとめて読めます。追加の別予想はありません。'}</p></header>
 ${single?`<div class="journey-race-choice" role="group" aria-label="単品の対象レース">${singles.map(pid=>{const race=c.rBy(pid);return `<a href="${href(c,'compare/'+r.id+'/'+pid)}" ${pid===id?'aria-current="true"':''}>${c.title(race)}<small>${characterFor(race).short}の分析</small></a>`;}).join('')}</div>`:''}
 <div class="journey-included">${ids.map(pid=>{const race=c.rBy(pid);return `<div class="journey-included-race">${raceImage(race,{className:'included-race-art',floating:false,theme:c.state.theme})}<div><small>${c.date(race)} · ${c.state.owned.includes(pid)?'購入済み':'対象'}</small><b>${c.title(race)}</b><span>${courseLabel(race)}</span><p>${articleMeta(race).benefit}</p></div></div>`;}).join('')}</div>
 <dl class="journey-terms"><div><dt>読める有料予想</dt><dd>${ids.length}レース分${week?' ＋ 週末の見どころ・週次総括':''}</dd></div><div><dt>情報料（税込）</dt><dd>${c.money(price(id))}</dd></div>${bill.credit?`<div><dt>対象の購入済み分</dt><dd>−${c.money(bill.credit)}</dd></div>`:''}<div class="journey-total"><dt>${owned?'追加のお支払い':'今回の追加情報料'}</dt><dd>${c.money(bill.due)}</dd></div><div><dt>馬券代の目安</dt><dd>各レース1,200円・別途<small>馬連２点 × 600円</small></dd></div></dl>
 <p class="journey-fine">${week?'中央の有料４本が対象。無料予想・地方競馬は含みません。':'無料予想はセットの対象に含みません。'}同じ予想の重複購入はありません。自動更新なし。</p>
 ${owned?link(c,single?'購入した予想を読む':'購入済みの予想を開く',single?'read/'+id:'mypage','cta-green'):link(c,ended?'販売終了・内容を見る':'対象・分析内容を確認する','product/'+id+'/'+r.id,'primary')}
 <p class="journey-fine">${owned?'このプランの対象はすべて購入済みです。':ended?'この表示状態では購入できません。':'次は商品詳細です。ここでは購入は確定しません。'}登録・購入はデモで、実際の課金はありません。</p></div></section>
 ${r.market==='local'?'<p class="journey-fine">地方の提供日・会場・時刻は仮設定です。週末４本セットは中央のみです。</p>':''}${link(c,'元の無料予想に戻る','read/'+r.id,'secondary')}
 </div></article>`;
}

export function productJourneyBack(c,id,originId) {
 const r=races.find(x=>x.id===originId&&x.free);
 if(!r||!planChoices(r).includes(id))return '';
 return `<div class="journey-product-back">${link(c,'プラン比較に戻る','compare/'+r.id+'/'+id,'secondary')}<small>${c.date(r)} ${c.title(r)}の無料記事から比較中</small></div>`;
}
