import {sampleDraws} from './frames.mjs';
import {sampleRaceConditions} from './race-conditions.mjs';
export const themes=[
{id:'11',name:'RACECAST',jp:'中継スタジオ',line:'週末の一戦を、<br>読む。',tone:'dark'},
{id:'04',name:'RACE WEEKEND',jp:'スポーツメディア',line:'週末の主役を、<br>根拠から見つける。',tone:'dark'},
{id:'06',name:'FOIL PADDOCK',jp:'ホログラムカード',line:'週末を彩る、<br>予想の一枚。',tone:'light'},
{id:'07',name:'NEON CIRCUIT',jp:'ネオン筐体',line:'週末の競馬に、<br>視点を。',tone:'dark'},
{id:'08',name:'MANGA IMPACT',jp:'漫画・集中線',line:'その一戦を、<br>読み解け。',tone:'light'},
{id:'10',name:'CHROME GRAND',jp:'赤金・クローム',line:'週末の主役を、<br>見極める。',tone:'dark'},
{id:'12',name:'PADDOCK COLLECTION',jp:'銀のショーケース',line:'選ぶ前に、<br>根拠が見える。',tone:'light'},
{id:'13',name:'RACE STORY',jp:'分析する編集部',line:'予想の理由まで、<br>面白い。',tone:'light'}];
export const races=[
{id:'sat-free',day:'sat',place:'東京',number:'10R',free:true,time:'14:50',title:'先行力とコース適性を読む',result:'hit'},
{id:'sat-a',day:'sat',place:'東京',number:'11R',free:false,time:'15:30',title:'ペースの変化から候補を比較',result:'miss'},
{id:'sat-b',day:'sat',place:'京都',number:'11R',free:false,time:'15:40',title:'持続力を軸に展開を整理',result:'hit'},
{id:'sun-free',day:'sun',place:'東京',number:'10R',free:true,time:'14:50',title:'コースの相性と位置取り',result:'miss'},
{id:'sun-a',day:'sun',place:'東京',number:'11R',free:false,time:'15:30',title:'有力候補の違いを読み解く',result:'pending'},
{id:'sun-b',day:'sun',place:'京都',number:'11R',free:false,time:'15:40',title:'終盤の持続力を見極める',result:'cancel'}];
for(const r of races)r.market='central';
export const paidIds=races.filter(r=>!r.free).map(r=>r.id);
for(const [day,dayLabel] of [['local1','提供日A（仮）'],['local2','提供日B（仮）']]){
  for(const [suffix,number,time,title,result] of [
    ['free','9R','18:30','小回りコースの位置取りを読む','hit'],
    ['a','10R','19:00','先行争いと馬場の影響を比較','miss'],
    ['b','11R','19:30','距離変更と終盤の持続力を整理','pending']
  ])races.push({id:`${day}-${suffix}`,day,dayLabel,market:'local',place:'地方会場（仮）',number,time,title,result,free:suffix==='free'});
}
for (const r of races) Object.assign(r, sampleRaceConditions[r.id], {draw:sampleDraws[r.id]});
const allPaidIds=races.filter(r=>!r.free).map(r=>r.id);
export const fresh=()=>({member:false,bundleOwned:false,owned:[],paidAmounts:{},orders:[],theme:'11',market:'central',day:'sat',localDay:'local1',phase:'live',notifications:{release:false,recap:false,changes:true,scope:'central'}});
export function normalize(raw){const d=fresh();const owned=[...new Set((Array.isArray(raw?.owned)?raw.owned:[]).filter(x=>allPaidIds.includes(x)))];return {...d,...raw,theme:themes.some(t=>t.id===raw?.theme)?raw.theme:'11',phase:['live','before','closed','results'].includes(raw?.phase)?raw.phase:'live',market:raw?.market==='local'?'local':'central',localDay:raw?.localDay==='local2'?'local2':'local1',day:raw?.day==='sun'?'sun':'sat',member:raw?.member===true,bundleOwned:raw?.bundleOwned===true,owned,paidAmounts:Object.fromEntries(owned.map(id=>[id,Number.isSafeInteger(raw?.paidAmounts?.[id])&&raw.paidAmounts[id]>=0?raw.paidAmounts[id]:0])),orders:Array.isArray(raw?.orders)?raw.orders.filter(o=>included(o?.id).length&&Number.isSafeInteger(o?.amount)&&o.amount>=0):[],notifications:{...d.notifications,...raw?.notifications,scope:['central','local','both'].includes(raw?.notifications?.scope)?raw.notifications.scope:'central'}};}
export const included=id=>id==='bundle'?paidIds:id?.startsWith('day-')?races.filter(r=>r.day===id.slice(4)&&!r.free).map(r=>r.id):allPaidIds.includes(id)?[id]:[];
export const price=id=>id==='bundle'?2980:id?.startsWith('day-')&&included(id).length?1780:allPaidIds.includes(id)?980:0;
export function quote(state,id){const ids=included(id),owned=ids.filter(x=>state.owned.includes(x));const credit=owned.reduce((sum,x)=>sum+(state.paidAmounts?.[x]||0),0);const legacyCredit=owned.filter(x=>!state.paidAmounts?.[x]).length*(id==='bundle'?745:ids.length>1?890:980);return {price:price(id),credit:Math.min(price(id),credit+legacyCredit),due:remaining(state,id).length?Math.max(0,price(id)-credit-legacyCredit):0};}
export const remaining=(state,id)=>included(id).filter(x=>!state.owned.includes(x));
export const canRead=(state,r)=>state.member&&(r.free||state.owned.includes(r.id));
export function purchase(state,id){if(!state.member)return {ok:false,error:'login',state};if(!['live','before'].includes(state.phase))return {ok:false,error:'closed',state};const add=remaining(state,id);if(!add.length)return {ok:false,error:'owned',state};const ids=included(id),bill=quote(state,id),paidAmounts={...state.paidAmounts};ids.forEach((x,i)=>{paidAmounts[x]=Math.floor(bill.price/ids.length)+(i<bill.price%ids.length?1:0);});return {ok:true,state:{...state,paidAmounts,orders:[...(state.orders||[]),{id,amount:bill.due}],bundleOwned:state.bundleOwned||id==='bundle',owned:[...new Set([...state.owned,...add])]}};}
