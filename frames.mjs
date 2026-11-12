// Frame colours follow NAR: https://www.keiba.go.jp/qa.html
// A horse number is NOT a frame number. Resolve only an explicit race draw.
export const frameColours = Object.freeze([
  null, '白', '黒', '赤', '青', '黄', '緑', '橙', '桃'
]);
const sampleEntries = Object.freeze([
  [1,1,'ソラノシルエット'], [2,2,'アカツキロード'],
  [3,3,'カゼノリズム'], [4,4,'ナギサフレーム'],
  [5,5,'ブルームライン'], [6,5,'ルミナスステップ'],
  [7,6,'ツキノコンパス'], [8,6,'ホシノランナー'],
  [9,7,'ユメノスケッチ'], [10,7,'ハルノプリズム'],
  [11,8,'アオゾラノート'], [12,8,'ヨアケノパレット']
].map(([horse,frame,name]) => Object.freeze({horse,frame,name})));
// Deliberately fictional 12-runner draws, attached ONLY to known preview races.
const sampleIds = ['sat-free','sat-a','sat-b','sun-free','sun-a','sun-b',
  'local1-free','local1-a','local1-b','local2-free','local2-a','local2-b'];
export const sampleDraws = Object.freeze(Object.fromEntries(sampleIds.map(id =>
  [id, Object.freeze({source:'sample', entries:sampleEntries})])));

function entryFor(race, horse) {
  if (!Number.isInteger(horse) || horse < 1 || horse > 18) return null;
  if (!Array.isArray(race?.draw?.entries)) return null;
  const matches = race.draw.entries.filter(entry => entry?.horse === horse);
  return matches.length === 1 ? matches[0] : null;
}
export function frameFor(race, horse) {
  const frame = entryFor(race,horse)?.frame;
  return Number.isInteger(frame) && frame >= 1 && frame <= 8 ? frame : null;
}
export function horseName(race,horse) {
  const name=entryFor(race,horse)?.name;
  return typeof name === 'string' && name.trim() ? name.trim() : '馬名未確認';
}
const escapeHtml=value=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Explicit editorial references keep names tied to THIS race, without changing
// step numbers, chart cells, HTML attributes or already rendered horse badges.
export function horseProse(race, copy) {
  return copy.replace(/\{\{horse:(\d{1,2})\}\}/g,(_,digits)=>{
    const horse=Number(digits);
    if(horse<1 || horse>18) return '馬番未確認';
    const frame=frameFor(race,horse);
    const label=`馬番${horse}、${frame ? `${frame}枠（${frameColours[frame]}）` : '枠未確定'}`;
    return `<span class="horse-ref" data-horse="${horse}"><b class="frame-badge frame-${frame || 'unknown'} prose-number" role="img" aria-label="${label}">${horse}</b>\u00a0${escapeHtml(horseName(race,horse))}</span>`;
  });
}
export function resolveHorseCopy(race,copy) {
  if(typeof copy==='string') return horseProse(race,copy);
  if(Array.isArray(copy)) return copy.map(value=>resolveHorseCopy(race,value));
  if(copy && typeof copy==='object') return Object.fromEntries(Object.entries(copy).map(([key,value])=>[key,resolveHorseCopy(race,value)]));
  return copy;
}

export function horseBadge(race, horse) {
  if (!Number.isInteger(horse) || horse < 1 || horse > 18) return '';
  const frame = frameFor(race, horse);
  const name=escapeHtml(horseName(race,horse));
  return `<span class="horse-id" data-horse="${horse}" role="img" aria-label="馬番${horse}、${frame ? `${frame}枠（${frameColours[frame]}）` : '枠未確定'}、${name}"><span class="frame-badge frame-${frame || 'unknown'}" aria-hidden="true">${horse}</span><span class="frame-caption" aria-hidden="true">${frame ? frame+'枠' : '枠未確定'}</span><span class="horse-name" aria-hidden="true">${name}</span></span>`;
}

export function frameLegend(race) {
  return `<div class="frame-guide"><p><b>数字は馬番・背景は枠色</b><span>${race?.draw?.source === 'sample' ? '馬名・枠順は仮データです' : '未確定の枠は色分けしません'}</span></p><div class="frame-key" aria-label="枠色の一覧">${frameColours.slice(1).map((name,i) => `<span><b class="frame-badge frame-${i+1}">${i+1}</b><small>${name}</small></span>`).join('')}</div></div>`;
}
