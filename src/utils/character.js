// =====================================================
// utils/character.js
// -----------------------------------------------------
// 캐릭터 이름 처리에 사용하는 순수 함수 모음
// =====================================================

/**
 * 캐릭터 폴더명에서 제작자 이름을 제외한
 * 간단한 캐릭터 이름만 반환합니다.
 *
 * 예:
 * "기본0(민준쌤)" → "기본0"
 * "용사(김민수)" → "용사"
 * "마법사" → "마법사"
 * 빈 값 → "없음"
 */
export function getSimpleCharacterName(charFolder) {
  if (!charFolder) return "없음";

  if (charFolder.includes("(")) {
    return charFolder.split("(")[0].trim();
  }

  return charFolder;
}


/**
 * 캐릭터 이미지를 표시하는 HTML 문자열을 만듭니다.
 */
export function getAvatarHtml(
  charFolder,
  size = "45px"
) {
  if (!charFolder) return "😎";

  return `
    <img
      src="char/${charFolder}/stand1_0.png"
      class="anim-avatar"
      data-char-id="${charFolder}"
      style="
        height: ${size};
        vertical-align: middle;
        margin-right: 5px;
        filter: drop-shadow(
          2px 2px 2px rgba(0,0,0,0.15)
        );
      "
    >
  `;
}