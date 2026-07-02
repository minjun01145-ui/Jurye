// =====================================================
// utils/timer.js
// -----------------------------------------------------
// 시간/타이머 관련 순수 함수 모음
// =====================================================

/**
 * 게임 제한시간 값을 초 단위로 변환합니다.
 *
 * - "test10" → 10초
 * - 3 → 180초
 * - 5 → 300초
 * - 10 → 600초
 * - 잘못된 값 → fallbackSeconds
 */
export function getDurationSeconds(durationValue, fallbackSeconds = 180) {
  if (durationValue === "test10") return 10;

  const n = Number(durationValue);
  if (!Number.isFinite(n) || n <= 0) return fallbackSeconds;

  return Math.round(n * 60);
}



/**
 * Promise가 지정된 시간 안에 완료되지 않으면
 * 시간 초과 오류를 발생시킵니다.
 *
 * 예:
 * await withTimeout(getDoc(...), 8000, "학생 명단");
 */
export function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${label} 응답 시간 초과`));
      }, ms);
    })
  ]);
}




