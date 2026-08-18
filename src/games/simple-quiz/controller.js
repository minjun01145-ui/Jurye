export function createSimpleQuizController({
  session,
  engine,
  view,
  getStatus,
  getQuestionKind,
  isPaused,
  setPaused,
  playSound,
  calculateScore,
  changeScore,
  shouldTrackScore,
  shouldAllowTreasure,
  triggerTreasure,
  showPraise,
  scheduleTask,
  random = Math.random,
  syncScore = () => {}
} = {}) {
  function updateStatus() {
    view.updateStatus(getStatus());
    syncScore();
  }

  function loadNextQuestion() {
    const round = engine.nextQuestion();
    if (!round) return false;
    const { question, choices } = round;
    view.renderQuestion({
      questionKind: getQuestionKind(),
      prompt: question.en,
      choices,
      onSelect: choice => handleChoice(choice, question)
    });
    return true;
  }

  function handleChoice(choice, question) {
    if (isPaused()) return;
    if (choice.correct) {
      playSound("success");
      const earned = calculateScore();
      if (shouldTrackScore()) changeScore(earned);
      session.completedCount++;
      updateStatus();
      view.setFeedback("정답입니다!");
      showPraise(earned);
      if (shouldAllowTreasure() && random() < 0.3) {
        setPaused(true);
        triggerTreasure(() => { setPaused(false); loadNextQuestion(); });
      } else {
        loadNextQuestion();
      }
      return;
    }

    playSound("wrong");
    setPaused(true);
    const penalty = calculateScore();
    if (shouldTrackScore()) changeScore(-penalty);
    updateStatus();
    view.setFeedback(`오답입니다. 정답: ${question.ko}`);
    view.setWrongState(true);
    scheduleTask(() => {
      view.setWrongState(false);
      setPaused(false);
      loadNextQuestion();
    }, 900);
  }

  return {
    updateStatus,
    loadNextQuestion,
    start() {
      session.completedCount = 0;
      updateStatus();
      loadNextQuestion();
    },
    reset() {
      engine.reset();
      view.setWrongState(false);
    }
  };
}
