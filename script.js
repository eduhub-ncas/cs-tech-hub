/* =========================================================
   TEC-HUB – Org Repository Showcase
   Card logo path unchanged (assets/logo2.png)
   Pink cover replaced with dark neutral gradient (CSS)
   Removed random color generator to keep neutral scheme
   ========================================================= */
const ORG = "cs-tech-hub";
const PER_PAGE = 50;
const LOGO_SRC = "assets/logo2.png";

const els = {
  searchToggle: q("#searchToggle"),
  sortToggle: q("#sortToggle"),
  searchPanel: q("#searchPanel"),
  sortPanel: q("#sortPanel"),
  searchInput: q("#searchInput"),
  clearSearch: q("#clearSearch"),
  applySort: q("#applySort"),
  sortForm: q("#sortForm"),
  cards: q("#cards"),
  loading: q("#loading"),
  empty: q("#empty"),
  errorBox: q("#errorBox"),
  errorMsg: q("#errorMsg"),
  retryBtn: q("#retryBtn"),
  repoCount: q("#repoCount"),
  prevTop: q("#prevTop"),
  nextTop: q("#nextTop"),
  pageInfoTop: q("#pageInfoTop"),
  prevBottom: q("#prevBottom"),
  nextBottom: q("#nextBottom"),
  pageInfoBottom: q("#pageInfoBottom"),
  cardTemplate: q("#cardTemplate"),
  year: q("#year")
};

let page = 1;
let currentRepos = [];
let searchTerm = "";
let sortMode = "stars-desc";

const pageCache = new Map();
const fileCache = new Map();

const languageColors = {
  JavaScript:"#f1e05a", TypeScript:"#3178c6", Python:"#3572A5", Java:"#b07219",
  HTML:"#e34c26", CSS:"#563d7c", Go:"#00ADD8", Rust:"#dea584", C:"#555555",
  "C++":"#f34b7d", Shell:"#89e051", Ruby:"#701516", PHP:"#4F5D95",
  Swift:"#ffac45", Kotlin:"#A97BFF", Dart:"#00B4AB"
};

/* ---------- Utilities ---------- */
function q(sel, parent=document){ return parent.querySelector(sel); }
function escapeHTML(str=""){
  return str.replace(/[&<>"']/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
function pad2(n){ return n.toString().padStart(2,"0"); }

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", () => {
  els.year.textContent = new Date().getFullYear();
  attachEvents();
  loadPage(page);
});

/* ---------- Events ---------- */
function attachEvents(){
  els.searchToggle.addEventListener("click",()=>togglePanel("search"));
  els.sortToggle.addEventListener("click",()=>togglePanel("sort"));

  document.addEventListener("click",(e)=>{
    ["search","sort"].forEach(kind=>{
      const panel = getPanel(kind);
      const btn = getBtn(kind);
      if (!panel.classList.contains("hidden") &&
          !panel.contains(e.target) &&
          e.target !== btn && !btn.contains(e.target)) {
        hidePanel(kind);
      }
    });
  });

  document.addEventListener("keydown",(e)=>{
    if (e.key === "Escape") ["search","sort"].forEach(hidePanel);
  });

  els.searchInput.addEventListener("input", onSearch);
  els.clearSearch.addEventListener("click", clearSearch);
  els.sortForm.addEventListener("change", ()=> sortMode = els.sortForm.sortMode.value );
  els.applySort.addEventListener("click", applySort);

  els.prevTop.addEventListener("click", prevPage);
  els.nextTop.addEventListener("click", nextPage);
  els.prevBottom.addEventListener("click", prevPage);
  els.nextBottom.addEventListener("click", nextPage);

  els.retryBtn.addEventListener("click", ()=> loadPage(page));

  els.cards.addEventListener("click", cardClickHandler);

  // Mouse reactive halo
  els.cards.addEventListener("pointermove", updateHaloPosition);
}

function updateHaloPosition(e){
  const card = e.target.closest(".repo-card");
  if(!card) return;
  const rect = card.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;
  card.style.setProperty("--mx", x + "%");
  card.style.setProperty("--my", y + "%");
}

/* ---------- Panels ---------- */
function getPanel(which){ return which==="search"?els.searchPanel:els.sortPanel; }
function getBtn(which){ return which==="search"?els.searchToggle:els.sortToggle; }
function togglePanel(which){
  const open = !getPanel(which).classList.contains("hidden");
  if (open) hidePanel(which);
  else {
    ["search","sort"].forEach(k=>{ if(k!==which) hidePanel(k); });
    showPanel(which);
  }
}
function showPanel(which){
  const panel = getPanel(which);
  const btn = getBtn(which);
  panel.classList.remove("hidden");
  btn.classList.add("active");
  btn.setAttribute("aria-expanded","true");
  if (which === "search") setTimeout(()=>els.searchInput.focus(),40);
}
function hidePanel(which){
  const panel = getPanel(which);
  const btn = getBtn(which);
  if (panel.classList.contains("hidden")) return;
  panel.classList.add("hidden");
  btn.classList.remove("active");
  btn.setAttribute("aria-expanded","false");
}

/* ---------- Fetch Repos ---------- */
async function fetchPage(p){
  if (pageCache.has(p)) return pageCache.get(p);
  const url = `https://api.github.com/orgs/${ORG}/repos?per_page=${PER_PAGE}&page=${p}&type=public&sort=updated`;
  const res = await fetch(url,{ headers:{Accept:"application/vnd.github+json"} });
  if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
  const data = await res.json();
  pageCache.set(p,data);
  return data;
}
async function loadPage(p){
  showError(false);
  toggleLoading(true);
  els.empty.classList.add("hidden");
  try {
    currentRepos = await fetchPage(p);
    sortCurrent();
    renderCards(currentRepos);
    applySearchFilter();
    updatePager();
  } catch(e){
    showError(true, e.message);
  } finally {
    toggleLoading(false);
  }
}

/* ---------- Sorting ---------- */
function sortCurrent(){
  currentRepos.sort((a,b)=>{
    switch(sortMode){
      case "stars-desc": return b.stargazers_count - a.stargazers_count;
      case "stars-asc": return a.stargazers_count - b.stargazers_count;
      case "updated-desc": return new Date(b.updated_at) - new Date(a.updated_at);
      case "updated-asc": return new Date(a.updated_at) - new Date(b.updated_at);
      case "created-desc": return new Date(b.created_at) - new Date(a.created_at);
      case "created-asc": return new Date(a.created_at) - new Date(b.created_at);
      case "name-asc": return a.name.localeCompare(b.name);
      case "name-desc": return b.name.localeCompare(a.name);
      default: return 0;
    }
  });
}
function applySort(){
  sortMode = els.sortForm.sortMode.value;
  sortCurrent();
  renderCards(currentRepos);
  applySearchFilter();
  hidePanel("sort");
}

/* ---------- Search ---------- */
function onSearch(e){
  searchTerm = e.target.value.trim().toLowerCase();
  els.clearSearch.classList.toggle("visible", searchTerm.length>0);
  applySearchFilter();
}
function clearSearch(){
  els.searchInput.value="";
  searchTerm="";
  els.clearSearch.classList.remove("visible");
  applySearchFilter();
  els.searchInput.focus();
}
function applySearchFilter(){
  let visible=0;
  [...els.cards.children].forEach(card=>{
    const show = !searchTerm ||
      card.dataset.name.includes(searchTerm) ||
      card.dataset.desc.includes(searchTerm) ||
      card.dataset.lang.includes(searchTerm);
    card.style.display = show ? "" : "none";
    if (show) visible++;
  });
  els.empty.classList.toggle("hidden", visible!==0);
  els.repoCount.textContent = `Showing ${visible} repos (Page ${page})`;
}

/* ---------- Render ---------- */
function renderCards(repos){
  els.cards.innerHTML="";
  if (!repos.length){
    els.empty.classList.remove("hidden");
    els.repoCount.textContent = "Showing 0 repos";
    return;
  }
  const frag = document.createDocumentFragment();
  repos.forEach(r=>frag.appendChild(buildCard(r)));
  els.cards.appendChild(frag);
  els.repoCount.textContent = `Showing ${repos.length} repos (Page ${page})`;
}

function buildCard(repo){
  const {
    name, description, stargazers_count, forks_count,
    watchers_count, language, updated_at, html_url,
    full_name, default_branch
  } = repo;

  const frag = els.cardTemplate.content.cloneNode(true);
  const card = frag.querySelector(".repo-card");

  card.dataset.name = (name||"").toLowerCase();
  card.dataset.desc = (description||"").toLowerCase();
  card.dataset.lang = (language||"").toLowerCase();
  card.dataset.full = full_name;
  card.dataset.repoUrl = html_url;

  const img = frag.querySelector(".logo");
  img.src = LOGO_SRC;
  img.alt = "TEC-HUB Logo";

  frag.querySelector(".repo-name").textContent = name;
  frag.querySelector(".repo-desc").textContent = description || "No description provided.";
  frag.querySelector(".stars").textContent = stargazers_count;
  frag.querySelector(".forks").textContent = forks_count;
  frag.querySelector(".watchers").textContent = watchers_count;

  const langDot = frag.querySelector(".dot");
  const langName = frag.querySelector(".lang-name");
  if (language){
    langDot.style.background = languageColors[language] || "#888";
    langName.textContent = language;
  } else {
    langDot.style.background = "#555";
    langName.textContent = "—";
  }

  frag.querySelector(".updated-rel").textContent = relativeTime(updated_at);
  frag.querySelector(".gh-link").href = html_url;

  frag.querySelector(".files-btn").addEventListener("click", e=>{
    e.stopPropagation();
    toggleFiles(card, default_branch || "main");
  });

  return frag;
}

/* ---------- Files ---------- */
async function toggleFiles(card, branch){
  const panel = card.querySelector(".files-panel");
  const btn = card.querySelector(".files-btn");
  const open = btn.getAttribute("aria-expanded")==="true";
  if (open){
    panel.classList.add("hidden");
    btn.setAttribute("aria-expanded","false");
    return;
  }
  btn.setAttribute("aria-expanded","true");
  panel.classList.remove("hidden");

  const full = card.dataset.full;
  const listEl = panel.querySelector(".files-list");
  const loadingEl = panel.querySelector(".files-loading");
  listEl.innerHTML="";
  loadingEl.style.display="block";
  try {
    if (!fileCache.has(full)){
      const res = await fetch(`https://api.github.com/repos/${full}/contents?ref=${encodeURIComponent(branch)}`);
      if (!res.ok) throw new Error("Files fetch failed");
      const data = await res.json();
      fileCache.set(full,data);
    }
    const files = (fileCache.get(full)||[]).slice(0,8);
    listEl.innerHTML = files.map(f=>{
      const icon = f.type === "dir" ? "📁" : "📄";
      return `<li>${icon} <a href="${f.html_url}" target="_blank" rel="noopener">${escapeHTML(f.name)}</a></li>`;
    }).join("") || "<li>No root files</li>";
  } catch(err){
    listEl.innerHTML = "<li>Error loading files</li>";
  } finally {
    loadingEl.style.display="none";
  }
}

/* ---------- Card Click ---------- */
function cardClickHandler(e){
  const card = e.target.closest(".repo-card");
  if (!card) return;
  if (e.target.closest(".files-btn") || e.target.closest(".files-panel") || e.target.closest("a")) return;
  window.open(card.dataset.repoUrl,"_blank","noopener");
}

/* ---------- Pagination ---------- */
function updatePager(){
  const disablePrev = page === 1;
  const disableNext = currentRepos.length < PER_PAGE;
  [els.prevTop, els.prevBottom].forEach(b=>b.disabled = disablePrev);
  [els.nextTop, els.nextBottom].forEach(b=>b.disabled = disableNext);
  els.pageInfoTop.textContent = pad2(page);
  els.pageInfoBottom.textContent = pad2(page);
}
function prevPage(){
  if (page>1){
    page--;
    loadPage(page);
    window.scrollTo({top:0,behavior:"smooth"});
  }
}
function nextPage(){
  page++;
  loadPage(page);
  window.scrollTo({top:0,behavior:"smooth"});
}

/* ---------- Helpers ---------- */
function toggleLoading(show){ els.loading.classList.toggle("active", show); }
function showError(show,msg=""){ els.errorBox.classList.toggle("hidden", !show); if (show) els.errorMsg.textContent = msg; }
function relativeTime(iso){
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const s = Math.floor(diff/1000);
  if (s < 60) return "Just now";
  const m = Math.floor(s/60);
  if (m < 60) return m+"m ago";
  const h = Math.floor(m/60);
  if (h < 24) return h+"h ago";
  const d = Math.floor(h/24);
  if (d < 30) return d+"d ago";
  const mo = Math.floor(d/30);
  if (mo < 12) return mo+"mo ago";
  return Math.floor(mo/12)+"y ago";
}