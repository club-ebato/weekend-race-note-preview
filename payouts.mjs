// 払戻の入力テキストを、サーバーへ渡す形にそろえる。的中の判定はサーバー側（app.judge）だけが行う。
// 1行に「券種 馬番の組み合わせ 100円あたりの払戻額」。例：馬連 2-6 1230 ／ 3連単 6→2→8 12,340円
const wide = s => String(s).replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/　/g, ' ');

export function parsePayouts(text) {
  const lines = wide(text || '').split(/\r?\n/).map(l => l.trim());
  const payouts = [];
  for (const [i, line] of lines.entries()) {
    if (!line) continue;
    const at = `${i + 1}行目`;
    const m = /^(\S+)\s+([\d\s\-－ー→>＞,、・]+?)\s+([\d,]+)\s*円?$/.exec(line);
    if (!m) return {error: `${at}を読み取れません。「馬連 2-6 1230」のように、券種・馬番・払戻額を空白で区切ってください。`};
    const combo = m[2].split(/[^\d]+/).filter(Boolean).map(Number);
    const yen = Number(m[3].replace(/,/g, ''));
    if (!combo.length || combo.length > 3 || combo.some(n => n < 1 || n > 18)) return {error: `${at}の馬番を確認してください（1〜18、3頭まで）。`};
    if (!(yen >= 100)) return {error: `${at}の払戻額は、100円あたりの金額を100円以上で入力してください。`};
    // 券種の表記は入力のまま渡す（サーバー側で表記ゆれをそろえる）。
    payouts.push({ticket: text.split(/\r?\n/)[i].trim().split(/[\s　]+/)[0], combo, yen});
  }
  return payouts.length ? {payouts} : {error: '払戻を1行以上入力してください。'};
}
