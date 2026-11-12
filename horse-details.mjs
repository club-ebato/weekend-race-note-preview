import {horseInsight} from './horse-insights.mjs';
import {horseName,frameFor,frameColours} from './frames.mjs';
import {characterFor} from './characters.mjs';
import {canRead} from './core.mjs';

let dialog,opener,locked,currentDetail,restoreFocus=true;
let narrowTable;
function updateTableFocus(){
  for(const button of document.querySelectorAll('.condition-table thead .horse-detail-trigger'))button.tabIndex=narrowTable.matches?-1:0;
}
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function mayOpenHorseDetails(state,race){
  return !!race && state.phase!=='before' && (race.free||canRead(state,race));
}
export function horseDetailChoices(state,race){
  if(!mayOpenHorseDetails(state,race))return [];
  return [6,2,8,5].filter(horse=>horseInsight(race,horse));
}
function restore(){
  if(!locked) return;
  const saved=locked;locked=null;
  currentDetail=null;
  for(const [key,value] of Object.entries(saved.styles))document.body.style[key]=value;
  window.scrollTo({top:saved.y,left:saved.x,behavior:'instant'});
  if(restoreFocus && opener?.isConnected)opener.focus({preventScroll:true});
  opener=null;
}
export function closeHorseDetails(restoreToOpener=true){
  restoreFocus=restoreToOpener;
  if(dialog?.open)dialog.close();
  restore();
}
function ensureDialog(){
  if(dialog)return dialog;
  dialog=document.createElement('dialog');
  dialog.id='horse-detail-dialog';dialog.className='horse-detail-dialog';
  dialog.setAttribute('aria-labelledby','horse-detail-title');
  dialog.setAttribute('aria-describedby','horse-detail-context');
  document.body.append(dialog);
  dialog.addEventListener('close',restore);
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeHorseDetails();});
  dialog.addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    const buttons=[...dialog.querySelectorAll('button:not([disabled])')];
    const first=buttons[0],last=buttons.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  let backdropDown=false;
  const outside=e=>{const b=dialog.getBoundingClientRect();return e.target===dialog&&(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom);};
  dialog.addEventListener('pointerdown',e=>{backdropDown=outside(e);});
  dialog.addEventListener('click',e=>{
    const choice=e.target.closest('[data-switch-horse]');
    if(choice)selectHorse(Number(choice.dataset.switchHorse));
    else if(e.target.closest('[data-close-horse]')||(backdropDown&&outside(e)))closeHorseDetails();
    backdropDown=false;
  });
  return dialog;
}
function switchButton(race,horse){
  const frame=frameFor(race,horse),name=horseName(race,horse);
  return `<button type="button" class="horse-switch-choice ${horse===5?'horse-switch-excluded':''}" data-switch-horse="${horse}" aria-pressed="false" aria-controls="horse-detail-reading" aria-label="${horse}番 ${escape(name)}に切り替える"><b class="frame-badge frame-${frame||'unknown'}" aria-hidden="true">${horse}</b><span class="horse-switch-name">${escape(name)}</span>${horse===5?'<small>見送り・保留</small>':''}<span class="horse-switch-check" aria-hidden="true">✓</span><span class="horse-switch-sr">${frame?`${frame}枠（${frameColours[frame]}）`:'枠未確定'}</span></button>`;
}
function selectHorse(horse,announce=true){
  if(!currentDetail)return;
  const {race,state,choices}=currentDetail;
  if(!mayOpenHorseDetails(state,race)){closeHorseDetails();return;}
  if(!choices.includes(horse)||horse===currentDetail.selected)return;
  const info=horseInsight(race,horse);if(!info)return;
  currentDetail.selected=horse;
  dialog.querySelector('#horse-detail-title').textContent=horseName(race,horse);
  for(const button of dialog.querySelectorAll('[data-switch-horse]'))button.setAttribute('aria-pressed',String(Number(button.dataset.switchHorse)===horse));
  dialog.querySelector('.horse-detail-body').innerHTML=`<div class="horse-detail-role"><span>今回の役割</span><strong>${escape(info.role)}</strong></div><section><h3>${horse===5?'見送り・保留の理由':'選んだ理由'}</h3><p>${escape(info.reason)}</p></section><section class="horse-detail-risk"><h3>懸念点</h3><p>${escape(info.risk)}</p></section><p class="horse-detail-note">この記事の見立てを要約しています。馬名・予想は仮データです。</p>`;
  dialog.querySelector('.horse-detail-body').scrollTop=0;
  dialog.querySelector('[role="status"]').textContent=announce?`${horse}番 ${horseName(race,horse)}の理由と懸念点を表示しました。`:'';
}
function openDetails(button,race,horse,state){
  if(!mayOpenHorseDetails(state,race))return;
  const choices=horseDetailChoices(state,race);if(!choices.includes(horse))return;
  const sheet=ensureDialog(),type=characterFor(race);
  sheet.dataset.persona=type.id;
  sheet.innerHTML=`<header class="horse-detail-header"><div><p>記事内の馬メモ</p><h2 id="horse-detail-title"></h2></div><button type="button" class="horse-detail-close" data-close-horse aria-label="馬の詳細を閉じる" autofocus>×</button></header><div class="horse-switcher"><p id="horse-detail-context">${escape(race.place)} ${escape(race.number)} · ${escape(type.name)}</p><div class="horse-switch-caption"><span>馬番・馬名で切り替え</span><small>✓ 表示中</small></div><div class="horse-switch-list" role="group" aria-label="比較する馬">${choices.map(n=>switchButton(race,n)).join('')}</div></div><div class="horse-detail-body" id="horse-detail-reading"></div><span class="horse-switch-sr" role="status" aria-live="polite" aria-atomic="true"></span><footer><button type="button" data-close-horse>閉じて記事の続きを読む</button></footer>`;
  currentDetail={race,state,choices,selected:null};
  selectHorse(horse,false);
  opener=button;restoreFocus=true;
  locked={x:window.scrollX,y:window.scrollY,styles:Object.fromEntries(['position','top','left','width','overflow'].map(key=>[key,document.body.style[key]]))};
  Object.assign(document.body.style,{position:'fixed',top:`-${locked.y}px`,left:`-${locked.x}px`,width:'100%',overflow:'hidden'});
  sheet.showModal();
}
export function mountHorseDetails(root,race,state){
  if(!mayOpenHorseDetails(state,race))return;
  const article=root.querySelector('.analysis-article,.recap-article');if(!article)return;
  ensureDialog();
  for(const node of article.querySelectorAll('.horse-ref[data-horse],.horse-id[data-horse]')){
    const horse=Number(node.dataset.horse);
    if(!horseInsight(race,horse)||node.closest('button,a'))continue;
    const button=document.createElement('button');
    button.type='button';button.className=node.className+' horse-detail-trigger';button.dataset.horse=String(horse);
    button.innerHTML=node.innerHTML;button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','horse-detail-dialog');
    button.setAttribute('aria-label',`${horse}番 ${horseName(race,horse)}の理由と懸念点を開く`);
    button.addEventListener('click',()=>openDetails(button,race,horse,state));
    node.replaceWith(button);
  }
  const guide=document.createElement('p');guide.className='horse-tap-guide';guide.textContent='馬名をタップすると、選んだ理由と懸念点を確認できます。';
  const anchor=article.querySelector('.analysis-lead,.recap-lead');anchor?.before(guide);
  if(!narrowTable){narrowTable=matchMedia('(max-width:380px)');narrowTable.addEventListener('change',updateTableFocus);}
  updateTableFocus();
}
