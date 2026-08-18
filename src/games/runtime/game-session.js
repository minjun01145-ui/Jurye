export function createGameSession({ mode, optionDefaults = {}, initialStage = "setup" } = {}) {
  const defaults = { ...optionDefaults };

  return {
    mode: mode || "",
    context: null,
    active: false,
    stage: initialStage,
    finishing: false,
    options: { ...defaults },
    questions: [],
    completedCount: 0,

    begin(context, { questions = [], options = {}, stage = initialStage } = {}) {
      this.context = context;
      this.active = true;
      this.stage = stage;
      this.finishing = false;
      this.questions = Array.isArray(questions) ? questions : [];
      this.completedCount = 0;
      this.resetOptions(options);
      return this;
    },

    resetOptions(overrides = {}) {
      Object.keys(this.options).forEach(key => delete this.options[key]);
      Object.assign(this.options, defaults, overrides);
      return this.options;
    },

    hasCompleteOptions() {
      return Object.values(this.options).every(Boolean);
    },

    reset() {
      this.context = null;
      this.active = false;
      this.stage = initialStage;
      this.finishing = false;
      this.questions = [];
      this.completedCount = 0;
      this.resetOptions();
    }
  };
}
