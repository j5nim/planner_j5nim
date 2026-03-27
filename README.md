# Planner

> Every planner failed me. So I made one that won't.

An AI-powered personal scheduling web app that understands how you actually think. Type tasks in plain English (or whatever language you prefer), and Claude handles the structure — so you can focus on doing, not organizing.

---

## Features

### Natural Language Input
Describe your tasks the way you'd say them out loud. Claude API parses your input and converts it into structured, actionable items — no rigid forms, no dropdowns.

### Drag-to-Paint Timetable
Block out your day visually. Click and drag across time slots to assign tasks, adjust durations, and build a schedule that looks the way your day actually feels.

### Pomodoro Timer
Built-in focus sessions with work/break intervals. Stay in flow without switching apps.

### AI Next-Step Recommendations
After completing a task, Claude suggests what to tackle next based on your goals, priorities, and remaining schedule — not just alphabetical order.

### UI
- **Font:** [Pretendard](https://github.com/orioncactus/pretendard) for clean, legible Korean/Latin typography
- **Themes:** Light and dark mode
- **Layout:** Collapsible sidebar for distraction-free focus or full-context planning

---

## Tech Stack

- **Frontend:** HTML / CSS / JavaScript
- **AI:** [Claude API](https://www.anthropic.com/api) (Anthropic)

---

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/planner.git
   cd planner
   ```

2. Add your Anthropic API key to the environment or config file.

3. Open `index.html` in your browser, or serve it locally:
   ```bash
   npx serve .
   ```

---

## License

MIT
