// AI 코치 함수 주소. Vercel에 배포하면 같은 주소의 /api/coach 를 그대로 쓰므로 고칠 필요가 없습니다.
// (index.html을 파일로 직접 열거나 python 서버로 띄우면 /api/coach 가 없어서 AI 코치만 꺼집니다)
// Gemini 키는 절대 여기에 적지 마세요. (Vercel > Settings > Environment Variables 에 GEMINI_API_KEY 로 넣기)
window.DSP_CONFIG = {
  coachUrl: "/api/coach",
};
