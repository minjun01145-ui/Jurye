const frames = ["stand1_0.png", "stand1_1.png", "stand1_2.png", "stand1_3.png"];
const banners = [
  { kicker: "CHARACTER SPOTLIGHT", title: "오늘의 캐릭터를<br>만나 보세요", description: "새로운 캐릭터와 게임 소식을 확인하세요.", action: "상점에서 보기", kind: "character" },
  { kicker: "NEW GAME MODE", title: "실시간 타수 대결<br>준비 중", description: "속도와 정확도를 겨루는 새로운 멀티플레이 모드입니다.", action: "타자게임 보기", kind: "typing" },
  { kicker: "WEEKLY CHAMPION · DEMO", title: "지난주의 최고 기록<br>284타 달성", description: "실제 기록 연동 전까지 표시되는 데모 배너입니다.", action: "랭킹 보기", kind: "champion" }
];
let characters = [];
let bannerIndex = 0;
let frameIndex = 0;
let currentFolder = "";
let rotationTimer = null;

function cleanName(folder) { return String(folder || "").split("(")[0].trim() || "JRCRAFT 캐릭터"; }
function randomCharacter() { return characters.length ? characters[Math.floor(Math.random() * characters.length)] : ""; }
function setAnimatedImage(image, folder) {
  if (!image || !folder) return;
  image.dataset.charId = folder;
  image.src = `char/${folder}/${frames[frameIndex]}`;
  image.alt = cleanName(folder);
}
function renderDots() {
  const host = document.getElementById("home-banner-dots");
  if (!host) return;
  host.replaceChildren();
  banners.forEach((_, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `banner-dot${index === bannerIndex ? " active" : ""}`;
    button.setAttribute("aria-label", `${index + 1}번 배너`);
    button.addEventListener("click", () => { bannerIndex = index; renderBanner(); restartRotation(); });
    host.appendChild(button);
  });
}
function renderBanner() {
  const banner = banners[bannerIndex];
  const title = document.getElementById("home-banner-title");
  const kicker = document.getElementById("home-banner-kicker");
  const description = document.getElementById("home-banner-description");
  const action = document.getElementById("home-banner-primary");
  const image = document.getElementById("home-hero-character");
  currentFolder = banner.kind === "character" ? randomCharacter() : (characters[bannerIndex] || characters[0] || "");
  if (kicker) kicker.textContent = banner.kicker;
  if (title) title.innerHTML = banner.kind === "character" && currentFolder ? `${cleanName(currentFolder)}<br>캐릭터 스포트라이트` : banner.title;
  if (description) description.textContent = banner.description;
  if (action) action.textContent = banner.action;
  if (currentFolder) setAnimatedImage(image, currentFolder);
  renderDots();
}
function restartRotation() {
  clearInterval(rotationTimer);
  rotationTimer = setInterval(() => { bannerIndex = (bannerIndex + 1) % banners.length; renderBanner(); }, 7000);
}
async function loadCharacterFolders() {
  try {
    const response = await fetch(`char/folder_list.txt?t=${Date.now()}`);
    if (!response.ok) throw new Error("folder_list.txt not found");
    characters = (await response.text()).split(/\r?\n/).map(v => v.trim()).filter(Boolean);
  } catch (error) {
    console.warn("V2 shell character loading failed", error);
  }
  if (characters[0]) {
    const avatar = document.getElementById("app-profile-avatar");
    if (avatar && !avatar.src) setAnimatedImage(avatar, characters[0]);
  }
  renderBanner();
}

document.getElementById("home-banner-primary")?.addEventListener("click", () => {
  const current = banners[bannerIndex];
  if (current.kind === "character") document.getElementById("app-profile-btn")?.click();
});
document.getElementById("home-banner-secondary")?.addEventListener("click", () => {});
setInterval(() => {
  frameIndex = (frameIndex + 1) % frames.length;
  const hero = document.getElementById("home-hero-character");
  if (hero && currentFolder) setAnimatedImage(hero, currentFolder);
}, 250);
loadCharacterFolders();
restartRotation();
