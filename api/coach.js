// 데이터 과학 프로젝트 노트 - Vercel 서버리스 함수 (Gemini AI 코치)
// Gemini API 키는 Vercel 환경변수(GEMINI_API_KEY)에만 두고, 브라우저에는 피드백 글만 돌려줍니다.
//
//   GET  /api/coach   연결 확인 → { ok, gemini, model }
//   POST /api/coach   { step: "s1".."s6", question, project } → { answer, model }
//
// 환경변수 (Vercel > Settings > Environment Variables):
//   GEMINI_API_KEY  aistudio.google.com 에서 발급
//   GEMINI_MODEL    (선택) 기본값 gemini-flash-lite-latest (빠름)

const BASE = `너는 고등학교 '데이터 과학' 수업에서 학생 모둠의 데이터 과학 프로젝트를 돕는 코치야.
프로젝트 절차: 1 주제 선정(SDGs) → 2 문제 정의 → 3 데이터 수집 → 4 탐색적 데이터 분석·전처리 → 5 데이터 분석 → 6 일반화 및 공유.
원칙:
- 학생이 쓴 내용을 근거로 잘한 점 1가지, 보완할 점 1~2가지를 짚고, 스스로 생각해 볼 질문을 1~2개 던져.
- 학생 대신 답안을 완성해 주지 마. 예시는 짧은 힌트 수준으로만.
- 주어진 데이터 요약에 없는 수치를 지어내지 마. 데이터 출처를 추천할 때는 공공데이터포털, KOSIS, 경기데이터드림, 기상자료개방포털, 에어코리아, 나이스 등 실제로 있는 곳만 말해.
- 상관관계를 인과관계로 말하지 않도록 주의시켜.
- 학생이 아직 아무것도 쓰지 않았으면 무엇부터 쓰면 좋을지 안내해.
- 한국어, 고등학생 눈높이, 6~10문장. 마크다운 제목 없이 짧은 문단 또는 글머리표로.`;

const STEP_FOCUS = {
  s1: "지금은 1단계(주제 선정)야. 주제가 선택한 SDG와 연결되는지, 데이터로 다룰 수 있을 만큼 구체적인지 봐 줘.",
  s2: "지금은 2단계(문제 정의)야. 질문이 데이터로 확인 가능한지, 종속 변수와 독립 변수가 분명한지, 가설이 검증 가능한지 봐 줘.",
  s3: "지금은 3단계(데이터 수집)야. 문제를 풀기에 필요한 속성이 데이터에 있는지, 출처와 수집 범위가 분명한지, 더 모으면 좋을 데이터가 있는지 봐 줘.",
  s4: "지금은 4단계(탐색적 데이터 분석·전처리)야. 결측치·이상치·속성 범위 차이를 잘 확인했는지, 시각화에서 찾은 패턴이 타당한지, 다음 분석 방법 구상이 적절한지 봐 줘.",
  s5: "지금은 5단계(데이터 분석)야. 분석 방법 선택이 문제에 맞는지, 결정 계수 등 결과 해석이 올바른지, 비교해 볼 다른 방법이 있는지 봐 줘.",
  s6: "지금은 6단계(일반화 및 공유)야. 결과 활용 방안, 사회적 영향과 윤리적 문제, 한계 성찰이 충분한지 봐 줘.",
};

const DEFAULT_MODEL = "gemini-flash-lite-latest";
const TIME_LIMIT_MS = 22000; // Vercel 함수 제한(30초) 안에 깔끔한 오류를 돌려주기 위한 시간

export default async function handler(req, res) {
  const key = process.env.GEMINI_API_KEY || "";
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  if (req.method === "GET") return res.status(200).json({ ok: true, gemini: !!key, model });
  if (req.method !== "POST") return res.status(405).json({ error: "지원하지 않는 요청이에요." });
  if (!key) return res.status(500).json({ error: "GEMINI_API_KEY 환경변수가 설정되지 않았어요." });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const step = STEP_FOCUS[body.step] ? body.step : "s1";
    const question = String(body.question ?? "").slice(0, 300) || "피드백을 줘.";
    const project = JSON.stringify(body.project ?? {}).slice(0, 12000);

    const payload = JSON.stringify({
      systemInstruction: { parts: [{ text: `${BASE}\n${STEP_FOCUS[step]}` }] },
      contents: [{ role: "user", parts: [{ text: `학생 프로젝트 내용(JSON): ${project}\n\n학생 질문: ${question}` }] }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 1200 },
    });
    const started = Date.now();
    const call = () =>
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: payload,
        signal: AbortSignal.timeout(Math.max(1000, TIME_LIMIT_MS - (Date.now() - started))),
      }).then(async (r) => ({ r, data: await r.json().catch(() => ({})) }));

    // 사용자가 몰려 503/429가 나면 잠깐 쉬고 한 번 더 시도
    const busy = (x) => x.r.status === 503 || x.r.status === 429;
    let out;
    try {
      out = await call();
      if (busy(out) && Date.now() - started < TIME_LIMIT_MS - 5000) {
        await new Promise((ok) => setTimeout(ok, 1500));
        out = await call();
      }
    } catch (e) {
      if (e?.name === "TimeoutError" || e?.name === "AbortError")
        return res.status(504).json({ error: "AI 답변이 너무 오래 걸려요. 잠시 후 다시 눌러 주세요." });
      throw e;
    }

    if (!out.r.ok) {
      const msg = busy(out) ? "지금 AI 사용자가 많아요. 잠시 후 다시 눌러 주세요." : `Gemini 오류 ${out.r.status}: ${out.data?.error?.message ?? ""}`;
      return res.status(502).json({ error: msg });
    }
    const text = out.data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    return res.status(200).json({ answer: text.trim() || "답변을 만들지 못했어요. 다시 시도해 주세요.", model });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
