/***********************
 * 프로덕션용 app.js
 * - 해시 제거: setTab()만 사용
 * - 업로드: POST /api/upload → GET /api/result/{id}
 * - 마크다운 렌더: marked.parse() + DOMPurify 사용
 * - documentType 기준 자동 분류/선택/펼침 (별칭 매핑 없음)
 * - 멀티 문서 질의: POST /api/ask { docIds[], question } → { markdown, metrics? }
 ***********************/

/* ========= 상수 ========= */
const CATS = [
    { documentType: 'HR_INFO',        name: '인사 정보 (암호화 필요)' },
    { documentType: 'PERSONAL_INFO',  name: '개인 정보 (PII 무조건 암호화)' },
    { documentType: 'BUSINESS_INFO',  name: '사업 관련 정보 (핵심 내용 암호화)' },
    { documentType: 'TECH_INFO',      name: '기술 정보 (부분 암호화)' },
    { documentType: 'PUBLIC_INFO',    name: '공개 정보 (암호화 불필요)' }
];
const CAT_KEYS = CATS.map(c => c.documentType);
const DEFAULT_CATEGORY = 'PUBLIC_INFO';

/* ========= 전역 상태 ========= */
const state = {
    lockedByFile: false,
    masked: '',
    docs: {}, // doc_id -> { title, categories:string[], preview? }
    byCategory: Object.fromEntries(CAT_KEYS.map(k => [k, []])),
    selectedDocIds: new Set(),
    collapsedCats: Object.fromEntries(CAT_KEYS.map(k => [k, false])) // false=접힘(기본)
};

/* ========= 유틸 ========= */
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const toast = (m, ms=1600)=>{ const t=$('#toast'); t.textContent=m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),ms); };

/* ========= 카테고리 키 정규화(별칭 없음) ========= */
function normalizeCategoryKey(raw){
    const s = (raw ?? '').toString().trim().toUpperCase();
    return CAT_KEYS.includes(s) ? s : DEFAULT_CATEGORY;
}

/* ========= 탭 ========= */
function setTab(key){
    const t1=$('#tab-transform'), t2=$('#tab-search');
    const p1=$('#page-transform'), p2=$('#page-search');
    const isSearch = key==='search';

    t1.classList.toggle('active', !isSearch);
    t2.classList.toggle('active',  isSearch);
    t1.setAttribute('aria-selected', String(!isSearch));
    t2.setAttribute('aria-selected', String(isSearch));

    p1.hidden = isSearch;
    p2.hidden = !isSearch;

    if (isSearch) { renderCategories(); updateSelectedInfo(); }
}
$('#tab-transform').addEventListener('click', (e)=>{ e.preventDefault(); setTab('transform'); });
$('#tab-search').addEventListener('click',    (e)=>{ e.preventDefault(); setTab('search'); });

/* ========= 변환 탭(입력/잠금) ========= */
function setLock(readonly, showBadge){
    const ta = $('#src');
    ta.readOnly = readonly;
    ta.classList.toggle('locked', readonly);
    const badge = $('#lockBadge'); if (badge) badge.hidden = !showBadge;
}
function updateTransformEnabled(){
    const hasText = !!($('#src').value || '').trim();
    const hasFile = !!($('#file').files?.length);
    $('#btnTransform').disabled = !(hasText || hasFile);
}
$('#src').addEventListener('input', ()=>{
    if(!$('#file').files?.length && state.lockedByFile){
        state.lockedByFile=false; setLock(false,false);
    }
    updateTransformEnabled();
});
$('#file').addEventListener('change', async (e)=>{
    const f = e.target.files?.[0];
    if(!f){ state.lockedByFile=false; setLock(false,false); updateTransformEnabled(); return; }
    const ext=(f.name.split('.').pop()||'').toLowerCase();
    let text='';
    try{
        if(ext==='docx'){
            const buf=await f.arrayBuffer();
            const { value } = await window.mammoth.extractRawText({ arrayBuffer:buf });
            text=value||'';
        }else if(ext==='pdf'){
            const buf=await f.arrayBuffer();
            const pdf = await window['pdfjsLib'].getDocument({ data:buf, worker:null }).promise;
            let all='';
            for(let p=1;p<=pdf.numPages;p++){
                const page=await pdf.getPage(p);
                const c=await page.getTextContent();
                all+=c.items.map(i=>i.str).join(' ')+'\n';
            }
            text=all.trim();
        }else if(['txt','md','json','csv'].includes(ext)){
            text=await f.text();
        }
        $('#src').value = text;
        state.lockedByFile = true; setLock(true,true);
        $('#status').textContent = text ? `${f.name}에서 불러왔습니다.` : `${f.name}: 미리보기 불가/내용 없음`;
    }catch(err){
        console.error(err);
        $('#status').textContent='파일을 읽는 중 오류가 발생했습니다.';
    }finally{
        updateTransformEnabled();
    }
});
$('#btnResetInput').addEventListener('click', ()=>{
    $('#file').value=''; $('#src').value=''; state.lockedByFile=false; setLock(false,false);
    $('#status').textContent='입력을 초기화했습니다.'; updateTransformEnabled();
});
updateTransformEnabled();

/* ========= 업로드/결과 헬퍼 ========= */
// 업로드 → UUID 문자열 반환 (text도 multipart로 감싸서 전송)
async function uploadFileOrText({ file, text }) {
    const fd = new FormData();
    if (file) {
        fd.append('file', file);
    } else {
        const blob = new Blob([text], { type: 'text/plain' });
        const pseudoFile = new File([blob], 'pasted.txt', { type: 'text/plain' });
        fd.append('file', pseudoFile);
    }

    const up = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' });
    if (!up.ok) throw new Error(`upload 실패: ${up.status}`);

    const data = await up.json();   // ✅ 서버 응답 { id: "..." }
    return data.id;                 // ✅ UUID 문자열만 반환
}

// UUID로 마스킹 결과 조회 → markdown (String)
// ✅ UUID로 마스킹 결과 조회 (백엔드 JSON 응답 기반)
async function fetchMaskedById(docId) {
    const rs = await fetch(`/api/result/${docId}`, { credentials: 'include' });
    if (!rs.ok) throw new Error(`result 실패: ${rs.status}`);

    let documentType = 'HR_INFO'; // ✅ 기본값 (없을 경우 대비)
    let markdown = '';

    try {
        const data = await rs.json(); // 백엔드 JSON 응답 시도
        documentType = data.documentType || 'HR_INFO';
        markdown = data.markdown || '';
        console.log('📄 DB 응답 기반 문서 유형:', documentType);
    } catch (err) {
        console.warn('⚠️ JSON 파싱 실패 — fallback to text:', err);
        // 혹시 백엔드가 text만 반환한 경우 대비
        const text = await rs.text();
        markdown = text;
        // "Category: ..." 라인에서 타입 추출 시도
        const match = text.match(/^Category:\s*(\w+)/im);
        if (match && match[1]) {
            documentType = match[1].trim().toUpperCase();
        }
    }

    return { documentType, markdown };
}



// ✅ Markdown 문자열을 #result에 안전하게 렌더링
function renderMarkdownToResult(md, docType) {
    const el = document.getElementById('result');
    if (!el) return;

    // 1️⃣ 기본 처리
    let markdown = typeof md === 'string' ? md.trim() : '';
    if (!markdown) {
        el.innerHTML = '<p style="color:#777;">(결과 없음)</p>';
        state.masked = '';
        return;
    }

    // ✅ (핵심) 이스케이프된 줄바꿈(\n) 복원
    markdown = markdown.replace(/\\n/g, '\n');

    // 2️⃣ "Category: ..." 라인 제거
    markdown = markdown.replace(/^Category:\s*\w+\s*/im, '').trim();

    // 3️⃣ 문서 유형 헤더 구성
    const typeLabel = CATS.find(c => c.documentType === docType)?.name || docType || '알 수 없음';
    const header = `> **문서 유형:** ${typeLabel}\n\n`;

    // 4️⃣ Markdown → HTML 변환
    let html = '';
    try {
        const fullMarkdown = header + markdown;
        if (window.marked && typeof marked.parse === 'function') {
            // prettier rendering (br = true ensures single \n is line break)
            html = marked.parse(fullMarkdown, { breaks: true });
        } else {
            html = fullMarkdown.replace(/\n/g, '<br>');
        }
    } catch (err) {
        console.error('⚠️ Markdown 파싱 오류:', err);
        html = markdown.replace(/\n/g, '<br>');
    }

    // 5️⃣ DOMPurify로 안전하게 정화
    if (window.DOMPurify && typeof DOMPurify.sanitize === 'function') {
        html = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
    }

    // 6️⃣ 결과 표시
    el.innerHTML = `
      <div class="md-report viewer md">
        ${html}
      </div>
    `;

    state.masked = markdown;
}



/* ========= 자동 펼침/선택/가시화 ========= */
function expandCategory(catKey){ state.collapsedCats[catKey] = true; }
function selectDoc(docId){ state.selectedDocIds = new Set([docId]); }
function revealDocInList(docId, catKey){
    requestAnimationFrame(()=>{
        const cb = document.querySelector(`#list-${catKey} input[type="checkbox"][data-id="${docId}"]`);
        if(cb){
            cb.checked = true;
            cb.focus({ preventScroll:true });
            cb.scrollIntoView({ block:'nearest', behavior:'smooth' });
            const li = cb.closest('li');
            if(li){ li.classList.add('flash'); setTimeout(()=>li.classList.remove('flash'), 1200); }
        }
        updateSelectedInfo();
    });
}
/* ========= 상태 반영: 문서 저장/분류 ========= */
function upsertDoc({doc_id, title, masked_text, categories}){
    if(!doc_id) return;

    const normCats = (categories||[]).map(normalizeCategoryKey);
    const finalCats = normCats.length ? normCats : [DEFAULT_CATEGORY];

    state.docs[doc_id] = {
        title: title || doc_id,
        categories: finalCats,
        preview: (masked_text||'').slice(0,120)
    };

    // 기존 분류에서 제거
    for(const k of Object.keys(state.byCategory)) {
        state.byCategory[k] = state.byCategory[k].filter(id=>id!==doc_id);
    }
    // 새 분류에 추가
    finalCats.forEach(k=>{
        if(!state.byCategory[k]) state.byCategory[k]=[];
        if(!state.byCategory[k].includes(doc_id)) state.byCategory[k].push(doc_id);
    });
}

/* ========= 좌측 카테고리/문서 렌더링(아코디언) ========= */
function renderCategories(){
    const root = $('#cats'); root.innerHTML='';
    CATS.forEach(({ documentType:key, name })=>{
        const sec  = document.createElement('section');
        sec.className='cat-sec';
        sec.id = `sec-${key}`;
        sec.setAttribute('aria-expanded', String(!!state.collapsedCats[key])); // true=펼침

        // 헤더
        const head = document.createElement('div'); head.className='cat-head';
        const btn  = document.createElement('button');
        btn.type='button'; btn.className='cat-toggle'; btn.setAttribute('aria-controls', `list-${key}`);
        btn.setAttribute('aria-expanded', String(!!state.collapsedCats[key]));
        btn.innerHTML = '<span class="chev">▶</span>';

        const ttl  = document.createElement('div'); ttl.className='cat-title'; ttl.textContent = name;
        const cnt  = document.createElement('div'); cnt.className='cat-count'; cnt.id=`count-${key}`;

        head.appendChild(btn); head.appendChild(ttl); head.appendChild(cnt);

        // 리스트
        const list = document.createElement('ul');
        list.className='doc-list'; list.id=`list-${key}`; list.setAttribute('role','group');

        // 토글
        const toggle = ()=>{
            state.collapsedCats[key] = !state.collapsedCats[key];
            sec.setAttribute('aria-expanded', String(state.collapsedCats[key]));
            btn.setAttribute('aria-expanded', String(state.collapsedCats[key]));
        };
        head.addEventListener('click', (e)=>{ if(!(e.target instanceof HTMLInputElement)) toggle(); });
        btn.addEventListener('click', (e)=>{ e.stopPropagation(); toggle(); });

        sec.appendChild(head); sec.appendChild(list);
        root.appendChild(sec);

        renderDocListForCategory(key);
    });
    updateSelectedInfo();
}

function renderDocListForCategory(catKey){
    const listEl = document.getElementById(`list-${catKey}`);
    listEl.innerHTML='';
    const ids = state.byCategory[catKey] || [];
    const countEl = document.getElementById(`count-${catKey}`);
    if (countEl) countEl.textContent = `${ids.length}개`;

    ids.forEach(id=>{
        const li = document.createElement('li'); li.className='doc-item';
        const cb = document.createElement('input'); cb.type='checkbox'; cb.dataset.id=id;
        cb.checked = state.selectedDocIds.has(id);
        cb.addEventListener('change', onSelectDoc);
        const title = document.createElement('span'); title.className='title';
        title.textContent = state.docs[id]?.title || id;

        li.appendChild(cb); li.appendChild(title);
        listEl.appendChild(li);
    });
}

/* ========= 선택/요약 ========= */
function onSelectDoc(e){
    const id = e.target.dataset.id;
    if(e.target.checked) state.selectedDocIds.add(id);
    else state.selectedDocIds.delete(id);
    // 동일 ID 체크박스 동기화
    $$(".doc-item input[type='checkbox'][data-id='"+id+"']").forEach(x=>{ if(x!==e.target) x.checked=e.target.checked; });
    updateSelectedInfo();
}
function updateSelectedInfo(){
    $('#selectedInfo').textContent = `선택된 문서: ${state.selectedDocIds.size}개`;
}

/* ========= 복사 ========= */
$('#btnCopy').addEventListener('click', ()=>{
    const t = state.masked || '';
    if(!t){ toast('복사할 내용이 없습니다.'); return; }
    navigator.clipboard.writeText(t); toast('결과(마크다운)를 복사했습니다.');
});

/* ========= 챗봇(선택 문서 기반, 멀티 문서 /ask) ========= */
const historyEl=$('#chatHistory');

function renderInlineMarkdown(md){
    const html = window.marked?.parse ? marked.parse(md || '') : (md || '');
    return window.DOMPurify ? DOMPurify.sanitize(html) : html;
}
function pushText(text, who='bot'){
    const b=document.createElement('div'); b.className=`bubble ${who==='me'?'me':'bot'}`;
    b.textContent = text;
    const row=document.createElement('div'); row.style.display='flex'; row.style.justifyContent=who==='me'?'flex-end':'flex-start';
    row.appendChild(b); historyEl.appendChild(row); historyEl.scrollTop=historyEl.scrollHeight;
}
function pushHTML(html, who='bot'){
    const b=document.createElement('div'); b.className=`bubble ${who==='me'?'me':'bot'}`;
    b.innerHTML = html;
    const row=document.createElement('div'); row.style.display='flex'; row.style.justifyContent=who==='me'?'flex-end':'flex-start';
    row.appendChild(b); historyEl.appendChild(row); historyEl.scrollTop=historyEl.scrollHeight;
}

/* ===== 메타바 유틸 ===== */
function topCategoryName(categoryShare){
    if (!categoryShare) return 'N/A';
    let bestKey=null, bestVal=-1;
    for(const [k,v] of Object.entries(categoryShare)) if(v>bestVal){bestKey=k;bestVal=v;}
    return CATS.find(c=>c.documentType===bestKey)?.name || bestKey || 'N/A';
}
function formatLatency(ms){ return ms==null ? '' : (ms/1000).toFixed(1) + '초'; }
function renderMetaBar(metrics){
    if (!metrics) return '';
    const rel  = metrics.relevance!=null ? Math.round(metrics.relevance*100) : null;
    const used = Array.isArray(metrics.usedDocs) ? metrics.usedDocs.length : null;
    const topC = topCategoryName(metrics.categoryShare);
    const lat  = formatLatency(metrics.latencyMs);

    const parts = [];
    if (rel!=null) parts.push(`연관도 ${rel}%`);
    if (used!=null) parts.push(`사용 문서 ${used}개`);
    if (topC)       parts.push(`주 카테고리 ${topC}`);
    if (lat)        parts.push(lat);

    return `<div class="metabar">${parts.join(' · ')}</div>`;
}
function pushBotMarkdownWithMeta(markdown, metrics) {
    // 1️⃣ Markdown 문자열 정리
    let htmlMd = '';
    try {
        if (window.marked && typeof marked.parse === 'function') {
            htmlMd = marked.parse(markdown || '', { breaks: true });
        } else {
            htmlMd = (markdown || '').replace(/\n/g, '<br>');
        }
    } catch (err) {
        console.error('⚠️ Markdown 파싱 오류:', err);
        htmlMd = (markdown || '').replace(/\n/g, '<br>');
    }

    // 2️⃣ HTML 보안 정화 (XSS 방지)
    if (window.DOMPurify && typeof DOMPurify.sanitize === 'function') {
        htmlMd = DOMPurify.sanitize(htmlMd, { USE_PROFILES: { html: true } });
    }

    // 3️⃣ 메타 정보 렌더링 (그대로 유지)
    const meta = renderMetaBar(metrics);

    // 4️⃣ 말풍선 생성
    const bubble = document.createElement('div');
    bubble.className = 'bubble bot';
    bubble.innerHTML = `${meta}<div class="viewer md">${htmlMd}</div>`;


    // 5️⃣ 채팅 히스토리에 추가
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'flex-start';
    row.appendChild(bubble);
    historyEl.appendChild(row);
    historyEl.scrollTop = historyEl.scrollHeight;
}


async function askMulti(docIds, question) {
    const params = new URLSearchParams();
    params.append('docId', docIds[0]);      // 백엔드는 하나만 받음
    params.append('question', question);

    const r = await fetch('/api/ask?' + params.toString(), {
        method: 'POST',
        credentials: 'include'
    });
    if (!r.ok) throw new Error(`/ask 실패: ${r.status}`);

    // 응답이 GenericAiResponse → markdown 문자열
    const data = await r.json(); // { markdown: "..." }
    return data;
}
/* ========= 변환 → 서버 호출 (upload→result) ========= */
$('#btnTransform').addEventListener('click', async ()=> {
    const file = $('#file').files?.[0];
    const text = ($('#src').value||'').trim();
    if (!file && !text) {
        $('#status').textContent = '입력된 문서가 없습니다.';
        return;
    }

    try {
        $('#status').textContent = '업로드/마스킹 중…';

        // 1️⃣ 업로드 후 UUID 획득
        const docId = await uploadFileOrText({ file, text });

        // 2️⃣ 결과 조회 (documentType + markdown)
        const { documentType, markdown } = await fetchMaskedById(docId);
        console.log('🧭 documentType before normalize:', documentType);

        // 3️⃣ documentType 정규화
        const normType = normalizeCategoryKey(documentType);
        console.log('✅ normalized type:', normType);
        // ✅ 4️⃣ Markdown 예쁘게 렌더링
        renderMarkdownToResult(markdown, normType);

        const typeLabel = CATS.find(c => c.documentType === normType)?.name || normType;
        $('#status').textContent = `변환 완료 (카테고리: ${typeLabel})`;

        // 5️⃣ 로컬 상태/카테고리 반영
        const title = file?.name || 'pasted.txt';
        expandCategory(normType);
        selectDoc(docId);
        upsertDoc({
            doc_id: docId,
            title,
            masked_text: markdown,
            categories: [normType]
        });
        renderCategories();
        revealDocInList(docId, normType);

        // 6️⃣ 검색 탭으로 전환
       // setTab('search');
        //toast('변환 완료! 검색 탭에서 문서를 선택해 질문하세요.');
    } catch (err) {
        console.error(err);
        $('#status').textContent = '변환 실패: ' + err.message;
        toast('변환 실패', 1800);
    }
});
/* ========= 질문하기 버튼 핸들러 ========= */
/* ========= 질문하기 폼(submit) 핸들러 ========= */
$('#chatForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const question = ($('#chatInput').value || '').trim();
    if (!question) {
        toast('질문을 입력하세요.');
        return;
    }

    if (state.selectedDocIds.size === 0) {
        toast('먼저 문서를 선택하세요.');
        return;
    }

    const docIds = Array.from(state.selectedDocIds);
    pushText(question, 'me'); // 내가 보낸 질문을 채팅창에 표시

    try {
        // 서버 호출
        const res = await askMulti(docIds, question);
        if (res.markdown) {
            pushBotMarkdownWithMeta(res.markdown, res.metrics);
        } else {
            pushText('(응답 없음)', 'bot');
        }
    } catch (err) {
        console.error('askMulti 실패:', err);
        pushText(`❌ 오류: ${err.message}`, 'bot');
    }

    $('#chatInput').value = '';
});

/* =============================
 * 🔍 예시 데이터 조회 및 렌더링
 * ============================= */
async function loadExampleData(docType) {
    const container = document.getElementById('exampleContainer');
    container.innerHTML = '<p style="color:#666;">로딩 중...</p>';

    try {
        const res = await fetch(`/api/example?type=${docType}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();

        // 1️⃣ 문자열을 JSON으로 파싱
        const data = JSON.parse(text);

        // 2️⃣ HTML 생성
        let html = '';
        for (const [fileName, items] of Object.entries(data)) {
            html += `
                <h3>📄 ${fileName}</h3>
                <table>
                    <thead>
                        <tr>
                            <th>문장(sentence)</th>
                            <th>점수(score)</th>
                            <th>인덱스(index)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(it => `
                            <tr>
                                <td>${DOMPurify.sanitize(it.sentence)}</td>
                                <td>${it.score.toFixed(6)}</td>
                                <td>${it.index}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <hr>
            `;
        }

        container.innerHTML = html;
    } catch (err) {
        console.error('⚠️ 예시 데이터 로드 실패:', err);
        container.innerHTML = '<p style="color:red;">예시 데이터를 불러오지 못했습니다.</p>';
    }
}

/* ========= 질문하기 폼(submit) 핸들러 ========= */
$('#chatForm').addEventListener('submit', async (e) => {
    // ... 생략 ...
});

/* ✅ 카테고리별 문서 목록 불러오기 */
async function loadDocumentsByType(type) {
    try {
        const res = await fetch(`/api/documents?type=${type}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const docs = await res.json();
        console.log(`📄 ${type} 문서 목록:`, docs);
        toast(`${type} 문서 ${docs.length}개 불러옴`);
        return docs;
    } catch (err) {
        console.error('⚠️ 문서 목록 불러오기 실패:', err);
        toast('문서 목록 불러오기 실패');
        return [];
    }
}

/* ========= 초기화 ========= */
(function initial() {
    setTab('transform');
    renderCategories();
    updateTransformEnabled();
    updateSelectedInfo();
})();



/* ========= 초기화 ========= */
(function initial(){
    setTab('transform');        // 해시 사용 안 함
    renderCategories();
    updateTransformEnabled();
    updateSelectedInfo();
})();
