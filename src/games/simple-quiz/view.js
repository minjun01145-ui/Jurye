export function createSimpleQuizView({ root = document } = {}) {
  const el = id => root.getElementById(id);

  return {
    setStage(stage, { optionsComplete = false } = {}) {
      const screen = el("speed-solo-screen");
      const actionButton = el("speed-solo-start-btn");
      const closeButton = el("speed-solo-close-btn");
      screen.classList.toggle("speed-solo-setup-mode", stage === "setup");
      screen.classList.toggle("speed-solo-playing-mode", stage === "playing");
      screen.classList.toggle("speed-solo-result-mode", stage === "result");
      actionButton.innerText = stage === "setup" ? "시작하기!" : stage === "playing" ? "게임 중단하기" : "다시하기";
      actionButton.classList.toggle("is-stop", stage === "playing");
      actionButton.classList.toggle("is-finish", stage === "result");
      actionButton.disabled = stage === "setup" && !optionsComplete;
      closeButton.hidden = stage === "playing";
      closeButton.innerText = stage === "result" ? "끝내기" : "닫기";
    },

    openSoloSetup() {
      const screen = el("speed-solo-screen");
      screen.style.display = "grid";
      screen.classList.add("speed-solo-mode");
      screen.classList.remove("speed-multi-mode", "speed-solo-playing-mode", "speed-solo-result-mode");
      el("speed-solo-settings").hidden = false;
      el("speed-solo-game-area").classList.add("is-preview");
      el("speed-solo-preview-message").hidden = false;
      el("speed-solo-result").hidden = true;
      el("speed-solo-timer").innerText = "시간 설정";
      el("speed-solo-score").style.display = "";
      el("speed-solo-score").innerText = "점수 설정";
      root.querySelectorAll("#speed-solo-settings [data-speed-option]").forEach(button => { button.classList.remove("selected"); button.disabled = false; });
      this.resetQuestion();
    },

    close() {
      const screen = el("speed-solo-screen");
      screen.classList.remove("speed-solo-mode", "speed-multi-mode", "speed-solo-setup-mode", "speed-solo-playing-mode", "speed-solo-result-mode");
      screen.style.display = "none";
      el("speed-solo-inline-countdown").hidden = true;
      el("speed-solo-settings").hidden = true;
      el("speed-solo-game-area").classList.remove("is-preview");
      el("speed-solo-result").hidden = true;
    },

    preparePlaying() {
      el("speed-solo-result").hidden = true;
      root.querySelectorAll("#speed-solo-settings [data-speed-option]").forEach(button => { button.disabled = true; });
      el("speed-solo-game-area").classList.remove("is-preview");
      el("speed-solo-preview-message").hidden = true;
    },

    openMultiplayer() {
      const screen = el("speed-solo-screen");
      screen.classList.add("speed-solo-mode", "speed-multi-mode");
      screen.classList.remove("speed-solo-setup-mode", "speed-solo-result-mode");
      el("speed-solo-settings").hidden = true;
      el("speed-solo-result").hidden = true;
      el("speed-solo-game-area").classList.remove("is-preview");
      el("speed-solo-preview-message").hidden = true;
      this.setFeedback("알맞은 뜻을 고르세요.");
    },

    selectOption(option, selectedButton) {
      root.querySelectorAll(`#speed-solo-settings [data-speed-option="${option}"]`).forEach(button => button.classList.toggle("selected", button === selectedButton));
    },

    updateStatus({ unlimited, remainingSeconds, scoreVisible, scoreHtml }) {
      const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, "0");
      const seconds = String(remainingSeconds % 60).padStart(2, "0");
      el("speed-solo-timer").innerText = unlimited ? "시간 제한 없음" : `🕒 ${minutes}:${seconds}`;
      el("speed-solo-score").style.display = scoreVisible ? "" : "none";
      el("speed-solo-score").innerHTML = scoreHtml;
    },

    renderQuestion({ questionKind, prompt, choices, onSelect }) {
      el("speed-solo-question-kind").innerText = questionKind;
      el("speed-solo-question").innerText = prompt;
      const options = el("speed-solo-options");
      options.innerHTML = "";
      choices.forEach(choice => {
        const button = root.createElement("button");
        button.type = "button";
        button.innerText = choice.text;
        button.onclick = () => onSelect(choice);
        options.appendChild(button);
      });
    },

    setFeedback(message) {
      el("speed-solo-feedback").innerText = message;
    },

    setWrongState(active) {
      el("speed-solo-options").classList.toggle("is-wrong", active);
    },

    resetQuestion() {
      el("speed-solo-question").innerText = "Question";
      el("speed-solo-options").innerHTML = "";
      this.setFeedback("알맞은 뜻을 고르세요.");
      this.setWrongState(false);
    }
  };
}
