# 데이터 과학 프로젝트 노트 (SDGs)

교과서 **Ⅳ. 데이터 과학 프로젝트 – 01. 데이터 과학 프로젝트의 개요 (168~183쪽)** 의
'데이터 과학 문제 해결 절차'를 학생 모둠이 직접 주제를 정해 따라가며 기록하는 웹앱입니다.

| 단계 | 교과서 | 학생이 하는 일 |
|---|---|---|
| 1 주제 선정 | 170~173쪽 | SDGs 17개 중 하나 선택, 선택 이유, 프로젝트 주제, 모둠 역할 분담 |
| 2 문제 정의 | 173쪽 | 문제 상황, 데이터로 답할 질문, 가설, 필요한 속성(종속·독립 변수), 해결 가능성 점검표 |
| 3 데이터 수집 | 174~175쪽 | 경기도 시·군 지도에서 지표 골라 데이터셋 만들기 / 직접 모은 CSV 올리기(시·군 지표 결합 가능) / 예시 데이터, 출처·범위·방법 기록 |
| 4 탐색적 분석·전처리 | 176~178쪽 | `info()`·`describe()` 표, 결측치 처리, 표준화/정규화, 히스토그램·선그래프·상자 그림·산점도·상관 행렬, 그래프마다 '발견한 점' |
| 5 데이터 분석 | 179~181쪽 | 종속·독립 변수 선택, 학습/평가 분할(70:30, random_state), 다중 선형 회귀, R²·RMSE, 실제 vs 예측 그래프, 결과 해석 |
| 6 일반화 및 공유 | 181쪽 | 결과 요약·활용 방안·사회적 영향과 윤리·한계, 보고서 미리보기 → 인쇄/PDF |

- 각 단계 아래에 **AI 코치(Gemini)** 가 있어서 학생이 쓴 내용을 보고 질문과 힌트를 줍니다. (답을 대신 써 주지 않도록 설정)
- 작성 내용은 브라우저에 자동 저장되고, **파일로 저장(.json) / 불러오기**로 다른 컴퓨터에서 이어 할 수 있습니다.
- 4단계 그래프는 '보고서에 넣기'를 누르면 6단계 보고서에 그림으로 들어갑니다.

## 주소

- 배포: https://ds-project-sdgs.vercel.app (Vercel 프로젝트 `ds-project-sdgs`)
- 내 컴퓨터: `public/index.html`을 열거나 `python -m http.server 5540 --directory public` (이때 AI 코치만 꺼짐)

## AI 코치 (Gemini)

`api/coach.js`가 Vercel 서버리스 함수로 Gemini를 부릅니다. 키는 Vercel 환경변수에만 둡니다.

```bash
npx vercel@latest env add GEMINI_API_KEY production
```

```bash
npx vercel@latest deploy --prod
```

브라우저는 `/api/coach`에 GET을 보내 `gemini: true`일 때만 코치 버튼을 켭니다. 모델은 환경변수 `GEMINI_MODEL`로 바꿀 수 있습니다(기본 `gemini-flash-lite-latest`).

## 파일

- `public/index.html`, `public/style.css` – 화면
- `public/app.js` – 단계별 화면, 지도, 시각화, 회귀, 보고서, 저장
- `public/stats.js` – CSV 읽기(UTF-8/EUC-KR 자동), 자료형 판단, 기술 통계, 상관, 전처리, 최소제곱 회귀
- `public/config.js` – AI 코치 주소 (기본 `/api/coach`)
- `public/data/sdgs.js` – SDGs 17개(색·설명·주제 예시·추천 데이터 출처)
- `public/data/regions.js` – 경기도 31개 시·군 경계 + 면적 (우리 동네 데이터 분석기에서 복사)
- `public/data/indicators.js` – 시·군별 인구·교통·안전·의료·생활·문화·교육(나이스) 지표 46개 (우리 동네 데이터 분석기에서 복사)

## 경기도 지표 새로 고치기

3단계 지도 데이터는 '우리 동네 데이터 분석기'의 `scripts/build_data.py`가 만든 파일을 복사해 쓴 거예요.
우리 동네 쪽에서 데이터를 다시 만들었다면 두 파일을 다시 복사하고 배포하세요.

```bash
cp "C:/Users/USER/Desktop/웹앱/우리동네_데이터분석기/public/data/indicators.js" "C:/Users/USER/Desktop/웹앱/우리동네_데이터분석기/public/data/regions.js" public/data/
```

```bash
npx vercel@latest deploy --prod
```
- `public/data/samples.js` – 연습용 데이터(수원 2025 일별 날씨, 펭귄 150마리)
- `api/coach.js` – Gemini AI 코치 (Vercel 함수)
