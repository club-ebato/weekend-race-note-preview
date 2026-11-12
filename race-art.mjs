import {raceCharacters,characterFor} from './characters.mjs';
import {raceCropEnds} from './race-art-crops.mjs';
import {hologramMedia} from './hologram-media.mjs';
// Image metadata is explicit: changing race conditions invalidates old baked text.
export const raceArtwork = {
  "sat-free": {
    "place": "東京",
    "number": "10R",
    "surface": "芝",
    "distance": 1600,
    "character": "ojisan",
    "src": "assets/races/sat-free.jpg"
  },
  "sat-a": {
    "place": "東京",
    "number": "11R",
    "surface": "芝",
    "distance": 1400,
    "character": "ren",
    "src": "assets/races/sat-a-ren.jpg"
  },
  "sat-b": {
    "place": "京都",
    "number": "11R",
    "surface": "芝",
    "distance": 1800,
    "character": "zero",
    "src": "assets/races/sat-b-zero.jpg"
  },
  "sun-free": {
    "place": "東京",
    "number": "10R",
    "surface": "ダート",
    "distance": 1600,
    "character": "ren",
    "src": "assets/races/sun-free-ren.jpg"
  },
  "sun-a": {
    "place": "東京",
    "number": "11R",
    "surface": "芝",
    "distance": 2500,
    "character": "ojisan",
    "src": "assets/races/sun-a.jpg"
  },
  "sun-b": {
    "place": "京都",
    "number": "11R",
    "surface": "ダート",
    "distance": 1800,
    "character": "zero",
    "src": "assets/races/sun-b-zero.jpg"
  },
  "local1-free": {
    "place": "大井",
    "number": "9R",
    "surface": "ダート",
    "distance": 1200,
    "character": "ojisan",
    "src": "assets/races/local1-free.jpg"
  },
  "local1-a": {
    "place": "大井",
    "number": "10R",
    "surface": "ダート",
    "distance": 1600,
    "character": "ren",
    "src": "assets/races/local1-a-ren.jpg"
  },
  "local1-b": {
    "place": "大井",
    "number": "11R",
    "surface": "ダート",
    "distance": 1800,
    "character": "zero",
    "src": "assets/races/local1-b-zero.jpg"
  },
  "local2-free": {
    "place": "川崎",
    "number": "9R",
    "surface": "ダート",
    "distance": 1400,
    "character": "zero",
    "src": "assets/races/local2-free-zero.jpg"
  },
  "local2-a": {
    "place": "川崎",
    "number": "10R",
    "surface": "ダート",
    "distance": 1500,
    "character": "ojisan",
    "src": "assets/races/local2-a.jpg"
  },
  "local2-b": {
    "place": "川崎",
    "number": "11R",
    "surface": "ダート",
    "distance": 2100,
    "character": "ren",
    "src": "assets/races/local2-b-ren.jpg"
  }
};

export function artworkFor(r) {
  const a = raceArtwork[r.id];
  return a && a.place === r.place && a.number === r.number &&
    a.surface === r.surface && a.distance === r.distance && a.character === raceCharacters[r.id] ? a : null;
}

export function courseLabel(r) {
  return r.surface && r.distance ? `${r.surface} ${r.distance.toLocaleString('ja-JP')}m` : '距離・馬場種別は未設定';
}

export const raceArtThemes = ['11','04','06','07','08','10','12','13'];
export function themedArtworkFor(r, theme='11') {
  const a=artworkFor(r);
  if(!a)return null;
  const selected=raceArtThemes.includes(theme)?theme:'11';
  return {...a,theme:selected,src:selected==='07'?a.src:`assets/races/themes/${selected}/${r.id}.jpg`};
}

export function typeArtworkFor(r) {
  const a=artworkFor(r);
  return a ? {...a,src:`assets/races/types-v2/${r.id}.png`} : null;
}

export function raceImage(r, { design='type', className = 'baked-race-art', fallback = '', floating = true, theme='11' } = {}) {
  const typeArt=design==='type'?typeArtworkFor(r):null;
  const a = typeArt || themedArtworkFor(r,theme);
  if (!a) return fallback;
  const alt = `${r.place} ${r.number}・${courseLabel(r)}・${characterFor(r).name}・イメージアート`;
  if(typeArt){
    const image=`<img src="${a.src}" alt="${alt}" width="1536" height="1024" loading="lazy">`;
    return floating && className!=='included-race-art' ? hologramMedia(image,`${className} race-specific-art type-race-art`,characterFor(r).id) : `<span class="${className} race-specific-art type-race-art" data-persona="${characterFor(r).id}">${image}</span>`;
  }
  const image = `<span class="race-image-window" style="--race-crop:${raceCropEnds[a.src]||860}"><img src="${a.src}" alt="${alt}" width="1536" height="1024" loading="lazy"></span><span class="race-type-band" data-persona="${characterFor(r).id}"><b>${characterFor(r).name}</b><small>表示見本</small></span>`;
  return floating && className !== 'included-race-art' ? hologramMedia(image,`${className} race-specific-art`,characterFor(r).id) : `<span class="${className} race-specific-art">${image}</span>`;
}
