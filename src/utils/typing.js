// =====================================================
// utils/typing.js
// -----------------------------------------------------
// 타자게임에서 공통으로 사용하는 계산 엔진
// - 슬래시 제거
// - 한글 두벌식 타수 계산
// - 정확하게 입력된 부분 계산
// - 현재 타수 계산
// - 후광 단계 계산
// =====================================================

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;

// 초성은 쌍자음도 키 하나와 Shift 조합으로 입력하므로
// 타자게임에서는 1타로 계산합니다.
const INITIAL_STROKES = [
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1
];

// 중성 중 겹모음은 두 개의 모음을 연속 입력합니다.
// 예: ㅘ = ㅗ + ㅏ
const MEDIAL_STROKES = [
  1, // ㅏ
  1, // ㅐ
  1, // ㅑ
  1, // ㅒ
  1, // ㅓ
  1, // ㅔ
  1, // ㅕ
  1, // ㅖ
  1, // ㅗ
  2, // ㅘ
  2, // ㅙ
  2, // ㅚ
  1, // ㅛ
  1, // ㅜ
  2, // ㅝ
  2, // ㅞ
  2, // ㅟ
  1, // ㅠ
  1, // ㅡ
  2, // ㅢ
  1  // ㅣ
];

// 종성 겹받침은 두 자음을 입력합니다.
// 0번은 받침 없음입니다.
const FINAL_STROKES = [
  0, // 없음
  1, // ㄱ
  1, // ㄲ
  2, // ㄳ
  1, // ㄴ
  2, // ㄵ
  2, // ㄶ
  1, // ㄷ
  1, // ㄹ
  2, // ㄺ
  2, // ㄻ
  2, // ㄼ
  2, // ㄽ
  2, // ㄾ
  2, // ㄿ
  2, // ㅀ
  1, // ㅁ
  1, // ㅂ
  2, // ㅄ
  1, // ㅅ
  1, // ㅆ
  1, // ㅇ
  1, // ㅈ
  1, // ㅊ
  1, // ㅋ
  1, // ㅌ
  1, // ㅍ
  1  // ㅎ
];

function getNow() {
  if (
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
  ) {
    return performance.now();
  }

  return Date.now();
}
// =====================================================
// 타자 입력 비교 옵션
// =====================================================

let punctuationOrSymbolRegex;

try {
  punctuationOrSymbolRegex =
    new RegExp("[\\p{P}\\p{S}]", "u");
} catch (error) {
  // Unicode 속성 정규식을 지원하지 않는 환경의 대체 규칙
  punctuationOrSymbolRegex =
    /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;
}

/**
 * 구부러진 따옴표나 여러 종류의 대시를
 * 일반 키보드로 입력 가능한 문자로 통일합니다.
 *
 * 이 처리는 '특수문자 무시' 옵션이 꺼져 있어도 적용됩니다.
 */
function normalizeTypingCharacter(
  character,
  {
    ignoreCase = false
  } = {}
) {
  let normalized =
    String(character ?? "");

  try {
    normalized =
      normalized.normalize("NFKC");
  } catch (error) {
    // normalize를 지원하지 않아도 계속 진행합니다.
  }

  normalized = normalized
    .replace(/[“”„‟«»]/g, '"')
    .replace(/[‘’‚‛`´]/g, "'")
    .replace(/[‐-‒–—―−]/g, "-")
    .replace(/…/g, ".");

  if (ignoreCase) {
    normalized =
      normalized.toLocaleLowerCase();
  }

  return normalized;
}

/**
 * 특수문자 무시 옵션에서 제외할 문자인지 확인합니다.
 *
 * 띄어쓰기는 특수문자가 아니므로 항상 비교 대상입니다.
 */
function isIgnoredTypingCharacter(
  character,
  {
    ignorePunctuation = false
  } = {}
) {
  if (!ignorePunctuation) {
    return false;
  }

  if (
    character === " " ||
    character === "\t" ||
    character === "\n" ||
    character === "\r"
  ) {
    return false;
  }

  return punctuationOrSymbolRegex.test(
    character
  );
}

/**
 * 문자열을 비교 가능한 문자 단위로 변환합니다.
 *
 * 각 문자는 원래 문장의 위치를 함께 보관하므로
 * 화면에서 초록색 표시 위치도 계산할 수 있습니다.
 */
function buildTypingComparisonUnits(
  text,
  options = {}
) {
  const originalText =
    String(text ?? "");

  const units = [];

  for (
    let index = 0;
    index < originalText.length;
    index += 1
  ) {
    const character =
      originalText[index];

    if (
      isIgnoredTypingCharacter(
        character,
        options
      )
    ) {
      continue;
    }

    units.push({
      originalIndex: index,
      originalCharacter: character,
      comparisonCharacter:
        normalizeTypingCharacter(
          character,
          options
        )
    });
  }

  return units;
}

/**
 * 목표 문장과 입력 문장의 비교 상태를 반환합니다.
 */
export function getTypingComparisonState(
  targetText,
  inputText,
  options = {}
) {
  const target =
    String(targetText ?? "");

  const input =
    String(inputText ?? "");

  const targetUnits =
    buildTypingComparisonUnits(
      target,
      options
    );

  const inputUnits =
    buildTypingComparisonUnits(
      input,
      options
    );

  const compareLength = Math.min(
    targetUnits.length,
    inputUnits.length
  );

  let matchedUnitCount = 0;

  while (
    matchedUnitCount < compareLength &&
    targetUnits[matchedUnitCount]
      .comparisonCharacter ===
    inputUnits[matchedUnitCount]
      .comparisonCharacter
  ) {
    matchedUnitCount += 1;
  }

  /*
   * 다음에 입력해야 하는 실제 문자의 위치입니다.
   *
   * 목표 문장의 특수문자를 건너뛰더라도
   * 원래 문장의 배치는 유지됩니다.
   */
  const currentPrefixLength =
    matchedUnitCount >= targetUnits.length
      ? target.length
      : targetUnits[matchedUnitCount]
          .originalIndex;

  const hasError =
    inputUnits.length >
    matchedUnitCount;

  const isComplete =
    matchedUnitCount ===
      targetUnits.length &&
    inputUnits.length ===
      targetUnits.length;

  return {
    targetUnits,
    inputUnits,
    matchedUnitCount,
    currentPrefixLength,
    hasError,
    isComplete
  };
}

/**
 * 비교 대상에서 제외된 특수문자를 제거합니다.
 *
 * 타수 계산 시 선택 입력인 특수문자가
 * 유효 타수에 포함되지 않게 합니다.
 */
function removeIgnoredCharacters(
  text,
  options = {}
) {
  return buildTypingComparisonUnits(
    text,
    options
  )
    .map((unit) => {
      return unit.originalCharacter;
    })
    .join("");
}


/**
 * 끊어읽기용 슬래시를 제거하고 공백을 정리합니다.
 *
 * "They make / old neighborhoods / bright."
 * → "They make old neighborhoods bright."
 */
export function cleanTypingPrompt(text) {
  return String(text ?? "")
    .replace(/\s*\/\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 문자열을 실제 타자 입력량에 가까운 타수로 계산합니다.
 *
 * 영어, 숫자, 공백, 문장부호: 각 1타
 * 한글 음절: 초성 + 중성 + 종성 입력량
 *
 * 예:
 * 가 → ㄱ + ㅏ = 2타
 * 한 → ㅎ + ㅏ + ㄴ = 3타
 * 과 → ㄱ + ㅗ + ㅏ = 3타
 */
export function countTypingStrokes(text) {
  let total = 0;

  for (const character of String(text ?? "")) {
    const code = character.charCodeAt(0);

    if (code >= HANGUL_BASE && code <= HANGUL_LAST) {
      const syllableIndex = code - HANGUL_BASE;

      const initialIndex =
        Math.floor(syllableIndex / 588);

      const medialIndex =
        Math.floor((syllableIndex % 588) / 28);

      const finalIndex =
        syllableIndex % 28;

      total += INITIAL_STROKES[initialIndex];
      total += MEDIAL_STROKES[medialIndex];
      total += FINAL_STROKES[finalIndex];

      continue;
    }

    // 호환용 한글 자모
    // ㄱ~ㅎ, ㅏ~ㅣ
    if (code >= 0x3131 && code <= 0x318e) {
      total += 1;
      continue;
    }

    // 줄바꿈 문자는 타수에서 제외합니다.
    if (character === "\n" || character === "\r") {
      continue;
    }

    total += 1;
  }

  return total;
}

/**
 * 목표 문장과 학생 입력이 앞에서부터 몇 글자까지
 * 정확히 일치하는지 계산합니다.
 */
export function getCorrectPrefixLength(
  targetText,
  inputText
) {
  const target = String(targetText ?? "");
  const input = String(inputText ?? "");

  const compareLength = Math.min(
    target.length,
    input.length
  );

  let index = 0;

  while (
    index < compareLength &&
    target[index] === input[index]
  ) {
    index += 1;
  }

  return index;
}

/**
 * 이전보다 정확한 입력 구간이 새롭게 늘어났는지 계산합니다.
 *
 * 오타를 연타한 부분은 타수에 들어가지 않고,
 * 정확히 진행한 부분만 유효 타수로 인정됩니다.
 */
export function getNewValidProgress(
  targetText,
  inputText,
  previousMaxPrefixLength = 0,
  options = {}
) {
  const comparison =
    getTypingComparisonState(
      targetText,
      inputText,
      options
    );

  const maxPrefixLength = Math.max(
    previousMaxPrefixLength,
    comparison.currentPrefixLength
  );

  const rawNewlyValidText =
    maxPrefixLength >
    previousMaxPrefixLength
      ? String(targetText ?? "").slice(
          previousMaxPrefixLength,
          maxPrefixLength
        )
      : "";

  /*
   * 무시하도록 설정한 특수문자는
   * 유효 타수에 포함하지 않습니다.
   */
  const newlyValidText =
    removeIgnoredCharacters(
      rawNewlyValidText,
      options
    );

  return {
    currentPrefixLength:
      comparison.currentPrefixLength,

    maxPrefixLength,

    newlyValidText,

    hasError:
      comparison.hasError,

    isComplete:
      comparison.isComplete
  };
}

/**
 * 현재 입력 내용의 일치율을 계산합니다.
 *
 * 정확한 부분 ÷ 현재 입력량
 *
 * 오타를 고치면 정확도가 다시 회복되는
 * 학생 친화적인 방식입니다.
 */
export function calculateCurrentAccuracy(
  targetText,
  inputText,
  options = {}
) {
  const comparison =
    getTypingComparisonState(
      targetText,
      inputText,
      options
    );

  if (
    comparison.inputUnits.length === 0
  ) {
    return 100;
  }

  const validTargetText =
    comparison.targetUnits
      .slice(
        0,
        comparison.matchedUnitCount
      )
      .map((unit) => {
        return unit.originalCharacter;
      })
      .join("");

  const comparableInputText =
    comparison.inputUnits
      .map((unit) => {
        return unit.originalCharacter;
      })
      .join("");

  const validStrokes =
    countTypingStrokes(
      validTargetText
    );

  const inputStrokes =
    countTypingStrokes(
      comparableInputText
    );

  if (inputStrokes <= 0) {
    return 100;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (
          validStrokes /
          inputStrokes
        ) * 100
      )
    )
  );
}

/**
 * 타수에 따라 화면 후광 단계를 반환합니다.
 *
 * 0: 없음
 * 1: 파랑
 * 2: 파랑·보라
 * 3: 무지개
 * 4: 강한 무지개
 */
export function getTypingGlowLevel(cpm) {
  const value = Number(cpm) || 0;

  if (value >= 400) return 4;
  if (value >= 300) return 3;
  if (value >= 200) return 2;
  if (value >= 100) return 1;

  return 0;
}

/**
 * 최근 유효 타수를 기준으로 현재 타수를 계산하는 추적기입니다.
 *
 * 기본값:
 * - 최근 30초간의 유효 입력을 계산
 * - 시작 직후 숫자가 과도하게 튀지 않도록
 *   최소 5초 분량으로 환산
 */
export function createTypingSpeedTracker({
  windowMs = 30000,
  minimumSampleMs = 5000
} = {}) {
  let startedAt = getNow();
  let totalValidStrokes = 0;
  let bestCpm = 0;

  const strokeEvents = [];

  function removeOldEvents(now) {
    const oldestAllowedTime = now - windowMs;

    while (
      strokeEvents.length > 0 &&
      strokeEvents[0].time < oldestAllowedTime
    ) {
      strokeEvents.shift();
    }
  }

  function addValidStrokes(
    strokeCount,
    now = getNow()
  ) {
    const safeCount = Math.max(
      0,
      Number(strokeCount) || 0
    );

    if (safeCount === 0) {
      return;
    }

    strokeEvents.push({
      time: now,
      count: safeCount
    });

    totalValidStrokes += safeCount;
  }

  function addValidText(
    text,
    now = getNow()
  ) {
    addValidStrokes(
      countTypingStrokes(text),
      now
    );
  }

  function getCurrentCpm(now = getNow()) {
    removeOldEvents(now);

    const windowStrokeCount =
      strokeEvents.reduce(
        (sum, event) => sum + event.count,
        0
      );

    const actualElapsedMs = Math.min(
      Math.max(0, now - startedAt),
      windowMs
    );

    const calculationMs = Math.max(
      actualElapsedMs,
      minimumSampleMs
    );

    if (
      windowStrokeCount === 0 ||
      calculationMs <= 0
    ) {
      return 0;
    }

    const cpm = Math.round(
      windowStrokeCount /
      (calculationMs / 60000)
    );

    bestCpm = Math.max(bestCpm, cpm);

    return cpm;
  }

  function getAverageCpm(now = getNow()) {
    const elapsedMs = Math.max(
      minimumSampleMs,
      now - startedAt
    );

    if (totalValidStrokes === 0) {
      return 0;
    }

    return Math.round(
      totalValidStrokes /
      (elapsedMs / 60000)
    );
  }

  function getStats(now = getNow()) {
    const currentCpm = getCurrentCpm(now);

    return {
      currentCpm,
      averageCpm: getAverageCpm(now),
      bestCpm,
      totalValidStrokes
    };
  }

  function reset(now = getNow()) {
    startedAt = now;
    totalValidStrokes = 0;
    bestCpm = 0;
    strokeEvents.length = 0;
  }

  return {
    addValidStrokes,
    addValidText,
    getCurrentCpm,
    getAverageCpm,
    getStats,
    reset
  };
}


/**
 * 한 개의 단어·문장 데이터에서
 * 타자게임에 사용할 텍스트를 가져옵니다.
 *
 * language:
 * - "en" → 영어
 * - "ko" → 우리말
 */
export function getTypingPromptFromWord(
  word,
  language = "en"
) {
  if (
    !word ||
    typeof word !== "object" ||
    word.isCustomData
  ) {
    return "";
  }

  const field =
    language === "ko" ? "ko" : "en";

  const rawText = word[field];

  if (
    rawText === null ||
    rawText === undefined
  ) {
    return "";
  }

  return cleanTypingPrompt(rawText);
}

/**
 * 기존 JRCRAFT 세트를
 * 타자게임용 문자열 배열로 변환합니다.
 *
 * - 학생 출제 특수 세트 제외
 * - 영어 또는 우리말 한쪽만 선택
 * - 슬래시 제거
 * - 연속 공백 정리
 * - 빈 문항 제외
 */
export function buildTypingPromptsFromSet(
  set,
  language = "en"
) {
  if (
    !set ||
    set.isCustomSet ||
    !Array.isArray(set.words)
  ) {
    return [];
  }

  return set.words
    .map((word) => {
      return getTypingPromptFromWord(
        word,
        language
      );
    })
    .filter((text) => text.length > 0);
}

/**
 * 선택한 언어로 타자게임을 할 수 있는
 * 일반 세트만 반환합니다.
 */
export function getTypingReadySets(
  wordSets,
  language = "en"
) {
  if (!Array.isArray(wordSets)) {
    return [];
  }

  return wordSets.filter((set) => {
    if (set?.isCustomSet) return false;

    return (
      buildTypingPromptsFromSet(
        set,
        language
      ).length > 0
    );
  });
}

/**
 * 현재 입력이 정답으로 완료되었는지 확인합니다.
 *
 * 옵션에 따라:
 * - 대소문자를 무시할 수 있음
 * - 특수문자를 입력하거나 생략할 수 있음
 */
export function isTypingAnswerComplete(
  targetText,
  inputText,
  options = {}
) {
  return getTypingComparisonState(
    targetText,
    inputText,
    options
  ).isComplete;
}