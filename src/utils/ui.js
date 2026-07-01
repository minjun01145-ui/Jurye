// =====================================================
// utils/ui.js
// -----------------------------------------------------
// 여러 화면에서 공통으로 사용하는 간단한 UI 보조 함수
// =====================================================

/**
 * 지정한 id의 요소에 클릭 이벤트를 연결합니다.
 */
export function bindClick(id, callback) {
  const element = document.getElementById(id);

  if (element) {
    element.onclick = callback;
  } else {
    console.warn(
      `주의: HTML에서 '${id}' 버튼 찾기 실패 (무시됨)`
    );
  }
}

/**
 * 단어의 별표 누적 횟수에 맞는 CSS 클래스를 반환합니다.
 */
export function getStarClass(count) {
  if (count === 0) return "fire-0";
  if (count === 1) return "fire-1";
  if (count === 2) return "fire-2";
  if (count <= 4) return "fire-3";
  if (count <= 7) return "fire-4";

  return "fire-max";
}

/**
 * 플래시카드 글자 길이에 따라 폰트 크기를 반환합니다.
 */
export function autoFontSize(text) {
  if (text.length > 40) return "18px";
  if (text.length > 20) return "24px";

  return "32px";
}