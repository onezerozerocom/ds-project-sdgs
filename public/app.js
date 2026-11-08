// 데이터 과학 프로젝트 노트
// 교과서 Ⅳ-01 '데이터 과학 문제 해결 절차'를 학생이 직접 따라가며 기록하는 웹앱
//   1 주제 선정(SDGs) → 2 문제 정의 → 3 데이터 수집 → 4 탐색적 데이터 분석·전처리 → 5 데이터 분석 → 6 일반화 및 공유

(() => {
  "use strict";

  const CFG = window.DSP_CONFIG || {};
  let COACH = false; // /api/coach 가 응답하면 켬 (checkCoach)
  const STORE = "dsp-project-v1";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (v, d = 2) => (v == null || !Number.isFinite(v) ? "–" : v.toLocaleString("ko-KR", { maximumFractionDigits: d, minimumFractionDigits: 0 }));
  const fmtAuto = (v) => (v == null || !Number.isFinite(v) ? "–" : fmt(v, Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 10 ? 1 : 3));

  // ---------- 프로젝트 상태 ----------

  const blank = () => ({
    v: 1, updatedAt: null,
    sdg: null,
    s1: { topic: "", reason: "", career: "", team: "", members: [{ name: "", role: "데이터 수집" }, { name: "", role: "프로그래밍 소스 코드 입력" }, { name: "", role: "데이터 시각화" }, { name: "", role: "결과 보고서 작성" }] },
    s2: { situation: "", question: "", why: "", hypothesis: "", variables: "", use: "", checks: {} },
    s3: { tab: "gg", source: "", period: "", method: "", fit: "", dataset: null, ggPick: ["population", "area", "density"], ggView: "density", mergePick: [] },
    s4: { drop: [], missing: "none", scale: "none", scaleCols: [], hist: "", box: [], sx: "", sy: "", sc: "", lx: "", ly: "", notes: {}, summary: "", snaps: {} },
    s5: { y: "", xs: [], test: 0.3, seed: 1234, method: "", interpret: "", next: "" },
    s6: { result: "", use: "", impact: "", limits: "", share: "" },
    ai: {},
  });

  let P = load() || blank();
  function load() {
    try {
      const p = JSON.parse(localStorage.getItem(STORE));
      return p && p.v === 1 ? merge(blank(), p) : null;
    } catch { return null; }
  }
  function merge(base, over) {
    for (const k of Object.keys(over)) {
      if (base[k] && typeof base[k] === "object" && !Array.isArray(base[k]) && over[k] && typeof over[k] === "object" && !Array.isArray(over[k])) merge(base[k], over[k]);
      else base[k] = over[k];
    }
    return base;
  }

  let saveTimer = null;
  function save() {
    P.updatedAt = new Date().toISOString();
    $("#saveState").textContent = "저장 중…";
    $("#saveState").className = "save-state";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORE, JSON.stringify(P));
        $("#saveState").textContent = "자동 저장됨 " + new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
      } catch {
        $("#saveState").textContent = "데이터가 커서 브라우저에 저장 못 함 · '파일로 저장'을 쓰세요";
        $("#saveState").className = "save-state warn";
      }
    }, 400);
    renderStepper();
  }

  const getPath = (path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), P);
  function setPath(path, value) {
    const ks = path.split(".");
    let o = P;
    for (const k of ks.slice(0, -1)) o = o[k] ??= {};
    o[ks[ks.length - 1]] = value;
  }

  // ---------- 단계 ----------

  const STEPS = [
    { key: "s1", no: 1, title: "주제 선정", sub: "SDGs", page: "170~173쪽" },
    { key: "s2", no: 2, title: "문제 정의", sub: "데이터로 풀 수 있나?", page: "173쪽" },
    { key: "s3", no: 3, title: "데이터 수집", sub: "지도·CSV", page: "174~175쪽" },
    { key: "s4", no: 4, title: "탐색적 분석·전처리", sub: "EDA", page: "176~178쪽" },
    { key: "s5", no: 5, title: "데이터 분석", sub: "회귀 분석", page: "179~181쪽" },
    { key: "s6", no: 6, title: "일반화 및 공유", sub: "보고서", page: "181쪽" },
  ];
  const filled = (s) => String(s || "").trim().length >= 5;
  function progress(key) {
    const parts = {
      s1: [P.sdg, filled(P.s1.topic), filled(P.s1.reason)],
      s2: [filled(P.s2.situation), filled(P.s2.question), filled(P.s2.why), filled(P.s2.variables)],
      s3: [!!P.s3.dataset, filled(P.s3.source), filled(P.s3.fit)],
      s4: [!!P.s3.dataset, Object.values(P.s4.notes || {}).some(filled), filled(P.s4.summary)],
      s5: [!!P.s5.y && P.s5.xs.length > 0, filled(P.s5.interpret)],
      s6: [filled(P.s6.result), filled(P.s6.use), filled(P.s6.impact)],
    }[key];
    return parts.filter(Boolean).length / parts.length;
  }

  let step = 1;
  function renderStepper() {
    $("#stepper").innerHTML = STEPS.map((s) => {
      const p = progress(s.key);
      const state = p >= 1 ? "done" : p > 0 ? "part" : "";
      return `<button type="button" class="step ${s.no === step ? "on" : ""} ${state}" data-step="${s.no}" ${s.no === step ? 'aria-current="step"' : ""}>
        <span class="num">${p >= 1 ? "✓" : s.no}</span>
        <span class="txt"><b>${s.title}</b><small>${s.sub}</small></span>
        <span class="bar"><i style="width:${Math.round(p * 100)}%"></i></span></button>`;
    }).join("");
    const sdg = sdgOf(P.sdg);
    $("#projTitle").textContent = P.s1.topic.trim() || "데이터 과학 프로젝트 노트";
    document.documentElement.style.setProperty("--sdg", sdg ? sdg.color : css("--accent"));
  }
  $("#stepper").addEventListener("click", (e) => {
    const b = e.target.closest("[data-step]");
    if (b) go(+b.dataset.step);
  });

  function go(n) {
    step = Math.min(6, Math.max(1, n));
    history.replaceState(null, "", "#step" + step);
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const sdgOf = (no) => SDGS.find((s) => s.no === no);

  // ---------- 공통 조각 ----------

  function field(path, label, { hint = "", rows = 3, ph = "", input = false } = {}) {
    const v = esc(getPath(path) || "");
    const id = "f_" + path.replace(/\./g, "_");
    return `<div class="field"><label for="${id}">${label}</label>${hint ? `<p class="hint">${hint}</p>` : ""}
      ${input ? `<input id="${id}" type="text" data-bind="${path}" value="${v}" placeholder="${esc(ph)}" />`
        : `<textarea id="${id}" data-bind="${path}" rows="${rows}" placeholder="${esc(ph)}">${v}</textarea>`}</div>`;
  }

  function nav() {
    const prev = STEPS[step - 2], next = STEPS[step];
    return `<div class="step-nav">
      ${prev ? `<button type="button" class="btn ghost" data-go="${step - 1}">← ${prev.no}. ${prev.title}</button>` : "<span></span>"}
      ${next ? `<button type="button" class="btn" data-go="${step + 1}">${next.no}. ${next.title} →</button>` : ""}</div>`;
  }

  function head(s, lead) {
    return `<div class="step-head"><div><p class="eyebrow">${s.no}단계 · 교과서 ${s.page}</p><h2>${s.title}</h2></div>
      <p class="lead">${lead}</p></div>`;
  }

  // ---------- AI 코치 ----------

  const COACH_Q = {
    s1: ["이 주제가 데이터로 해결 가능한지 봐 줘", "주제를 더 구체적으로 다듬어 줘"],
    s2: ["문제 정의에서 부족한 점은?", "가설을 데이터로 확인할 수 있을까?"],
    s3: ["이 문제에 필요한 데이터를 추천해 줘", "지금 데이터로 충분할까?"],
    s4: ["내 탐색 결과에서 놓친 점은?", "어떤 전처리가 더 필요할까?"],
    s5: ["분석 결과를 어떻게 해석하면 될까?", "더 나은 분석 방법이 있을까?"],
    s6: ["사회적 영향과 윤리 문제를 더 생각해 보면?", "보고서에서 보완할 점은?"],
  };

  function coachBox(key) {
    const prev = P.ai[key];
    return `<section class="card coach">
      <div class="coach-head"><h3>AI 코치 <span class="tag">Gemini</span></h3>
        <p class="muted small">${COACH ? "지금까지 쓴 내용을 보고 질문과 힌트를 줘요. 정답을 대신 써 주지는 않아요." : "AI 코치는 Vercel에 배포한 주소에서만 켜져요."}</p></div>
      <div class="chips">${COACH_Q[key].map((q) => `<button type="button" class="chip" data-coach="${esc(q)}" ${COACH ? "" : "disabled"}>${esc(q)}</button>`).join("")}</div>
      <form class="coach-form" data-coach-form><input type="text" maxlength="300" placeholder="직접 질문하기" ${COACH ? "" : "disabled"} />
        <button type="submit" class="btn" ${COACH ? "" : "disabled"}>묻기</button></form>
      <div class="coach-answer" id="coachAnswer">${prev ? answerHtml(prev) : ""}</div></section>`;
  }
  function answerHtml(a) {
    return `<div class="q">Q. ${esc(a.q)}</div><div class="box">${mdLite(a.answer)}</div>
      <div class="note">AI가 만든 피드백이에요. 그대로 옮겨 쓰지 말고 내 생각으로 고쳐 쓰세요.</div>`;
  }
  function mdLite(text) {
    const blocks = esc(text).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").split(/\n{2,}/);
    return blocks.map((b) => {
      const lines = b.split("\n");
      if (lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l)))
        return `<ul>${lines.map((l) => `<li>${l.replace(/^\s*([-*•]|\d+\.)\s+/, "")}</li>`).join("")}</ul>`;
      return `<p>${lines.join("<br>")}</p>`;
    }).join("");
  }

  // AI에게 보낼 프로젝트 요약 (원자료 전체는 보내지 않음)
  function projectBrief() {
    const sdg = sdgOf(P.sdg);
    const b = {
      SDG: sdg ? `${sdg.no}. ${sdg.name}` : "미선택",
      주제선정: { 주제: P.s1.topic, 선택이유: P.s1.reason, 진로연계: P.s1.career },
      문제정의: { 문제상황: P.s2.situation, 분석질문: P.s2.question, 데이터로해결가능한이유: P.s2.why, 가설: P.s2.hypothesis, 필요한속성: P.s2.variables, 활용: P.s2.use },
      데이터수집: { 출처: P.s3.source, 기간범위: P.s3.period, 방법: P.s3.method, 적합성: P.s3.fit },
    };
    const t = table();
    if (t) {
      b.데이터셋 = {
        이름: P.s3.dataset.name, 행수: t.n,
        열: t.cols.map((c) => {
          const miss = c.values.filter((v) => v == null).length;
          if (c.type !== "num") return { 이름: c.name, 자료형: c.type === "date" ? "날짜" : "범주형", 결측: miss, 종류수: new Set(c.values.filter(Boolean)).size };
          const d = DS.describe(c);
          return { 이름: c.name, 자료형: "수치형", 결측: miss, 평균: +d.mean.toPrecision(4), 표준편차: +d.std.toPrecision(4), 최솟값: d.min, 최댓값: d.max };
        }).slice(0, 25),
        전처리: t.log,
      };
      b.탐색기록 = { ...P.s4.notes, 정리: P.s4.summary };
      const reg = currentReg();
      if (reg) b.분석결과 = { 종속변수: reg.yName, 독립변수: reg.xNames, 학습R2: +reg.r2Train.toFixed(3), 평가R2: reg.r2Test == null ? null : +reg.r2Test.toFixed(3), 계수: reg.beta.map((v) => +v.toPrecision(4)) };
      b.분석해석 = { 방법: P.s5.method, 해석: P.s5.interpret };
    }
    b.일반화및공유 = P.s6;
    return b;
  }

  async function askCoach(q) {
    const key = STEPS[step - 1].key;
    const box = $("#coachAnswer");
    box.innerHTML = `<div class="q">Q. ${esc(q)}</div><div class="box"><span class="dots">생각하는 중</span></div>`;
    try {
      const res = await fetch(CFG.coachUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "coach", step: key, question: q, project: projectBrief() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || res.status);
      P.ai[key] = { q, answer: data.answer, at: Date.now() };
      save();
      box.innerHTML = answerHtml(P.ai[key]);
    } catch (e) {
      box.innerHTML = `<div class="box err">AI 코치 답을 받지 못했어요: ${esc(e.message || e)}</div>`;
    }
  }

  // ---------- 1단계: 주제 선정 ----------

  const ROLES = ["데이터 수집", "프로그래밍 소스 코드 입력", "데이터 시각화", "결과 보고서 작성", "발표", "기타"];

  function renderS1() {
    const sdg = sdgOf(P.sdg);
    return head(STEPS[0], "지속 가능 발전 목표(SDGs) 17개 중 관심 있는 목표를 고르고, 데이터로 해결할 수 있는 프로젝트 주제를 정해요.") + `
    <section class="card">
      <h3>① 지속 가능 발전 목표 고르기</h3>
      <p class="hint">인간 · 지구 · 번영 · 평화 · 파트너십 5개 영역, 17개 목표예요. 하나를 눌러 보세요.</p>
      <div class="sdg-grid" role="radiogroup" aria-label="지속 가능 발전 목표">
        ${SDGS.map((s) => `<button type="button" role="radio" aria-checked="${s.no === P.sdg}" class="sdg ${s.no === P.sdg ? "on" : ""}" data-sdg="${s.no}" style="--c:${s.color}">
          <span class="n">${s.no}</span><span class="t">${s.name}</span></button>`).join("")}
      </div>
    </section>
    ${sdg ? `<section class="card sdg-detail" style="--c:${sdg.color}">
      <div class="sdg-badge"><span>${sdg.no}</span></div>
      <div><h3>${sdg.name} <small class="muted">${sdg.en}</small></h3><p>${sdg.desc} · 영역: ${sdg.area}</p>
        <p class="small"><b>데이터 과학 주제 예시</b> (그대로 쓰기보다 우리 상황에 맞게 바꿔 보세요)</p>
        <ul class="topics">${sdg.topics.map((t) => `<li><button type="button" class="link" data-topic="${esc(t)}">${esc(t)}</button></li>`).join("")}</ul>
      </div></section>` : ""}
    <section class="card">
      <h3>② 프로젝트 주제 정하기</h3>
      <div class="cols2">
        <div>
          ${field("s1.topic", "우리 모둠의 프로젝트 주제", { input: true, ph: "예: 우리나라 전력 사용량을 분석하여 내년도 전력 사용량을 예측한다." })}
          ${field("s1.reason", "이 지속 가능 발전 목표를 선택한 이유", { rows: 4, ph: "예: 여름과 겨울철 에너지 사용이 궁금해서 선택하였다." })}
          ${field("s1.career", "나의 진로와 어떻게 연결되나요? (선택)", { rows: 2, ph: "예: 기상 예보관 - 날씨 데이터 분석" })}
        </div>
        <div>
          ${field("s1.team", "모둠 이름", { input: true, ph: "예: 3모둠 블랙아웃 지킴이" })}
          <div class="field"><label>구성원과 역할 분담</label><p class="hint">프로젝트 규모에 맞게 역할을 나눠요. (교과서 173쪽 역할 분담 예시)</p>
          <div class="members">${P.s1.members.map((m, i) => `<div class="member">
            <input type="text" placeholder="이름" value="${esc(m.name)}" data-bind="s1.members.${i}.name" aria-label="구성원 ${i + 1} 이름" />
            <select data-bind="s1.members.${i}.role" aria-label="구성원 ${i + 1} 역할">${ROLES.map((r) => `<option ${r === m.role ? "selected" : ""}>${r}</option>`).join("")}</select>
            <button type="button" class="icon-btn" data-del-member="${i}" aria-label="구성원 ${i + 1} 삭제">×</button></div>`).join("")}</div>
          <button type="button" class="btn ghost small" id="addMember">+ 구성원 추가</button></div>
        </div>
      </div>
    </section>
    ${coachBox("s1")}${nav()}`;
  }
  function bindS1(root) {
    root.addEventListener("click", (e) => {
      const b = e.target.closest("[data-sdg]");
      if (b) { P.sdg = +b.dataset.sdg; save(); render(); return; }
      const t = e.target.closest("[data-topic]");
      if (t) {
        if (P.s1.topic.trim() && !confirm("지금 쓴 주제를 예시로 바꿀까요?")) return;
        P.s1.topic = t.dataset.topic; save(); render(); return;
      }
      const d = e.target.closest("[data-del-member]");
      if (d) { P.s1.members.splice(+d.dataset.delMember, 1); save(); render(); return; }
      if (e.target.id === "addMember") { P.s1.members.push({ name: "", role: "기타" }); save(); render(); }
    });
  }

  // ---------- 2단계: 문제 정의 ----------

  const CHECKS = [
    ["measure", "해결하려는 문제를 숫자나 범주로 측정할 수 있다."],
    ["get", "필요한 데이터를 공공 데이터 포털 등에서 구할 수 있다."],
    ["scope", "언제·어디서·누구를 대상으로 할지 범위가 구체적이다."],
    ["sdg", "선택한 지속 가능 발전 목표와 연결된다."],
    ["ethic", "개인정보 침해 등 윤리적 문제가 없다."],
  ];

  function renderS2() {
    const sdg = sdgOf(P.sdg);
    return head(STEPS[1], "여러 분야에서 일어나는 문제를 살펴보고, 그것이 <b>데이터를 이용해 해결할 수 있는 문제인지</b> 판단해요.") + `
    <section class="card context">
      <span class="pill" style="--c:${sdg ? sdg.color : "var(--muted)"}">${sdg ? `SDG ${sdg.no}. ${sdg.name}` : "SDG 미선택"}</span>
      <b>${esc(P.s1.topic) || '<span class="muted">1단계에서 주제를 정해 주세요.</span>'}</b>
    </section>
    <section class="card">
      <div class="example"><b>교과서 예시</b> 냉·난방 기기 사용이 늘면서 전기 수요가 급증할 때 생기는 대정전(블랙아웃)을 막기 위해,
        기상 변화에 따른 최대 전력 소비량을 예측하는 모델을 만든다.</div>
      <div class="cols2">
        <div>
          ${field("s2.situation", "① 문제 상황 – 어떤 현상이 왜 문제인가요?", { rows: 4, ph: "예: 여름·겨울철 전력 사용량이 공급 능력을 넘으면 대정전이 일어날 수 있다." })}
          ${field("s2.question", "② 데이터로 답하고 싶은 질문", { rows: 3, hint: "'무엇이 무엇에 영향을 줄까?', '어떻게 달라질까?'처럼 데이터로 확인할 수 있게 써요.", ph: "예: 기온·습도·일사량으로 그날의 최대 전력을 예측할 수 있을까?" })}
          ${field("s2.why", "③ 데이터로 해결할 수 있다고 판단한 이유", { rows: 3, ph: "예: 기상청과 전력거래소가 일별 데이터를 공개하고 있어 1년치를 모을 수 있다." })}
        </div>
        <div>
          ${field("s2.hypothesis", "④ 예상(가설)", { rows: 3, ph: "예: 기온이 아주 높거나 낮을수록 최대 전력이 커질 것이다." })}
          ${field("s2.variables", "⑤ 필요한 데이터(속성)", { rows: 3, hint: "예측·설명하고 싶은 것(종속 변수)과 영향을 줄 것 같은 것(독립 변수)을 나눠 써 보세요.", ph: "종속: 최대전력(MW)\n독립: 평균최고기온, 평균최저기온, 일사합, 평균습도, 평균풍속" })}
          ${field("s2.use", "⑥ 문제를 해결하면 누구에게 어떻게 도움이 되나요?", { rows: 2, ph: "예: 전력 수요를 미리 예측해 공급 부족을 막는다." })}
        </div>
      </div>
    </section>
    <section class="card">
      <h3>데이터로 해결할 수 있는 문제인지 점검하기</h3>
      <div class="checks">${CHECKS.map(([k, t]) => `<label class="check"><input type="checkbox" data-bind-check="s2.checks.${k}" ${P.s2.checks[k] ? "checked" : ""} /> ${t}</label>`).join("")}</div>
      <p class="hint" id="checkMsg"></p>
    </section>
    ${coachBox("s2")}${nav()}`;
  }
  function checkMsg() {
    const el = $("#checkMsg");
    if (!el) return;
    const n = CHECKS.filter(([k]) => P.s2.checks[k]).length;
    el.textContent = n === CHECKS.length ? "모두 확인했어요. 데이터 수집 단계로 넘어가요!" : `${CHECKS.length - n}개가 아직이에요. 체크하지 못한 항목은 문제를 고쳐서 해결해 보세요.`;
  }

  // ---------- 3단계: 데이터 수집 ----------

  // 경기도 31개 시·군 지표 – 우리 동네 데이터 분석기와 같은 데이터(data/indicators.js)·정의
  // indicators.js는 우리 동네 분석기의 scripts/build_data.py가 공공데이터포털·경기데이터드림·나이스에서 미리 모아 둔 것
  const GEO = window.GG_REGIONS;
  const GDATA = window.GG_DATA || { sources: {}, cities: {} };
  const REGIONS = GEO.features.map((f) => {
    const d = GDATA.cities[f.properties.name] || {};
    return { name: f.properties.name, area: f.properties.area, d, neis: d.neis || null };
  });
  const REG = Object.fromEntries(REGIONS.map((r) => [r.name, r]));
  const per = (a, b, k) => (a == null || !b ? null : (a / b) * k);
  const Pop = (r) => r.d.pop;
  const share = (r, word) => (r.neis.academies ? (Object.entries(r.neis.academyFields || {}).reduce((s, [k, v]) => (k.includes(word) ? s + v : s), 0) / r.neis.academies) * 100 : null);
  const GG_CATS = [["pop", "인구"], ["traffic", "교통"], ["safety", "안전·범죄"], ["health", "의료"], ["life", "생활·복지"], ["culture", "문화"], ["edu", "교육(나이스)"]];
  const GG = [
    { cat: "pop", key: "population", label: "인구", unit: "명", d: 0, src: "population", get: (r) => Pop(r) },
    { cat: "pop", key: "density", label: "인구밀도", unit: "명/km²", d: 0, src: "population", get: (r) => per(Pop(r), r.area, 1) },
    { cat: "pop", key: "area", label: "면적", unit: "km²", d: 1, src: "area", get: (r) => r.area },
    { cat: "pop", key: "age65Share", label: "고령인구 비율 (65세 이상)", unit: "%", d: 1, src: "population", get: (r) => per(r.d.age65p, Pop(r), 100) },
    { cat: "pop", key: "youthShare", label: "학령인구 비율 (6~17세)", unit: "%", d: 1, src: "population", get: (r) => per(r.d.age6_17, Pop(r), 100) },
    { cat: "pop", key: "infantShare", label: "영유아 비율 (0~5세)", unit: "%", d: 1, src: "population", get: (r) => per(r.d.age0_5, Pop(r), 100) },
    { cat: "pop", key: "singleRate", label: "인구 100명당 1인 세대", unit: "세대", d: 1, src: "single", get: (r) => per(r.d.single, Pop(r), 100) },
    { cat: "pop", key: "sexRatio", label: "성비 (여자 100명당 남자)", unit: "명", d: 1, src: "population", get: (r) => per(r.d.male, r.d.female, 100) },
    { cat: "traffic", key: "busStops", label: "버스정류장 수", unit: "곳", d: 0, src: "bus", get: (r) => r.d.bus_stops },
    { cat: "traffic", key: "busPerKm2", label: "1km²당 버스정류장", unit: "곳", d: 2, src: "bus", get: (r) => per(r.d.bus_stops, r.area, 1) },
    { cat: "traffic", key: "busPer10k", label: "인구 1만 명당 버스정류장", unit: "곳", d: 1, src: "bus", get: (r) => per(r.d.bus_stops, Pop(r), 1e4) },
    { cat: "traffic", key: "acc", label: "교통사고 건수", unit: "건", d: 0, src: "accident", get: (r) => r.d.acc },
    { cat: "traffic", key: "accPer10k", label: "인구 1만 명당 교통사고", unit: "건", d: 1, src: "accident", get: (r) => per(r.d.acc, Pop(r), 1e4) },
    { cat: "traffic", key: "accDeadPer100k", label: "인구 10만 명당 교통사고 사망자", unit: "명", d: 1, src: "accident", get: (r) => per(r.d.acc_dead, Pop(r), 1e5) },
    { cat: "traffic", key: "carsPer1k", label: "인구 1천 명당 자동차", unit: "대", d: 0, src: "CarRegistration", get: (r) => per(r.d.cars, Pop(r), 1e3) },
    { cat: "traffic", key: "evShare", label: "전기차 비율", unit: "%", d: 2, src: "TBGGVEHREGFUELSTM", get: (r) => per(r.d.ev, r.d.fuel_total, 100) },
    { cat: "traffic", key: "chargersPer10k", label: "인구 1만 명당 전기차 충전기", unit: "기", d: 1, src: "ElectricityCarCharging", get: (r) => per(r.d.chargers, Pop(r), 1e4) },
    { cat: "traffic", key: "evPerCharger", label: "충전기 1기당 전기차", unit: "대", d: 2, src: "ElectricityCarCharging", get: (r) => per(r.d.ev, r.d.chargers, 1) },
    { cat: "safety", key: "crime", label: "범죄 발생 건수", unit: "건", d: 0, src: "crime", get: (r) => r.d.crime_total },
    { cat: "safety", key: "crimePer10k", label: "인구 1만 명당 범죄", unit: "건", d: 1, src: "crime", get: (r) => per(r.d.crime_total, Pop(r), 1e4) },
    { cat: "safety", key: "violentPer10k", label: "인구 1만 명당 강력범죄", unit: "건", d: 2, src: "crime", get: (r) => per(r.d.crime_violent, Pop(r), 1e4) },
    { cat: "safety", key: "theftPer10k", label: "인구 1만 명당 절도", unit: "건", d: 1, src: "crime", get: (r) => per(r.d.crime_theft, Pop(r), 1e4) },
    { cat: "safety", key: "assaultPer10k", label: "인구 1만 명당 폭력범죄", unit: "건", d: 1, src: "crime", get: (r) => per(r.d.crime_assault, Pop(r), 1e4) },
    { cat: "safety", key: "fraudPer10k", label: "인구 1만 명당 지능범죄(사기 등)", unit: "건", d: 1, src: "crime", get: (r) => per(r.d.crime_fraud, Pop(r), 1e4) },
    { cat: "health", key: "hTotal", label: "의료기관 수", unit: "곳", d: 0, src: "hospital", get: (r) => r.d.h_total },
    { cat: "health", key: "clinicPer10k", label: "인구 1만 명당 의원", unit: "곳", d: 1, src: "hospital", get: (r) => per(r.d.h_clinic, Pop(r), 1e4) },
    { cat: "health", key: "doctorsPer1k", label: "인구 1천 명당 의사 수", unit: "명", d: 2, src: "hospital", get: (r) => per(r.d.doctors, Pop(r), 1e3) },
    { cat: "health", key: "general", label: "종합병원 수 (상급종합 포함)", unit: "곳", d: 0, src: "hospital", get: (r) => r.d.h_general },
    { cat: "health", key: "pharmPer10k", label: "인구 1만 명당 약국", unit: "곳", d: 1, src: "hospital", get: (r) => per(r.d.pharmacy, Pop(r), 1e4) },
    { cat: "life", key: "daycarePer1k", label: "영유아 1천 명당 어린이집", unit: "곳", d: 1, src: "ChildhouseKndrgrM", get: (r) => per(r.d.daycare, r.d.age0_5, 1e3) },
    { cat: "life", key: "daycarePublicShare", label: "국공립 어린이집 비율", unit: "%", d: 1, src: "ChildhouseKndrgrM", get: (r) => per(r.d.daycare_public, r.d.daycare, 100) },
    { cat: "life", key: "seniorPer1k", label: "노인 1천 명당 경로당", unit: "곳", d: 1, src: "SenircentFaclt", get: (r) => per(r.d.senior_center, r.d.age65p, 1e3) },
    { cat: "life", key: "parkPerCap", label: "1인당 도시공원 면적", unit: "m²", d: 1, src: "CityPark", get: (r) => per(r.d.park_area, Pop(r), 1) },
    { cat: "life", key: "playPer1k", label: "아동(0~17세) 1천 명당 놀이시설", unit: "곳", d: 1, src: "ChildPlayFacility", get: (r) => per(r.d.playgrounds, (r.d.age0_5 || 0) + (r.d.age6_17 || 0), 1e3) },
    { cat: "culture", key: "lib", label: "공공도서관 수", unit: "곳", d: 0, src: "library", get: (r) => r.d.lib },
    { cat: "culture", key: "libPer100k", label: "인구 10만 명당 공공도서관", unit: "곳", d: 1, src: "library", get: (r) => per(r.d.lib, Pop(r), 1e5) },
    { cat: "culture", key: "booksPerCap", label: "1인당 도서관 장서 수", unit: "권", d: 2, src: "library", get: (r) => per(r.d.lib_books, Pop(r), 1) },
    { cat: "culture", key: "loansPerCap", label: "1인당 도서관 대출 권수", unit: "권", d: 2, src: "library", get: (r) => per(r.d.lib_loans, Pop(r), 1) },
    { cat: "edu", key: "schools", label: "학교 수", unit: "곳", d: 0, neis: true, src: "neis", get: (r) => r.neis.schools },
    { cat: "edu", key: "academies", label: "학원·교습소 수", unit: "곳", d: 0, neis: true, src: "neis", get: (r) => r.neis.academies },
    { cat: "edu", key: "schoolPer10k", label: "인구 1만 명당 학교 수", unit: "곳", d: 2, neis: true, src: "neis", get: (r) => per(r.neis.schools, Pop(r), 1e4) },
    { cat: "edu", key: "acaPerStudent", label: "학령인구 1천 명당 학원 수", unit: "곳", d: 1, neis: true, src: "neis", get: (r) => per(r.neis.academies, r.d.age6_17, 1e3) },
    { cat: "edu", key: "acaPerSchool", label: "학교 1곳당 학원 수", unit: "곳", d: 1, neis: true, src: "neis", get: (r) => per(r.neis.academies, r.neis.schools, 1) },
    { cat: "edu", key: "examShare", label: "입시·보습 학원 비율", unit: "%", d: 1, neis: true, src: "neis", get: (r) => share(r, "입시") },
    { cat: "edu", key: "artsShare", label: "예능 학원 비율", unit: "%", d: 1, neis: true, src: "neis", get: (r) => share(r, "예능") },
    { cat: "edu", key: "intlShare", label: "국제화(외국어) 학원 비율", unit: "%", d: 1, neis: true, src: "neis", get: (r) => share(r, "국제") },
  ];
  const GGM = Object.fromEntries(GG.map((m) => [m.key, m]));
  const ggVal = (r, key) => { const m = GGM[key]; if (m.neis && !r.neis) return null; const v = m.get(r); return v != null && Number.isFinite(v) ? v : null; };
  // 데이터가 하나라도 있는 지표만 고를 수 있게 함
  const GG_HAS = Object.fromEntries(GG.map((m) => [m.key, REGIONS.some((r) => ggVal(r, m.key) != null)]));
  const ggOk = (m) => !!GG_HAS[m.key];
  const ggCol = (m) => `${m.label}(${m.unit})`;
  // 고른 지표들의 출처를 '자료명 (기준 시점)' 줄 목록으로
  function ggSource(ms) {
    return [...new Set(ms.map((m) => m.src))].map((k) => {
      if (k === "area") return "면적: 위키백과 '경기도의 행정 구역' (2025.3.31 기준)";
      const s = GDATA.sources[k];
      if (k === "neis") return s && s.name ? `${s.name}${s.year ? ` (${s.year})` : ""}` : "나이스 교육정보 개방포털 (학교기본정보, 학원교습소정보)";
      return s ? `${s.name}${s.year ? ` (${s.year})` : ""}` : k;
    }).join("\n");
  }
  const GG_SOURCE = `공공데이터포털·경기데이터드림·나이스 (${GDATA.built || ""} 수집, 우리 동네 데이터 분석기와 같은 데이터)`;

  // 다른 데이터셋에서 시·군 이름이 들어 있는 열 찾기 ("경기도 수원시", "수원" 모두 인정)
  const regionKey = (s) => {
    const t = String(s || "").replace(/^경기(도)?\s*/, "").trim().split(/\s+/)[0];
    if (REG[t]) return t;
    return REGIONS.find((r) => r.name.replace(/[시군]$/, "") === t)?.name || null;
  };
  function regionColumn(ds) {
    let best = null;
    ds.columns.forEach((c, j) => {
      const hits = new Set(ds.rows.map((r) => regionKey(r[j])).filter(Boolean)).size;
      if (hits >= 10 && (!best || hits > best.hits)) best = { col: c, j, hits };
    });
    return best;
  }

  function renderS3() {
    const sdg = sdgOf(P.sdg);
    const tab = P.s3.tab;
    const tabs = [["gg", "경기도 시·군 지도 데이터"], ["csv", "내가 모은 CSV 올리기"], ["sample", "연습용 예시 데이터"]];
    const portals = (sdg ? sdg.portals : ["datagokr", "kosis", "gg"]).map((k) => PORTALS[k]);
    return head(STEPS[2], "문제를 해결하는 데 필요한 데이터를 고르고, <b>출처와 수집 방법</b>을 분명하게 기록해요.") + `
    <section class="card context">
      <span class="pill" style="--c:${sdg ? sdg.color : "var(--muted)"}">${sdg ? `SDG ${sdg.no}` : "SDG 미선택"}</span>
      <span><b>질문</b> ${esc(P.s2.question) || '<span class="muted">2단계에서 데이터로 답할 질문을 써 주세요.</span>'}</span>
      ${P.s2.variables ? `<span class="muted small">필요한 속성: ${esc(P.s2.variables).replace(/\n/g, " · ")}</span>` : ""}
    </section>
    <section class="card">
      <h3>데이터를 찾을 수 있는 곳 ${sdg ? `<small class="muted">SDG ${sdg.no}에 추천</small>` : ""}</h3>
      <div class="portals">${portals.map((p) => `<a class="portal" href="${p.url}" target="_blank" rel="noopener">${p.name}<small>${p.url.replace(/^https?:\/\/(www\.)?/, "")}</small></a>`).join("")}</div>
      <p class="hint">CSV로 내려받은 뒤 '내가 모은 CSV 올리기'에 넣으면 돼요. 내려받은 파일은 헷갈리지 않게 이름을 바꿔 두세요.</p>
    </section>
    <section class="card">
      <div class="tabs" role="tablist">${tabs.map(([k, t]) => `<button type="button" role="tab" aria-selected="${k === tab}" class="tab ${k === tab ? "on" : ""}" data-tab="${k}">${t}</button>`).join("")}</div>
      <div class="tab-body">${tab === "gg" ? ggPanel() : tab === "csv" ? csvPanel() : samplePanel()}</div>
    </section>
    <section class="card" id="dsPreview">${previewHtml()}</section>
    <section class="card">
      <h3>데이터 수집 기록</h3>
      <div class="cols2"><div>
        ${field("s3.source", "데이터 출처 (기관·사이트·메뉴)", { rows: 2, ph: "예: 기상자료개방포털 [기후 통계 분석] → [조건별 통계]" })}
        ${field("s3.period", "수집 범위 (기간·지역·대상)", { input: true, ph: "예: 전국, 2022.1.1 ~ 2022.12.31, 일별" })}
      </div><div>
        ${field("s3.method", "수집 방법", { rows: 2, ph: "예: xlsx로 내려받아 필요한 열만 남기고 CSV로 저장" })}
        ${field("s3.fit", "이 데이터가 문제 해결에 적합한 이유", { rows: 2, ph: "예: 종속 변수(최대전력)와 독립 변수(기상 요소)가 같은 날짜 단위로 있다." })}
      </div></div>
    </section>
    ${coachBox("s3")}${nav()}`;
  }

  function ggPanel() {
    const view = GGM[P.s3.ggView] && ggOk(GGM[P.s3.ggView]) ? P.s3.ggView : "density";
    const byCat = (fn) => GG_CATS.map(([c, l]) => [c, l, GG.filter((m) => m.cat === c && ggOk(m))]).filter((x) => x[2].length).map(fn).join("");
    return `<p class="hint">지도를 눌러 시·군의 값을 살펴보고, 프로젝트에 쓸 지표를 골라 데이터셋을 만들어요. <span class="status ok">${GG_CATS.length}개 주제 · 지표 ${GG.filter(ggOk).length}개 · ${esc(GDATA.built || "")} 기준</span></p>
      <div class="gg">
        <div class="gg-map"><div class="map-ctl"><label>지도 색칠 <select id="ggView">${byCat(([, l, ms]) => `<optgroup label="${l}">${ms.map((m) => `<option value="${m.key}" ${m.key === view ? "selected" : ""}>${m.label}</option>`).join("")}</optgroup>`)}</select></label></div>
          <div id="map" aria-label="경기도 시군 지도"></div><div class="legend" id="legend"></div></div>
        <div class="gg-pick"><h4>데이터셋에 넣을 지표</h4>
          <div class="gg-cats">${byCat(([c, l, ms]) => {
            const n = ms.filter((m) => P.s3.ggPick.includes(m.key)).length;
            return `<details ${n || c === "pop" ? "open" : ""}><summary>${l} <small class="muted" data-cnt="${c}">${n ? n + "개 선택" : ""}</small></summary>
              ${ms.map((m) => `<label class="check"><input type="checkbox" data-gg="${m.key}" ${P.s3.ggPick.includes(m.key) ? "checked" : ""} /> ${m.label} <small class="muted">${m.unit}</small></label>`).join("")}</details>`;
          })}</div>
          <div id="ggInfo" class="gg-info muted small">시·군을 누르면 값이 보여요.</div>
          <button type="button" class="btn" id="ggMake">이 지표로 데이터셋 만들기</button></div>
      </div>`;
  }
  let map = null;
  function mountMap() {
    if (map) { map.remove(); map = null; }
    const el = $("#map");
    if (!el) return;
    const view = $("#ggView").value;
    const m = GGM[view];
    const vals = REGIONS.map((r) => ggVal(r, view)).filter((v) => v != null).sort((a, b) => a - b);
    const br = [1, 2, 3, 4].map((q) => vals[Math.floor((q / 5) * vals.length)]);
    const seq = [1, 2, 3, 4, 5].map((i) => css(`--seq-${i}`));
    const color = (v) => { if (v == null) return css("--surface-2"); let i = 0; while (i < 4 && v >= br[i]) i++; return seq[i]; };
    map = L.map(el, { zoomSnap: 0.25, scrollWheelZoom: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 13 }).addTo(map);
    let selLayer = null;
    const layer = L.geoJSON(GEO, {
      style: (f) => ({ fillColor: color(ggVal(REG[f.properties.name], view)), fillOpacity: 0.85, color: css("--surface"), weight: 1.2 }),
      onEachFeature: (f, l) => {
        l.bindTooltip(() => `<b>${f.properties.name}</b><br>${m.label}: ${fmt(ggVal(REG[f.properties.name], view), m.d)} ${m.unit}`, { sticky: true, className: "tt" });
        l.on("click", () => {
          if (selLayer) layer.resetStyle(selLayer);
          selLayer = l; l.setStyle({ color: css("--highlight"), weight: 3 }); l.bringToFront();
          const r = REG[f.properties.name];
          $("#ggInfo").innerHTML = `<b>${r.name}</b><table>${GG.filter((g) => ggOk(g) && (P.s3.ggPick.includes(g.key) || g.key === view)).map((g) => `<tr><td>${g.label}</td><td>${fmt(ggVal(r, g.key), g.d)} ${g.unit}</td></tr>`).join("")}</table>`;
        });
      },
    }).addTo(map);
    const fit = () => map && map.fitBounds(layer.getBounds(), { padding: [8, 8] });
    fit();
    new ResizeObserver(() => { if (map && el.clientWidth) { map.invalidateSize(); fit(); } }).observe(el);
    const edges = [vals[0], ...br, vals[vals.length - 1]];
    $("#legend").innerHTML = `<b>${m.label}</b> (${m.unit})` + seq.map((c, i) => `<span class="sw"><i style="background:${c}"></i>${fmt(edges[i], m.d)}~${i === 4 ? fmt(edges[5], m.d) : ""}</span>`).join("");
  }

  function ggDataset(keys) {
    const ms = keys.map((k) => GGM[k]).filter(ggOk);
    return {
      name: `경기도 31개 시·군 (${ms.map((m) => m.label).join(", ")})`, origin: "gg", source: ggSource(ms),
      columns: ["시군", ...ms.map(ggCol)],
      rows: REGIONS.map((r) => [r.name, ...ms.map((m) => { const v = ggVal(r, m.key); return v == null ? "" : String(+v.toFixed(Math.max(m.d, 2))); })]),
    };
  }

  function csvPanel() {
    const ds = P.s3.dataset;
    const rc = ds && ds.origin === "csv" ? regionColumn(ds) : null;
    return `<label class="drop" id="drop"><input type="file" id="csvFile" accept=".csv,text/csv" hidden />
        <b>CSV 파일을 끌어다 놓거나 눌러서 고르세요</b><span class="muted small">UTF-8·EUC-KR 모두 읽어요. 엑셀(xlsx)은 '다른 이름으로 저장 → CSV'로 바꿔 주세요.</span></label>
      <p class="err-msg" id="csvErr" role="alert"></p>
      ${rc ? `<div class="merge"><h4>경기도 시·군 지표와 합치기</h4>
        <p class="hint">'${esc(rc.col)}' 열에서 시·군 이름 ${rc.hits}개를 찾았어요. 아래 지표를 같은 시·군 행에 붙일 수 있어요. (교과서 176쪽 '데이터 추출&결합'과 같은 과정)</p>
        <div class="gg-cats merge-cats">${GG_CATS.map(([c, l]) => {
          const ms = GG.filter((m) => m.cat === c && ggOk(m));
          return ms.length ? `<details ${c === "pop" ? "open" : ""}><summary>${l}</summary><div class="checks inline">${ms.map((m) => `<label class="check"><input type="checkbox" data-merge="${m.key}" ${ds.columns.includes(ggCol(m)) ? "checked disabled" : ""} /> ${m.label}</label>`).join("")}</div></details>` : "";
        }).join("")}</div>
        <button type="button" class="btn ghost" id="doMerge">선택한 지표 붙이기</button></div>` : ""}`;
  }
  async function readCsvFile(file) {
    $("#csvErr").textContent = "";
    try {
      if (file.size > 15e6) throw new Error("15MB보다 큰 파일은 필요한 열·행만 남겨서 올려 주세요.");
      const { text, enc } = DS.decode(await file.arrayBuffer());
      const { columns, rows } = DS.parseCsv(text);
      setDataset({ name: file.name, origin: "csv", source: "", enc, columns, rows });
      render();
    } catch (e) { $("#csvErr").textContent = "읽지 못했어요: " + (e.message || e); }
  }
  function mergeGg(keys) {
    const ds = P.s3.dataset, rc = regionColumn(ds);
    const ms = keys.map((k) => GGM[k]).filter((m) => !ds.columns.includes(ggCol(m)));
    ds.columns.push(...ms.map(ggCol));
    for (const row of ds.rows) {
      const r = REG[regionKey(row[rc.j])];
      row.push(...ms.map((m) => { const v = r ? ggVal(r, m.key) : null; return v == null ? "" : String(+v.toFixed(Math.max(m.d, 2))); }));
    }
    ds.name += ` + 경기도 지표`;
    setDataset(ds);
    const add = ggSource(ms).split("\n").filter((l) => !P.s3.source.includes(l));
    if (add.length) P.s3.source = [P.s3.source.trim(), ...add].filter(Boolean).join("\n");
  }

  function samplePanel() {
    return `<p class="hint">직접 모은 데이터가 아직 없을 때 연습해 볼 수 있는 데이터예요.</p>
      <div class="samples">${SAMPLE_DATASETS.map((s) => {
        const n = s.csv.trim().split("\n").length - 1;
        return `<div class="sample"><div><b>${esc(s.name)}</b><p class="muted small">${esc(s.source)} · ${n}행</p>
          <p class="small">${s.sdg.map((no) => `<span class="pill sm" style="--c:${sdgOf(no).color}">SDG ${no}</span>`).join(" ")}</p></div>
          <button type="button" class="btn ghost" data-sample="${s.id}">불러오기</button></div>`;
      }).join("")}</div>`;
  }

  function setDataset(ds) {
    P.s3.dataset = ds;
    // 데이터가 바뀌면 탐색·분석 설정을 초기화
    const keepNotes = P.s4.notes, keepSummary = P.s4.summary;
    P.s4 = { ...blank().s4, notes: keepNotes, summary: keepSummary };
    P.s5 = { ...P.s5, y: "", xs: [] };
    lastReg = null;
    tblCache = null;
    save();
  }

  function previewHtml() {
    const ds = P.s3.dataset;
    if (!ds) return `<h3>내 데이터셋</h3><p class="muted">아직 데이터셋이 없어요. 위에서 데이터를 골라 주세요.</p>`;
    const t = table();
    const types = t.cols.map((c) => c.type);
    return `<div class="ds-head"><h3>내 데이터셋 <small class="muted">${esc(ds.name)}</small></h3>
      <span class="shape">${ds.rows.length.toLocaleString("ko-KR")}행 × ${ds.columns.length}열${ds.enc ? ` · ${ds.enc}` : ""}</span>
      <button type="button" class="btn ghost small" id="dlCsv">CSV 내려받기</button>
      <button type="button" class="btn ghost small" id="clearDs">지우기</button></div>
      <p class="hint">pandas의 <code>df.shape</code>, <code>df.head()</code>와 같은 정보예요. 처음 8행만 보여요.</p>
      <div class="table-wrap"><table class="data"><thead><tr><th></th>${ds.columns.map((c, i) => `<th>${esc(c)}<br><small class="type ${types[i]}">${typeName(types[i])}</small></th>`).join("")}</tr></thead>
      <tbody>${ds.rows.slice(0, 8).map((r, i) => `<tr><td class="idx">${i}</td>${r.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  const typeName = (t) => ({ num: "수치형", text: "범주형", date: "날짜" }[t]);

  function downloadCsv(ds, name) {
    const q = (s) => (/[",\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : s);
    const text = [ds.columns, ...ds.rows].map((r) => r.map(q).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function bindS3(root) {
    root.addEventListener("click", (e) => {
      const tb = e.target.closest("[data-tab]");
      if (tb) { P.s3.tab = tb.dataset.tab; save(); render(); return; }
      if (e.target.id === "ggMake") {
        const keys = $$("[data-gg]:checked").map((c) => c.dataset.gg);
        if (!keys.length) return alert("지표를 하나 이상 골라 주세요.");
        P.s3.ggPick = keys;
        setDataset(ggDataset(keys));
        if (!P.s3.source.trim()) P.s3.source = P.s3.dataset.source;
        if (!P.s3.period.trim()) P.s3.period = "경기도 31개 시·군";
        render(); $("#dsPreview").scrollIntoView({ behavior: "smooth" });
        return;
      }
      const sb = e.target.closest("[data-sample]");
      if (sb) {
        const s = SAMPLE_DATASETS.find((x) => x.id === sb.dataset.sample);
        const { columns, rows } = DS.parseCsv(s.csv);
        setDataset({ name: s.name, origin: "sample", source: s.source, columns, rows });
        if (!P.s3.source.trim()) P.s3.source = s.source;
        render(); $("#dsPreview").scrollIntoView({ behavior: "smooth" });
        return;
      }
      if (e.target.id === "doMerge") {
        const keys = $$("[data-merge]:checked:not(:disabled)").map((c) => c.dataset.merge);
        if (keys.length) { mergeGg(keys); render(); }
        return;
      }
      if (e.target.id === "dlCsv") return downloadCsv(P.s3.dataset, (P.s3.dataset.name.replace(/\.csv$/i, "") || "dataset") + ".csv");
      if (e.target.id === "clearDs" && confirm("데이터셋을 지울까요? (탐색·분석 설정도 초기화돼요)")) { setDataset(null); render(); }
    });
    root.addEventListener("change", (e) => {
      if (e.target.id === "ggView") { P.s3.ggView = e.target.value; save(); mountMap(); }
      if (e.target.dataset.gg) {
        P.s3.ggPick = $$("[data-gg]:checked").map((c) => c.dataset.gg);
        save();
        for (const [c] of GG_CATS) {
          const el = $(`[data-cnt="${c}"]`);
          const n = GG.filter((m) => m.cat === c && P.s3.ggPick.includes(m.key)).length;
          if (el) el.textContent = n ? n + "개 선택" : "";
        }
      }
      if (e.target.id === "csvFile" && e.target.files[0]) readCsvFile(e.target.files[0]);
    });
    const drop = $("#drop");
    if (drop) {
      ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
      ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("over")));
      drop.addEventListener("drop", (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) readCsvFile(f); });
    }
    if (P.s3.tab === "gg") mountMap();
  }

  // ---------- 4단계: 탐색적 데이터 분석 및 전처리 ----------

  let tblCache = null;
  function rawTable() {
    if (!P.s3.dataset) return null;
    if (!tblCache || tblCache.ds !== P.s3.dataset) tblCache = { ds: P.s3.dataset, t: DS.build(P.s3.dataset) };
    return tblCache.t;
  }
  // 전처리를 거친 표 (4·5단계에서 사용)
  function table() {
    const raw = rawTable();
    return raw ? DS.preprocess(raw, P.s4) : null;
  }
  const numCols = (t) => t.cols.filter((c) => c.type === "num").map((c) => c.name);

  function needData() {
    return `<section class="card empty"><p>먼저 3단계에서 데이터셋을 만들어 주세요.</p><button type="button" class="btn" data-go="3">3. 데이터 수집으로 →</button></section>`;
  }

  function note(key, ph) {
    return `<div class="obs"><label for="n_${key}">발견한 점</label>
      <textarea id="n_${key}" rows="2" data-bind="s4.notes.${key}" placeholder="${esc(ph)}">${esc(P.s4.notes[key] || "")}</textarea>
      <button type="button" class="btn ghost small" data-snap="${key}">${P.s4.snaps[key] ? "보고서 그림 다시 넣기 ✓" : "이 그래프를 보고서에 넣기"}</button></div>`;
  }
  const opt = (list, cur, blankLabel) => (blankLabel ? `<option value="">${blankLabel}</option>` : "") + list.map((n) => `<option value="${esc(n)}" ${n === cur ? "selected" : ""}>${esc(n)}</option>`).join("");

  function renderS4() {
    const raw = rawTable();
    if (!raw) return head(STEPS[3], "") + needData() + nav();
    const t = table();
    const nums = numCols(t);
    const s = P.s4;
    // 기본값 채우기
    if (!nums.includes(s.hist)) s.hist = nums[nums.length - 1] || "";
    if (!s.box.length) s.box = nums.slice(0, 6);
    s.box = s.box.filter((n) => nums.includes(n));
    if (!nums.includes(s.sx)) s.sx = nums[0] || "";
    if (!nums.includes(s.sy)) s.sy = nums[1] || nums[0] || "";
    if (!nums.includes(s.ly)) s.ly = nums[0] || "";
    const cats = t.cols.filter((c) => c.type !== "num" && new Set(c.values.filter(Boolean)).size <= 8).map((c) => c.name);
    const xLine = ["(행 순서)", ...t.cols.filter((c) => c.type !== "text").map((c) => c.name)];
    const rawNums = raw.cols.filter((c) => c.type === "num").map((c) => c.name).filter((n) => !s.drop.includes(n));

    return head(STEPS[3], "데이터 분석 시 생길 수 있는 오류를 피하고, 속성 사이의 관계를 <b>시각화와 통계</b>로 살펴보며 분석 방법을 구상해요.") + `
    <section class="card">
      <h3>① 데이터 특성 파악하기 <code>df.info()</code></h3>
      <p class="hint">각 속성의 자료형과 결측치를 확인하고, 분석에 쓰지 않을 속성은 체크를 풀어요.</p>
      <div class="table-wrap"><table class="info"><thead><tr><th>사용</th><th>#</th><th>속성(열)</th><th>자료형</th><th>값 있음</th><th>결측치</th><th>예시 값</th></tr></thead><tbody>
      ${raw.cols.map((c, i) => {
        const miss = c.values.filter((v) => v == null).length;
        const ex = c.values.filter((v) => v != null).slice(0, 3).map((v) => (typeof v === "number" ? fmtAuto(v) : v)).join(", ");
        return `<tr class="${s.drop.includes(c.name) ? "off" : ""}"><td><input type="checkbox" data-use="${esc(c.name)}" ${s.drop.includes(c.name) ? "" : "checked"} aria-label="${esc(c.name)} 사용" /></td>
          <td class="idx">${i}</td><td>${esc(c.name)}</td><td><span class="type ${c.type}">${typeName(c.type)}</span></td>
          <td>${(raw.n - miss).toLocaleString("ko-KR")}</td><td class="${miss ? "warn-txt" : ""}">${miss.toLocaleString("ko-KR")}</td><td class="muted ex">${esc(ex)}</td></tr>`;
      }).join("")}</tbody></table></div>
      <p class="small">전체 ${raw.n.toLocaleString("ko-KR")}행 · 수치형 ${raw.cols.filter((c) => c.type === "num").length}개 · 범주형 ${raw.cols.filter((c) => c.type === "text").length}개 · 날짜 ${raw.cols.filter((c) => c.type === "date").length}개</p>
      ${note("info", "예: 최대전력 열에 결측치가 3개 있다. 지역명은 모두 같아서 분석에 필요 없다.").replace(/<button[^]*?<\/button>/, "")}
    </section>

    <section class="card">
      <h3>② 데이터 전처리</h3>
      <div class="cols2">
        <div class="field"><label>결측치 처리</label>
          ${[["none", "그대로 두기"], ["drop", "결측치가 있는 행 삭제 (dropna)"], ["mean", "수치형 결측치를 평균으로 채우기 (fillna)"]].map(([k, l]) =>
            `<label class="check"><input type="radio" name="missing" value="${k}" ${s.missing === k ? "checked" : ""} /> ${l}</label>`).join("")}</div>
        <div class="field"><label>속성 값의 범위 맞추기 (정규화)</label>
          ${[["none", "하지 않음"], ["z", "표준화 – 평균 0, 표준편차 1 (StandardScaler)"], ["minmax", "최소-최대 정규화 – 0~1 (MinMaxScaler)"]].map(([k, l]) =>
            `<label class="check"><input type="radio" name="scale" value="${k}" ${s.scale === k ? "checked" : ""} /> ${l}</label>`).join("")}
          ${s.scale !== "none" ? `<p class="hint">정규화할 속성 (예측하려는 종속 변수는 보통 빼요)</p><div class="checks inline">${rawNums.map((n) => `<label class="check"><input type="checkbox" data-scale="${esc(n)}" ${s.scaleCols.includes(n) ? "checked" : ""} /> ${esc(n)}</label>`).join("")}</div>` : ""}
        </div>
      </div>
      <p class="log">${t.log.length ? "전처리 기록: " + t.log.map(esc).join(" → ") + ` · 결과 ${t.n.toLocaleString("ko-KR")}행` : "아직 전처리를 하지 않았어요. 아래 결과는 원래 데이터 그대로예요."}</p>
    </section>

    <section class="card">
      <h3>③ 통계적 특성 확인하기 <code>df.describe()</code></h3>
      ${describeHtml(t)}
      ${note("describe", "예: 최대전력의 최솟값은 53,936, 최댓값은 94,509이고 평균은 약 73,596이다.").replace(/<button[^]*?<\/button>/, "")}
    </section>

    <h3 class="section-title">④ 데이터 시각화하기</h3>
    <div class="viz-grid">
      <section class="card viz"><h4>히스토그램 – 값이 어떻게 분포하나?</h4>
        <label class="ctl">속성 <select data-s4="hist">${opt(nums, s.hist)}</select></label>
        <div class="chart-box"><canvas id="cHist"></canvas></div>${note("hist", "예: 65,000~75,000 사이에 가장 많이 분포한다.")}</section>

      <section class="card viz"><h4>선그래프 – 시간(순서)에 따라 어떻게 변하나?</h4>
        <div class="ctl-row"><label class="ctl">가로축 <select data-s4="lx">${opt(xLine, s.lx || "(행 순서)")}</select></label>
          <label class="ctl">세로축 <select data-s4="ly">${opt(nums, s.ly)}</select></label></div>
        <div class="chart-box"><canvas id="cLine"></canvas></div>${note("line", "예: 1~2월, 7~8월, 12월에 높게 나타난다.")}</section>

      <section class="card viz"><h4>상자 그림 – 속성들의 범위와 이상치</h4>
        <div class="checks inline small">${nums.map((n) => `<label class="check"><input type="checkbox" data-box="${esc(n)}" ${s.box.includes(n) ? "checked" : ""} /> ${esc(n)}</label>`).join("")}</div>
        <div class="box-wrap" id="cBox"></div>${note("box", "예: 습도와 풍속의 범위가 크게 달라서 정규화가 필요하다.")}</section>

      <section class="card viz"><h4>산점도 – 두 속성의 관계</h4>
        <div class="ctl-row"><label class="ctl">X <select data-s4="sx">${opt(nums, s.sx)}</select></label>
          <label class="ctl">Y <select data-s4="sy">${opt(nums, s.sy)}</select></label>
          ${cats.length ? `<label class="ctl">색 구분 <select data-s4="sc">${opt(cats, s.sc, "없음")}</select></label>` : ""}</div>
        <p class="corr" id="corr"></p>
        <div class="chart-box"><canvas id="cScatter"></canvas></div>${note("scatter", "예: 기온이 아주 낮거나 높을 때 최대전력이 크다 (U자 모양).")}</section>
    </div>
    <section class="card"><h4>상관 행렬 – 수치형 속성끼리의 상관계수 <code>df.corr()</code></h4>
      <div class="table-wrap" id="cCorr">${corrHtml(t)}</div>${note("corr", "예: 최대전력과 가장 상관이 큰 속성은 …이다. 단, 상관관계가 인과관계는 아니다.").replace(/<button[^]*?<\/button>/, "")}</section>

    <section class="card">
      <h3>⑤ 탐색 결과 정리</h3>
      ${field("s4.summary", "탐색으로 알게 된 점과, 다음 단계에서 어떻게 분석할지", { rows: 4, hint: "어떤 속성이 문제와 관련 있어 보이나요? 어떤 분석 방법(회귀·분류·군집 등)을 쓰면 좋을까요?", ph: "예: 기온과 최대전력은 직선 관계가 아니어서 선형 회귀만으로는 예측이 어려울 수 있다. …" })}
    </section>
    ${coachBox("s4")}${nav()}`;
  }

  function describeHtml(t) {
    const nums = t.cols.filter((c) => c.type === "num");
    const cats = t.cols.filter((c) => c.type !== "num");
    let html = "";
    if (nums.length) {
      const ds = nums.map((c) => DS.describe(c));
      const rows = [["count", "개수"], ["mean", "평균"], ["std", "표준편차"], ["min", "최솟값"], ["q1", "25%"], ["median", "50%(중앙값)"], ["q3", "75%"], ["max", "최댓값"]];
      html += `<div class="table-wrap"><table class="desc"><thead><tr><th></th>${nums.map((c) => `<th>${esc(c.name)}${c.scaled ? ' <small class="type num">정규화</small>' : ""}</th>`).join("")}</tr></thead>
        <tbody>${rows.map(([k, l]) => `<tr><th>${k}<small> ${l}</small></th>${ds.map((d) => `<td>${k === "count" ? d.count : fmtAuto(d[k])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    }
    const shown = cats.filter((c) => c.type === "text").slice(0, 4);
    if (shown.length) {
      html += `<div class="freq">${shown.map((c) => {
        const f = DS.freq(c);
        return `<div><b>${esc(c.name)}</b> <span class="muted small">종류 ${f.length}개</span><br><span class="small">${f.slice(0, 6).map(([k, v]) => `${esc(k)} ${v}`).join(" · ")}${f.length > 6 ? " …" : ""}</span></div>`;
      }).join("")}</div>`;
    }
    return html || `<p class="muted">수치형 속성이 없어요.</p>`;
  }

  function corrHtml(t) {
    const nums = t.cols.filter((c) => c.type === "num").slice(0, 12);
    if (nums.length < 2) return `<p class="muted">수치형 속성이 2개 이상 있어야 해요.</p>`;
    const pos = css("--div-pos"), neg = css("--div-neg");
    const cell = (r) => {
      if (r == null) return `<td class="muted">–</td>`;
      const a = Math.min(1, Math.abs(r));
      const bg = `color-mix(in srgb, ${r >= 0 ? pos : neg} ${Math.round(a * 85)}%, transparent)`;
      return `<td style="background:${bg};color:${a > 0.55 ? "#fff" : "inherit"}" title="r = ${r.toFixed(3)}">${r.toFixed(2)}</td>`;
    };
    return `<table class="corr-m"><thead><tr><th></th>${nums.map((c) => `<th>${esc(c.name)}</th>`).join("")}</tr></thead><tbody>
      ${nums.map((a) => `<tr><th>${esc(a.name)}</th>${nums.map((b) => cell(a === b ? 1 : DS.pearson(a.values, b.values)?.r ?? null)).join("")}</tr>`).join("")}</tbody></table>
      <p class="hint">파란색은 양(+)의 상관, 주황색은 음(-)의 상관이에요. 색이 진할수록 관계가 강해요.</p>`;
  }

  // ---------- 차트 ----------

  const charts = {};
  function chart(id, cfg) {
    charts[id]?.destroy();
    const el = document.getElementById(id);
    if (!el) return null;
    return (charts[id] = new Chart(el, cfg));
  }
  const destroyCharts = () => { for (const k of Object.keys(charts)) { charts[k].destroy(); delete charts[k]; } };
  const tip = () => ({ backgroundColor: css("--surface"), titleColor: css("--text"), bodyColor: css("--text-2"), borderColor: css("--border"), borderWidth: 1, padding: 10, cornerRadius: 8, displayColors: false });
  const axis = (title) => ({ grid: { color: css("--grid") }, title: { display: !!title, text: title }, ticks: { maxRotation: 0, autoSkipPadding: 12, callback(v) { return this.type === "category" ? this.getLabelForValue(v) : fmtAuto(v); } } });
  const CAT = () => [1, 2, 3, 4, 5, 6, 7, 8].map((i) => css(`--cat-${i}`));

  function drawS4() {
    const t = table();
    if (!t) return;
    const s = P.s4;
    Chart.defaults.font.family = '"Noto Sans KR", system-ui, sans-serif';
    Chart.defaults.color = css("--text-2");
    Chart.defaults.borderColor = css("--grid");

    // 히스토그램
    if (s.hist) {
      const h = DS.histogram(t.byName[s.hist].values);
      chart("cHist", {
        type: "bar",
        data: { labels: h.counts.map((_, i) => fmtAuto(h.edges[i])), datasets: [{ data: h.counts, backgroundColor: css("--accent"), barPercentage: 1, categoryPercentage: 0.96, borderRadius: 2 }] },
        options: { maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { ...tip(), callbacks: { title: (c) => `${fmtAuto(h.edges[c[0].dataIndex])} ~ ${fmtAuto(h.edges[c[0].dataIndex + 1])}`, label: (c) => `${c.raw}개` } } },
          scales: { x: { ...axis(s.hist), grid: { display: false } }, y: { ...axis("개수"), beginAtZero: true } } },
      });
    }

    // 선그래프
    if (s.ly) {
      const xc = s.lx && s.lx !== "(행 순서)" ? t.byName[s.lx] : null;
      const y = t.byName[s.ly].values;
      let idx = [...Array(t.n).keys()];
      if (xc && xc.type === "num") idx = idx.filter((i) => xc.values[i] != null).sort((a, b) => xc.values[a] - xc.values[b]);
      if (xc && xc.type === "date") idx = idx.filter((i) => xc.values[i] != null).sort((a, b) => String(xc.values[a]).localeCompare(String(xc.values[b])));
      chart("cLine", {
        type: "line",
        data: { labels: idx.map((i) => (xc ? xc.values[i] : i)), datasets: [{ data: idx.map((i) => y[i]), borderColor: css("--accent"), borderWidth: 1.6, pointRadius: idx.length > 60 ? 0 : 2.5, spanGaps: false, tension: 0 }] },
        options: { maintainAspectRatio: false, animation: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { display: false }, tooltip: { ...tip(), callbacks: { label: (c) => `${s.ly}: ${fmtAuto(c.raw)}` } } },
          scales: { x: { ...axis(xc ? xc.name : "행 번호"), grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } }, y: axis(s.ly) } },
      });
    }

    // 산점도
    if (s.sx && s.sy) {
      const xs = t.byName[s.sx].values, ys = t.byName[s.sy].values;
      const cc = s.sc ? t.byName[s.sc] : null;
      const groups = new Map();
      for (let i = 0; i < t.n; i++) {
        if (xs[i] == null || ys[i] == null) continue;
        const g = cc ? cc.values[i] ?? "(결측)" : "전체";
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push({ x: xs[i], y: ys[i] });
      }
      const cat = CAT();
      const fit = DS.pearson(xs, ys);
      const all = [...groups.values()].flat();
      const datasets = [...groups.entries()].map(([g, pts], k) => ({ label: g, data: pts, backgroundColor: cc ? cat[k % 8] : css("--accent"), borderColor: css("--surface"), borderWidth: 1, pointRadius: all.length > 300 ? 3 : 4.5 }));
      if (fit) {
        const xv = all.map((p) => p.x), x0 = Math.min(...xv), x1 = Math.max(...xv);
        datasets.push({ label: "추세선", type: "line", data: [{ x: x0, y: fit.slope * x0 + fit.b }, { x: x1, y: fit.slope * x1 + fit.b }], borderColor: css("--muted"), borderDash: [6, 4], borderWidth: 2, pointRadius: 0 });
      }
      chart("cScatter", {
        type: "scatter", data: { datasets },
        options: { maintainAspectRatio: false, animation: false,
          plugins: { legend: { display: !!cc, position: "bottom", labels: { boxWidth: 10, filter: (l) => l.text !== "추세선" } }, tooltip: { ...tip(), filter: (c) => c.dataset.label !== "추세선", callbacks: { label: (c) => `${cc ? c.dataset.label + " · " : ""}(${fmtAuto(c.raw.x)}, ${fmtAuto(c.raw.y)})` } } },
          scales: { x: { ...axis(s.sx), type: "linear", grace: "4%" }, y: { ...axis(s.sy), grace: "4%" } } },
      });
      $("#corr").innerHTML = fit ? `상관계수 <b>r = ${fit.r.toFixed(3)}</b> · ${DS.corrWord(fit.r)} (점 ${fit.n}개) <span class="muted">· 상관관계는 인과관계가 아니에요.</span>` : "점이 3개 이상 있어야 상관계수를 계산할 수 있어요.";
    }

    // 상자 그림 (SVG)
    $("#cBox").innerHTML = boxSvg(t, s.box);
  }

  function boxSvg(t, names) {
    const data = names.map((n) => ({ n, f: DS.fiveNum(t.byName[n].values) })).filter((d) => d.f);
    if (!data.length) return `<p class="muted small">속성을 하나 이상 골라 주세요.</p>`;
    const lo = Math.min(...data.map((d) => d.f.min)), hi = Math.max(...data.map((d) => d.f.max));
    const W = 460, rowH = 32, padL = 118, padR = 16, top = 8, H = top + data.length * rowH + 30;
    const x = (v) => padL + ((v - lo) / (hi - lo || 1)) * (W - padL - padR);
    const c = { accent: css("--accent"), text: css("--text"), text2: css("--text-2"), grid: css("--grid"), hl: css("--highlight"), fill: css("--seq-1") };
    const ticks = niceTicks(lo, hi, 5);
    let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="상자 그림" font-family="Noto Sans KR, sans-serif" font-size="12">`;
    for (const tv of ticks) svg += `<line x1="${x(tv)}" x2="${x(tv)}" y1="${top}" y2="${H - 24}" stroke="${c.grid}"/><text x="${x(tv)}" y="${H - 8}" text-anchor="middle" fill="${c.text2}">${fmtAuto(tv)}</text>`;
    data.forEach((d, i) => {
      const y = top + i * rowH + rowH / 2, f = d.f, h = 16;
      const label = d.n.length > 16 ? d.n.slice(0, 15) + "…" : d.n;
      svg += `<text x="${padL - 8}" y="${y + 4}" text-anchor="end" fill="${c.text}"><title>${esc(d.n)}</title>${esc(label)}</text>
        <line x1="${x(f.lo)}" x2="${x(f.hi)}" y1="${y}" y2="${y}" stroke="${c.text2}"/>
        <line x1="${x(f.lo)}" x2="${x(f.lo)}" y1="${y - 6}" y2="${y + 6}" stroke="${c.text2}"/><line x1="${x(f.hi)}" x2="${x(f.hi)}" y1="${y - 6}" y2="${y + 6}" stroke="${c.text2}"/>
        <rect x="${x(f.q1)}" y="${y - h / 2}" width="${Math.max(1, x(f.q3) - x(f.q1))}" height="${h}" fill="${c.fill}" stroke="${c.accent}" rx="2"><title>${esc(d.n)}: Q1 ${fmtAuto(f.q1)} · 중앙값 ${fmtAuto(f.med)} · Q3 ${fmtAuto(f.q3)}</title></rect>
        <line x1="${x(f.med)}" x2="${x(f.med)}" y1="${y - h / 2}" y2="${y + h / 2}" stroke="${c.accent}" stroke-width="2.5"/>`;
      for (const o of f.outliers.slice(0, 60)) svg += `<circle cx="${x(o)}" cy="${y}" r="2.6" fill="none" stroke="${c.hl}"/>`;
    });
    return svg + `</svg><p class="hint">상자는 25%~75%(Q1~Q3), 굵은 선은 중앙값, 동그라미는 이상치(1.5×IQR 밖)예요.</p>`;
  }
  function niceTicks(lo, hi, n) {
    const span = hi - lo || 1, step0 = span / n, mag = 10 ** Math.floor(Math.log10(step0));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0);
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toPrecision(12));
    return out;
  }

  // 그래프를 그림으로 저장해서 보고서에 넣기 (흰 배경 JPEG로 작게)
  async function snapshot(key) {
    let src = null, w, h;
    const canvasId = { hist: "cHist", line: "cLine", scatter: "cScatter" }[key];
    if (canvasId) {
      const c = document.getElementById(canvasId);
      src = c; w = c.width; h = c.height;
    } else if (key === "box") {
      const svg = $("#cBox svg");
      if (!svg) return;
      const img = new Image();
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(svg));
      await img.decode();
      const vb = svg.viewBox.baseVal; w = vb.width * 2; h = vb.height * 2; src = img;
    }
    if (!src) return;
    const out = document.createElement("canvas");
    const scale = Math.min(1, 900 / w);
    out.width = Math.round(w * scale); out.height = Math.round(h * scale);
    const g = out.getContext("2d");
    g.fillStyle = css("--surface"); g.fillRect(0, 0, out.width, out.height);
    g.drawImage(src, 0, 0, out.width, out.height);
    P.s4.snaps[key] = out.toDataURL("image/jpeg", 0.85);
    save();
    const b = $(`[data-snap="${key}"]`);
    if (b) b.textContent = "보고서 그림 다시 넣기 ✓";
  }

  function bindS4(root) {
    root.addEventListener("change", (e) => {
      const el = e.target, s = P.s4;
      if (el.dataset.use !== undefined) {
        const n = el.dataset.use;
        s.drop = el.checked ? s.drop.filter((x) => x !== n) : [...s.drop, n];
      } else if (el.name === "missing") s.missing = el.value;
      else if (el.name === "scale") {
        s.scale = el.value;
        if (el.value !== "none" && !s.scaleCols.length) s.scaleCols = numCols(rawTable()).filter((n) => !s.drop.includes(n) && n !== P.s5.y);
      } else if (el.dataset.scale !== undefined) s.scaleCols = $$("[data-scale]:checked").map((c) => c.dataset.scale);
      else if (el.dataset.box !== undefined) s.box = $$("[data-box]:checked").map((c) => c.dataset.box);
      else if (el.dataset.s4) { s[el.dataset.s4] = el.value; save(); drawS4(); return; }
      else return;
      save();
      const y = window.scrollY;
      render();
      window.scrollTo(0, y);
    });
    root.addEventListener("click", (e) => {
      const b = e.target.closest("[data-snap]");
      if (b) snapshot(b.dataset.snap);
    });
    drawS4();
  }

  // ---------- 5단계: 데이터 분석 ----------

  let lastReg = null;
  function currentReg() {
    const t = table();
    if (!t || !P.s5.y || !P.s5.xs.length) return null;
    try { return DS.regress(t, P.s5.xs, P.s5.y, { testRatio: +P.s5.test, seed: +P.s5.seed || 1234 }); } catch { return null; }
  }
  function renderS5() {
    const t = table();
    if (!t) return head(STEPS[4], "") + needData() + nav();
    const nums = numCols(t);
    const s = P.s5;
    if (!nums.includes(s.y)) s.y = "";
    s.xs = s.xs.filter((n) => nums.includes(n) && n !== s.y);
    let res = null, err = "";
    if (s.y && s.xs.length) {
      try { res = DS.regress(t, s.xs, s.y, { testRatio: +s.test, seed: +s.seed || 1234 }); } catch (e) { err = e.message; }
    }
    lastReg = res;
    const scaled = t.cols.filter((c) => c.scaled && s.xs.includes(c.name)).length;
    return head(STEPS[4], "문제 해결에 가장 알맞은 방법으로 데이터를 <b>모델링</b>하고 결과를 해석해요. 여기서는 (다중) 선형 회귀로 예측 모델을 만들어 봐요.") + `
    <section class="card">
      <h3>① 종속 변수와 독립 변수 고르기</h3>
      <div class="cols2">
        <div class="field"><label>종속 변수 y – 예측하고 싶은 것</label>
          <select data-s5="y">${opt(nums, s.y, "골라 주세요")}</select>
          <p class="hint">2단계에서 쓴 필요한 속성: ${esc(P.s2.variables || "–").replace(/\n/g, " · ")}</p></div>
        <div class="field"><label>독립 변수 X – 영향을 줄 것 같은 것 (여러 개 가능)</label>
          <div class="checks inline">${nums.filter((n) => n !== s.y).map((n) => `<label class="check"><input type="checkbox" data-x="${esc(n)}" ${s.xs.includes(n) ? "checked" : ""} /> ${esc(n)}</label>`).join("")}</div></div>
      </div>
      <div class="ctl-row">
        <label class="ctl">학습 : 평가 데이터 <select data-s5="test">${[[0, "나누지 않음 (전체로 학습)"], [0.2, "80% : 20%"], [0.3, "70% : 30% (교과서)"]].map(([v, l]) => `<option value="${v}" ${+s.test === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="ctl">random_state <input type="number" data-s5="seed" value="${esc(s.seed)}" style="width:7em" /></label>
      </div>
      ${t.byName[s.y]?.scaled ? `<p class="warn-box">종속 변수 '${esc(s.y)}'도 정규화되어 있어서 예측값이 원래 단위가 아니에요. 4단계 ② 전처리에서 이 속성의 체크를 풀면 원래 단위로 예측해요.</p>` : ""}
      <p class="hint">4단계에서 한 전처리(${t.log.length ? t.log.map(esc).join(", ") : "없음"})가 적용된 데이터로 분석해요.</p>
    </section>
    ${err ? `<section class="card"><p class="err-msg">${esc(err)}</p></section>` : ""}
    ${res ? regHtml(res, scaled) : !err ? `<section class="card"><p class="muted">종속 변수와 독립 변수를 고르면 결과가 나와요.</p></section>` : ""}
    <section class="card">
      <h3>③ 결과 해석</h3>
      ${field("s5.method", "선택한 분석 방법과 그 이유", { rows: 2, ph: "예: 최대전력이라는 수치를 예측해야 하므로 회귀 분석을 선택했다." })}
      ${field("s5.interpret", "결과 해석 – 모델이 문제를 잘 해결하나요?", { rows: 4, hint: "결정 계수(R²)는 1에 가까울수록 모델이 데이터를 잘 설명해요. 학습 R²와 평가 R²를 비교해 보세요.", ph: "예: 평가 데이터의 결정 계수가 약 0.05로 매우 작다. 기온이 낮은 겨울과 높은 여름 모두 전력이 많아서 직선으로 설명하기 어렵다." })}
      ${field("s5.next", "더 해 보고 싶은 분석 (선택)", { rows: 2, ph: "예: 랜덤 포레스트 회귀(Orange3/파이썬)로 다시 학습해 선형 회귀와 성능을 비교한다." })}
      <p class="hint">교과서처럼 두 가지 이상의 방법으로 분석해 결과를 비교하면 더 좋아요. 랜덤 포레스트·군집·분류는 Orange3나 파이썬에서 이어서 해 보세요. (위 '내 데이터셋'을 CSV로 내려받아 쓰면 돼요)</p>
    </section>
    ${coachBox("s5")}${nav()}`;
  }

  function regHtml(r, scaled) {
    const terms = r.xNames.map((n, i) => `${r.beta[i + 1] >= 0 ? "+" : "−"} ${fmtAuto(Math.abs(r.beta[i + 1]))} × [${esc(n)}]`).join(" ");
    const r2w = (v) => (v == null ? "" : v >= 0.7 ? "잘 설명함" : v >= 0.4 ? "어느 정도 설명함" : v >= 0.1 ? "설명력이 약함" : "거의 설명하지 못함");
    return `<section class="card">
      <h3>② 모델 학습과 평가 결과</h3>
      <p class="formula">[${esc(r.yName)}] = ${fmtAuto(r.beta[0])} ${terms}</p>
      ${scaled ? `<p class="hint">정규화한 독립 변수의 계수는 '1 표준편차(또는 범위) 늘 때 y의 변화'라서, 계수 크기끼리 비교할 수 있어요.</p>` : ""}
      <div class="metrics">
        <div class="metric"><span>학습 데이터 결정 계수 R²</span><b>${r.r2Train.toFixed(3)}</b><small>${r.nTrain}행 · ${r2w(r.r2Train)}</small></div>
        ${r.r2Test != null ? `<div class="metric primary"><span>평가 데이터 결정 계수 R²</span><b>${r.r2Test.toFixed(3)}</b><small>${r.nTest}행 · ${r2w(r.r2Test)}</small></div>` : ""}
        <div class="metric"><span>평균 오차 RMSE</span><b>${fmtAuto(r.rmseTest ?? r.rmseTrain)}</b><small>${r.rmseTest != null ? "평가" : "학습"} 데이터 · y와 같은 단위</small></div>
      </div>
      <div class="table-wrap"><table class="coef"><thead><tr><th>항</th><th>계수</th><th>뜻</th></tr></thead><tbody>
        <tr><td>절편</td><td>${fmtAuto(r.beta[0])}</td><td class="muted">모든 X가 0일 때 예측값</td></tr>
        ${r.xNames.map((n, i) => `<tr><td>${esc(n)}</td><td>${fmtAuto(r.beta[i + 1])}</td><td class="muted">${esc(n)}이(가) 1 늘면 ${esc(r.yName)}이(가) ${fmtAuto(Math.abs(r.beta[i + 1]))} ${r.beta[i + 1] >= 0 ? "늘어남" : "줄어듦"} (다른 X는 그대로일 때)</td></tr>`).join("")}
      </tbody></table></div>
      <div class="chart-box"><canvas id="cPred"></canvas></div>
      <p class="hint">점이 대각선에 가까울수록 예측이 정확해요. ${r.nTest ? "주황색은 평가 데이터(모델이 처음 보는 데이터)예요." : ""}</p>
    </section>`;
  }
  function drawS5() {
    const r = lastReg;
    if (!r) return;
    const all = [...r.train, ...r.test];
    const lo = Math.min(...all.map((p) => Math.min(p.y, p.yhat))), hi = Math.max(...all.map((p) => Math.max(p.y, p.yhat)));
    chart("cPred", {
      type: "scatter",
      data: { datasets: [
        { label: "학습 데이터", data: r.train.map((p) => ({ x: p.y, y: p.yhat })), backgroundColor: css("--accent"), pointRadius: 3.5 },
        { label: "평가 데이터", data: r.test.map((p) => ({ x: p.y, y: p.yhat })), backgroundColor: css("--highlight"), pointRadius: 4 },
        { label: "완벽한 예측", type: "line", data: [{ x: lo, y: lo }, { x: hi, y: hi }], borderColor: css("--muted"), borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0 },
      ] },
      options: { maintainAspectRatio: false, animation: false,
        plugins: { legend: { position: "bottom", labels: { boxWidth: 10 } }, tooltip: { ...tip(), callbacks: { label: (c) => `실제 ${fmtAuto(c.raw.x)} · 예측 ${fmtAuto(c.raw.y)}` } } },
        scales: { x: { ...axis(`실제 ${r.yName}`), type: "linear" }, y: axis(`예측 ${r.yName}`) } },
    });
  }
  function bindS5(root) {
    root.addEventListener("change", (e) => {
      const el = e.target;
      if (el.dataset.s5) P.s5[el.dataset.s5] = el.value;
      else if (el.dataset.x !== undefined) P.s5.xs = $$("[data-x]:checked").map((c) => c.dataset.x);
      else return;
      if (el.dataset.s5 === "y") P.s5.xs = P.s5.xs.filter((n) => n !== el.value);
      save();
      const y = window.scrollY; render(); window.scrollTo(0, y);
    });
    drawS5();
  }

  // ---------- 6단계: 일반화 및 공유 ----------

  function renderS6() {
    return head(STEPS[5], "분석 목적부터 수집·분석까지 전 과정을 <b>성찰</b>하고, 사회적 영향과 윤리 문제를 고려해 결과의 활용 방안을 찾아 공유해요.") + `
    <section class="card">
      <div class="cols2"><div>
        ${field("s6.result", "① 분석 결과 요약 – 처음 질문에 대한 답은?", { rows: 4, ph: "예: 기상 데이터로 최대 전력을 예측할 때 선형 회귀(R² 0.05)보다 랜덤 포레스트(R² 0.89)가 훨씬 정확했다." })}
        ${field("s6.use", "② 결과를 어떻게 활용할 수 있나요?", { rows: 3, ph: "예: 여름·겨울철 최대 전력 수요를 미리 예측해 전력 공급 부족 사태를 막는다." })}
        ${field("s6.impact", "③ 사회적 영향과 윤리적 문제", { rows: 3, hint: "누가 이익을 보고 누가 피해를 볼 수 있나요? 개인정보·편향·오남용 가능성은 없나요?", ph: "예: 예측이 틀리면 정전 피해가 생길 수 있으므로 예측 결과만 믿지 않고 여유 전력을 확보해야 한다." })}
      </div><div>
        ${field("s6.limits", "④ 한계와 개선 방법 – 다시 한다면?", { rows: 4, ph: "예: 1년치 데이터만 써서 해마다 달라지는 경향을 반영하지 못했다. 여러 해 데이터를 더 모으면 좋겠다." })}
        ${field("s6.share", "⑤ 어떻게 공유할까요?", { rows: 3, ph: "예: 학급 발표, 학교 누리집 게시, 보고서 제출" })}
        <div class="share-box"><h4>보고서로 정리하기</h4><p class="hint">1~6단계에 쓴 내용과 그래프를 한 장의 보고서로 모아요. 인쇄 창에서 'PDF로 저장'을 고르면 파일로 낼 수 있어요.</p>
          <button type="button" class="btn" id="btnPrint">보고서 인쇄 / PDF 저장</button></div>
      </div></div>
    </section>
    ${coachBox("s6")}
    <section class="card report" id="report" aria-label="보고서 미리보기">${reportHtml()}</section>
    ${nav()}`;
  }

  function reportHtml() {
    const sdg = sdgOf(P.sdg);
    const para = (s) => (String(s || "").trim() ? `<p>${esc(s).replace(/\n/g, "<br>")}</p>` : `<p class="muted">(작성하지 않음)</p>`);
    const qa = (label, v) => `<h4>${label}</h4>${para(v)}`;
    const t = table();
    const members = P.s1.members.filter((m) => m.name.trim()).map((m) => `${esc(m.name)}(${esc(m.role)})`).join(", ");
    const snap = (k, cap) => (P.s4.snaps[k] ? `<figure><img src="${P.s4.snaps[k]}" alt="${cap}" /><figcaption>${cap}${P.s4.notes[k] ? " – " + esc(P.s4.notes[k]) : ""}</figcaption></figure>` : "");
    const r = currentReg();
    return `<p class="eyebrow">보고서 미리보기</p>
      <h2>${esc(P.s1.topic) || "(프로젝트 주제)"}</h2>
      <p class="meta">${sdg ? `<span class="pill" style="--c:${sdg.color}">SDG ${sdg.no}. ${sdg.name}</span>` : ""} ${esc(P.s1.team)} ${members ? "· " + members : ""} · ${new Date().toLocaleDateString("ko-KR")}</p>
      <h3>1. 주제 선정</h3>${qa("지속 가능 발전 목표를 선택한 이유", P.s1.reason)}${P.s1.career ? qa("진로 연계", P.s1.career) : ""}
      <h3>2. 문제 정의</h3>${qa("문제 상황", P.s2.situation)}${qa("데이터로 답하고 싶은 질문", P.s2.question)}${qa("데이터로 해결할 수 있는 이유", P.s2.why)}${qa("가설", P.s2.hypothesis)}${qa("필요한 데이터(속성)", P.s2.variables)}
      <h3>3. 데이터 수집</h3>
      ${P.s3.dataset ? `<p><b>${esc(P.s3.dataset.name)}</b> · ${P.s3.dataset.rows.length.toLocaleString("ko-KR")}행 × ${P.s3.dataset.columns.length}열</p>` : '<p class="muted">(데이터 없음)</p>'}
      ${qa("출처", P.s3.source)}${qa("수집 범위", P.s3.period)}${qa("수집 방법", P.s3.method)}${qa("적합한 이유", P.s3.fit)}
      <h3>4. 탐색적 데이터 분석 및 전처리</h3>
      ${t ? `<p class="small">전처리: ${t.log.length ? t.log.map(esc).join(" → ") : "하지 않음"}</p>${describeHtml(t)}` : ""}
      ${P.s4.notes.info ? qa("데이터 특성", P.s4.notes.info) : ""}${P.s4.notes.describe ? qa("통계적 특성", P.s4.notes.describe) : ""}
      <div class="figs">${snap("hist", "히스토그램")}${snap("line", "선그래프")}${snap("box", "상자 그림")}${snap("scatter", "산점도")}</div>
      ${P.s4.notes.corr ? qa("상관 행렬에서 발견한 점", P.s4.notes.corr) : ""}
      ${qa("탐색 결과 정리", P.s4.summary)}
      <h3>5. 데이터 분석</h3>
      ${r ? `<p class="formula">[${esc(r.yName)}] = ${fmtAuto(r.beta[0])} ${r.xNames.map((n, i) => `${r.beta[i + 1] >= 0 ? "+" : "−"} ${fmtAuto(Math.abs(r.beta[i + 1]))} × [${esc(n)}]`).join(" ")}</p>
        <p>학습 R² = ${r.r2Train.toFixed(3)}${r.r2Test != null ? ` · 평가 R² = ${r.r2Test.toFixed(3)}` : ""} · RMSE = ${fmtAuto(r.rmseTest ?? r.rmseTrain)}</p>` : '<p class="muted">(회귀 분석 결과 없음)</p>'}
      ${qa("분석 방법과 이유", P.s5.method)}${qa("결과 해석", P.s5.interpret)}${P.s5.next ? qa("더 해 보고 싶은 분석", P.s5.next) : ""}
      <h3>6. 일반화 및 공유</h3>${qa("분석 결과 요약", P.s6.result)}${qa("활용 방안", P.s6.use)}${qa("사회적 영향과 윤리적 문제", P.s6.impact)}${qa("한계와 개선 방법", P.s6.limits)}${qa("공유 방법", P.s6.share)}`;
  }
  function bindS6(root) {
    root.addEventListener("click", (e) => { if (e.target.id === "btnPrint") { $("#report").innerHTML = reportHtml(); window.print(); } });
    root.addEventListener("input", () => { clearTimeout(bindS6.t); bindS6.t = setTimeout(() => { const r = $("#report"); if (r) r.innerHTML = reportHtml(); }, 500); });
  }

  // ---------- 그리기 ----------

  const VIEWS = [[renderS1, bindS1], [renderS2, () => checkMsg()], [renderS3, bindS3], [renderS4, bindS4], [renderS5, bindS5], [renderS6, bindS6]];
  function render() {
    destroyCharts();
    if (map) { map.remove(); map = null; }
    // 이벤트가 겹치지 않도록 매번 새 요소로 교체
    const old = $("#main");
    const main = old.cloneNode(false);
    old.replaceWith(main);
    const [r, b] = VIEWS[step - 1];
    main.innerHTML = `<div class="step-body" data-key="${STEPS[step - 1].key}">${r()}</div>`;
    bindCommon(main);
    b(main);
    renderStepper();
  }

  function bindCommon(root) {
    root.addEventListener("input", (e) => {
      const el = e.target;
      if (el.dataset.bind) { setPath(el.dataset.bind, el.value); save(); }
    });
    root.addEventListener("change", (e) => {
      const el = e.target;
      if (el.dataset.bind && el.tagName === "SELECT") { setPath(el.dataset.bind, el.value); save(); }
      if (el.dataset.bindCheck) { setPath(el.dataset.bindCheck, el.checked); save(); checkMsg(); }
    });
    root.addEventListener("click", (e) => {
      const g = e.target.closest("[data-go]");
      if (g) return go(+g.dataset.go);
      const c = e.target.closest("[data-coach]");
      if (c) return askCoach(c.dataset.coach);
    });
    root.addEventListener("submit", (e) => {
      if (!e.target.matches("[data-coach-form]")) return;
      e.preventDefault();
      const q = e.target.querySelector("input").value.trim();
      if (q) askCoach(q);
    });
  }

  // ---------- 저장 · 불러오기 ----------

  $("#btnExport").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(P)], { type: "application/json" }));
    const name = (P.s1.team || P.s1.topic || "프로젝트").replace(/[\\/:*?"<>|]/g, "").slice(0, 30);
    a.download = `데이터과학프로젝트_${name}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $("#fileImport").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const p = JSON.parse(await f.text());
      if (p.v !== 1 || !p.s1) throw new Error("이 웹앱에서 저장한 파일이 아니에요.");
      P = merge(blank(), p); tblCache = null; save(); render();
    } catch (err) { alert("불러오지 못했어요: " + err.message); }
    e.target.value = "";
  });
  $("#btnReset").addEventListener("click", () => {
    if (!confirm("지금까지 쓴 내용을 모두 지우고 새로 시작할까요? (먼저 '파일로 저장'을 해 두면 안전해요)")) return;
    P = blank(); tblCache = null; save(); go(1);
  });

  // 다크 모드가 바뀌면 그래프 색을 다시 칠함
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => render());

  $("#foot").innerHTML = `<div>교과서: 고등학교 데이터 과학 Ⅳ. 데이터 과학 프로젝트 – 01. 데이터 과학 프로젝트의 개요 (168~183쪽)</div>
    <div>경기도 지도: 통계청 2018 시군구 경계(southkorea-maps) · ${GG_SOURCE} · 지도 배경 © OpenStreetMap</div>
    <div>작성 내용은 이 브라우저에만 자동 저장돼요. 다른 컴퓨터에서 이어 하려면 '파일로 저장'을 쓰세요.</div>`;

  const m = location.hash.match(/step(\d)/);
  if (m) step = +m[1];
  window.addEventListener("hashchange", () => {
    const h = location.hash.match(/step(\d)/);
    if (h && +h[1] !== step) go(+h[1]);
  });
  render();
  checkCoach();

  async function checkCoach() {
    if (!CFG.coachUrl || location.protocol === "file:") return;
    try {
      const r = await fetch(CFG.coachUrl, { signal: AbortSignal.timeout(8000) });
      const d = await r.json();
      COACH = !!(r.ok && d.gemini);
    } catch { COACH = false; }
    if (COACH && !$("main :focus")) render();
  }
})();
