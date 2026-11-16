/* ===== UI ===== */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

const NOW = new Date();
const MONTH = NOW.getMonth() + 1;
const dayIdx = NOW.getDay();
const S = {
  items: [], tex: false, tab: 'today', sel: 0, filter: 'all', sample: null, aiChecked: false, dbOK: true,
  occ: (dayIdx === 0 || dayIdx === 6) ? '캐주얼' : '출근',
  w: { min: MONTH_DEF[MONTH][0], max: MONTH_DEF[MONTH][1], sky: '맑음', wind: '보통' },
  edit: null, delArm: false, gapCache: null,
  me: null, view: 'man', wInfo: null, wBusy: false, wErr: '', city: '서울', styles: null, styBusy: false, styErr: '', meArm: false, meBusy: '',
};
let Q = [];

/* --- 저장소 (IndexedDB, 이 브라우저 전용) --- */
const DB = {
  db: null, mem: {},
  async open() {
    try {
      this.db = await new Promise((res, rej) => {
        const r = indexedDB.open('outfit-coord', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
    } catch (e) { this.db = null; }
  },
  get(k) {
    if (!this.db) return Promise.resolve(this.mem[k]);
    return new Promise(res => { try { const q = this.db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); } catch (e) { res(undefined); } });
  },
  set(k, v) {
    this.mem[k] = v; if (!this.db) return Promise.resolve();
    return new Promise(res => { try { const t = this.db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(); t.onerror = () => res(); t.onabort = () => res(); } catch (e) { res(); } });
  },
};
async function save() {
  S.gapCache = null; S.styles = null;
  const items = S.items.map(i => { const c = { ...i }; delete c._h; return c; });
  await DB.set('state', { items, tex: S.tex, occ: S.occ });
}

/* --- 마네킹 SVG (예상샷) --- */
let svgUid = 0;
function outfitSVG(o, tex) {
  const id = 'p' + (++svgUid), defs = [];
  const fill = (it, box, key) => {
    if (!it) return '#ccc';
    if (tex && it.photo) {
      defs.push(`<pattern id="${id}${key}" patternUnits="userSpaceOnUse" x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}"><image href="${it.photo}" x="0" y="0" width="${box[2]}" height="${box[3]}" preserveAspectRatio="xMidYMid slice"/></pattern>`);
      return `url(#${id}${key})`;
    }
    return it.color;
  };
  const skin = '#ecd1b6', ln = 'stroke="rgba(0,0,0,.25)" stroke-width="1" stroke-linejoin="round"';
  const mirror = d => `<path d="${d}"/><g transform="translate(220,0) scale(-1,1)"><path d="${d}"/></g>`;
  const mirrorF = (d, f, extra = '') => `<g fill="${f}" ${ln} ${extra}>${mirror(d)}</g>`;
  const { top, bottom, outer, shoes } = o;
  let s = '';
  // 몸(피부)
  s += mirrorF('M52 104 L36 204 Q36 218 48 218 L60 216 Q66 212 66 202 L78 120 Z', skin);
  s += `<rect x="102" y="64" width="16" height="22" fill="${skin}"/>`;
  s += mirrorF('M80 296 L107 296 L105 426 L84 426 Z', skin);
  // 하의
  const shortB = bottom && bottom.length === 'short';
  if (bottom) {
    const d = shortB ? 'M72 212 L110 212 L110 258 L108 312 L75 312 L70 240 Z' : 'M72 212 L110 212 L110 258 L107 424 L79 424 L70 240 Z';
    s += mirrorF(d, fill(bottom, [66, 210, 88, 215], 'b'));
  }
  // 신발
  if (shoes) {
    const boot = shoes.warmth >= 3;
    const d = boot ? 'M78 396 L106 396 L107 446 Q112 458 96 458 L68 458 Q60 458 64 448 L78 440 Z' : 'M78 424 L106 424 L108 446 Q112 458 96 458 L68 458 Q60 458 64 448 Z';
    s += mirrorF(d, shoes.color);
    s += `<g stroke="rgba(0,0,0,.35)" stroke-width="2"><path d="M63 453 L110 453"/><path d="M157 453 L110 453"/></g>`;
  }
  // 상의
  if (top) {
    const f = fill(top, [30, 76, 160, 150], 't');
    s += `<path d="M72 84 Q110 76 148 84 L147 222 Q110 230 73 222 Z" fill="${f}" ${ln}/>`;
    const longS = top.sleeve !== 'short';
    s += mirrorF(longS ? 'M72 84 C60 88 52 96 48 108 L34 196 Q33 205 44 206 L55 207 Q61 207 63 199 L76 126 Z' : 'M72 84 C60 88 52 96 48 108 L42 142 L67 150 L76 120 Z', f);
    s += `<path d="M95 80 Q110 96 125 80 Z" fill="${skin}" ${ln}/>`;
  }
  // 겉옷
  if (outer) {
    const f = fill(outer, [24, 78, 172, outer.length === 'long' ? 262 : 162], 'o');
    const hem = outer.length === 'long' ? 'L103 338 L56 338 Z' : 'L103 236 L66 236 Z';
    s += mirrorF('M70 82 C56 86 46 96 42 110 L26 202 Q25 212 38 213 L56 214 Q64 213 66 203 L78 130 Z', f);
    s += mirrorF('M68 82 Q88 78 106 84 ' + hem, f);
    s += `<g fill="rgba(0,0,0,.18)">${mirror('M106 84 L96 108 L104 120 Z')}</g>`;
  }
  // 명암
  s += `<path d="M72 84 Q110 76 148 84 L147 222 Q110 230 73 222 Z" fill="url(#g${id})" opacity=".55"/>`;
  // 머리
  s += `<ellipse cx="110" cy="44" rx="21" ry="25" fill="${skin}" ${ln}/><path d="M88 42 Q88 17 110 17 Q132 17 132 42 Q124 29 110 29 Q96 29 88 42 Z" fill="#3a2f2a"/>`;
  return `<svg viewBox="0 0 220 470" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="예상 착장">
<defs><linearGradient id="g${id}" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient>
<radialGradient id="bg${id}" cx=".5" cy=".4" r=".75"><stop offset="0" stop-color="#fffaf1"/><stop offset="1" stop-color="#eadfcd"/></radialGradient>${defs.join('')}</defs>
<rect width="220" height="470" rx="18" fill="url(#bg${id})"/><ellipse cx="110" cy="460" rx="62" ry="6" fill="rgba(0,0,0,.14)"/>${s}</svg>`;
}

/* --- 공통 조각 --- */
function thumb(it, size = 44) {
  const st = `width:${size}px;height:${size}px`;
  if (it.photo) return `<img class="th" style="${st}" src="${it.photo}" alt="">`;
  return `<span class="th sw" style="${st};background:${esc(it.color)}">${CAT_ICON[it.cat]}</span>`;
}
function itemMeta(it) { return `${CATS[it.cat]} · 보온 ${it.warmth} · ${FORM[it.formality]}${it.waterproof ? ' · 방수' : ''}`; }
function blankItem() { return { name: '', cat: 'top', color: '#808080', colorName: '', warmth: 2, formality: 1, waterproof: false, pattern: 'solid', sleeve: 'long', length: null, photo: null }; }

/* --- 그림 선택(마네킹 / 내 사진) --- */
let figUid = 0; const PEND = [];
function fig(o) {
  if (S.view === 'me' && S.me) { const id = 'cv' + (++figUid); PEND.push({ id, o }); return `<canvas id="${id}" class="mec"></canvas>`; }
  return outfitSVG(o, S.tex);
}
function flushFigs() { PEND.splice(0).forEach(p => drawMe(document.getElementById(p.id), p.o)); }

/* --- 탭: 오늘 코디 --- */
function dateLabel() { return `${MONTH}월 ${NOW.getDate()}일 ${DOW[dayIdx]}요일 · ${seasonOf(MONTH)}`; }

function renderToday() {
  const w = S.w, e = effTemp(w), SKY = { '맑음': '☀️', '흐림': '☁️', '비': '🌧️', '눈': '❄️' };
  const chips = (arr, cur, act, icons) => arr.map(v => `<button class="chip ${cur === v ? 'on' : ''}" data-a="${act}" data-v="${v}">${icons ? icons[v] + ' ' : ''}${v}</button>`).join('');
  $('#view').innerHTML = `
  <header class="hd"><div><div class="eyebrow">${dateLabel()}</div><h1>오늘 뭐 입지?</h1></div></header>
  <section class="card" id="wcard">
    <div class="row between"><b>오늘 날씨</b><a class="lnk" href="https://www.weather.go.kr" target="_blank" rel="noopener">기상청에서 확인 ↗</a></div>
    <div class="row gap wrap"><button class="btn pri" data-a="geoWeather" ${S.wBusy ? 'disabled' : ''}>📍 내 위치 날씨</button>
      <select id="cityS" data-i="city" class="sel">${Object.keys(CITIES).map(c => `<option ${S.city === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
      <button class="btn" data-a="cityWeather" ${S.wBusy ? 'disabled' : ''}>도시 날씨</button></div>
    <div class="sm" id="wmsg">${weatherMsg()}</div>
    <div class="sl"><label>최저 <b id="vmin">${w.min}°C</b></label><input type="range" min="-20" max="38" value="${w.min}" data-i="min"></div>
    <div class="sl"><label>최고 <b id="vmax">${w.max}°C</b></label><input type="range" min="-20" max="42" value="${w.max}" data-i="max"></div>
    <div class="chips">${chips(['맑음', '흐림', '비', '눈'], w.sky, 'sky', SKY)}</div>
    <div class="row gap"><span class="lb">바람</span><div class="chips">${chips(['약', '보통', '강'], w.wind, 'wind')}</div></div>
    <div class="row gap"><span class="lb">오늘 일정</span><div class="chips">${chips(Object.keys(OCC), S.occ, 'occ')}</div></div>
    <div class="row gap"><span class="lb">계절 빠른설정</span><div class="chips">${chips(Object.keys(SEASON_PRESET), '', 'preset')}</div></div>
    <div class="feel" id="feel"></div>
  </section>
  <div id="results"></div>`;
  updateFeel(); renderResults();
}
function weatherMsg() {
  if (S.wBusy) return '<span class="mute">날씨를 가져오는 중…</span>';
  if (S.wErr) return `<span class="warnT">${esc(S.wErr)}</span>`;
  if (S.wInfo) { const i = S.wInfo; return `<span class="okT">✓ ${esc(i.label)} · 현재 ${i.now}°C${i.feels != null ? `(체감 ${i.feels}°C)` : ''} · 오늘 ${S.w.min}~${S.w.max}°C · ${esc(i.at)} 기준</span> <a class="lnk" href="https://open-meteo.com/" target="_blank" rel="noopener">Weather data by Open-Meteo.com</a>`; }
  return '<span class="mute">자동 가져오기를 누르지 않으면 서울 평년값(대략치)으로 채워져 있어요. 오늘 예보대로 바꿔주세요.</span>';
}
function updateFeel() {
  const e = effTemp(S.w), t = targetWarmth(e);
  const el = $('#feel'); if (el) el.innerHTML = `체감 약 <b>${e.toFixed(0)}°C</b> · 필요한 보온 <b>${t.toFixed(1)}</b> <span class="mute">(바람·비·눈 반영)</span>`;
}

function renderResults() {
  const box = $('#results'); if (!box) return;
  if (!S.items.length) {
    box.innerHTML = `<section class="card empty"><div class="big">🧺</div><b>옷장이 비어 있어요</b><p class="mute">가진 옷을 사진으로 등록하면 그 안에서 오늘 날씨에 맞는 조합을 골라드려요.</p>
    <div class="row gap center"><button class="btn pri" data-a="tab" data-v="closet">옷장에 옷 등록하기</button><button class="btn" data-a="addSample">예시 옷장으로 체험</button></div></section>`;
    return;
  }
  const ctx = mkCtx(S.w, S.occ), outs = bestOutfits(S.items, ctx, 3); S.lastOuts = outs;
  if (S.sel >= outs.length) S.sel = 0;
  const cur = outs[S.sel];
  const parts = [['top', cur.o.top], ['outer', cur.o.outer], ['bottom', cur.o.bottom], ['shoes', cur.o.shoes]];
  const rows = parts.map(([c, it]) => it
    ? `<li class="pc" data-a="editItem" data-v="${it.id}">${thumb(it)}<div><b>${esc(it.name)}</b><div class="mute sm">${CATS[c]} · ${esc(it.colorName || '')}</div></div></li>`
    : (c === 'outer' ? `<li class="pc none"><span class="th sw" style="width:44px;height:44px;background:#eee">—</span><div><b>겉옷 없이</b><div class="mute sm">이 날씨엔 겉옷 없이도 괜찮아요</div></div></li>`
      : `<li class="pc none"><span class="th sw" style="width:44px;height:44px;background:#eee">?</span><div><b>${CATS[c]} 없음</b><div class="mute sm">옷장에 등록해주세요</div></div></li>`)).join('');
  const label = cur.score >= 85 ? '아주 좋아요' : cur.score >= 70 ? '무난해요' : '아쉬운 점이 있어요';
  box.innerHTML = `
  <section class="card">
    <div class="row between"><b>추천 ${S.sel + 1} <span class="badge">${label} · ${cur.score.toFixed(0)}점</span></b>
      <div class="chips"><button class="chip ${S.view === 'man' ? 'on' : ''}" data-a="view" data-v="man">마네킹</button><button class="chip ${S.view === 'me' ? 'on' : ''}" data-a="view" data-v="me">내 사진</button><button class="chip ${S.tex ? 'on' : ''}" data-a="tex">${S.tex ? '옷 사진 무늬 ON' : '옷 사진 무늬'}</button></div></div>
    ${S.view === 'me' && !S.me ? `<p class="mute sm">'내 모습' 탭에서 전신 사진을 등록하면 내 사진 위에 코디가 그려져요. <button class="lnk2" data-a="tab" data-v="me">사진 등록하기</button></p>` : ''}
    <div class="fit">
      <div class="man">${fig(cur.o)}<div class="mute xs">${S.view === 'me' && S.me ? '내 사진 위에 옷 모양·색을 겹쳐 그린 합성 미리보기예요. 실제 착용 사진이 아니에요.' : '예상샷은 옷의 색·길이·종류를 반영한 간이 그림이에요. 실제 착용 사진이 아니에요.'}</div></div>
      <div class="info"><ul class="pl">${rows}</ul></div>
    </div>
    <div class="row gap wrap"><button class="btn pri" data-a="openGen">✨ AI로 내 모습에 입혀보기</button><button class="btn" data-a="openManual">무료: Gemini 앱으로</button></div>
    ${cur.warns.length ? `<div class="msgs warn">${cur.warns.map(m => `<div>⚠️ ${esc(m)}</div>`).join('')}</div>` : ''}
    <div class="msgs ok">${cur.notes.map(m => `<div>✓ ${esc(m)}</div>`).join('')}</div>
  </section>
  <div class="opts">${outs.map((r, i) => `<button class="opt ${i === S.sel ? 'on' : ''}" data-a="selOutfit" data-v="${i}">${fig(r.o)}<span>추천 ${i + 1} · ${r.score.toFixed(0)}</span></button>`).join('')}</div>
  <p class="mute sm pad">점수는 보온(체감온도), 색 조합, 일정에 맞는 격식, 비·눈 대비, 일교차를 합산한 값이에요. 등록한 옷 정보(보온도 등)가 틀리면 점수도 틀려져요. 옷을 눌러 고쳐주세요.</p>`;
  flushFigs();
}

/* --- 탭: 옷장 --- */
function renderCloset() {
  const fl = ['all', 'top', 'bottom', 'outer', 'shoes'];
  $('#view').innerHTML = `
  <header class="hd"><div><div class="eyebrow">내 옷장 · ${S.items.length}벌</div><h1>옷장</h1></div></header>
  <section class="card">
    <b>옷 추가</b>
    <p class="mute sm">${S.sample ? '사진을 올리면 AI가 종류·색·두께를 자동으로 분석해요. 틀린 부분은 눌러서 고칠 수 있어요. 옷 한 벌씩, 배경이 단순할수록 정확해요.' : 'AI 사진 분석은 오른쪽 위 ⚙️에서 Gemini API 키를 넣으면 쓸 수 있어요. 키 없이도 사진은 등록되고, 종류·색·두께는 직접 입력하면 돼요.'}</p>
    <div class="row gap wrap">
      <button class="btn pri" data-a="pickCam">📷 촬영</button>
      <button class="btn" data-a="pickGal">🖼 사진 선택(여러 장)</button>
      <button class="btn" data-a="addManual">✏️ 직접 입력</button>
      <button class="btn" data-a="addSample">예시 옷장 넣기</button>
    </div>
    <input type="file" id="fcam" accept="image/*" capture="environment" hidden>
    <input type="file" id="fgal" accept="image/*" multiple hidden>
    <div id="queue"></div>
    <p class="mute xs">${S.dbOK ? '옷장 데이터는 이 기기의 이 브라우저에만 저장돼요. 다른 기기에서는 보이지 않아요.' : '⚠️ 이 환경에선 저장이 안 돼요. 페이지를 닫으면 옷장이 사라져요.'}</p>
  </section>
  <div class="chips pad">${fl.map(f => `<button class="chip ${S.filter === f ? 'on' : ''}" data-a="filter" data-v="${f}">${f === 'all' ? '전체' : CATS[f]} ${f === 'all' ? S.items.length : S.items.filter(i => i.cat === f).length}</button>`).join('')}</div>
  <div class="grid" id="grid"></div>`;
  renderQueue(); renderGrid();
}
function renderQueue() {
  const q = $('#queue'); if (!q) return;
  q.innerHTML = Q.slice(-6).map(x => `<div class="qi">${x.thumb ? `<img class="th" style="width:36px;height:36px" src="${x.thumb}">` : '<span class="th sw" style="width:36px;height:36px">…</span>'}<span class="${x.status}">${x.status === 'run' ? '분석 중…' : esc(x.msg || '완료')}</span></div>`).join('');
}
function renderGrid() {
  const g = $('#grid'); if (!g) return;
  const list = S.items.filter(i => S.filter === 'all' || i.cat === S.filter);
  if (!list.length) { g.innerHTML = `<p class="mute pad">아직 이 분류에 옷이 없어요.</p>`; return; }
  g.innerHTML = list.map(it => `<button class="ic" data-a="editItem" data-v="${it.id}">
    ${it.photo ? `<img src="${it.photo}" alt="">` : `<span class="sw big2" style="background:${esc(it.color)}">${CAT_ICON[it.cat]}</span>`}
    <b>${esc(it.name || '이름 없음')}</b><span class="mute xs">${itemMeta(it)}</span>
    ${it.needs ? '<span class="tag bad">정보 입력 필요</span>' : (it.ai ? '<span class="tag">AI 분석</span>' : '')}</button>`).join('');
}

/* --- 편집 모달 --- */
function openEdit(id) {
  const it = id ? S.items.find(i => i.id === id) : null;
  S.edit = it ? { ...it } : { ...blankItem(), id: null, isNew: true };
  S.delArm = false; renderModal();
}
const WHINT = { top: '1 얇은 반팔 · 3 맨투맨/가벼운 니트 · 5 두꺼운 니트·기모', bottom: '1 반바지/린넨 · 2 청바지·면바지 · 3 기모·울', outer: '1 바람막이 · 3 재킷·코트 · 5 패딩', shoes: '1 샌들·메시 · 2 스니커즈·로퍼 · 3 부츠' };
function renderModal() {
  const m = $('#modal'), e = S.edit;
  if (!e) { m.innerHTML = ''; m.className = ''; return; }
  m.className = 'on';
  const mx = WARM_MAX[e.cat];
  if (e.warmth > mx) e.warmth = mx;
  m.innerHTML = `<div class="sheet" role="dialog" aria-label="옷 정보">
    <div class="row between"><b>${e.isNew ? '옷 직접 추가' : '옷 정보 수정'}</b><button class="x" data-a="closeModal" aria-label="닫기">✕</button></div>
    ${e.photo ? `<img class="ph" src="${e.photo}" alt="">` : ''}
    <label>이름<input id="e_name" value="${esc(e.name)}" placeholder="예: 네이비 크루넥 니트"></label>
    <label>종류<select id="e_cat" data-i="ecat">${Object.keys(CATS).map(c => `<option value="${c}" ${e.cat === c ? 'selected' : ''}>${CATS[c]}</option>`).join('')}</select></label>
    <div class="row gap"><label class="grow">대표 색<input id="e_color" type="color" value="${esc(e.color)}"></label><label class="grow">색 이름<input id="e_cn" value="${esc(e.colorName)}" placeholder="예: 네이비"></label></div>
    <label>보온도 <b id="e_wv">${e.warmth}</b><input id="e_w" type="range" min="1" max="${mx}" value="${e.warmth}" data-i="ew"><span class="mute xs">${WHINT[e.cat]}</span></label>
    <label>격식<select id="e_f">${FORM.map((f, i) => `<option value="${i}" ${e.formality === i ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
    <div class="row gap">
      <label class="grow">무늬<select id="e_p"><option value="solid" ${e.pattern !== 'pattern' ? 'selected' : ''}>단색</option><option value="pattern" ${e.pattern === 'pattern' ? 'selected' : ''}>패턴·로고 큼</option></select></label>
      ${e.cat === 'top' || e.cat === 'outer' ? `<label class="grow">소매<select id="e_s"><option value="long" ${e.sleeve !== 'short' ? 'selected' : ''}>긴팔</option><option value="short" ${e.sleeve === 'short' ? 'selected' : ''}>반팔</option></select></label>` : ''}
      ${e.cat === 'bottom' ? `<label class="grow">기장<select id="e_l"><option value="long" ${e.length !== 'short' ? 'selected' : ''}>긴바지</option><option value="short" ${e.length === 'short' ? 'selected' : ''}>반바지</option></select></label>` : ''}
      ${e.cat === 'outer' ? `<label class="grow">기장<select id="e_l"><option value="short" ${e.length !== 'long' ? 'selected' : ''}>허리~엉덩이</option><option value="long" ${e.length === 'long' ? 'selected' : ''}>무릎 근처 롱</option></select></label>` : ''}
    </div>
    <label class="chk"><input id="e_wp" type="checkbox" ${e.waterproof ? 'checked' : ''}> 방수·발수 (비·눈 오는 날 OK)</label>
    <div class="row gap"><button class="btn pri grow" data-a="saveItem">저장</button>${e.isNew ? '' : `<button class="btn ${S.delArm ? 'dng' : ''}" data-a="delItem">${S.delArm ? '정말 삭제' : '삭제'}</button>`}</div>
  </div>`;
}
function readEdit() {
  const e = S.edit, g = id => document.getElementById(id);
  e.name = g('e_name').value.trim() || '이름 없음'; e.cat = g('e_cat').value; e.color = g('e_color').value; e.colorName = g('e_cn').value.trim();
  e.warmth = +g('e_w').value; e.formality = +g('e_f').value; e.pattern = g('e_p').value; e.waterproof = g('e_wp').checked;
  e.sleeve = g('e_s') ? g('e_s').value : null; e.length = g('e_l') ? g('e_l').value : null;
}

/* --- 탭: 부족한 부분 --- */
function renderGaps() {
  $('#view').innerHTML = `<header class="hd"><div><div class="eyebrow">옷장 진단</div><h1>부족한 부분</h1></div></header><div id="gapbox"></div>`;
  const box = $('#gapbox');
  if (S.items.length < 3) { box.innerHTML = `<section class="card empty"><div class="big">🔍</div><b>옷을 3벌 이상 등록하면 진단할 수 있어요</b><div class="row gap center"><button class="btn pri" data-a="tab" data-v="closet">옷장으로</button></div></section>`; return; }
  const sig = JSON.stringify(S.items.map(i => [i.id, i.cat, i.color, i.warmth, i.formality, i.waterproof, i.pattern, i.length]));
  if (S.gapCache && S.gapCache.sig === sig) { box.innerHTML = S.gapCache.html; return; }
  box.innerHTML = `<section class="card empty"><div class="big">⏳</div><b>옷장을 분석하는 중…</b></section>`;
  setTimeout(() => {
    const cov = coverage(S.items), cl = checklist(S.items), rec = recommendItems(S.items);
    const bars = cov.map(c => { const v = c.avg, k = v >= 80 ? 'good' : v >= 65 ? 'mid' : 'low'; return `<div class="bar"><span>${c.sc.label}<i>${c.sc.range}</i></span><div class="trk"><div class="fl ${k}" style="width:${Math.max(4, v)}%"></div></div><b>${v.toFixed(0)}</b></div>`; }).join('');
    const weak = cov.filter(c => c.avg < 65).map(c => c.sc.label);
    const clh = cl.length ? cl.map(c => `<li class="${c.lv}">${c.lv === 'bad' ? '🚫' : c.lv === 'warn' ? '⚠️' : '💡'} ${esc(c.t)}</li>`).join('') : '<li class="info">✅ 기본 구성에 큰 구멍은 없어요.</li>';
    const recH = rec.length ? rec.map(r => {
      const sc = r.bestScenario, ctx = sc ? sc.ctx : mkCtx(SCENARIOS[3].w, '캐주얼');
      const o = bestOutfits(S.items, ctx, 1, r.item)[0];
      return `<div class="rc"><div class="rm">${outfitSVG(o.o, false)}</div><div><span class="tag acc">추천 아이템</span><b>${esc(r.item.name)}</b>
      <p class="sm">${esc(r.item.why)}</p>
      <p class="mute sm">${sc ? `특히 <b>${sc.sc.label}(${sc.sc.range}${sc.sc.key === 'k7' ? '' : ' · ' + sc.o})</b>에서 코디 점수가 +${r.bestGain.toFixed(0)}점 올라가요. 왼쪽은 이 아이템을 내 옷장과 맞춰본 예시예요.` : ''}</p></div></div>`;
    }).join('') : '<p class="mute">지금 옷장에 더해서 점수가 확 오르는 아이템이 없어요. 꽤 잘 갖춰진 옷장이에요.</p>';
    const html = `
    <section class="card"><b>날씨별 대비도</b><p class="mute sm">각 날씨에서 내 옷장으로 만들 수 있는 최고 코디 점수예요. 65점 미만이면 취약해요.</p>${bars}
      ${weak.length ? `<p class="sm"><b>취약한 구간:</b> ${weak.join(', ')}</p>` : '<p class="sm">모든 날씨 구간을 무난하게 커버해요.</p>'}</section>
    <section class="card"><b>체크리스트</b><ul class="cl">${clh}</ul></section>
    <section class="card"><b>이런 옷을 더하면 좋아요</b><p class="mute sm">내 옷장에서 점수가 가장 많이 오르는 순서로 골랐어요. 특정 브랜드·상품이 아니라 아이템 종류 추천이에요.</p>${recH}</section>`;
    S.gapCache = { sig, html }; if (S.tab === 'gaps') box.innerHTML = html;
  }, 30);
}

/* --- 사진 분석 --- */
function loadImg(file) { return new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => res({ im, u }); im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('이미지를 열 수 없어요')); }; im.src = u; }); }
async function prepPhoto(file) {
  const { im, u } = await loadImg(file);
  const mk = max => { const sc = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.width * sc)); c.height = Math.max(1, Math.round(im.height * sc)); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c; };
  const big = mk(900), small = mk(420);
  const blob = await new Promise(r => big.toBlob(r, 'image/jpeg', 0.82));
  const dataUrl = small.toDataURL('image/jpeg', 0.8); URL.revokeObjectURL(u);
  return { blob, dataUrl };
}
const PROMPT = `당신은 패션 스타일리스트입니다. 사진 속 옷·신발을 분석해 JSON만 출력하세요(설명·마크다운 금지).
사진에 여러 벌이 있으면 각각 items에 넣으세요(최대 4개). 옷이 없으면 {"items":[]}.
형식: {"items":[{"name":"짧은 한국어 이름(예: 네이비 크루넥 니트)","cat":"top|bottom|outer|shoes","color":"#RRGGBB (배경 제외한 옷 본래 대표색)","colorName":"한국어 색 이름","warmth":정수,"formality":0~3,"waterproof":true|false,"pattern":"solid|pattern","sleeve":"short|long|null","length":"short|long|null"}]}
기준: warmth는 상의 1(얇은 반팔·민소매)~5(두꺼운 니트·기모), 하의 1(반바지·린넨)~3(기모·울), 겉옷 1(바람막이·얇은 가디건)~5(롱패딩), 신발 1(샌들·메시)~3(부츠·방한).
formality: 0 운동·스포티, 1 캐주얼, 2 스마트캐주얼, 3 포멀. waterproof는 방수 소재(고어텍스·패딩 코팅·고무·방수 가죽 부츠 등)가 분명할 때만 true.
sleeve는 상의·겉옷만, length는 하의(short=무릎 위 반바지)와 겉옷(long=무릎 아래까지 오는 코트)만 쓰고 나머지는 null.
불확실하면 가장 가능성 높은 값을 고르고, 보이지 않는 정보는 지어내지 마세요.`;
function parseLoose(t) { try { return JSON.parse(t); } catch (e) { const m = String(t).match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); throw e; } }
function normItem(r) {
  const cat = ['top', 'bottom', 'outer', 'shoes'].includes(r.cat) ? r.cat : 'top';
  const hex = /^#[0-9a-f]{6}$/i.test(r.color || '') ? r.color.toLowerCase() : '#808080';
  return { name: String(r.name || '새 아이템').slice(0, 30), cat, color: hex, colorName: String(r.colorName || '').slice(0, 12), warmth: Math.max(1, Math.min(WARM_MAX[cat], Math.round(+r.warmth) || 2)), formality: Math.max(0, Math.min(3, Math.round(+r.formality))), waterproof: r.waterproof === true, pattern: r.pattern === 'pattern' ? 'pattern' : 'solid', sleeve: cat === 'top' || cat === 'outer' ? (r.sleeve === 'short' ? 'short' : 'long') : null, length: cat === 'bottom' ? (r.length === 'short' ? 'short' : 'long') : cat === 'outer' ? (r.length === 'long' ? 'long' : 'short') : null };
}
async function analyze(blob) {
  const s = S.sample, opts = { images: [blob], cache: false };
  let v;
  if (typeof s.json === 'function') { try { v = await s.json(PROMPT, opts); } catch (e) { if (e && (e.code === 'not_granted' || e.code === 'rate_limited')) throw e; v = undefined; } }
  if (v === undefined) { const r = await s(PROMPT, opts); v = parseLoose(r.text); }
  if (typeof v === 'string') v = parseLoose(v);
  const arr = Array.isArray(v) ? v : (v && v.items) || [];
  return arr.slice(0, 4).map(normItem);
}
let aiBlocked = false;
async function processFiles(files) {
  for (const f of files) {
    const q = { status: 'run', thumb: null, msg: '' }; Q.push(q); renderQueue();
    try {
      const p = await prepPhoto(f); q.thumb = p.dataUrl; renderQueue();
      let found = null;
      if (S.sample && !aiBlocked) {
        try { found = await analyze(p.blob); }
        catch (e) {
          if (e && e.code === 'not_granted') { aiBlocked = true; S.sample = null; q.msg = 'AI 분석 권한이 없어 직접 입력으로 추가했어요'; }
          else if (e && e.code === 'rate_limited') { aiBlocked = true; q.msg = '요청이 많아 AI 분석을 멈췄어요. 잠시 뒤 다시 시도해주세요'; }
          else q.msg = '분석에 실패해 직접 입력으로 추가했어요';
        }
      }
      if (found && found.length) { found.forEach(it => S.items.push({ ...it, id: uid(), photo: p.dataUrl, ai: true })); q.status = 'done'; q.msg = `${found.length}벌 인식: ${found.map(x => x.name).join(', ')}`; }
      else { S.items.push({ ...blankItem(), id: uid(), photo: p.dataUrl, name: '새 아이템', needs: true }); q.status = 'warn'; q.msg = q.msg || '인식된 옷이 없어요 — 눌러서 직접 입력해주세요'; }
      await save();
    } catch (e) { q.status = 'fail'; q.msg = e.message || '실패'; }
    renderQueue(); renderGrid();
  }
}

/* --- 예시 옷장 --- */
function addSampleCloset() {
  const m = (cat, name, color, colorName, warmth, formality, x = {}) => ({ id: uid(), cat, name, color, colorName, warmth, formality, pattern: 'solid', waterproof: false, sleeve: cat === 'top' ? 'long' : null, length: cat === 'bottom' ? 'long' : null, photo: null, sample: true, ...x });
  S.items = S.items.concat([
    m('top', '화이트 반팔 티', '#f6f6f4', '화이트', 1, 1, { sleeve: 'short' }), m('top', '그레이 맨투맨', '#9a9ea5', '그레이', 3, 1), m('top', '네이비 니트', '#24334f', '네이비', 4, 2),
    m('top', '하늘색 셔츠', '#a9c4e0', '하늘색', 2, 2), m('top', '줄무늬 긴팔 티', '#e8e4da', '아이보리', 2, 1, { pattern: 'pattern' }),
    m('bottom', '연청 데님', '#8fa8c4', '연청', 2, 1), m('bottom', '블랙 슬랙스', '#1e1e20', '블랙', 2, 3), m('bottom', '베이지 반바지', '#d3c3a4', '베이지', 1, 1, { length: 'short' }),
    m('outer', '카키 필드 재킷', '#59603f', '카키', 2, 1, { sleeve: 'long', length: 'short' }), m('outer', '카멜 코트', '#b58a5a', '카멜', 3, 2, { sleeve: 'long', length: 'long' }),
    m('shoes', '화이트 스니커즈', '#f1f1ef', '화이트', 2, 1), m('shoes', '브라운 로퍼', '#6a4a34', '브라운', 2, 3),
  ]);
  save(); render();
}

/* --- 렌더/이벤트 --- */
function render() {
  document.querySelectorAll('.tb').forEach(b => b.classList.toggle('on', b.dataset.v === S.tab));
  ({ today: renderToday, me: renderMe, closet: renderCloset, style: renderStyle, gaps: renderGaps }[S.tab] || renderToday)();
  window.scrollTo(0, 0);
}
const H = {
  tab(t) { S.tab = t.dataset.v; render(); },
  sky(t) { S.w.sky = t.dataset.v; renderToday(); },
  wind(t) { S.w.wind = t.dataset.v; renderToday(); },
  occ(t) { S.occ = t.dataset.v; S.sel = 0; save(); renderToday(); },
  preset(t) { const p = SEASON_PRESET[t.dataset.v]; S.w.min = p[0]; S.w.max = p[1]; renderToday(); },
  selOutfit(t) { S.sel = +t.dataset.v; renderResults(); },
  tex() { S.tex = !S.tex; save(); if (S.tab === 'me') renderMe(); else if (S.tab === 'style') renderStyle(); else renderResults(); },
  view(t) { S.view = t.dataset.v; saveMe(); renderResults(); },
  geoWeather() { geoWeather(); }, cityWeather() { cityWeather(); },
  pickMe() { $('#fme').click(); }, pickMeCam() { $('#fmecam').click(); },
  aiFit() { aiFit(); }, delMe() { delMe(); },
  aiStyle() { aiStyle(); },
  filter(t) { S.filter = t.dataset.v; renderCloset(); },
  addSample() { addSampleCloset(); },
  addManual() { openEdit(null); },
  pickCam() { $('#fcam').click(); }, pickGal() { $('#fgal').click(); },
  editItem(t) { openEdit(t.dataset.v); },
  closeModal() { S.edit = null; renderModal(); },
  saveItem() {
    readEdit(); const e = S.edit; delete e.isNew; delete e.needs; delete e._h;
    if (!e.id) { e.id = uid(); S.items.push(e); } else { const i = S.items.findIndex(x => x.id === e.id); if (i >= 0) S.items[i] = e; }
    S.edit = null; renderModal(); save(); render();
  },
  delItem() {
    if (!S.delArm) { readEdit(); S.delArm = true; renderModal(); return; }
    S.items = S.items.filter(x => x.id !== S.edit.id); S.edit = null; renderModal(); save(); render();
  },
};
document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-a]'); if (t && H[t.dataset.a]) H[t.dataset.a](t, ev);
  else if (ev.target.id === 'modal') H.closeModal();
});
document.addEventListener('input', ev => {
  const i = ev.target.dataset && ev.target.dataset.i; if (!i) return;
  if (i === 'min' || i === 'max') {
    S.w[i] = +ev.target.value;
    if (S.w.min > S.w.max) { if (i === 'min') { S.w.max = S.w.min; } else { S.w.min = S.w.max; } const a = document.querySelector('[data-i=min]'), b = document.querySelector('[data-i=max]'); if (a) a.value = S.w.min; if (b) b.value = S.w.max; }
    $('#vmin').textContent = S.w.min + '°C'; $('#vmax').textContent = S.w.max + '°C'; updateFeel(); S.sel = 0; renderResults();
  } else if (i === 'ew') { $('#e_wv').textContent = ev.target.value; }
  else if (/^me_/.test(i) && S.me) { S.me.a[i.slice(3)] = +ev.target.value / 100; const lb = document.getElementById('v_' + i); if (lb) lb.textContent = ev.target.value + '%'; scheduleMe(); }
});
document.addEventListener('change', ev => {
  if (ev.target.dataset && ev.target.dataset.i === 'ecat') { readEdit(); renderModal(); }
  if (ev.target.dataset && ev.target.dataset.i === 'city') S.city = ev.target.value;
  if (ev.target.dataset && /^me_/.test(ev.target.dataset.i || '')) saveMe();
  if (ev.target.id === 'fme' || ev.target.id === 'fmecam') { const f = ev.target.files && ev.target.files[0]; ev.target.value = ''; if (f) setMe(f); }
  if (ev.target.id === 'fcam' || ev.target.id === 'fgal') { const fs = Array.from(ev.target.files || []); ev.target.value = ''; if (fs.length) processFiles(fs); }
});

/* --- 시작 --- */
window.addEventListener('load', async function init() {
  await DB.open(); S.dbOK = !!DB.db;
  const st = await DB.get('state');
  if (st) { S.items = st.items || []; S.tex = !!st.tex; if (st.occ && OCC[st.occ] != null) S.occ = st.occ; }
  const me = await DB.get('me'); if (me && me.photo) { S.me = me; if (me.view) S.view = me.view; }
  const pf = await DB.get('prefs'); if (pf && pf.city && CITIES[pf.city]) S.city = pf.city;
  render();
  try {
    const cfg = await DB.get('cfg'); if (cfg) { S.cfg = { key: cfg.key || '', textModel: cfg.textModel || '', imageModel: cfg.imageModel || '', models: cfg.models || null }; setSample(); }
    const gl = await DB.get('gallery'); if (Array.isArray(gl)) S.gallery = gl;
    if (S.tab === 'closet') renderCloset(); else if (S.tab === 'me') renderMe();
  } catch (e) { /* AI 없이 동작 */ }
});
