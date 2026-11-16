/* ===== Gemini 연결 / 설정 / 착장·헤어 생성(A) / Gemini 앱 수동 패키지(B) / 기록 ===== */
Object.assign(S, { cfg: { key: '', textModel: '', imageModel: '', models: null }, m2: null, gen: null, hair: null, gallery: [], setMsg: '', setBusy: false, viewId: null, delArm2: false, manual: null, lastOuts: [] });
const GBASE = 'https://generativelanguage.googleapis.com/v1beta/';
const HAIR_PRESETS = ['투블럭 컷', '가르마 펌', '리프 컷', '댄디 컷', '크롭 컷', '포마드 올백', '쉐도우 펌', '짧은 스포츠 머리'];
const HAIR_COLORS = ['지금 색 그대로', '자연스러운 검정', '다크 브라운', '애쉬 브라운'];

function blobToB64(b) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(b); }); }
function dataUrlParts(u) { const m = String(u).match(/^data:(.*?);base64,(.*)$/); return m ? { mimeType: m[1], data: m[2] } : null; }
async function compressDataUrl(u, max = 900, q = 0.88) {
  const im = await getImg(u), sc = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
  c.width = Math.round(im.naturalWidth * sc); c.height = Math.round(im.naturalHeight * sc); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', q);
}
async function gReq(path, { method = 'GET', body } = {}) {
  let r;
  try { r = await fetch(GBASE + path, { method, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': S.cfg.key }, body: body ? JSON.stringify(body) : undefined }); }
  catch (e) { const er = new Error('네트워크 오류예요. 인터넷 연결을 확인하거나, 브라우저 확장 프로그램이 Google 요청을 막고 있지 않은지 확인해주세요.'); er.code = 'network'; throw er; }
  let j = null; try { j = await r.json(); } catch (e) { }
  if (!r.ok) {
    const msg = (j && j.error && j.error.message) || ('HTTP ' + r.status), e = new Error(msg); e.status = r.status;
    e.code = r.status === 429 ? 'rate_limited' : (r.status === 401 || r.status === 403 || (r.status === 400 && /api key/i.test(msg))) ? 'not_granted' : 'error'; throw e;
  }
  return j;
}
function errMsg(e) {
  const m = String((e && e.message) || '').slice(0, 200);
  if (e && e.code === 'not_granted') return 'API 키가 거절됐어요. ⚙️ 설정에서 키를 다시 확인해주세요.';
  if (e && e.code === 'rate_limited') return `사용 한도를 넘었어요(429). 무료 등급에는 이미지 생성 한도가 없을 수 있어요. 잠시 뒤 다시 시도하거나 결제를 설정하거나 B 방식(Gemini 앱)을 쓰세요. (${m})`;
  return m || '알 수 없는 오류예요.';
}
const tModel = () => S.cfg.textModel || 'gemini-2.5-flash';
const iModel = () => S.cfg.imageModel || 'gemini-2.5-flash-image';
const candParts = j => { const c = j && j.candidates && j.candidates[0]; return (c && c.content && c.content.parts) || []; };
function makeSample() {
  const s = async (input, opts = {}) => {
    const parts = [];
    for (const b of (opts.images || [])) parts.push({ inlineData: { mimeType: b.type || 'image/jpeg', data: await blobToB64(b) } });
    parts.push({ text: typeof input === 'string' ? input : input.map(m => m.content).join('\n') });
    const body = { contents: [{ role: 'user', parts }] }; if (opts.json) body.generationConfig = { responseMimeType: 'application/json' };
    const j = await gReq(`models/${encodeURIComponent(tModel())}:generateContent`, { method: 'POST', body });
    return { text: candParts(j).map(p => p.text || '').join(''), truncated: false };
  };
  s.json = async (input, opts = {}) => parseLoose((await s(input, { ...opts, json: true })).text);
  s.limits = async () => ({ images: true });
  return s;
}
function setSample() { S.sample = S.cfg.key ? makeSample() : null; }
async function saveCfg() { await DB.set('cfg', { key: S.cfg.key, textModel: S.cfg.textModel, imageModel: S.cfg.imageModel, models: S.cfg.models }); }
async function loadModels() {
  S.setBusy = true; S.setMsg = ''; renderM2();
  try {
    const j = await gReq('models?pageSize=200');
    const list = (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => String(m.name).replace(/^models\//, ''));
    const bad = /tts|embedding|live|audio|robotics|computer|veo|imagen|learnlm|gemma|aqa/i;
    const imgs = list.filter(x => /image/i.test(x) && !bad.test(x)).sort().reverse();
    const txts = list.filter(x => /^gemini/i.test(x) && !/image/i.test(x) && !bad.test(x)).sort().reverse();
    S.cfg.models = { text: txts, image: imgs };
    if (!txts.includes(S.cfg.textModel)) S.cfg.textModel = txts.find(x => /flash/.test(x) && !/lite|preview|exp/.test(x)) || txts.find(x => /flash/.test(x)) || txts[0] || '';
    if (!imgs.includes(S.cfg.imageModel)) S.cfg.imageModel = imgs.find(x => /flash.*image/.test(x) && !/preview|exp/.test(x)) || imgs.find(x => /flash.*image/.test(x)) || imgs[0] || '';
    S.setMsg = `✓ 연결됐어요. 분석용 모델 ${txts.length}개, 이미지 생성용 모델 ${imgs.length}개를 찾았어요.` + (imgs.length ? '' : ' 이미지 생성 모델이 보이지 않아요(계정·지역 제한일 수 있어요). 이 경우 B 방식을 쓰세요.');
    await saveCfg(); setSample();
  } catch (e) { S.setMsg = '⚠️ ' + errMsg(e); }
  S.setBusy = false; renderM2(); if (S.tab === 'closet') renderCloset();
}

/* --- 기록(갤러리) --- */
async function saveGallery() { await DB.set('gallery', S.gallery); }
async function addGallery(img, title, kind) {
  S.gallery.unshift({ id: uid(), img, title, kind, date: new Date().toISOString().slice(0, 16).replace('T', ' ') });
  if (S.gallery.length > 24) S.gallery.length = 24; await saveGallery();
}
function galleryHtml() {
  if (!S.gallery.length) return `<section class="card"><b>내 코디 기록</b><p class="mute sm">생성한 이미지를 '기록에 담기'로 저장하면 여기에 모여요.</p></section>`;
  return `<section class="card"><b>내 코디 기록 (${S.gallery.length})</b><div class="gal">${S.gallery.map(g => `<button class="gi" data-a="viewG" data-v="${g.id}"><img src="${g.img}" alt=""><span>${esc(g.title)}</span></button>`).join('')}</div></section>`;
}
function baseUrl() { return S.me && S.me.useHair && S.me.hair ? S.me.hair : S.me.photo; }
function meExtras() {
  const m = S.me;
  return `<section class="card"><b>헤어스타일</b>
    <p class="mute sm">내 사진의 헤어만 바꿔 보고, 마음에 들면 그 사진을 기준으로 코디를 입혀요. (AI 생성 · 얼굴이 조금 달라질 수 있어요)</p>
    ${m.hair ? `<div class="row gap wrap"><img class="hth" src="${m.hair}" alt=""><div class="chips"><button class="chip ${!m.useHair ? 'on' : ''}" data-a="useBase" data-v="0">기준: 원본</button><button class="chip ${m.useHair ? 'on' : ''}" data-a="useBase" data-v="1">기준: 헤어 적용</button></div></div>` : ''}
    <button class="btn pri" data-a="openHair">✂️ 헤어 바꿔보기</button></section>${galleryHtml()}`;
}

/* --- 하단 시트(모달2) --- */
function renderM2() {
  const m = $('#modal2'); if (!m) return;
  if (!S.m2) { m.className = ''; m.innerHTML = ''; return; }
  m.className = 'on';
  const head = t => `<div class="row between"><b>${t}</b><button class="x" data-a="closeM2" aria-label="닫기">✕</button></div>`;
  let h = '';
  if (S.m2 === 'settings') {
    const c = S.cfg, opt = (arr, cur) => (arr || []).map(x => `<option ${x === cur ? 'selected' : ''}>${esc(x)}</option>`).join('');
    h = head('⚙️ AI 설정') + `
    <label>Gemini API 키<input id="s_key" type="password" value="${esc(c.key)}" placeholder="AIza..." autocomplete="off"></label>
    <p class="mute xs">키는 이 기기의 이 브라우저에만 저장되고, 앱이 Google로 직접 보냅니다. 발급은 <a class="lnk" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio ↗</a>에서 하세요. 이 주소를 다른 사람과 공유하지 마세요.</p>
    <div class="row gap wrap"><button class="btn pri" data-a="saveKey" ${S.setBusy ? 'disabled' : ''}>${S.setBusy ? '확인 중…' : '저장 후 연결 테스트'}</button>${c.key ? '<button class="btn" data-a="delKey">키 삭제</button>' : ''}</div>
    ${S.setMsg ? `<p class="sm ${S.setMsg[0] === '✓' ? 'okT' : 'warnT'}">${esc(S.setMsg)}</p>` : ''}
    ${c.models ? `<label>분석용 모델(옷 사진 분석·스타일 제안)<select data-i="s_tm">${opt(c.models.text, c.textModel)}</select></label>
    <label>이미지 생성 모델(착장·헤어)<select data-i="s_im">${opt(c.models.image, c.imageModel)}</select></label>` : ''}
    <ul class="gd"><li>사진 분석·스타일 제안은 무료 한도 안에서 될 수 있지만, 이미지 생성은 계정에 따라 유료(장당 약 $0.04 안팎)일 수 있어요. 구글 요금 안내를 확인하세요.</li>
    <li>무료 등급에서는 보낸 내용이 Google 제품 개선에 쓰일 수 있어요. 전신·얼굴 사진은 유료(결제 설정) 키로 쓰는 편이 안전해요.</li>
    <li>키가 없으면 B 방식(Gemini 앱에서 직접 만들기)으로 무료로 쓸 수 있어요.</li></ul>`;
  } else if (S.m2 === 'gen' && S.gen) {
    const g = S.gen, items = outfitItems(g.o), noPhoto = items.filter(x => !x[2].photo).length;
    h = head('✨ AI로 내 모습에 입히기') + `
    <div class="chips">${items.map(([k, l, it]) => `<span class="tag">${l}: ${esc(it.name)}${it.photo ? '' : ' (사진 없음)'}</span>`).join('')}</div>
    ${noPhoto ? '<p class="mute xs">사진이 없는 옷은 글 설명(이름·색)만 보내서 정확도가 떨어져요. 사진을 등록하면 더 비슷하게 나와요.</p>' : ''}
    ${g.img ? `<img class="gimg" src="${g.img}" alt="생성된 착장">` : (g.busy ? '<div class="empty"><div class="big">⏳</div><p class="mute">생성 중… (10~40초)</p></div>' : `<p class="mute sm">${S.me.useHair && S.me.hair ? '헤어를 적용한 기준 사진' : '원본 기준 사진'}과 위 옷 사진을 Google(Gemini)로 보내 이미지를 만들어요. 이미지 1장당 약 $0.04 안팎(계정·요금제에 따라 다름)이 들 수 있어요.</p>`)}
    ${g.err ? `<p class="warnT sm">⚠️ ${esc(g.err)}</p>` : ''}
    <div class="row gap wrap"><button class="btn pri" data-a="runGen" ${g.busy ? 'disabled' : ''}>${g.img ? '다시 생성' : '생성하기'}</button>
      ${g.img ? `<button class="btn" data-a="saveGen" ${g.saved ? 'disabled' : ''}>${g.saved ? '저장됨' : '기록에 담기'}</button><a class="btn" href="${g.img}" download="my-outfit.jpg">이미지 저장</a>` : ''}
      <button class="btn" data-a="openManual">B: Gemini 앱으로 직접</button></div>
    <p class="mute xs">AI 생성 이미지는 실제 착용 모습과 다를 수 있어요(핏·주름·색 차이). 얼굴이나 체형이 조금 달라지면 '다시 생성'해보세요.</p>`;
  } else if (S.m2 === 'hair' && S.hair) {
    const x = S.hair;
    h = head('✂️ 헤어스타일 바꿔보기') + `
    <img class="hbase" src="${S.me.photo}" alt="원본">
    <div class="chips">${HAIR_PRESETS.map(p => `<button class="chip ${x.style === p ? 'on' : ''}" data-a="hairPick" data-v="${esc(p)}">${p}</button>`).join('')}</div>
    <label>원하는 스타일(직접 입력해도 돼요)<input id="h_style" value="${esc(x.style)}" placeholder="예: 앞머리 내린 가르마 펌"></label>
    <label>머리색<select id="h_color">${HAIR_COLORS.map(c => `<option ${x.color === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    <div class="row gap wrap"><button class="btn" data-a="aiHairRec" ${x.recBusy ? 'disabled' : ''}>${x.recBusy ? '살펴보는 중…' : '✨ AI에게 어울리는 스타일 물어보기'}</button></div>
    ${x.rec ? `<div class="msgs ok"><div><b>${esc(x.rec.faceShape || '')}</b> <span class="mute">(AI의 의견일 뿐 정확한 진단이 아니에요)</span></div>${(x.rec.styles || []).map(s => `<div>• <button class="lnk2" data-a="hairPick" data-v="${esc(s.name)}">${esc(s.name)}</button> — ${esc(s.why)}</div>`).join('')}</div>` : ''}
    ${x.img ? `<img class="gimg" src="${x.img}" alt="헤어 결과">` : (x.busy ? '<div class="empty"><div class="big">⏳</div><p class="mute">생성 중… (10~40초)</p></div>' : '')}
    ${x.err ? `<p class="warnT sm">⚠️ ${esc(x.err)}</p>` : ''}
    <div class="row gap wrap"><button class="btn pri" data-a="runHair" ${x.busy ? 'disabled' : ''}>${x.img ? '다시 생성' : '생성하기'}</button>
      ${x.img ? `<button class="btn" data-a="useHair">이 헤어를 내 기본 사진으로</button><button class="btn" data-a="saveHair" ${x.saved ? 'disabled' : ''}>${x.saved ? '저장됨' : '기록에 담기'}</button>` : ''}</div>
    <p class="mute xs">원본 사진과 요청이 Google(Gemini)로 전송돼요. 생성 1장당 약 $0.04 안팎일 수 있어요.</p>`;
  } else if (S.m2 === 'manual' && S.manual) {
    const mn = S.manual;
    h = head('B: Gemini 앱으로 직접 만들기 (무료)') + `
    <ol class="gd"><li>아래 <b>시트 이미지</b>를 저장해요(저장이 안 되면 이미지를 길게 눌러 저장).</li><li><b>Gemini 앱</b>(Pro)을 열고 이미지 생성(나노 바나나) 모드에서 시트를 첨부해요.</li><li><b>프롬프트</b>를 복사해 붙여넣고 보내요.</li><li>마음에 드는 결과 이미지를 저장해서 아래에서 올리면 기록에 남아요.</li></ol>
    ${mn.sheet ? `<img class="gimg" src="${mn.sheet}" alt="시트">` : '<p class="mute">시트를 만드는 중…</p>'}
    <div class="row gap wrap">${mn.sheet ? `<a class="btn pri" href="${mn.sheet}" download="coordi-sheet.jpg">시트 이미지 저장</a>` : ''}<button class="btn" data-a="copyPrompt">프롬프트 복사</button><a class="btn" href="https://gemini.google.com/app" target="_blank" rel="noopener">Gemini 열기 ↗</a></div>
    <textarea id="mprompt" class="ta" readonly rows="6">${esc(mn.prompt || '')}</textarea>
    <label>결과 이미지 올리기<input type="file" id="fres" accept="image/*"></label>
    ${mn.msg ? `<p class="sm ${mn.msg[0] === '✓' ? 'okT' : 'warnT'}">${esc(mn.msg)}</p>` : ''}`;
  } else if (S.m2 === 'viewG') {
    const g = S.gallery.find(x => x.id === S.viewId);
    if (!g) { S.m2 = null; return renderM2(); }
    h = head(esc(g.title)) + `<img class="gimg" src="${g.img}" alt=""><p class="mute xs">${esc(g.date)}</p><div class="row gap wrap"><a class="btn" href="${g.img}" download="my-outfit.jpg">이미지 저장</a><button class="btn ${S.delArm2 ? 'dng' : ''}" data-a="delG">${S.delArm2 ? '정말 삭제' : '삭제'}</button></div>`;
  }
  m.innerHTML = `<div class="sheet">${h}</div>`;
}

/* --- 착장 생성(A) --- */
function outfitItems(o) { return [['top', '상의', o.top], ['outer', '겉옷', o.outer], ['bottom', '하의', o.bottom], ['shoes', '신발', o.shoes]].filter(x => x[2]); }
function itemDesc(it) {
  const p = [it.name]; if (it.colorName) p.push(`color ${it.colorName} (${it.color})`);
  if (it.cat === 'top' || it.cat === 'outer') p.push(it.sleeve === 'short' ? 'short sleeves' : 'long sleeves');
  if (it.cat === 'bottom') p.push(it.length === 'short' ? 'shorts' : 'full-length pants');
  if (it.cat === 'outer' && it.length === 'long') p.push('long coat length');
  if (it.pattern === 'pattern') p.push('patterned');
  return p.join(', ');
}
async function pickImage(j) {
  const part = candParts(j).find(p => p.inlineData || p.inline_data);
  if (part) { const d = part.inlineData || part.inline_data; return compressDataUrl(`data:${d.mimeType || d.mime_type || 'image/png'};base64,${d.data}`); }
  const br = j && j.promptFeedback && j.promptFeedback.blockReason, fr = j && j.candidates && j.candidates[0] && j.candidates[0].finishReason, tx = candParts(j).map(p => p.text || '').join(' ').trim();
  throw new Error(br ? `요청이 차단됐어요(${br}). 다른 사진이나 옷으로 시도해보세요.` : `이미지가 만들어지지 않았어요${fr ? ` (${fr})` : ''}.${tx ? ' 모델 응답: ' + tx.slice(0, 160) : ''}`);
}
function needMe() { if (!S.me) { S.tab = 'me'; render(); return true; } return false; }
function curOutfit() { const o = S.lastOuts && (S.lastOuts[S.sel] || S.lastOuts[0]); return o ? o.o : null; }
function openGen() { const o = curOutfit(); if (!o || needMe()) return; S.gen = { o, busy: false, err: '', img: null, saved: false }; S.m2 = 'gen'; renderM2(); }
async function runGen() {
  const g = S.gen; if (!g || g.busy) return;
  if (!S.cfg.key) { S.m2 = 'settings'; renderM2(); return; }
  g.busy = true; g.err = ''; renderM2();
  try {
    const parts = [{ inlineData: dataUrlParts(baseUrl()) }], lines = []; let n = 2;
    for (const [k, label, it] of outfitItems(g.o)) {
      const d = itemDesc(it);
      if (it.photo) { parts.push({ inlineData: dataUrlParts(it.photo) }); lines.push(`- ${label} (reference photo = image ${n++}): ${d}`); } else lines.push(`- ${label} (no photo, follow this description): ${d}`);
    }
    parts.push({ text: `You are a virtual try-on photo editor. Image 1 is a full-body photo of a real person. Edit image 1 so that this exact same person is wearing the following outfit:\n${lines.join('\n')}\n\nRules: keep the person's face, hairstyle, skin tone, body shape, pose, background, lighting and camera framing exactly as in image 1. Change only the clothes and shoes. Each garment must match its reference photo (color, pattern, material, sleeve and length). Put the outerwear over the top. Make the fit realistic with natural fabric folds. Output exactly one photo with the same framing as image 1, with no text, no collage and no borders.` });
    const j = await gReq(`models/${encodeURIComponent(iModel())}:generateContent`, { method: 'POST', body: { contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } } });
    g.img = await pickImage(j); g.saved = false;
  } catch (e) { g.err = errMsg(e); }
  g.busy = false; if (S.m2 === 'gen') renderM2();
}
const titleOf = o => outfitItems(o).map(x => x[2].name).join(' · ').slice(0, 60);

/* --- 헤어 --- */
function openHair() { if (needMe()) return; S.hair = S.hair || { busy: false, err: '', img: null, style: '', color: HAIR_COLORS[0], rec: null, recBusy: false, saved: false }; S.hair.err = ''; S.m2 = 'hair'; renderM2(); }
async function runHair() {
  const x = S.hair; if (!x || x.busy) return;
  const st = ($('#h_style') ? $('#h_style').value : x.style).trim(), col = $('#h_color') ? $('#h_color').value : x.color; x.style = st; x.color = col;
  if (!st) { x.err = '원하는 헤어스타일을 고르거나 입력해주세요.'; renderM2(); return; }
  if (!S.cfg.key) { S.m2 = 'settings'; renderM2(); return; }
  x.busy = true; x.err = ''; renderM2();
  try {
    const colorTxt = col === HAIR_COLORS[0] ? 'Keep the current hair color.' : `Hair color: ${col}.`;
    const j = await gReq(`models/${encodeURIComponent(iModel())}:generateContent`, { method: 'POST', body: { contents: [{ role: 'user', parts: [{ inlineData: dataUrlParts(S.me.photo) }, { text: `Edit this photo: change only the person's hairstyle to "${st}" (Korean hairstyle name). ${colorTxt} Keep the face identity, expression, skin tone, clothes, body, pose, background, lighting and framing exactly the same. Natural hairline and realistic hair texture. Output exactly one photo with the same framing, no text, no collage.` }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } } });
    x.img = await pickImage(j); x.saved = false;
  } catch (e) { x.err = errMsg(e); }
  x.busy = false; if (S.m2 === 'hair') renderM2();
}
async function aiHairRec() {
  const x = S.hair; if (!x || x.recBusy) return;
  if (!S.sample) { S.m2 = 'settings'; renderM2(); return; }
  x.recBusy = true; x.err = ''; renderM2();
  try {
    const blob = dataUrlToBlob(S.me.photo);
    const v = await S.sample.json('이 사진 속 사람에게 어울릴 만한 헤어스타일을 추천하세요. 얼굴형은 사진으로 보이는 범위에서 추정한 의견일 뿐이며, 확신이 없으면 그렇게 표현하세요. JSON만 출력: {"faceShape":"추정 얼굴형 한 줄(의견임을 드러내는 표현)","styles":[{"name":"한국에서 통용되는 헤어스타일 이름","why":"이유 한 문장"}]} (styles는 3개)', { images: [blob], cache: false });
    x.rec = { faceShape: String(v.faceShape || '').slice(0, 80), styles: (v.styles || []).slice(0, 3).map(s => ({ name: String(s.name || '').slice(0, 20), why: String(s.why || '').slice(0, 80) })).filter(s => s.name) };
  } catch (e) { x.err = errMsg(e); }
  x.recBusy = false; if (S.m2 === 'hair') renderM2();
}

/* --- 수동 패키지(B) --- */
async function buildSheet(o) {
  const W = 1200, H = 900, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  const fit = (im, x, y, w, h) => { const k = Math.min(w / im.naturalWidth, h / im.naturalHeight), dw = im.naturalWidth * k, dh = im.naturalHeight * k; g.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); };
  const base = await getImg(baseUrl()); fit(base, 10, 10, 600, 850);
  g.fillStyle = '#111'; g.font = 'bold 26px sans-serif'; g.fillText('PERSON (나)', 20, 885);
  const items = outfitItems(o);
  for (let i = 0; i < items.length; i++) {
    const [k, label, it] = items[i], x = 640 + (i % 2) * 280, y = 10 + Math.floor(i / 2) * 440, w = 270, h = 380;
    g.fillStyle = '#f4f1ea'; g.fillRect(x, y, w, h);
    if (it.photo) { try { fit(await getImg(it.photo), x + 5, y + 5, w - 10, h - 10); } catch (e) { } } else { g.fillStyle = it.color; g.fillRect(x + 30, y + 40, w - 60, h - 80); }
    g.fillStyle = '#111'; g.font = 'bold 22px sans-serif'; g.fillText(`${label}`, x + 4, y + h + 30); g.font = '18px sans-serif'; g.fillText(it.name.slice(0, 16), x + 4, y + h + 54);
  }
  return c.toDataURL('image/jpeg', 0.9);
}
function manualPrompt(o) {
  const items = outfitItems(o), cell = ['왼쪽 위', '오른쪽 위', '왼쪽 아래', '오른쪽 아래'];
  return `첨부한 이미지는 한 장짜리 시트예요. 왼쪽의 큰 사진은 실제 사람(나)이고, 오른쪽의 네모 칸들은 이 사람에게 입힐 옷 사진이에요.\n` +
    items.map(([k, l, it], i) => `- 오른쪽 칸 ${i + 1}(${cell[i]}): ${l} - ${it.name}${it.photo ? '' : '(사진 대신 색 칸. 색: ' + (it.colorName || it.color) + ')'}`).join('\n') +
    `\n\n왼쪽 사람의 얼굴, 헤어스타일, 체형, 포즈, 배경, 조명은 그대로 두고, 옷과 신발만 위 옷들로 바꿔 입은 모습의 전신 사진 한 장을 만들어 주세요. 겉옷은 상의 위에 걸쳐 주세요. 옷의 색, 무늬, 소매·기장은 참고 사진과 똑같이, 핏과 주름은 자연스럽게 해주세요. 시트의 흰 배경·글씨·칸 나누기는 결과에 넣지 마세요.`;
}
async function openManual() {
  const o = (S.gen && S.gen.o) || curOutfit(); if (!o || needMe()) return;
  S.manual = { o, sheet: null, prompt: manualPrompt(o), msg: '' }; S.m2 = 'manual'; renderM2();
  try { S.manual.sheet = await buildSheet(o); } catch (e) { S.manual.msg = '시트를 만들지 못했어요.'; }
  if (S.m2 === 'manual') renderM2();
}

/* --- 이벤트 --- */
Object.assign(H, {
  openSettings() { S.m2 = 'settings'; S.setMsg = ''; renderM2(); },
  closeM2() { S.m2 = null; S.delArm2 = false; renderM2(); },
  saveKey() { const k = ($('#s_key').value || '').trim(); if (!k) { S.setMsg = '키를 입력해주세요.'; renderM2(); return; } S.cfg.key = k; setSample(); saveCfg(); loadModels(); },
  delKey() { S.cfg = { key: '', textModel: '', imageModel: '', models: null }; setSample(); saveCfg(); S.setMsg = '키를 삭제했어요.'; renderM2(); if (S.tab === 'closet') renderCloset(); },
  openGen() { openGen(); }, runGen() { runGen(); },
  saveGen() { const g = S.gen; if (g && g.img && !g.saved) { g.saved = true; addGallery(g.img, titleOf(g.o), 'outfit').then(() => { renderM2(); if (S.tab === 'me') renderMe(); }); renderM2(); } },
  openHair() { openHair(); }, runHair() { runHair(); }, aiHairRec() { aiHairRec(); },
  hairPick(t) { if (S.hair) { S.hair.style = t.dataset.v; renderM2(); } },
  useHair() { const x = S.hair; if (x && x.img) { S.me.hair = x.img; S.me.useHair = true; saveMe(); S.m2 = null; renderM2(); if (S.tab === 'me') renderMe(); else renderResults(); } },
  saveHair() { const x = S.hair; if (x && x.img && !x.saved) { x.saved = true; addGallery(x.img, `헤어: ${x.style}`, 'hair').then(() => { renderM2(); if (S.tab === 'me') renderMe(); }); renderM2(); } },
  useBase(t) { S.me.useHair = t.dataset.v === '1'; saveMe(); renderMe(); },
  openManual() { openManual(); },
  copyPrompt() { const ta = $('#mprompt'); if (!ta) return; ta.select(); let ok = false; try { if (navigator.clipboard) { navigator.clipboard.writeText(ta.value); ok = true; } } catch (e) { } try { if (!ok) ok = document.execCommand('copy'); } catch (e) { } S.manual.msg = ok ? '✓ 프롬프트를 복사했어요.' : '복사가 막혔어요. 위 글상자를 길게 눌러 직접 복사해주세요.'; renderM2(); },
  viewG(t) { S.viewId = t.dataset.v; S.delArm2 = false; S.m2 = 'viewG'; renderM2(); },
  delG() { if (!S.delArm2) { S.delArm2 = true; renderM2(); return; } S.gallery = S.gallery.filter(x => x.id !== S.viewId); saveGallery(); S.m2 = null; S.delArm2 = false; renderM2(); if (S.tab === 'me') renderMe(); },
});
document.addEventListener('change', async ev => {
  const t = ev.target, i = t.dataset && t.dataset.i;
  if (i === 's_tm') { S.cfg.textModel = t.value; saveCfg(); setSample(); }
  if (i === 's_im') { S.cfg.imageModel = t.value; saveCfg(); }
  if (t.id === 'fres' && t.files && t.files[0] && S.manual) {
    const f = t.files[0]; t.value = '';
    try { const { dataUrl } = await prepPhotoBig(f); await addGallery(dataUrl, titleOf(S.manual.o), 'outfit'); S.manual.msg = '✓ 기록에 저장했어요.'; if (S.tab === 'me') renderMe(); } catch (e) { S.manual.msg = '이미지를 열 수 없어요.'; }
    renderM2();
  }
});
async function prepPhotoBig(file) { const { im, u } = await loadImg(file), sc = Math.min(1, 900 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); return { dataUrl: c.toDataURL('image/jpeg', 0.88) }; }
document.addEventListener('click', ev => { if (ev.target.id === 'modal2') H.closeM2(); });
