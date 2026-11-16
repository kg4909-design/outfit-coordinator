/* ===== 쇼핑 추천: 내 옷장 부족분 + AI 추천 → 검색 링크 → 내 모습에 입혀보기 ===== */
Object.assign(S, { wish: [], shopRec: null, shopBusy: false, shopErr: '', found: {}, shopTarget: null });
const BRANDS = ['유니클로', '지오다노', '지오지아', '지이크'];
const q2 = it => `${it.colorName || ''} ${it.name}`.trim();
const gUrl = (b, it) => 'https://www.google.com/search?q=' + encodeURIComponent(`${b} 남성 ${q2(it)} 구매`);
const nUrl = it => 'https://search.shopping.naver.com/search/all?query=' + encodeURIComponent('남성 ' + q2(it));
async function saveWish() { await DB.set('wish', S.wish); }
function ruleRecs() {
  if (S.items.length < 3) return [];
  try { return recommendItems(S.items).slice(0, 5).map(r => ({ ...r.item, id: 'r' + r.item.name, gain: r.gain, src: '옷장 진단' })); } catch (e) { return []; }
}
function allCands() { return [...(S.shopRec || []), ...ruleRecs(), ...S.wish]; }
function findCand(id) { return allCands().find(x => x.id === id); }
const CAT_KO = { top: '상의', bottom: '하의', outer: '겉옷', shoes: '신발' };

function candCard(it, wish) {
  const f = S.found[it.id], links = (f && f.links) || [];
  return `<section class="card">
    <div class="row gap">${it.photo ? `<img class="hth" src="${it.photo}" alt="">` : `<span class="th sw" style="width:56px;height:56px;background:${esc(it.color || '#ddd')}"></span>`}
      <div><b>${esc(it.name)}</b> <span class="tag">${CAT_KO[it.cat] || ''}</span><div class="mute sm">${esc(it.why || '')}</div>${it.gain ? `<div class="mute xs">사면 부족한 날씨·일정 상황에서 점수가 좋아져요(개선 합계 +${it.gain.toFixed(0)})</div>` : ''}</div></div>
    <div class="row gap wrap"><button class="btn pri" data-a="tryCand" data-v="${esc(it.id)}">👤 내 모습에 입혀보기</button><button class="btn" data-a="photoCand" data-v="${esc(it.id)}">🖼 상품 사진 올려서 정확히</button></div>
    <div class="mute xs">구매 링크(검색 결과로 이동해요)</div>
    <div class="chips">${BRANDS.map(b => `<a class="chip" href="${gUrl(b, it)}" target="_blank" rel="noopener noreferrer">${b} ↗</a>`).join('')}<a class="chip" href="${nUrl(it)}" target="_blank" rel="noopener noreferrer">네이버쇼핑 ↗</a></div>
    <div class="row gap wrap"><button class="btn" data-a="findReal" data-v="${esc(it.id)}" ${f && f.busy ? 'disabled' : ''}>${f && f.busy ? '검색 중…' : '🔎 AI로 실제 상품 찾기'}</button>${wish ? `<button class="btn" data-a="delWish" data-v="${esc(it.id)}">후보 삭제</button>` : `<button class="btn" data-a="addWish" data-v="${esc(it.id)}">후보에 담기</button>`}</div>
    ${f && f.err ? `<p class="warnT sm">⚠️ ${esc(f.err)}</p>` : ''}
    ${f && f.text ? `<div class="msgs ok"><div style="white-space:pre-wrap">${esc(f.text)}</div></div>${links.length ? `<div class="mute xs">검색 출처</div><div class="chips">${links.map(l => `<a class="chip" href="${esc(l.uri)}" target="_blank" rel="noopener noreferrer">${esc((l.title || '링크').slice(0, 24))} ↗</a>`).join('')}</div>` : ''}<p class="mute xs">AI 검색 결과예요. 가격·재고·사이즈는 판매 페이지에서 꼭 확인하세요.</p>` : ''}
  </section>`;
}
function renderShop() {
  const rec = [...ruleRecs(), ...(S.shopRec || [])];
  $('#view').innerHTML = `<header class="hd"><div><div class="eyebrow">사면 좋은 옷 · 입혀보고 구매</div><h1>쇼핑</h1></div></header>
  <section class="card"><b>나에게 어울릴 옷 찾기</b>
    <p class="mute sm">① 옷장에서 부족한 옷(진단 결과) 또는 AI 추천을 고르고 → ② 내 사진에 입혀보고 → ③ 링크로 구매 페이지로 이동해요.</p>
    <div class="row gap wrap"><button class="btn pri" data-a="aiShopRec" ${S.shopBusy ? 'disabled' : ''}>${S.shopBusy ? '고르는 중…' : '✨ AI에게 어울리는 옷 추천받기'}</button></div>
    ${S.sample ? `<p class="mute xs">${S.me ? '내 사진·' : ''}옷장 정보와 오늘 날씨가 Google(Gemini)로 전송돼요.</p>` : '<p class="mute xs">AI 추천은 ⚙️에서 Gemini API 키를 넣으면 쓸 수 있어요. 아래 진단 기반 추천은 키 없이 보여요.</p>'}
    ${S.shopErr ? `<p class="warnT sm">⚠️ ${esc(S.shopErr)}</p>` : ''}
    <p class="mute xs">브랜드 공식몰의 상품 목록을 앱이 직접 가져올 수는 없어요(외부 사이트가 막혀 있음). 대신 브랜드별 검색 링크와 AI 웹검색을 제공해요. 제휴·광고 링크는 없어요.</p></section>
  ${rec.length ? rec.map(r => candCard(r, false)).join('') : (S.items.length < 3 ? '<section class="card empty"><div class="big">🛍</div><b>옷을 3벌 이상 등록하면 부족한 옷을 골라드려요</b></section>' : '')}
  ${S.wish.length ? `<h2 class="sec">내 구매 후보 (${S.wish.length})</h2>${S.wish.map(r => candCard(r, true)).join('')}` : ''}
  <input type="file" id="fshop" accept="image/*" hidden>`;
}
async function aiShopRec() {
  if (S.shopBusy) return;
  if (!S.sample) { S.m2 = 'settings'; renderM2(); return; }
  S.shopBusy = true; S.shopErr = ''; renderShop();
  try {
    const closet = S.items.map(i => ({ 종류: CAT_KO[i.cat], 이름: i.name, 색: i.colorName, 두께: i.warmth }));
    const opts = { cache: false }; if (S.me) opts.images = [dataUrlToBlob(S.me.photo)];
    const p = `당신은 30대 남성의 퍼스널 스타일리스트입니다. ${S.me ? '첨부 사진 속 사람의 체형·피부톤·전체 분위기에 어울리고, ' : ''}아래 옷장에 없는 부분을 채워 주며 한국에서 유니클로·지오다노·지오지아·지이크 같은 브랜드에서 구하기 쉬운 일반적인 아이템 5개를 추천하세요. 오늘 날씨는 ${S.w.min}~${S.w.max}도, 일정은 '${S.occ}'. 사진으로 보이는 범위의 의견일 뿐이며 얼굴·신체를 평가하지 말고, 옷만 말하세요. 특정 상품 모델명·가격은 지어내지 마세요.\n내 옷장: ${JSON.stringify(closet)}\nJSON만 출력: {"items":[{"cat":"top|bottom|outer|shoes","name":"아이템 이름","colorName":"색 이름","color":"#rrggbb","warmth":1-5,"formality":0-3,"sleeve":"short|long|null","length":"short|long|null","why":"이유 한 문장"}]}`;
    const v = await S.sample.json(p, opts), arr = Array.isArray(v) ? v : (v && v.items) || [];
    S.shopRec = arr.slice(0, 5).map(r => ({ ...normItem(r), id: 'a' + uid(), why: String(r.why || '').slice(0, 90), src: 'AI' }));
    if (!S.shopRec.length) S.shopErr = '추천 결과가 비어 있어요. 다시 시도해주세요.';
  } catch (e) { S.shopErr = errMsg(e); }
  S.shopBusy = false; if (S.tab === 'shop') renderShop();
}
async function findReal(id) {
  const it = findCand(id); if (!it) return; const f = S.found[id] = { busy: true, err: '', text: '', links: [] }; renderShop();
  if (!S.cfg.key) { f.busy = false; f.err = '⚙️에서 Gemini API 키를 먼저 넣어주세요.'; return renderShop(); }
  try {
    const text = `한국에서 구매할 수 있는 ${BRANDS.join(', ')} 중에서, 남성용 "${q2(it)}"과(와) 비슷한 실제 판매 상품을 웹에서 검색해 최대 4개 알려주세요. 각 줄은 "브랜드 · 상품명 · 가격(검색에서 확인된 경우만)" 형식으로, 확인되지 않은 정보는 쓰지 말고 모르면 '확인 안 됨'이라고 쓰세요. 링크는 본문에 쓰지 마세요.`;
    const j = await gReq(`models/${encodeURIComponent(tModel())}:generateContent`, { method: 'POST', body: { contents: [{ role: 'user', parts: [{ text }] }], tools: [{ google_search: {} }] } });
    f.text = candParts(j).map(p => p.text || '').join('').trim().slice(0, 900);
    const ch = (j.candidates && j.candidates[0] && j.candidates[0].groundingMetadata && j.candidates[0].groundingMetadata.groundingChunks) || [], seen = new Set();
    f.links = ch.map(c => c.web).filter(w => w && w.uri && !seen.has(w.uri) && seen.add(w.uri)).slice(0, 6);
    if (!f.text) f.err = '검색 결과가 비어 있어요. 위의 브랜드 검색 링크를 이용해주세요.';
  } catch (e) { f.err = errMsg(e); }
  f.busy = false; if (S.tab === 'shop') renderShop();
}
function tryCand(id) {
  const c = findCand(id); if (!c || needMe()) return;
  const base = curOutfit() || previewOutfit(), item = { ...c, photo: c.photo || null, id: c.id };
  S.gen = { o: { ...base, [c.cat]: item }, busy: false, err: '', img: null, saved: false }; S.m2 = 'gen'; renderM2();
}
Object.assign(H, {
  tryCand(t) { tryCand(t.dataset.v); }, findReal(t) { findReal(t.dataset.v); }, aiShopRec() { aiShopRec(); },
  photoCand(t) { S.shopTarget = t.dataset.v; $('#fshop').click(); },
  addWish(t) { const c = findCand(t.dataset.v); if (c && !S.wish.some(w => w.id === c.id)) { S.wish.push({ ...c }); saveWish(); renderShop(); } },
  delWish(t) { S.wish = S.wish.filter(w => w.id !== t.dataset.v); saveWish(); renderShop(); },
});
document.addEventListener('change', async ev => {
  if (ev.target.id !== 'fshop') return;
  const f = ev.target.files && ev.target.files[0]; ev.target.value = ''; if (!f || !S.shopTarget) return;
  const c = findCand(S.shopTarget); if (!c) return;
  try {
    const { dataUrl } = await prepPhotoBig(f); let w = S.wish.find(x => x.id === c.id);
    if (!w) { w = { ...c }; S.wish.push(w); } w.photo = dataUrl; await saveWish(); renderShop(); tryCand(c.id);
  } catch (e) { S.shopErr = '사진을 열 수 없어요.'; renderShop(); }
});
