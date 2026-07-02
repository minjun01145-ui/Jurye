// =====================================================
// utils/text.js
// -----------------------------------------------------
// 텍스트 비교와 정리에 사용하는 순수 함수 모음
// =====================================================

/**
 * 단답형 정답 비교를 위해 텍스트를 정규화합니다.
 *
 * 처리 내용:
 * - 영문 대소문자 무시
 * - 일반적인 문장부호와 특수문자 무시
 * - 연속된 공백을 한 칸으로 통일
 * - 앞뒤 공백 제거
 * - 전각 문자 등을 일반 문자 형태로 정규화
 *
 * 예:
 * "I have a dog."
 * "i have a dog"
 * "I have a dog!"
 * → 모두 "i have a dog"
 */
export function normalizeShortAnswer(text) {
  let normalizedText = String(text ?? "");

  try {
    normalizedText = normalizedText.normalize("NFKC");
  } catch (error) {
    // 일부 오래된 환경에서 normalize를 지원하지 않아도
    // 나머지 정규화 작업은 계속 진행합니다.
  }

  return normalizedText
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^0-9a-zA-Z가-힣ㄱ-ㅎㅏ-ㅣ\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}