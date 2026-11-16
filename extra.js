/* ===== 날씨 자동 가져오기 / 내 사진 합성 / 스타일 제안 ===== */
const CITIES = {
  '서울': [37.5665, 126.9780], '부산': [35.1796, 129.0756], '대구': [35.8714, 128.6014], '인천': [37.4563, 126.7052],
  '광주': [35.1595, 126.8526], '대전': [36.3504, 127.3845], '울산': [35.5384, 129.3114], '세종': [36.4800, 127.2890],
  '수원': [37.2636, 127.0286], '청주': [36.6424, 127.4890], '전주': [35.8242, 127.1480], '강릉': [37.7519, 128.8761], '제주': [33.4996, 126.5312],
};
function wmoSky(c) {
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return '눈';
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95) return '비';
  if (c === 0 || c === 1) return '맑음';
  return '흐림';
}
async function fetchWeather(lat, lon, label) {
  S.wBusy = true; S.wErr = ''; renderToday();
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code,wind_speed_10m_max&timezone=auto&forecast_days=1`;
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 9000);
    const r = await fetch(url, { signal: ctl.signal }); clearTimeout(to);
    if (!r.ok) throw new Error('http ' + r.status);
    const j = await r.json(), d = j.daily, c = j.current || {};
    if (!d || !d.temperature_2m_min || d.temperature_2m_min[0] == null || d.temperature_2m_max[0] == null) throw new Error('bad-data');
    const wk = d.wind_speed_10m_max && d.wind_speed_10m_max[0] != null ? d.wind_speed_10m_max[0] : (c.wind_speed_10m || 0);
    S.w = { min: Math.round(d.temperature_2m_min[0]), max: Math.round(d.temperature_2m_max[0]), sky: wmoSky(d.weather_code ? d.weather_code[0] : (c.weather_code || 0)), wind: wk < 12 ? '약' : wk < 30 ? '보통' : '강' };
    S.wInfo = { label, now: c.temperature_2m != null ? Math.round(c.temperature_2m) : '-', feels: c.apparent_temperature != null ? Math.round(c.apparent_temperature) : null, at: (c.time || '').replace('T', ' ') || '방금' };
    S.sel = 0; saveMe();
  } catch (e) {
    S.wErr = (e && (e.name === 'TypeError' || e.name === 'AbortError'))
      ? '날씨 서버에 연결하지 못했어요. 인터넷 연결이나 위치 권한(브라우저 설정)을 확인하거나, 아래 슬라이더로 직접 입력해주세요.'
      : '날씨 데이터를 읽지 못했어요. 잠시 뒤 다시 시도하거나 직접 입력해주세요.';
  } finally { S.wBusy = false; renderToday(); }
}
function geoWeather() {
  if (!navigator.geolocation) { S.wErr = '이 화면에서는 위치 정보를 쓸 수 없어요. 도시를 골라 가져오거나 직접 입력해주세요.'; renderToday(); return; }
  S.wBusy = true; S.wErr = ''; renderToday();
  let done = false;
  const fail = msg => { if (done) return; done = true; S.wBusy = false; S.wErr = msg; renderToday(); };
  setTimeout(() => fail('위치 응답이 없어요. 이 화면에서는 위치 접근이 막혀 있을 수 있어요. 도시를 골라 가져오거나 직접 입력해주세요.'), 12000);
  try {
    navigator.geolocation.getCurrentPosition(p => { if (done) return; done = true; fetchWeather(p.coords.latitude, p.coords.longitude, '내 위치'); },
      e => fail(e && e.code === 1 ? '위치 권한이 거부됐거나 이 화면에서 막혀 있어요. 도시를 골라 가져오거나 직접 입력해주세요.' : '위치를 확인하지 못했어요. 도시를 골라 가져오거나 직접 입력해주세요.'),
      { timeout: 10000, maximumAge: 600000 });
  } catch (e) { fail('이 화면에서는 위치 정보를 쓸 수 없어요. 도시를 골라 가져오거나 직접 입력해주세요.'); }
}
function cityWeather() { const c = CITIES[S.city] || CITIES['서울']; fetchWeather(c[0], c[1], S.city); }
function saveMe() { if (S.me) DB.set('me', { ...S.me, view: S.view }); DB.set('prefs', { city: S.city }); }

/* --- 내 모습(사진 위 합성) --- */
const IMGC = new Map();
function getImg(src) { if (!IMGC.has(src)) IMGC.set(src, new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; })); return IMGC.get(src); }
function dataUrlToBlob(u) { const [h, b] = u.split(','), mime = (h.match(/:(.*?);/) || [])[1] || 'image/jpeg', bin = atob(b), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return new Blob([arr], { type: mime }); }
async function prepMe(file) {
  const { im, u } = await loadImg(file), sc = Math.min(1, 900 / Math.max(im.width, im.height)), c = document.createElement('canvas');
  c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  URL.revokeObjectURL(u); return c.toDataURL('image/jpeg', 0.85);
}
async function setMe(file) {
  try { const photo = await prepMe(file); S.me = { photo, a: { sy: 0.2, ay: 0.92, cx: 0.5, sw: 0.27 } }; S.view = 'me'; S.meArm = false; saveMe(); renderMe(); }
  catch (e) { S.meBusy = '사진을 열 수 없어요. 다른 사진을 골라주세요.'; renderMe(); }
}
function delMe() {
  if (!S.meArm) { S.meArm = true; renderMe(); return; }
  S.me = null; S.view = 'man'; S.meArm = false; DB.set('me', null); renderMe();
}
const SH = {
  top: 'M72 84 Q110 76 148 84 L147 222 Q110 230 73 222 Z',
  topSL: 'M72 84 C60 88 52 96 48 108 L34 196 Q33 205 44 206 L55 207 Q61 207 63 199 L76 126 Z',
  topSS: 'M72 84 C60 88 52 96 48 108 L42 142 L67 150 L76 120 Z',
  oSleeve: 'M70 82 C56 86 46 96 42 110 L26 202 Q25 212 38 213 L56 214 Q64 213 66 203 L78 130 Z',
  oShort: 'M68 82 Q88 78 106 84 L103 236 L66 236 Z', oLong: 'M68 82 Q88 78 106 84 L103 338 L56 338 Z', lapel: 'M106 84 L96 108 L104 120 Z',
  bLong: 'M72 212 L110 212 L110 258 L107 424 L79 424 L70 240 Z', bShort: 'M72 212 L110 212 L110 258 L108 312 L75 312 L70 240 Z',
  shoe: 'M78 424 L106 424 L108 446 Q112 458 96 458 L68 458 Q60 458 64 448 Z', boot: 'M78 396 L106 396 L107 446 Q112 458 96 458 L68 458 Q60 458 64 448 L78 440 Z',
};
async function drawMe(cv, o) {
  if (!cv || !S.me) return;
  try {
    const base = await getImg(S.me.photo), W = base.naturalWidth, H = base.naturalHeight;
    cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.drawImage(base, 0, 0);
    const a = S.me.a, sx = a.sw * W / 76, sy = (a.ay - a.sy) * H / 340;
    if (!(sx > 0 && sy > 0)) return;
    const imgs = {};
    if (S.tex) for (const it of [o.top, o.bottom, o.outer]) if (it && it.photo) { try { imgs[it.id] = await getImg(it.photo); } catch (e) { } }
    const paint = (d, it, box, mirror) => {
      g.save(); if (mirror) { g.translate(220, 0); g.scale(-1, 1); }
      const p = new Path2D(d), im = imgs[it.id];
      if (im) {
        g.save(); g.clip(p); const k = Math.max(box[2] / im.naturalWidth, box[3] / im.naturalHeight), dw = im.naturalWidth * k, dh = im.naturalHeight * k;
        g.drawImage(im, box[0] + (box[2] - dw) / 2, box[1] + (box[3] - dh) / 2, dw, dh); g.restore();
      } else { g.fillStyle = it.color; g.fill(p); }
      g.lineWidth = 1.3; g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineJoin = 'round'; g.stroke(p); g.restore();
    };
    const both = (d, it, box) => { paint(d, it, box, false); paint(d, it, box, true); };
    g.save(); g.translate(a.cx * W - 110 * sx, a.sy * H - 84 * sy); g.scale(sx, sy);
    const { top, bottom, outer, shoes } = o;
    if (bottom) both(bottom.length === 'short' ? SH.bShort : SH.bLong, bottom, [66, 210, 88, 215]);
    if (shoes) both(shoes.warmth >= 3 ? SH.boot : SH.shoe, { ...shoes, id: 'x' }, [60, 396, 100, 62]);
    if (top) { paint(SH.top, top, [30, 76, 160, 150], false); both(top.sleeve === 'short' ? SH.topSS : SH.topSL, top, [30, 76, 160, 150]); }
    if (outer) {
      const ob = [24, 78, 172, outer.length === 'long' ? 262 : 162];
      both(SH.oSleeve, outer, ob); both(outer.length === 'long' ? SH.oLong : SH.oShort, outer, ob);
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fill(new Path2D(SH.lapel)); g.save(); g.translate(220, 0); g.scale(-1, 1); g.fill(new Path2D(SH.lapel)); g.restore();
    }
    if (top) { const gr = g.createLinearGradient(72, 0, 148, 0); gr.addColorStop(0, 'rgba(255,255,255,.28)'); gr.addColorStop(.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.25)'); g.globalAlpha = .5; g.fillStyle = gr; g.fill(new Path2D(SH.top)); g.globalAlpha = 1; }
    g.restore();
  } catch (e) { /* 그리기 실패 시 사진만 표시 */ }
}
let meRaf = 0;
function scheduleMe() { if (meRaf) return; meRaf = requestAnimationFrame(() => { meRaf = 0; const cv = document.getElementById('mecv'); if (cv && S._pv) drawMe(cv, S._pv); }); }
function previewOutfit() {
  const none = { top: null, bottom: null, outer: null, shoes: null };
  if (!S.items.length) return none;
  const r = bestOutfits(S.items, mkCtx(S.w, S.occ), 1)[0]; return r ? r.o : none;
}
function renderMe() {
  const v = $('#view'), head = `<header class="hd"><div><div class="eyebrow">내 사진으로 코디 미리보기</div><h1>내 모습</h1></div></header>`;
  if (!S.me) {
    v.innerHTML = head + `<section class="card"><b>전신 사진을 등록해요</b>
    <ul class="gd"><li>정면을 보고 서서 머리부터 발끝까지 나온 사진</li><li>몸에 붙는 단색 옷이나 편한 차림일수록 합성이 깔끔해요 (입고 있는 옷이 합성한 옷 밖으로 보일 수 있어요)</li><li>밝은 곳, 배경은 단순하게</li></ul>
    <div class="row gap wrap"><button class="btn pri" data-a="pickMeCam">📷 촬영</button><button class="btn" data-a="pickMe">🖼 사진 선택</button></div>
    <input type="file" id="fmecam" accept="image/*" capture="user" hidden><input type="file" id="fme" accept="image/*" hidden>
    ${S.meBusy ? `<p class="warnT sm">${esc(S.meBusy)}</p>` : ''}
    <p class="mute xs">사진은 이 기기의 이 브라우저에만 저장돼요. 아래 'AI 자동 맞춤'을 직접 누를 때만 그 사진이 AI(Google Gemini)로 전송돼요.</p></section>
    <section class="card"><b>알아두세요</b><p class="mute sm">이 기능은 실제 착용 사진을 만드는 AI 가상 피팅이 아니라, 내 사진 위에 옷의 모양·색(또는 옷 사진 무늬)을 겹쳐 그리는 합성 미리보기예요. 옷의 주름·체형에 따른 핏은 반영되지 않아요.</p></section>`;
    return;
  }
  S._pv = previewOutfit(); const a = S.me.a, p = k => Math.round(a[k] * 100);
  const sl = (k, label, mn, mx) => `<div class="sl"><label>${label} <b id="v_me_${k}">${p(k)}%</b></label><input type="range" min="${mn}" max="${mx}" value="${p(k)}" data-i="me_${k}"></div>`;
  v.innerHTML = head + `<section class="card">
    <div class="row between"><b>${S.items.length ? '오늘 추천 1위 코디' : '옷장에 옷을 등록하면 코디가 입혀져요'}</b><button class="chip ${S.tex ? 'on' : ''}" data-a="tex">${S.tex ? '옷 사진 무늬 ON' : '옷 사진 무늬'}</button></div>
    <canvas id="mecv" class="mec"></canvas>
    <p class="mute sm">옷이 어깨·발목선에 맞도록 아래 슬라이더로 조정하세요. 한 번 맞추면 저장돼요.</p>
    ${sl('sy', '어깨 높이', 5, 45)}${sl('ay', '발목(바지 밑단) 높이', 60, 99)}${sl('cx', '몸 중심 좌우', 30, 70)}${sl('sw', '어깨 너비', 12, 55)}
    <div class="row gap wrap">${S.sample ? `<button class="btn" data-a="aiFit" ${S.meBusy === 'fit' ? 'disabled' : ''}>${S.meBusy === 'fit' ? '맞추는 중…' : '✨ AI 자동 맞춤'}</button>` : ''}
      <button class="btn" data-a="pickMe">다른 사진으로</button><button class="btn ${S.meArm ? 'dng' : ''}" data-a="delMe">${S.meArm ? '정말 삭제' : '사진 삭제'}</button>
      <input type="file" id="fme" accept="image/*" hidden></div>
    ${S.meBusy && S.meBusy !== 'fit' ? `<p class="warnT sm">${esc(S.meBusy)}</p>` : ''}
    ${S.sample ? '<p class="mute xs">AI 자동 맞춤은 사진을 AI(Google Gemini)로 보내 어깨·발목 위치를 추정해요. 대략적이라 슬라이더로 마무리해주세요.</p>' : ''}
  </section>` + meExtras();
  drawMe($('#mecv'), S._pv);
}
async function aiFit() {
  if (!S.sample || !S.me) return;
  S.meBusy = 'fit'; renderMe();
  const prompt = `이 전신 사진에서 몸의 위치를 이미지 전체 크기 대비 0~1 비율로 추정해 JSON만 출력하세요(설명 금지).
{"shoulderY":어깨선 높이(위=0, 아래=1),"ankleY":발목 높이(바지 밑단이 올 위치),"centerX":몸 중심선 가로 위치(왼쪽=0, 오른쪽=1),"shoulderWidth":양쪽 어깨 끝 사이 거리 ÷ 이미지 가로 폭,"fullBody":머리부터 발끝까지 모두 보이면 true}
정확히 알 수 없으면 가장 가능성 높은 값을 고르세요.`;
  try {
    const blob = dataUrlToBlob(S.me.photo), opts = { images: [blob], cache: false };
    let v; if (typeof S.sample.json === 'function') { try { v = await S.sample.json(prompt, opts); } catch (e) { if (e && (e.code === 'not_granted' || e.code === 'rate_limited')) throw e; } }
    if (v === undefined) { const r = await S.sample(prompt, opts); v = parseLoose(r.text); }
    if (typeof v === 'string') v = parseLoose(v);
    const ok = (x, lo, hi) => typeof x === 'number' && x >= lo && x <= hi;
    if (ok(v.shoulderY, 0.05, 0.5) && ok(v.ankleY, 0.55, 1) && ok(v.centerX, 0.25, 0.75) && ok(v.shoulderWidth, 0.1, 0.6) && v.ankleY > v.shoulderY + 0.3) {
      S.me.a = { sy: v.shoulderY, ay: v.ankleY, cx: v.centerX, sw: v.shoulderWidth }; saveMe(); S.meBusy = v.fullBody === false ? '전신이 다 나오지 않은 사진 같아요. 발목 위치를 슬라이더로 확인해주세요.' : '';
    } else S.meBusy = '위치를 확신하지 못했어요. 슬라이더로 직접 맞춰주세요.';
  } catch (e) { S.meBusy = e && e.code === 'not_granted' ? 'AI 사용 권한이 없어 자동 맞춤을 할 수 없어요. 슬라이더로 맞춰주세요.' : e && e.code === 'rate_limited' ? '요청이 많아요. 잠시 뒤 다시 시도해주세요.' : '자동 맞춤에 실패했어요. 슬라이더로 맞춰주세요.'; }
  renderMe();
}

/* --- 스타일 제안 --- */
const OCC_TITLE = { '캐주얼': '데일리 캐주얼', '출근': '단정한 출근룩', '데이트': '데이트 룩', '운동': '가볍게 움직이는 날', '격식': '격식 있는 자리' };
function moodTags(o) {
  const fs = [o.top, o.bottom, o.shoes, o.outer].filter(Boolean), avg = fs.reduce((s, i) => s + i.formality, 0) / (fs.length || 1), t = [];
  t.push(avg < 0.7 ? '스포티' : avg < 1.5 ? '편안한 캐주얼' : avg < 2.4 ? '스마트 캐주얼' : '클래식');
  const col = [o.top, o.bottom, o.outer].filter(Boolean), nc = col.filter(i => !isNeutral(hsl(i))).length;
  t.push(nc === 0 ? '미니멀 무채색' : nc === 1 ? '컬러 포인트' : '컬러 믹스');
  if (o.outer) t.push('레이어드');
  return t;
}
function styleCard(o, title, sub, extra) {
  const parts = [['top', o.top], ['outer', o.outer], ['bottom', o.bottom], ['shoes', o.shoes]].filter(x => x[1]);
  return `<div class="rc sc"><div class="rm2">${fig(o)}</div><div>
    <b class="st">${esc(title)}</b>${sub ? `<p class="sm">${esc(sub)}</p>` : ''}
    <div class="chips tg">${moodTags(o).map(t => `<span class="tag">${t}</span>`).join('')}</div>
    <p class="mute sm">${parts.map(([c, i]) => esc(i.name)).join(' · ')}</p>${extra || ''}</div></div>`;
}
function renderStyle() {
  const head = `<header class="hd"><div><div class="eyebrow">내 옷으로 만드는 코디 스타일</div><h1>스타일 제안</h1></div></header>`;
  if (S.items.length < 4) { $('#view').innerHTML = head + `<section class="card empty"><div class="big">🧥</div><b>옷을 4벌 이상 등록하면 스타일을 제안해요</b><div class="row gap center"><button class="btn pri" data-a="tab" data-v="closet">옷장으로</button><button class="btn" data-a="addSample">예시 옷장으로 체험</button></div></section>`; return; }
  const ctx0 = mkCtx(S.w, S.occ), occs = ['캐주얼', '출근', '데이트', '운동'];
  if (S.items.some(i => i.formality >= 3)) occs.push('격식');
  const seen = new Set(), cards = [];
  occs.forEach(oc => {
    const r = bestOutfits(S.items, mkCtx(S.w, oc), 1)[0]; if (!r) return;
    const sig = ['top', 'bottom', 'outer', 'shoes'].map(k => r.o[k] ? r.o[k].id : '-').join('|'); if (seen.has(sig)) return; seen.add(sig);
    const ex = (r.warns.length ? `<p class="sm warnT">⚠️ ${esc(r.warns[0])}</p>` : '') + (r.notes.length ? `<p class="sm okT">✓ ${esc(r.notes[r.notes.length > 2 ? 2 : 0])}</p>` : '');
    cards.push(styleCard(r.o, OCC_TITLE[oc] || oc, `오늘 날씨 기준 '${oc}' 최적 조합 · ${r.score.toFixed(0)}점`, ex));
  });
  let ai = '';
  if (!S.sample) ai = '<p class="mute sm">AI 스타일리스트는 ⚙️ 설정에서 Gemini API 키를 넣으면 쓸 수 있어요. (아래 규칙 기반 제안은 키 없이 동작해요)</p>';
  else {
    ai = `<button class="btn pri" data-a="aiStyle" ${S.styBusy ? 'disabled' : ''}>${S.styBusy ? '스타일링 중…' : (S.styles ? '✨ 다시 제안받기' : '✨ AI 스타일리스트에게 제안받기')}</button>
      <p class="mute xs">내 옷장 정보(이름·색·두께, 사진 제외)와 오늘 날씨·일정이 AI(Google Gemini)로 전송돼요.</p>${S.styErr ? `<p class="warnT sm">${esc(S.styErr)}</p>` : ''}`;
    if (S.styles) ai += S.styles.map(s => {
      const r = scoreOutfit(s.o, ctx0, true), w2 = r.warns.slice(0, 2).map(x => `<p class="sm warnT">⚠️ ${esc(x)}</p>`).join('');
      return styleCard(s.o, s.styleName, s.mood, `<p class="sm">${esc(s.why)}</p>${(s.tips || []).map(t => `<p class="sm">💡 ${esc(t)}</p>`).join('')}${s.suits ? `<p class="mute sm">어울리는 때: ${esc(s.suits)}</p>` : ''}${s.missing ? `<p class="sm">➕ 더하면 좋은 아이템: ${esc(s.missing)}</p>` : ''}${w2}<p class="mute xs">앱 점검 점수 ${r.score.toFixed(0)}점</p>`);
    }).join('');
  }
  $('#view').innerHTML = head + `<section class="card"><b>지금 옷장으로 되는 스타일</b><p class="mute sm">일정별로 오늘 날씨에 맞춰 규칙 계산으로 고른 조합이에요. (체감 ${effTemp(S.w).toFixed(0)}°C 기준)</p>${cards.join('')}</section>
  <section class="card"><b>AI 스타일리스트 제안</b><p class="mute sm">분위기가 다른 스타일 4가지를 내 옷만으로 만들어 이유와 스타일링 팁까지 알려줘요. AI가 만든 제안이라 틀릴 수 있어서, 앱이 날씨 적합도를 다시 점검해 표시해요.</p>${ai}</section>`;
  flushFigs();
}
async function aiStyle() {
  if (!S.sample || S.styBusy) return;
  S.styBusy = true; S.styErr = ''; renderStyle();
  const ctx = mkCtx(S.w, S.occ), byId = Object.fromEntries(S.items.map(i => [i.id, i]));
  const closet = S.items.map(i => ({ id: i.id, 종류: CATS[i.cat], 이름: i.name, 색: i.colorName || i.color, 보온: i.warmth, 격식: FORM[i.formality], 패턴: i.pattern === 'pattern' ? '있음' : '없음', 방수: i.waterproof, 소매: i.sleeve, 기장: i.length }));
  const hasShoes = S.items.some(i => i.cat === 'shoes');
  const prompt = `당신은 한국 사용자를 위한 개인 스타일리스트입니다. 아래 '내 옷장'에 있는 옷만 사용해서, 서로 분위기가 다른 스타일 4가지를 제안하세요.
오늘 날씨: 체감 약 ${ctx.eff.toFixed(0)}°C(최저 ${S.w.min}°C, 최고 ${S.w.max}°C, ${S.w.sky}, 바람 ${S.w.wind}), 일정: '${S.occ}'. 오늘 입을 수 있는 현실적인 조합이어야 하고, 보온이 너무 모자라거나 넘치면 안 됩니다.
규칙: itemIds의 id는 내 옷장에 실제 있는 id만 쓰고 절대 지어내지 마세요. top·bottom은 필수${hasShoes ? ', shoes도 필수' : ''}, outer는 선택(없으면 null). 같은 조합을 반복하지 마세요. 보이지 않는 정보를 지어내지 마세요.
JSON만 출력(설명·마크다운 금지): {"styles":[{"styleName":"스타일 이름(예: 미니멀 클린룩)","mood":"한 줄 분위기","itemIds":{"top":"id","bottom":"id","outer":"id 또는 null","shoes":"id 또는 null"},"why":"왜 어울리는지 2문장(색·실루엣·분위기)","tips":["스타일링 팁 1~2개"],"suits":"어울리는 상황","missing":"이 스타일을 더 완성해줄 추가 아이템 한 가지(없으면 null)"}]}
내 옷장: ${JSON.stringify(closet)}`;
  try {
    let v; if (typeof S.sample.json === 'function') { try { v = await S.sample.json(prompt, { cache: false }); } catch (e) { if (e && (e.code === 'not_granted' || e.code === 'rate_limited')) throw e; } }
    if (v === undefined) { const r = await S.sample(prompt, { cache: false }); v = parseLoose(r.text); }
    if (typeof v === 'string') v = parseLoose(v);
    const out = [];
    for (const s of (v && v.styles) || []) {
      const ids = s.itemIds || {}, g = (k, c) => (ids[k] && byId[ids[k]] && byId[ids[k]].cat === c) ? byId[ids[k]] : null;
      const o = { top: g('top', 'top'), bottom: g('bottom', 'bottom'), outer: g('outer', 'outer'), shoes: g('shoes', 'shoes') };
      if (!o.top || !o.bottom) continue;
      out.push({ o, styleName: String(s.styleName || '스타일').slice(0, 24), mood: String(s.mood || '').slice(0, 80), why: String(s.why || '').slice(0, 220), tips: Array.isArray(s.tips) ? s.tips.slice(0, 2).map(t => String(t).slice(0, 100)) : [], suits: s.suits ? String(s.suits).slice(0, 60) : '', missing: s.missing && s.missing !== 'null' ? String(s.missing).slice(0, 80) : '' });
    }
    if (!out.length) S.styErr = '제안을 만들지 못했어요. 다시 시도해주세요.'; else S.styles = out;
  } catch (e) { S.styErr = e && e.code === 'not_granted' ? 'AI 사용 권한이 없어요.' : e && e.code === 'rate_limited' ? '요청이 많아요. 잠시 뒤 다시 시도해주세요.' : '제안에 실패했어요. 다시 시도해주세요.'; }
  S.styBusy = false; if (S.tab === 'style') renderStyle();
}
