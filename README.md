# Planner

> Every planner failed me. So I made one that won't.

An AI-powered personal scheduling web app that understands how you actually think. Type tasks in plain Korean or English, and Gemini handles the structure — so you can focus on doing, not organizing.

---

## Features

### Natural Language Input
Describe your tasks the way you'd say them out loud. Gemini API parses your input and converts it into structured, actionable items — no rigid forms, no dropdowns.

### Drag-to-Paint Timetable
Block out your day visually. Click and drag across time slots to assign tasks, adjust durations, and build a schedule that looks the way your day actually feels.

### Pomodoro Timer
Built-in focus sessions with work/break intervals. Stay in flow without switching apps.

### AI Next-Step Recommendations
After completing a task, Gemini suggests what to tackle next based on your goals, priorities, and remaining schedule — not just alphabetical order.

### UI
- **Font:** [Pretendard](https://github.com/orioncactus/pretendard) for clean, legible Korean/Latin typography
- **Themes:** Light and dark mode
- **Layout:** Collapsible sidebar for distraction-free focus or full-context planning

---

## Tech Stack

- **Frontend:** HTML / CSS / JavaScript (no framework, no build tool)
- **AI:** [Gemini API](https://aistudio.google.com) (Google, free tier)

---

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/j5nim/planner_j5nim.git
   cd planner_j5nim
   ```

2. API 키 설정:
   ```bash
   cp config.example.js config.js
   ```
   `config.js`를 열고 `your_gemini_api_key_here` 부분을 본인의 Gemini API 키로 교체하세요.
   - API 키 발급: [https://aistudio.google.com](https://aistudio.google.com) → Get API key → Create API key

3. 로컬 서버 실행 (ES 모듈 사용으로 `file://` 직접 실행 불가):
   ```bash
   npx serve .
   ```
   브라우저에서 `http://localhost:3000` 접속

---

## License

MIT
