// utils/greeting.js
// Dynamic greeting logic. Returns time-aware greeting strings.

const greetings = {
  morning: [
    "안녕하세요! 오늘은 어떤 일부터 끝내볼까요?",
    "좋은 아침이에요. 오늘 하루도 잘 시작해봐요.",
    "아침부터 여기 와줬군요. 오늘 뭐부터 해치울까요?",
  ],
  afternoon: [
    "오후가 됐네요. 지금까지 잘 하고 계신 거 맞죠?",
    "점심은 먹었나요? 오후도 같이 달려봐요.",
    "오후 시작이에요. 오늘 남은 할 일, 같이 정리해봐요.",
  ],
  evening: [
    "저녁이에요. 오늘 하루 어떠셨나요?",
    "퇴근 후에도 여기 오셨군요. 가볍게 정리해봐요.",
    "저녁 시간이네요. 내일을 위해 오늘을 마무리해봐요.",
  ],
  night: [
    "밤이 깊어지고 있어요. 오늘 마무리 잘 해봐요!",
    "늦은 시간까지 고생 많아요. 마지막 정리 한 번 해볼까요?",
    "오늘도 수고 많았어요. 남은 것만 마저 끝내봐요.",
  ],
};

/**
 * Returns a random greeting string based on the current hour.
 * Morning  05–11, Afternoon 12–17, Evening 18–21, Night 22–04
 * @returns {string}
 */
export function getGreeting() {
  const hour = new Date().getHours();
  let period;

  if (hour >= 5 && hour < 12)       period = 'morning';
  else if (hour >= 12 && hour < 18) period = 'afternoon';
  else if (hour >= 18 && hour < 22) period = 'evening';
  else                               period = 'night';

  const pool = greetings[period];
  return pool[Math.floor(Math.random() * pool.length)];
}
