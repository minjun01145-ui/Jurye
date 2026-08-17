export const DEFAULT_GAME_COUNTDOWN_MS = 5000;
export const SIMPLE_QUIZ_COUNTDOWN_MS = 2100;

export function getGameCountdownDurationMs(gameMode, subMode = "") {
  if (["speed", "speed-match", "chunk"].includes(gameMode) ||
      (gameMode === "boss" && ["speed", "chunk"].includes(subMode))) {
    return SIMPLE_QUIZ_COUNTDOWN_MS;
  }
  return DEFAULT_GAME_COUNTDOWN_MS;
}

export function startCountdownSequence({
  seconds = 3,
  intervalMs = 700,
  onTick = () => {},
  onComplete = () => {},
  setTimer = setInterval,
  clearTimer = clearInterval
} = {}) {
  let remaining = Math.max(1, Math.floor(Number(seconds) || 3));
  let timerId = null;
  let completed = false;

  onTick(remaining, { initial: true });
  timerId = setTimer(() => {
    remaining--;
    if (remaining > 0) {
      onTick(remaining, { initial: false });
      return;
    }
    if (completed) return;
    completed = true;
    clearTimer(timerId);
    onComplete();
  }, intervalMs);

  return timerId;
}
