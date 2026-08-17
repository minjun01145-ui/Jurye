function legacyShuffle(items, random = Math.random) {
  return [...items].sort(() => 0.5 - random());
}

export function parseSentenceQuizPairs(word, sourceIndex) {
  const enParts = String(word?.en || "").split("/");
  const koParts = String(word?.ko || "").split("/");
  if (enParts.length !== koParts.length) return [];

  const pairs = [];
  for (let index = 0; index < enParts.length; index++) {
    const en = enParts[index].trim();
    const ko = koParts[index].trim();
    if (!en || !ko) return [];
    pairs.push({ id: `${sourceIndex}:${index}`, en, ko });
  }
  return pairs;
}

export function buildSimpleQuizQuestions(words, setType = "") {
  const sourceWords = Array.isArray(words) ? words : [];
  const questions = setType === "문장(끊어읽기)"
    ? sourceWords.flatMap((word, index) => parseSentenceQuizPairs(word, index))
    : sourceWords
        .filter(word => String(word?.en || "").trim() && String(word?.ko || "").trim())
        .map((word, index) => ({
          id: String(index),
          en: String(word.en).trim(),
          ko: String(word.ko).trim()
        }));

  const distinctKorean = new Set(questions.map(question => question.ko.replace(/\s+/g, " ")));
  return distinctKorean.size >= 2 ? questions : [];
}

export function parseChunkGameSentence(word) {
  const enParts = String(word?.en || "").split("/").map(part => part.trim()).filter(Boolean);
  const koText = String(word?.ko || "").split("/").map(part => part.trim()).filter(Boolean).join(" ");
  if (enParts.length < 2 || !koText) return null;
  return { enParts, koText };
}

export function buildChunkGameQuestions(words) {
  return (Array.isArray(words) ? words : [])
    .map(word => ({ word, parsed: parseChunkGameSentence(word) }))
    .filter(question => question.parsed);
}

export function buildMatchingRound(words, count = 4, random = Math.random) {
  const roundWords = legacyShuffle(Array.isArray(words) ? words : [], random).slice(0, count);
  return {
    left: legacyShuffle(roundWords.map(word => ({ text: word.en, id: word.en, side: "left" })), random),
    right: legacyShuffle(roundWords.map(word => ({ text: word.ko, id: word.en, side: "right" })), random)
  };
}

export function createShuffledPieceIndices(length, random = Math.random) {
  const indices = Array.from({ length }, (_, index) => index);
  for (let index = indices.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(random() * (index + 1));
    [indices[index], indices[randomIndex]] = [indices[randomIndex], indices[index]];
  }
  if (indices.length > 1 && indices.every((value, index) => value === index)) {
    [indices[0], indices[1]] = [indices[1], indices[0]];
  }
  return indices;
}
