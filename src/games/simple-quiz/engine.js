const normalizeMeaning = value => String(value || "").replace(/\s+/g, " ");

export function createSimpleQuizEngine({ getQuestions, random = Math.random } = {}) {
  let currentQuestion = null;

  function nextQuestion() {
    const sourceQuestions = getQuestions?.();
    const questions = Array.isArray(sourceQuestions) ? sourceQuestions : [];
    const validQuestions = questions.filter(question =>
      questions.some(candidate => candidate.id !== question.id && normalizeMeaning(candidate.ko) !== normalizeMeaning(question.ko))
    );
    if (!validQuestions.length) return null;

    currentQuestion = validQuestions[Math.floor(random() * validQuestions.length)];
    const wrongChoices = questions.filter(candidate =>
      candidate.id !== currentQuestion.id && normalizeMeaning(candidate.ko) !== normalizeMeaning(currentQuestion.ko)
    );
    const wrong = wrongChoices[Math.floor(random() * wrongChoices.length)];
    if (!wrong) return null;

    const choices = [
      { text: currentQuestion.ko, correct: true },
      { text: wrong.ko, correct: false }
    ].sort(() => random() - 0.5);

    return { question: currentQuestion, choices };
  }

  return {
    nextQuestion,
    getCurrentQuestion: () => currentQuestion,
    reset: () => { currentQuestion = null; }
  };
}
