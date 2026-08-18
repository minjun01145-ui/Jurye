const POKE_API_BASE = "https://pokeapi.co/api/v2";
const KANTO_FIRST_ID = 1;
const KANTO_LAST_ID = 151;
const ENCOUNTER_ANIMATION_MS = 1900;
const DEFAULT_BALLS = 5;

const shuffle = items => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
};

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function koreanName(species, fallback) {
  return species?.names?.find(entry => entry.language?.name === "ko")?.name || fallback;
}

function fireRedSprite(pokemon) {
  return pokemon?.sprites?.versions?.["generation-iii"]?.["firered-leafgreen"]?.front_default
    || pokemon?.sprites?.front_default;
}

async function loadRandomKantoPokemon(signal) {
  const id = Math.floor(Math.random() * (KANTO_LAST_ID - KANTO_FIRST_ID + 1)) + KANTO_FIRST_ID;
  const [pokemonResponse, speciesResponse] = await Promise.all([
    fetch(`${POKE_API_BASE}/pokemon/${id}`, { signal }),
    fetch(`${POKE_API_BASE}/pokemon-species/${id}`, { signal })
  ]);
  if (!pokemonResponse.ok || !speciesResponse.ok) throw new Error("PokeAPI response failed");
  const [pokemon, species] = await Promise.all([pokemonResponse.json(), speciesResponse.json()]);
  return {
    id,
    name: koreanName(species, pokemon.name),
    level: Math.floor(Math.random() * 26) + 5,
    sprite: fireRedSprite(pokemon),
    cry: pokemon?.cries?.legacy || pokemon?.cries?.latest || ""
  };
}

function buildQuestion(words) {
  const usable = (Array.isArray(words) ? words : []).filter(word => String(word?.en || "").trim() && String(word?.ko || "").trim());
  if (!usable.length) return null;
  const answer = usable[Math.floor(Math.random() * usable.length)];
  const wrong = shuffle(usable.filter(word => word !== answer && String(word.ko).trim() !== String(answer.ko).trim()))
    .slice(0, 3).map(word => String(word.ko).trim());
  if (wrong.length < 3) return null;
  return { prompt: `${String(answer.en).replaceAll("/", " ")}의 뜻은?`, answer: String(answer.ko).replaceAll("/", " ").trim(), choices: shuffle([String(answer.ko).replaceAll("/", " ").trim(), ...wrong]) };
}

export function createPokemonCatchGame({ root = document, getQuestionWords = () => [], playUiSound = () => {} } = {}) {
  const el = id => root.getElementById(id);
  const overlay = el("pokemon-battle-overlay");
  const modal = overlay?.querySelector(".pokemon-battle-modal");
  let encounterTimer = null;
  let requestController = null;
  let cryAudio = null;
  let pokemon = null;
  let hp = 100;
  let balls = DEFAULT_BALLS;
  let busy = false;
  let messageTimer = null;

  const setMessage = (message, immediate = false) => {
    const target = el("pokemon-battle-message");
    if (!target) return;
    clearInterval(messageTimer);
    if (immediate) { target.textContent = message; return; }
    target.textContent = "";
    let index = 0;
    messageTimer = setInterval(() => {
      target.textContent += message[index++] || "";
      if (index >= message.length) { clearInterval(messageTimer); messageTimer = null; }
    }, 38);
  };
  const setControlsDisabled = disabled => ["pokemon-quiz-btn", "pokemon-item-btn", "pokemon-ball-btn", "pokemon-run-btn"].forEach(id => { if (el(id)) el(id).disabled = disabled; });
  const updateStatus = () => {
    if (el("pokemon-enemy-hp-bar")) {
      el("pokemon-enemy-hp-bar").style.width = `${hp}%`;
      el("pokemon-enemy-hp-bar").dataset.level = hp > 50 ? "high" : hp > 20 ? "medium" : "low";
    }
    if (el("pokemon-ball-btn")) el("pokemon-ball-btn").textContent = `포켓볼 던지기 (${balls})`;
  };
  const hideQuiz = () => { if (el("pokemon-quiz-panel")) el("pokemon-quiz-panel").hidden = true; };
  const stopAudio = () => { if (cryAudio) { cryAudio.pause(); cryAudio.currentTime = 0; cryAudio = null; } };

  function close() {
    clearTimeout(encounterTimer);
    clearInterval(messageTimer);
    requestController?.abort();
    requestController = null;
    stopAudio();
    hideQuiz();
    busy = false;
    if (overlay) overlay.hidden = true;
  }

  async function open() {
    if (!overlay || !modal || busy) return;
    playUiSound("click");
    busy = true; hp = 100; balls = DEFAULT_BALLS; pokemon = null;
    overlay.hidden = false;
    el("pokemon-loading").hidden = false;
    el("pokemon-enemy-sprite").removeAttribute("src");
    setMessage("야생 포켓몬을 찾는 중...", true); setControlsDisabled(true); updateStatus();
    modal.classList.remove("is-battle", "is-caught", "is-escaped", "is-throwing", "is-intro");
    modal.classList.add("is-encounter");
    requestController?.abort(); requestController = new AbortController();
    try {
      pokemon = await loadRandomKantoPokemon(requestController.signal);
      el("pokemon-enemy-name").textContent = pokemon.name;
      el("pokemon-enemy-level").textContent = `Lv. ${pokemon.level}`;
      el("pokemon-enemy-sprite").src = pokemon.sprite;
      el("pokemon-enemy-sprite").alt = `야생 ${pokemon.name}`;
      await sleep(ENCOUNTER_ANIMATION_MS);
      if (overlay.hidden) return;
      modal.classList.remove("is-encounter"); modal.classList.add("is-intro");
      el("pokemon-loading").hidden = true;
      setMessage(`앗! 야생 ${pokemon.name}이(가) 튀어나왔다!`);
      if (pokemon.cry) { cryAudio = new Audio(pokemon.cry); cryAudio.volume = .45; cryAudio.play().catch(() => {}); }
      await sleep(1150);
      if (overlay.hidden) return;
      modal.classList.remove("is-intro"); modal.classList.add("is-battle");
      setMessage(`${pokemon.name}을(를) 어떻게 할까?`); setControlsDisabled(false); busy = false;
    } catch (error) {
      if (error.name === "AbortError") return;
      el("pokemon-loading").hidden = true; modal.classList.remove("is-encounter");
      setMessage("포켓몬을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setControlsDisabled(false); busy = false;
    }
  }

  function showQuiz() {
    if (busy || !pokemon) return;
    const question = buildQuestion(getQuestionWords());
    if (!question) { setMessage("객관식 문제를 만들려면 서로 다른 뜻의 단어가 4개 이상 필요합니다."); return; }
    playUiSound("click");
    el("pokemon-quiz-question").textContent = question.prompt;
    const choices = el("pokemon-quiz-choices"); choices.innerHTML = "";
    question.choices.forEach(choice => {
      const button = root.createElement("button"); button.type = "button"; button.textContent = choice;
      button.onclick = () => {
        hideQuiz();
        if (choice === question.answer) {
          hp = Math.max(1, hp - 30); playUiSound("success");
          el("pokemon-enemy-sprite-wrap").classList.add("is-hit");
          setTimeout(() => el("pokemon-enemy-sprite-wrap")?.classList.remove("is-hit"), 420);
          setMessage(`정답! ${pokemon.name}의 힘이 약해졌다.`);
        } else { playUiSound("wrong"); setMessage("오답! 다시 문제를 풀어 포획 확률을 높여 보세요."); }
        updateStatus();
      };
      choices.appendChild(button);
    });
    el("pokemon-quiz-panel").hidden = false;
  }

  async function throwBall() {
    if (busy || !pokemon) return;
    if (balls <= 0) { setMessage("포켓볼을 모두 사용했습니다. 도망가서 새 포켓몬을 찾아보세요."); return; }
    busy = true; balls--; updateStatus(); setControlsDisabled(true); playUiSound("pop");
    modal.classList.remove("is-throwing"); void modal.offsetWidth; modal.classList.add("is-throwing");
    setMessage("가랏, 포켓볼!"); await sleep(1750);
    const catchChance = Math.min(.92, .16 + ((100 - hp) / 100) * .7);
    if (Math.random() < catchChance) {
      modal.classList.add("is-caught"); setMessage(`신난다! ${pokemon.name}을(를) 잡았다!`); playUiSound("success");
      await sleep(2200); close();
    } else {
      modal.classList.remove("is-throwing"); setMessage(`${pokemon.name}이(가) 볼에서 빠져나왔다!`); playUiSound("wrong");
      setControlsDisabled(false); busy = false;
    }
  }

  el("pokemon-quiz-btn")?.addEventListener("click", showQuiz);
  el("pokemon-item-btn")?.addEventListener("click", () => setMessage(`${pokemon?.name || "포켓몬"} HP ${hp}% · 남은 포켓볼 ${balls}개`));
  el("pokemon-ball-btn")?.addEventListener("click", throwBall);
  el("pokemon-run-btn")?.addEventListener("click", () => { setMessage("무사히 도망쳤다!"); setTimeout(close, 500); });
  el("pokemon-battle-close-btn")?.addEventListener("click", close);
  overlay?.addEventListener("click", event => { if (event.target === overlay) close(); });

  return { open, close, isOpen: () => Boolean(overlay && !overlay.hidden) };
}
