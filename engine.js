/* ===== 코디 엔진 (DOM 없음) ===== */
const CATS = { top: '상의', bottom: '하의', outer: '겉옷', shoes: '신발' };
const CAT_ICON = { top: '👕', bottom: '👖', outer: '🧥', shoes: '👟' };
const FORM = ['스포티', '캐주얼', '스마트캐주얼', '포멀'];
const OCC = { '출근': 2.3, '데이트': 1.8, '캐주얼': 1, '운동': 0, '격식': 3 };
const WARM_MAX = { top: 5, bottom: 3, outer: 5, shoes: 3 };
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const MONTH_DEF = { 1: [-6, 3], 2: [-4, 6], 3: [1, 12], 4: [7, 19], 5: [13, 24], 6: [18, 28], 7: [22, 30], 8: [23, 31], 9: [17, 26], 10: [9, 19], 11: [2, 12], 12: [-5, 3] };
const SEASON_PRESET = { '봄': [7, 19], '여름': [23, 31], '가을': [10, 20], '겨울': [-5, 3] };

function seasonOf(m) { return m >= 3 && m <= 5 ? '봄' : m >= 6 && m <= 8 ? '여름' : m >= 9 && m <= 11 ? '가을' : '겨울'; }

function hexToHsl(hex) {
  hex = (hex || '#888888').replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const r = parseInt(hex.slice(0, 2), 16) / 255, g = parseInt(hex.slice(2, 4), 16) / 255, b = parseInt(hex.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d > 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s, l };
}
function hsl(it) { return it._h || (it._h = hexToHsl(it.color)); }
function isNeutral(c) { return c.s < 0.45 || c.l < 0.16 || c.l > 0.88; }

function harmony(a, b) {
  const x = hsl(a), y = hsl(b), nx = isNeutral(x), ny = isNeutral(y);
  if (nx && ny) return { s: 5, label: '차분한 무채색·어스톤 조합' };
  if (nx || ny) {
    const c = nx ? y : x;
    return (c.s > 0.85 && c.l > 0.4 && c.l < 0.7) ? { s: 1, label: '무채색 + 강한 포인트 컬러' } : { s: 6, label: '무채색 + 컬러 포인트' };
  }
  let d = Math.abs(x.h - y.h); if (d > 180) d = 360 - d;
  const dl = Math.abs(x.l - y.l);
  if (d < 25) return dl > 0.15 ? { s: 5, label: '톤온톤' } : { s: 2, label: '원톤 코디' };
  if (d < 60) return { s: 2, label: '유사색 조합' };
  if (d >= 150) return (x.s > 0.7 || y.s > 0.7) ? { s: -3, label: '강한 보색 대비' } : { s: 2, label: '보색 대비' };
  return { s: -7, label: '색이 부딪힐 수 있어요' };
}

function effTemp(w) {
  const base = w.min * 0.35 + w.max * 0.65;
  const wind = { '약': 0, '보통': 1, '강': 3 }[w.wind] || 0;
  const pr = w.sky === '눈' ? 2 : w.sky === '비' ? 1 : 0;
  return base - wind - pr;
}
function targetWarmth(eff) { return Math.max(2, Math.min(12.5, 2 + (28 - eff) * 0.33)); }
function mkCtx(w, occ) { const eff = effTemp(w); return { w, eff, target: targetWarmth(eff), occ, T: OCC[occ] != null ? OCC[occ] : 1 }; }

function scoreOutfit(o, ctx, v) {
  const { eff, target, w, T } = ctx, { top, bottom, outer, shoes } = o;
  let s = 75; const notes = v ? [] : null, warns = v ? [] : null;
  if (!top) { s -= 25; v && warns.push('상의가 옷장에 없어요'); }
  if (!bottom) { s -= 25; v && warns.push('하의가 옷장에 없어요'); }
  if (!shoes) { s -= 12; v && warns.push('신발을 등록하면 더 정확해져요'); }
  const sum = (top ? top.warmth : 0) + (bottom ? bottom.warmth : 0) + (outer ? outer.warmth : 0);
  const diff = sum - target;
  s -= diff < 0 ? -diff * 12 : diff * 8;
  if (v) {
    if (Math.abs(diff) <= 1) notes.push(`체감 ${eff.toFixed(0)}°C에 보온이 딱 맞아요 (보온 ${sum} / 목표 ${target.toFixed(1)})`);
    else if (diff < 0) warns.push(`조금 쌀쌀할 수 있어요 (보온 ${sum} / 목표 ${target.toFixed(1)}) — 목도리·이너를 더하세요`);
    else (diff > 2.5 ? warns : notes).push(`조금 더울 수 있어요 (보온 ${sum} / 목표 ${target.toFixed(1)}) — 겉옷은 벗기 쉽게 챙기세요`);
  }
  const range = w.max - w.min;
  if (outer) {
    if (range >= 8 && outer.warmth <= 3) { s += 4; v && notes.push(`일교차 ${range}°C — 겉옷을 벗고 입기 좋은 레이어드예요`); }
  } else {
    if (range >= 8 && w.min < 18) { s -= 6; v && warns.push(`일교차가 ${range}°C라 아침·저녁엔 겉옷이 있으면 좋아요`); }
    if (eff < 14) s -= 6;
    if (w.wind === '강') { s -= 4; v && warns.push('바람이 강해요 — 겉옷 추천'); }
  }
  if (bottom && bottom.length === 'short' && eff < 18) { s -= 15; v && warns.push('이 기온엔 반바지가 추워요'); }
  if (shoes) {
    const sw = shoes.warmth;
    if (eff < 5 && sw < 3) { s -= (3 - sw) * 5; if (sw === 1) s -= 8; v && warns.push('한겨울엔 발이 시릴 수 있는 신발이에요'); }
    else if (eff < 12 && sw < 2) { s -= 10; v && warns.push('쌀쌀한 날씨에 발이 시릴 수 있어요'); }
    if (eff >= 27 && sw >= 3) { s -= 8; v && warns.push('더운 날엔 부츠가 답답할 수 있어요'); }
    if (w.sky === '비' || w.sky === '눈') {
      if (shoes.waterproof) { s += 4; v && notes.push(`${w.sky} 오는 날 방수 신발이라 안심이에요`); }
      else { s -= w.sky === '눈' ? 16 : 10; v && warns.push(`${w.sky} 오는 날엔 젖을 수 있는 신발이에요`); }
    }
  }
  if (outer && outer.waterproof && (w.sky === '비' || w.sky === '눈')) { s += 3; v && notes.push('방수 겉옷으로 비·눈을 막아줘요'); }
  // 격식
  const fs = [top, bottom, shoes, outer].filter(Boolean);
  if (fs.length) {
    let mn = 9, mx = -9, tot = 0;
    for (const f of fs) { tot += f.formality; if (f.formality < mn) mn = f.formality; if (f.formality > mx) mx = f.formality; }
    const avg = tot / fs.length;
    let pen = Math.abs(avg - T) * 8;
    const spread = mx - mn;
    if (spread > 1.6) { pen += (spread - 1.6) * 8; v && warns.push('격식 수준이 서로 달라 어색할 수 있어요 (예: 포멀 + 스포티)'); }
    s -= pen;
    if (v && Math.abs(avg - T) <= 0.6) notes.push(`'${ctx.occ}' 분위기에 잘 맞아요`);
  }
  // 색
  let cs = 0; const cl = [];
  const pair = (a, b, wt, tag) => { if (a && b) { const h = harmony(a, b); cs += h.s * wt; if (v) cl.push({ tag, ...h }); } };
  pair(top, bottom, 1.4, '상의×하의'); pair(top, outer, 1, '상의×겉옷'); pair(bottom, outer, 0.8, '하의×겉옷'); pair(bottom, shoes, 1, '하의×신발');
  s += cs;
  if (top && bottom && top.color === bottom.color && !isNeutral(hsl(top))) s -= 3;
  if (v) { const p = cl[0]; if (p) (p.s >= 2 ? notes : warns).push(`색: ${p.label}`); const q = cl.find(c => c.tag === '하의×신발'); if (q && q.s >= 5) notes.push('신발 색이 하의와 잘 이어져요'); }
  // 패턴
  const pc = (top && top.pattern === 'pattern' ? 1 : 0) + (bottom && bottom.pattern === 'pattern' ? 1 : 0) + (outer && outer.pattern === 'pattern' ? 1 : 0);
  if (pc >= 2) { s -= 10; v && warns.push('패턴 아이템이 두 개 이상이라 복잡해 보여요'); }
  s = Math.max(0, Math.min(100, s));
  return v ? { score: s, sum, notes, warns } : s;
}

const CAPS = { top: 9, bottom: 7, outer: 7, shoes: 6 };
function lists(closet, force, ctx) {
  const g = c => { const a = closet.filter(i => i.cat === c); return a.length ? a : [null]; };
  const L = { top: g('top'), bottom: g('bottom'), outer: [null].concat(closet.filter(i => i.cat === 'outer')), shoes: g('shoes') };
  if (ctx) {
    const n = L.top.length * L.bottom.length * L.outer.length * L.shoes.length;
    if (n > 4000) {
      const ideal = { top: ctx.target * 0.4, bottom: ctx.target * 0.25, outer: ctx.target * 0.3, shoes: ctx.eff < 5 ? 3 : ctx.eff < 14 ? 2 : ctx.eff >= 27 ? 1 : 2 };
      for (const c of Object.keys(L)) {
        if (L[c].length > CAPS[c]) {
          const key = i => i ? Math.abs(i.formality - ctx.T) + 0.5 * Math.abs(i.warmth - ideal[c]) : 0.9;
          L[c] = L[c].slice().sort((a, b) => key(a) - key(b)).slice(0, CAPS[c]);
          if (c === 'outer' && !L[c].includes(null)) L[c].push(null);
        }
      }
    }
  }
  if (force) L[force.cat] = [force];
  return L;
}
function maxScore(closet, ctx, force) {
  const L = lists(closet, force, ctx); let best = 0;
  for (const top of L.top) for (const bottom of L.bottom) for (const shoes of L.shoes) for (const outer of L.outer) {
    const s = scoreOutfit({ top, bottom, outer, shoes }, ctx); if (s > best) best = s;
  }
  return best;
}
function bestOutfits(closet, ctx, n, force) {
  const L = lists(closet, force, ctx), all = [];
  for (const top of L.top) for (const bottom of L.bottom) for (const shoes of L.shoes) for (const outer of L.outer) {
    const o = { top, bottom, outer, shoes }; all.push({ o, s: scoreOutfit(o, ctx) });
  }
  all.sort((a, b) => b.s - a.s);
  const id = x => x ? x.id : '-';
  const diffN = (a, b) => ['top', 'bottom', 'outer', 'shoes'].filter(k => id(a[k]) !== id(b[k])).length;
  const pick = [];
  for (const c of all) { if (pick.length >= n) break; if (pick.every(p => diffN(p.o, c.o) >= 2)) pick.push(c); }
  for (const c of all) { if (pick.length >= n) break; if (!pick.includes(c) && pick.every(p => diffN(p.o, c.o) >= 1)) pick.push(c); }
  return pick.map(p => ({ o: p.o, ...scoreOutfit(p.o, ctx, true) }));
}

/* ===== 부족한 부분 분석 ===== */
const SCENARIOS = [
  { key: 'k1', label: '한파', range: '-6~2°C', w: { min: -6, max: 2, sky: '맑음', wind: '보통' } },
  { key: 'k2', label: '겨울', range: '0~8°C', w: { min: 0, max: 8, sky: '맑음', wind: '보통' } },
  { key: 'k3', label: '쌀쌀한 날', range: '6~14°C', w: { min: 6, max: 14, sky: '맑음', wind: '보통' } },
  { key: 'k4', label: '선선한 날', range: '12~20°C', w: { min: 12, max: 20, sky: '맑음', wind: '보통' } },
  { key: 'k5', label: '포근한 날', range: '18~25°C', w: { min: 18, max: 25, sky: '맑음', wind: '약' } },
  { key: 'k6', label: '더운 날', range: '24~32°C', w: { min: 24, max: 32, sky: '맑음', wind: '약' } },
  { key: 'k7', label: '비 오는 날', range: '10~16°C', w: { min: 10, max: 16, sky: '비', wind: '보통' } },
];
const GAP_OCCS = ['캐주얼', '출근'];

function coverage(closet) {
  return SCENARIOS.map(sc => {
    const occs = sc.key === 'k7' ? ['캐주얼'] : GAP_OCCS;
    const per = occs.map(o => maxScore(closet, mkCtx(sc.w, o)));
    return { sc, per, avg: per.reduce((a, b) => a + b, 0) / per.length };
  });
}

const CATALOG = [
  { cat: 'top', name: '화이트 반팔 티셔츠', color: '#f6f6f4', colorName: '화이트', warmth: 1, formality: 1, sleeve: 'short', why: '어떤 하의에도 받쳐 입는 여름 기본템' },
  { cat: 'top', name: '블랙 반팔 티셔츠', color: '#1b1b1d', colorName: '블랙', warmth: 1, formality: 1, sleeve: 'short', why: '무채색 베이스로 코디 실패가 거의 없어요' },
  { cat: 'top', name: '화이트 옥스퍼드 셔츠', color: '#f4f2ee', colorName: '화이트', warmth: 2, formality: 3, sleeve: 'long', why: '출근·데이트 모두 되는 깔끔한 기본 셔츠' },
  { cat: 'top', name: '하늘색 셔츠', color: '#a9c4e0', colorName: '하늘색', warmth: 2, formality: 2, sleeve: 'long', why: '밝은 인상을 주는 스마트 캐주얼 포인트' },
  { cat: 'top', name: '그레이 맨투맨', color: '#9a9ea5', colorName: '그레이', warmth: 3, formality: 1, sleeve: 'long', why: '간절기 캐주얼의 정석' },
  { cat: 'top', name: '네이비 크루넥 니트', color: '#24334f', colorName: '네이비', warmth: 4, formality: 2, sleeve: 'long', why: '쌀쌀한 날 단독·레이어드 모두 활용' },
  { cat: 'top', name: '아이보리 케이블 니트', color: '#eee6d6', colorName: '아이보리', warmth: 4, formality: 2, sleeve: 'long', why: '겨울에 얼굴을 밝혀주는 따뜻한 톤' },
  { cat: 'top', name: '차콜 터틀넥', color: '#3b3d42', colorName: '차콜', warmth: 3, formality: 2, sleeve: 'long', why: '코트 안에 받쳐 입기 좋은 이너' },
  { cat: 'top', name: '두꺼운 기모 후디', color: '#4a4d52', colorName: '다크그레이', warmth: 5, formality: 1, sleeve: 'long', why: '한파에 캐주얼로 버티는 보온 아이템' },
  { cat: 'bottom', name: '블랙 슬랙스', color: '#1e1e20', colorName: '블랙', warmth: 2, formality: 3, length: 'long', why: '출근·격식 자리까지 커버하는 필수 하의' },
  { cat: 'bottom', name: '베이지 치노 팬츠', color: '#c9b79c', colorName: '베이지', warmth: 2, formality: 2, length: 'long', why: '네이비·화이트·그레이와 두루 어울려요' },
  { cat: 'bottom', name: '연청 데님', color: '#8fa8c4', colorName: '연청', warmth: 2, formality: 1, length: 'long', why: '캐주얼 코디의 기본' },
  { cat: 'bottom', name: '진청 데님', color: '#2d3d5a', colorName: '진청', warmth: 2, formality: 1, length: 'long', why: '깔끔한 인상의 데님, 스니커즈·로퍼 모두 OK' },
  { cat: 'bottom', name: '차콜 울 슬랙스', color: '#44464b', colorName: '차콜', warmth: 3, formality: 3, length: 'long', why: '겨울 출근 코디에 보온과 격식을 동시에' },
  { cat: 'bottom', name: '베이지 반바지', color: '#d3c3a4', colorName: '베이지', warmth: 1, formality: 1, length: 'short', why: '더운 날 시원한 캐주얼' },
  { cat: 'bottom', name: '블랙 조거 팬츠', color: '#202225', colorName: '블랙', warmth: 2, formality: 0, length: 'long', why: '운동·편한 외출용' },
  { cat: 'outer', name: '카멜 롱코트', color: '#b58a5a', colorName: '카멜', warmth: 3, formality: 2, length: 'long', why: '한 벌로 분위기가 확 바뀌는 시즌 아이템' },
  { cat: 'outer', name: '네이비 블레이저', color: '#22304a', colorName: '네이비', warmth: 2, formality: 3, length: 'short', why: '간절기 출근·데이트 모두 활용' },
  { cat: 'outer', name: '베이지 트렌치코트', color: '#c8b08a', colorName: '베이지', warmth: 2, formality: 2, length: 'long', waterproof: true, why: '비·바람을 막아주는 간절기 아우터' },
  { cat: 'outer', name: '블랙 숏패딩', color: '#1c1c1e', colorName: '블랙', warmth: 5, formality: 1, length: 'short', waterproof: true, why: '한파·눈 오는 날의 실전 방한템' },
  { cat: 'outer', name: '올리브 필드 재킷', color: '#59603f', colorName: '올리브', warmth: 2, formality: 1, length: 'short', why: '가벼운 간절기 겉옷, 포인트 컬러' },
  { cat: 'outer', name: '그레이 가디건', color: '#b3b5b9', colorName: '그레이', warmth: 2, formality: 2, length: 'short', why: '일교차 큰 날 벗고 입기 좋은 레이어' },
  { cat: 'outer', name: '네이비 윈드브레이커', color: '#27375b', colorName: '네이비', warmth: 1, formality: 0, length: 'short', waterproof: true, why: '가벼운 방풍·방수용' },
  { cat: 'shoes', name: '화이트 가죽 스니커즈', color: '#f1f1ef', colorName: '화이트', warmth: 2, formality: 1, why: '대부분의 하의와 어울리는 만능 신발' },
  { cat: 'shoes', name: '블랙 첼시 부츠 (방수)', color: '#17171a', colorName: '블랙', warmth: 3, formality: 2, waterproof: true, why: '가을·겨울·비 오는 날까지 커버' },
  { cat: 'shoes', name: '브라운 로퍼', color: '#6a4a34', colorName: '브라운', warmth: 2, formality: 3, why: '슬랙스·치노와 격식 있게 매치' },
  { cat: 'shoes', name: '블랙 방수 워커', color: '#1f1f1f', colorName: '블랙', warmth: 3, formality: 1, waterproof: true, why: '눈·비 오는 날 실용 신발' },
  { cat: 'shoes', name: '그레이 러닝화', color: '#a4a8ad', colorName: '그레이', warmth: 2, formality: 0, why: '운동·편한 날' },
  { cat: 'shoes', name: '샌들', color: '#8a6d4e', colorName: '브라운', warmth: 1, formality: 1, why: '한여름 시원한 신발' },
].map((c, i) => ({ id: 'cat' + i, pattern: 'solid', waterproof: false, sleeve: null, length: null, ...c, ghost: true }));

function recommendItems(closet, base) {
  const scs = [];
  SCENARIOS.forEach((sc, si) => (sc.key === 'k7' ? ['캐주얼'] : GAP_OCCS).forEach(o => scs.push({ sc, si, o, ctx: mkCtx(sc.w, o) })));
  const baseScores = scs.map(x => maxScore(closet, x.ctx));
  const res = [];
  for (const c of CATALOG) {
    if (closet.some(i => i.cat === c.cat && i.color.toLowerCase() === c.color.toLowerCase() && Math.abs(i.warmth - c.warmth) <= 1)) continue;
    let gain = 0, bestG = 0, bestIdx = -1;
    scs.forEach((x, k) => {
      const m = maxScore(closet, x.ctx, c); const g = Math.max(0, m - baseScores[k]);
      gain += g; if (g > bestG) { bestG = g; bestIdx = k; }
    });
    if (gain > 4) res.push({ item: c, gain, bestScenario: bestIdx >= 0 ? scs[bestIdx] : null, bestGain: bestG });
  }
  res.sort((a, b) => b.gain - a.gain);
  const out = [], perCat = {};
  for (const r of res) { if (out.length >= 6) break; const k = r.item.cat; if ((perCat[k] || 0) >= 2) continue; perCat[k] = (perCat[k] || 0) + 1; out.push(r); }
  return out;
}

function checklist(items) {
  const out = [], by = c => items.filter(i => i.cat === c);
  const mins = { top: 5, bottom: 3, outer: 2, shoes: 3 };
  for (const c of Object.keys(mins)) {
    const n = by(c).length;
    if (n < mins[c]) out.push({ lv: n === 0 ? 'bad' : 'warn', t: `${CATS[c]}${c === 'top' || c === 'bottom' ? '가' : '이'} ${n}개예요. 돌려 입으려면 최소 ${mins[c]}개는 있으면 좋아요.` });
  }
  const shoes = by('shoes'), outer = by('outer');
  if (shoes.length && !shoes.some(s => s.waterproof)) out.push({ lv: 'warn', t: '비·눈 오는 날 신을 방수 신발이 없어요.' });
  if (shoes.length && !shoes.some(s => s.warmth >= 3)) out.push({ lv: 'warn', t: '한겨울에 신을 따뜻한 신발(부츠류)이 없어요.' });
  if (outer.length && !outer.some(o => o.warmth >= 4)) out.push({ lv: 'warn', t: '한파용 두꺼운 겉옷(패딩·두꺼운 코트)이 없어요.' });
  if (outer.length && !outer.some(o => o.warmth <= 2)) out.push({ lv: 'warn', t: '간절기용 얇은 겉옷(재킷·가디건)이 없어요.' });
  if (items.length && !items.some(i => i.formality >= 3)) out.push({ lv: 'info', t: '면접·경조사 같은 격식 자리에 입을 포멀 아이템이 없어요.' });
  const tops = by('top'), bots = by('bottom');
  const isW = i => hsl(i).l > 0.85, isDark = i => hsl(i).l < 0.2;
  if (tops.length && !tops.some(isW)) out.push({ lv: 'info', t: '흰색 계열 상의가 없어요. 가장 활용도 높은 기본색이에요.' });
  if (tops.length && !tops.some(isDark) && !tops.some(i => hsl(i).s < 0.15 && hsl(i).l < 0.5)) out.push({ lv: 'info', t: '검정·차콜 계열 상의가 없어요.' });
  if (bots.length && !bots.some(i => isDark(i) || (hsl(i).h > 200 && hsl(i).h < 240 && hsl(i).l < 0.4))) out.push({ lv: 'info', t: '블랙·네이비·진청 같은 어두운 하의가 없어요.' });
  if (items.length >= 6 && items.every(i => isNeutral(hsl(i)))) out.push({ lv: 'info', t: '모두 무채색·어스톤이라 안전하지만, 포인트 컬러 하나가 있으면 인상이 달라져요.' });
  return out;
}
