const $ = (q, root = document) => root.querySelector(q);
const $$ = (q, root = document) => [...root.querySelectorAll(q)];
const STORAGE_KEY = 'ders-maliye-progress-v1';
const SYNC_KEY = 'ders-maliye-github-v1';
const SUPABASE_AUTH_KEY = 'ders-maliye-supabase-auth-v1';
const SUPABASE_URL = 'https://qznkkrosedtkwbzotuzg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_m1ZGyif7raaeoUVuhC_FmQ_u3qqeHBe';
const SUPABASE_PROGRESS_TABLE = 'study_progress';
const DEFAULT_GITHUB_CLIENT_ID = 'Iv23liJeFWuLkdXEkG4K';
const DEFAULT_GITHUB_OWNER = 'soltackle';
const DEFAULT_GITHUB_REPO = 'ders-ilerlemem';
const DAY = 86_400_000;
const ICONS = ['○', '→', '▦', '◇', '◒', '▤', '◍', '⌁'];
const DEFAULTS = {
  readingMode: 'page', bionic: true, highlightWord: true, boldPercent: 38, wpm: 220, groupWords: 1,
  punctuationPause: 320, fontSize: 19, lineHeight: 1.85, focusParagraph: false, studyFocus: true, autoScroll: true, reduceMotion: false, theme: 'light', sessionMinutes: 20, breakMinutes: 5,
};

let courses = [];
let state = loadState();
let github = loadGithub();
let supabaseSession = loadSupabaseSession();
let view = 'home';
let activeCourseId = null;
let activeBlock = 0;
let activeCategory = 'Tümü';
let activeReviewCourseId = '';
let searchQuery = '';
let wordIndex = 0;
let playerTimer = 0;
let playerRunning = false;
let syncTimer = 0;
let stateRevision = 0;
let mergeConflicts = [];
let syncLabel = 'Bu cihazda kaydediliyor';
let githubDeviceFlowActive = false;
let toastTimer = 0;
let lastTouch = Date.now();
let activeSecondsRemainder = 0;
let activeMapRouteId = '';
let studyTool = '';
let mapResizeObserver = null;

function freshState() {
  return { version: 1, updatedAt: 0, lastCourseId: '', preferences: { ...DEFAULTS, updatedAt: 0 }, lessons: {}, review: {}, activeDays: {}, activitySeconds: 0, syncConflicts: [], session: null };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved?.version === 1) return { ...freshState(), ...saved, preferences: { ...DEFAULTS, ...(saved.preferences || {}) } };
  } catch (error) { console.warn('Yerel çalışma kaydı okunamadı.', error); }
  return freshState();
}

function loadGithub() {
  try {
    const saved = JSON.parse(localStorage.getItem(SYNC_KEY) || 'null') || {};
    return { sha: '', ...saved, clientId: saved.clientId || DEFAULT_GITHUB_CLIENT_ID, owner: saved.owner || DEFAULT_GITHUB_OWNER, repo: saved.repo || DEFAULT_GITHUB_REPO, token: saved.token || '' };
  } catch { return { clientId: DEFAULT_GITHUB_CLIENT_ID, owner: DEFAULT_GITHUB_OWNER, repo: DEFAULT_GITHUB_REPO, token: '', sha: '' }; }
}

function loadSupabaseSession() {
  try { return JSON.parse(localStorage.getItem(SUPABASE_AUTH_KEY) || 'null'); }
  catch { return null; }
}

function persistSupabaseSession() {
  if (supabaseSession) localStorage.setItem(SUPABASE_AUTH_KEY, JSON.stringify(supabaseSession));
  else localStorage.removeItem(SUPABASE_AUTH_KEY);
}

function activeSyncProvider() {
  if (supabaseSession?.access_token && supabaseSession?.user?.id) return 'supabase';
  if (github.token && github.owner && github.repo) return 'github';
  return '';
}

function persistGithub() {
  localStorage.setItem(SYNC_KEY, JSON.stringify(github));
}

function lessonProgress(id) {
  if (!state.lessons[id]) state.lessons[id] = { updatedAt: 0, activeBlock: 0, completedAt: null, rating: null, blocks: {}, tasks: {}, reader: {} };
  return state.lessons[id];
}

function taskProgress(id, taskKey) {
  const progress = lessonProgress(id);
  if (!progress.tasks[taskKey]) progress.tasks[taskKey] = { updatedAt: 0, answer: '', revealed: false, copied: false, confidence: '', status: 'todo' };
  return progress.tasks[taskKey];
}

function blockFlow(id, blockNumber) {
  const progress = lessonProgress(id);
  progress.flow ||= {};
  progress.flow[String(blockNumber)] ||= { phase: 'consume', taskIndex: 0, mapNotes: '', analogyNotes: '' };
  const flow = progress.flow[String(blockNumber)];
  // Resume old numeric indices before the six newly extracted own-analogy tasks.
  // From here onward also store the task ID, independent of source task ordering.
  if (flow.phase === 'digest' && !flow.taskId) {
    const course = courses.find(item => item.id === id);
    const block = course?.blocks.find(item => String(item.number) === String(blockNumber));
    if (block) {
      const legacy = getBlockTasks(block).filter(item =>
        !['5', '6'].includes(course.id.split('-')[0]) || !/^A\d+own$/.test(item.task.id));
      const entry = legacy[flow.taskIndex || 0];
      if (entry) {
        flow.taskId = entry.task.id;
        flow.taskIndex = getBlockTasks(block).findIndex(item => item.task.id === flow.taskId);
      }
    }
  }
  return flow;
}

function progressBlockDone(courseId, blockNumber) {
  return Boolean(lessonProgress(courseId).blocks[blockNumber]?.completed);
}

function touchState(delay = 12_000) {
  stateRevision++;
  state.updatedAt = Date.now();
  if (!state.activeDays[dayKey()]) state.activeDays[dayKey()] = true;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { showToast('Cihazda yer kalmadı; bir yedek indirip tekrar deneyebilirsin.'); }
  updateSyncBadge();
  if (activeSyncProvider()) scheduleSync(delay);
}

function changeLesson(id, change, delay) {
  const progress = lessonProgress(id);
  Object.assign(progress, change, { updatedAt: Date.now() });
  touchState(delay);
}

function dayKey(date = Date.now()) { return new Date(date).toISOString().slice(0, 10); }
function esc(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function niceDate(date) { return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' }).format(date); }
function fmtTime(seconds) {
  const min = Math.round((seconds || 0) / 60);
  return min >= 60 ? `${Math.floor(min / 60)} sa ${min % 60} dk` : `${min} dk`;
}
function shorten(text, length = 155) { const v = String(text || ''); return v.length > length ? `${v.slice(0, length - 1).trimEnd()}…` : v; }
function currentCourse() { return courses.find(course => course.id === activeCourseId); }
function catColor(category) {
  if (/gelir|vergi/i.test(category)) return 'orange';
  if (/bütçe|borç/i.test(category)) return 'lavender';
  if (/politika|gider/i.test(category)) return 'blue';
  return '';
}

function getCourseStats(course) {
  const p = lessonProgress(course.id);
  const answered = Object.values(p.tasks).filter(task => task.answer?.trim()).length;
  const totalTasks = course.blocks.reduce((sum, block) => sum + block.sections.reduce((s, section) => s + section.tasks.length, 0), 0);
  const completedBlocks = Object.values(p.blocks).filter(block => block.completed).length;
  const percent = course.blocks.length ? Math.round(100 * completedBlocks / course.blocks.length) : 0;
  return { ...p, answered, totalTasks, completedBlocks, percent };
}

function getAllTasks() {
  const list = [];
  for (const course of courses) {
    for (const block of course.blocks) {
      for (const section of block.sections) {
        for (const task of section.tasks) {
          list.push({ course, block, section, task, key: `${block.number}:${task.id}` });
        }
      }
    }
  }
  for (const course of courses) {
    for (const task of course.wrapUp || []) list.push({ course, block: { number: 'son' }, section: { type: task.type }, task, key: `son:${task.id}` });
    for (const task of course.proofPractice?.tasks || []) list.push({ course, block: { number: 'kanıt' }, section: { type: 'proof' }, task, key: `kanıt:${task.id}` });
  }
  return list;
}

function getDueCards() {
  const now = dayKey();
  const cards = courses.flatMap(course => (course.referenceCards || []).flatMap(card => {
    const key = `K:${card.id}`;
    const review = state.review[`${course.id}:${key}`];
    return review && review.due <= now ? [{ course, card, key, review }] : [];
  }));
  for (const course of courses) for (const block of course.blocks) for (const section of block.sections) {
    if (section.type !== 'ER') continue;
    for (const task of section.tasks) {
      if (task.expectedKind !== 'R') continue;
      const key = `R:${block.number}:${task.id}`;
      const selection = lessonProgress(course.id).tasks[`${block.number}:${task.id}`]?.kindChoice;
      const review = state.review[`${course.id}:${key}`];
      if (selection === 'R' && review && review.due <= now) cards.push({ course, card: { id: task.id, front: task.prompt, back: task.answer }, key, review });
    }
  }
  return cards;
}

function getDeferredTasks(dueOnly = false) {
  const today = dayKey();
  return getAllTasks().flatMap(item => {
    const saved = lessonProgress(item.course.id).tasks[item.key];
    if (saved?.status !== 'deferred' || !saved.deferUntil) return [];
    return !dueOnly || saved.deferUntil <= today ? [{ ...item, saved }] : [];
  });
}

function taskIsDone(courseId, key) {
  const saved = taskProgress(courseId, key);
  return ['worked', 'again'].includes(saved.status) || (saved.status === 'deferred' && saved.deferUntil > dayKey());
}

function getBlockTasks(block) {
  return block.sections.flatMap((section, sectionIndex) => section.tasks.map(task => ({ section, sectionIndex, task })));
}

function visibleCourses() {
  return courses.filter(course => {
    const categoryMatch = activeCategory === 'Tümü' || course.category === activeCategory;
    const q = searchQuery.trim().toLocaleLowerCase('tr');
    if (!q) return categoryMatch;
    const content = `${course.title} ${course.category} ${course.thesis} ${course.blocks.map(b => `${b.title} ${b.sections.flatMap(s => s.tasks.map(t => t.prompt)).join(' ')}`).join(' ')}`.toLocaleLowerCase('tr');
    return categoryMatch && content.includes(q);
  });
}

function continueTarget() {
  const lastCourse = courses.find(course => course.id === state.lastCourseId && !lessonProgress(course.id).completedAt);
  if (lastCourse) return lastCourse;
  const unfinished = courses.find(course => {
    const p = lessonProgress(course.id);
    return !p.completedAt && p.activeBlock > 0;
  });
  if (unfinished) return unfinished;
  return courses.find(course => !lessonProgress(course.id).completedAt) || courses[0];
}

function startCourse(course, block = null) {
  stopPlayer();
  studyTool = '';
  activeCourseId = course.id;
  state.lastCourseId = course.id;
  const p = lessonProgress(course.id);
  activeBlock = Math.max(0, Math.min(block ?? p.activeBlock ?? 0, course.blocks.length));
  view = 'study';
  changeLesson(course.id, { activeBlock }, 2_500);
  render();
  scrollTo({ top: 0, behavior: 'smooth' });
}

function navTo(next) {
  if (next === 'home' || next === 'courses' || next === 'settings' || next === 'stats' || next === 'reviews') {
    stopPlayer();
    view = next;
    render();
    scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function markActivity() { lastTouch = Date.now(); }

function render() {
  const app = $('#app');
  if (!app || !courses.length) return;
  $$('.nav-item[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  $('#nav-course-count').textContent = String(courses.length);
  $('#nav-review-count').textContent = String(getDueCards().length);
  const mobileReviewCount = $('#mobile-review-count'); if (mobileReviewCount) mobileReviewCount.textContent = String(getDueCards().length);
  document.body.classList.toggle('dark', state.preferences.theme === 'dark');
  document.body.classList.toggle('study-focus', view === 'study' && state.preferences.studyFocus);
  document.body.classList.toggle('study-workspace', view === 'study');
  if (view === 'home') app.innerHTML = renderHome();
  else if (view === 'courses') app.innerHTML = renderCourses();
  else if (view === 'study') app.innerHTML = renderStudy();
  else if (view === 'settings') app.innerHTML = renderSettings();
  else if (view === 'stats') app.innerHTML = renderStats();
  else if (view === 'reviews') app.innerHTML = renderReviews();
  $('#breadcrumb').textContent = view === 'study' ? `Dersler  /  ${currentCourse()?.title || 'Çalışma'}` : view === 'home' ? 'Kişisel çalışma alanın' : ({ courses: 'Derslerin', reviews: 'Günlük tekrarların', stats: 'Çalışma istatistikleri', settings: 'Kişisel ayarların' })[view];
  applyReadingSettings();
  if (view === 'study' && activeBlock < (currentCourse()?.blocks.length || 0)) refreshPlayerDisplay();
  observeAnswerMap();
}

function renderHome() {
  const unfinished = courses.filter(c => !lessonProgress(c.id).completedAt).length;
  const completed = courses.length - unfinished;
  const blocksDone = courses.reduce((n, c) => n + getCourseStats(c).completedBlocks, 0);
  const due = getDueCards().length;
  const deferred = getDeferredTasks(true);
  const target = continueTarget();
  const targetStats = getCourseStats(target);
  const startBlock = Math.min(Number.isInteger(targetStats.activeBlock) ? targetStats.activeBlock : targetStats.completedBlocks, target.blocks.length);
  const block = target.blocks[startBlock];
  const flow = block ? blockFlow(target.id, block.number) : { phase: 'consume' };
  const duration = target.durationMinutes ? Math.round(target.durationMinutes) : 0;
  const seenMinutes = fmtTime(state.activitySeconds);
  const dayCount = Object.keys(state.activeDays).length;
  const groups = categoryList();
  const session = state.session;
  const sessionText = session ? (session.phase === 'break' ? `Mola · ${countdown(session.endsAt)}` : `Çalışma · ${countdown(session.endsAt)}`) : 'Bir çalışma süresi seç, mola süresini belirle ve zamanlayıcıyı başlat.';
  const deferredMarkup = deferred.length ? `<section class="deferred-list"><h2>Erteleme zamanı gelen görevler · ${deferred.length}</h2>${deferred.map(item => `<button class="deferred-item" data-action="resume-deferred" data-course-id="${esc(item.course.id)}" data-task-key="${esc(item.key)}"><span><strong>${esc(item.course.title)}</strong><small>${esc(item.task.id)} · ${esc(item.task.prompt)}</small></span><span>${item.saved.deferUntil < dayKey() ? 'Gecikti' : 'Bugün'} →</span></button>`).join('')}</section>` : '';
  return `<section class="home-focus"><div class="home-focus-main"><div class="eyebrow">KALDIĞIN YER</div><h1>${esc(target.title)}</h1><p class="home-next-block">${block ? `Blok ${startBlock + 1} · ${esc(block.title)}` : 'Oturum sonu'}</p><div class="home-next-phase">${block ? (flow.phase === 'digest' ? 'Şimdi sindir' : 'Şimdi tüket') : 'Kısa öz değerlendirme'} · ${duration} dk tahmini ders</div><div class="progress-track"><div class="progress-fill" style="width:${targetStats.percent}%"></div></div><small>${targetStats.completedBlocks} / ${target.blocks.length} blok tamamlandı</small><button class="btn" data-action="continue">Çalışmaya devam et →</button></div><aside class="home-focus-side"><div class="eyebrow">BUGÜN</div><strong>${due} tekrar kartı</strong><p>${seenMinutes} çalışma süresi · ${dayCount} etkin gün</p><button class="btn secondary small" data-view="reviews">Tekrarlara git</button><div class="home-lesson-count">${blocksDone} blok · ${completed} ders tamamlandı</div></aside></section>${deferredMarkup}<section class="session-planner"><div><div class="eyebrow">ÇALIŞMA OTURUMU</div><h2>Bir adımda, kendi temponda</h2><p data-session-status>${esc(sessionText)}</p></div><div class="session-controls"><label>Çalışma<select class="select-small" data-session-setting="sessionMinutes"><option value="10" ${state.preferences.sessionMinutes == 10 ? 'selected' : ''}>10 dk</option><option value="20" ${state.preferences.sessionMinutes == 20 ? 'selected' : ''}>20 dk</option><option value="40" ${state.preferences.sessionMinutes == 40 ? 'selected' : ''}>40 dk</option><option value="custom" ${![10,20,40].includes(Number(state.preferences.sessionMinutes)) ? 'selected' : ''}>Özel</option></select></label><input aria-label="Özel çalışma dakikası" type="number" min="1" max="180" data-session-custom value="${![10,20,40].includes(Number(state.preferences.sessionMinutes)) ? esc(state.preferences.sessionMinutes) : ''}" placeholder="dk" ${[10,20,40].includes(Number(state.preferences.sessionMinutes)) ? 'hidden' : ''}><label>Mola<select class="select-small" data-session-setting="breakMinutes"><option value="3" ${state.preferences.breakMinutes == 3 ? 'selected' : ''}>3 dk</option><option value="5" ${state.preferences.breakMinutes == 5 ? 'selected' : ''}>5 dk</option><option value="10" ${state.preferences.breakMinutes == 10 ? 'selected' : ''}>10 dk</option></select></label><button class="btn small" data-action="${session ? 'session-stop' : 'session-start'}">${session ? 'Oturumu bitir' : 'Oturumu başlat'}</button></div></section><div class="section-heading"><div><h2>Derslerin</h2><p>${courses.length} çalışma kâğıdı · ${groups.length} konu başlığı</p></div><button class="text-button" data-view="courses">Tüm dersleri gör →</button></div><div class="course-grid">${courses.slice(0, 6).map(courseCard).join('')}</div>`;
}

function countdown(endsAt) { return `${Math.floor(Math.max(0, endsAt - Date.now()) / 60_000)}:${String(Math.floor(Math.max(0, endsAt - Date.now()) / 1000) % 60).padStart(2, '0')}`; }

function statCard(label, value, note) {
  return `<article class="stat-card"><div class="stat-label">${esc(label)}</div><div class="stat-value">${esc(value)}</div><div class="stat-note">${esc(note)}</div></article>`;
}

function categoryList() {
  return ['Tümü', ...new Set(courses.map(course => course.category))];
}

function courseCard(course) {
  const stats = getCourseStats(course);
  const nextBlock = course.blocks[Math.min(stats.activeBlock || stats.completedBlocks, course.blocks.length - 1)];
  return `<article class="course-card" tabindex="0" role="button" data-course="${esc(course.id)}" aria-label="${esc(course.title)} dersini aç">
    <div class="course-card-top"><span class="course-glyph ${catColor(course.category)}">${ICONS[courses.indexOf(course) % ICONS.length]}</span><small>${course.blocks.length} blok · ${Math.round(course.durationMinutes || 0)} dk</small></div>
    <h3>${esc(course.title)}</h3><p>${esc(course.thesis || course.outcomes)}</p>
    <div class="course-card-bottom"><div class="progress-track"><div class="progress-fill" style="width:${stats.percent}%"></div></div><small>${stats.completedBlocks === course.blocks.length ? 'Ders tamamlandı' : `Sıradaki: ${esc(shorten(nextBlock?.title || 'Oturum özeti', 40))}`} · ${stats.percent}%</small></div>
  </article>`;
}

function renderCourses() {
  const categories = categoryList();
  return `<div class="eyebrow">BÜTÜN ÇALIŞMA KÂĞITLARIN</div><h1 class="page-title">Dersler</h1><p class="page-subtitle">İstediğin konudan başla veya kaldığın yere dön. Derslerin adımları kendi P.A.C.E.R. kâğıtlarına göre sıralandı.</p>
    <div class="section-heading"><div><h2>${courses.length} ders</h2><p>Konu, ders veya görev içinde ara</p></div><label class="search-box"><span>⌕</span><input id="course-search" type="search" value="${esc(searchQuery)}" placeholder="Ders veya kavram ara" aria-label="Derslerde ara"></label></div>
    <div class="chip-row">${categories.map(cat => `<button class="chip ${cat === activeCategory ? 'active' : ''}" data-category="${esc(cat)}">${esc(cat)}</button>`).join('')}</div>
    <div class="course-grid">${visibleCourses().map(courseCard).join('') || '<div class="empty-state">Bu aramada ders bulunamadı. Başka bir kavram deneyebilirsin.</div>'}</div>`;
}

// Keep original task indices and keys so existing answers and resumed tasks survive.
function studySteps(block) {
  const tasks = getBlockTasks(block).map((entry, taskIndex) => ({ ...entry, taskIndex,
    stage: ['C', 'A'].includes(entry.section.type) ? 'notes' : 'digest' }));
  return [{ stage: 'consume' }, ...tasks.filter(item => item.stage === 'notes'),
    ...tasks.filter(item => item.stage === 'digest'), { stage: 'summary' }];
}

function currentStudyStep(block, flow) {
  const steps = studySteps(block);
  if (flow.phase === 'consume') return 0;
  if (flow.phase === 'summary') return steps.length - 1;
  return Math.max(0, steps.findIndex(item => flow.taskId ? item.task?.id === flow.taskId : item.taskIndex === flow.taskIndex));
}

function renderStudyHeading(course, subtitle) {
  return `<div class="study-heading"><div><div class="eyebrow">${esc(subtitle)}</div><h1 title="${esc(course.title)}">${esc(course.title)}</h1></div><div class="study-head-actions"><button class="btn ghost small" data-setting-toggle="studyFocus" aria-pressed="${state.preferences.studyFocus}">${state.preferences.studyFocus ? 'Odak açık' : 'Odak görünümü'}</button><button class="btn ghost small" data-view="courses">Ders listesi</button></div></div>`;
}

function renderStudyTools(hasReading = true) {
  return `<div class="workspace-tools"><span>${studyTool === 'map' ? 'Kaynaklı kavram haritası' : studyTool === 'reading' ? 'Kaynak metin' : 'Çalışma alanın'}</span><div>${studyTool ? '<button class="text-button" data-action="close-study-tool">← Çalıştığım adıma dön</button>' : `${hasReading ? '<button class="text-button" data-action="show-study-reading">Kaynak metin</button>' : ''}<button class="text-button" data-action="show-answer-map">Kavram haritası</button>`}</div></div>`;
}

function renderStudyReading(course, block) {
  const prefs = state.preferences;
  return `<div class="workspace-reading"><div class="reading-tools"><label class="tool-select">Gösterim <select id="reading-mode" class="select-small" aria-label="Okuma biçimi"><option value="page" ${prefs.readingMode === 'page' ? 'selected' : ''}>Metinde kelime takibi</option><option value="word" ${prefs.readingMode === 'word' ? 'selected' : ''}>Ortada kelime göster</option></select></label><details class="reader-preferences"><summary>Okuma seçenekleri</summary><div class="reader-preferences-body"><button class="toggle ${prefs.bionic ? 'active' : ''}" data-setting-toggle="bionic">Bionik ${prefs.bionic ? 'Açık' : 'Kapalı'}</button><button class="toggle ${prefs.highlightWord ? 'active' : ''}" data-setting-toggle="highlightWord">Kelime vurgusu ${prefs.highlightWord ? 'Açık' : 'Kapalı'}</button><button class="text-button" data-view="settings">Tüm okuma ayarları →</button></div></details></div>${prefs.readingMode === 'word' ? renderWordPlayer(course, block, activeBlock) : renderReadingPanel(block)}</div>`;
}

function noteSourceAnswers(course, block, kind) {
  const tasks = getBlockTasks(block).filter(entry => entry.section.type === kind).map(entry => entry.task);
  if (kind === 'C' && block.sourceMapAnswer) tasks.unshift({ id: `Blok ${block.number} · Harita`, prompt: 'Bu bloğun cevap anahtarındaki kavram bağlantıları', answer: block.sourceMapAnswer });
  const seen = new Set();
  return tasks.filter(task => {
    if (!task.answer || seen.has(task.answer)) return false;
    seen.add(task.answer); return true;
  });
}

function renderNoteAnswerControls(course, block, kind) {
  const answers = noteSourceAnswers(course, block, kind);
  const id = `note-source-${block.number}-${kind}`;
  return `<div class="personal-note-answer" data-note-source="${kind}" data-course-id="${esc(course.id)}" data-block-number="${block.number}"><div class="answer-actions"><button class="answer-button" data-note-answer-action="reveal" aria-expanded="false" aria-controls="${id}">? Cevabı göster</button><button class="answer-button" data-note-answer-action="copy" ${answers.length ? '' : 'disabled'}>Cevabı kopyala</button></div><div class="note-model-answer" id="${id}" hidden>${answers.length ? answers.map(task => `<article><strong>Cevap anahtarı · ${esc(task.id)}</strong><p class="note-source-prompt">${esc(task.prompt)}</p><p class="note-source-text">${esc(task.answer)}</p></article>`).join('') : '<p>Bu not için belgede ayrı bir örnek cevap bulunmuyor.</p>'}</div></div>`;
}

function renderPersonalNotes(course, block, kind) {
  const progress = lessonProgress(course.id), flow = blockFlow(course.id, block.number);
  if (kind === 'A') return `<details class="personal-notes"><summary>Serbest analoji notlarım</summary><label><span>Kaynak cevabını açıp kendi notunu yazarak çalışabilirsin.</span><textarea data-flow-field="analogyNotes" data-course-id="${esc(course.id)}" data-block-number="${block.number}" placeholder="Neye benziyor? Nerede ayrılıyor?">${esc(flow.analogyNotes || '')}</textarea></label>${renderNoteAnswerControls(course, block, 'A')}</details>`;
  return `<details class="personal-notes"><summary>Serbest kavram bağlantılarım</summary><div class="map-editor"><div><label><span>${course.mapSetup?.starter ? `Başlangıç: ${esc(course.mapSetup.starter)}` : 'Kendi kavram bağlantıların'}</span></label><div class="map-link-form"><input data-map-from placeholder="Kavram" aria-label="Başlangıç kavramı"><input data-map-relation placeholder="İlişki (oluşturur, etkiler…)" aria-label="İlişki"><input data-map-to placeholder="Bağlı kavram" aria-label="Hedef kavram"><select data-map-source aria-label="Kaynak paragrafı"><option value="">Kaynak paragrafı (isteğe bağlı)</option>${block.reading.map((para, i) => `<option value="${block.number}:${i + 1}">Blok ${block.number} · ¶${i + 1} · ${esc(shorten(para.text, 54))}</option>`).join('')}</select><button class="btn small" data-action="map-add">Bağlantı ekle</button></div><label><span>Kaynak cevabını açıp kendi notunu yazarak çalışabilirsin.</span><textarea data-flow-field="mapNotes" data-course-id="${esc(course.id)}" data-block-number="${block.number}" placeholder="Her satıra: kavram → ilişki → kavram | B1 ¶2">${esc(progress.mapNotes || '')}</textarea></label>${renderNoteAnswerControls(course, block, 'C')}</div><div class="map-preview" data-map-preview>${renderMapPreview(progress.mapNotes || '')}</div></div></details>`;
}

function renderStudyTask(course, block, entry) {
  const key = taskKey(block, entry.task), saved = taskProgress(course.id, key);
  const status = progressBlockDone(course.id, block.number) ? 'worked' : saved.status;
  const section = entry.section;
  const guidance = section.guidance?.length ? `<details class="task-guidance"><summary>${section.type === 'A' ? 'Benzetme ve yönergeyi oku' : 'Görev yönergesini oku'}</summary>${section.instruction ? `<p>${esc(section.instruction)}</p>` : ''}${section.guidance.map(text => `<p>${esc(text)}</p>`).join('')}</details>` : '';
  return `<div class="workspace-task"><div class="task-section-head"><span class="type-tag ${section.type.toLowerCase()}">${section.type === 'ER' ? 'E/R' : esc(section.type)}</span><strong>${entry.stage === 'notes' ? (section.type === 'A' ? 'Kendi notların · Analoji' : 'Kendi notların · Kavram bağlantısı') : esc(section.label)}</strong></div>${guidance}${renderTask(course, block, entry.task)}<div class="self-check"><span>Nasıl gitti?</span><button class="answer-button ${status === 'worked' ? 'selected' : ''}" data-action="task-status" data-status="worked" data-task-key="${esc(key)}" data-course-id="${esc(course.id)}">İşledim</button><button class="answer-button ${status === 'again' ? 'selected' : ''}" data-action="task-status" data-status="again" data-task-key="${esc(key)}" data-course-id="${esc(course.id)}">Tekrar gerekli</button></div><details class="task-defer-options"><summary>${status === 'deferred' ? `Ertelendi · ${esc(saved.deferUntil)}` : 'Sonraya bırak / tekrar tarihi'}</summary><div class="task-defer"><label>Tekrar tarihi<input type="date" data-defer-date min="${dayKey()}" value="${esc(saved.deferUntil || dayKey())}" aria-label="Görev için tekrar tarihi"></label><button class="answer-button" data-action="task-defer" data-task-key="${esc(key)}" data-course-id="${esc(course.id)}">Bu tarihe ertele</button>${status === 'deferred' ? `<button class="text-button" data-action="task-undefer" data-task-key="${esc(key)}" data-course-id="${esc(course.id)}">Ertelemeyi kaldır</button>` : ''}</div></details>${entry.stage === 'notes' ? renderPersonalNotes(course, block, section.type) : ''}</div>`;
}

function renderBlockSummary(course, block, flow) {
  const tasks = getBlockTasks(block), progress = lessonProgress(course.id);
  const completed = progressBlockDone(course.id, block.number);
  const pending = tasks.filter(({ task }) => !completed && !taskIsDone(course.id, taskKey(block, task)));
  const deferred = tasks.filter(({ task }) => taskProgress(course.id, taskKey(block, task)).status === 'deferred').length;
  const answered = tasks.filter(({ task }) => taskProgress(course.id, taskKey(block, task)).answer?.trim()).length;
  return `<div class="block-summary"><div class="eyebrow">BLOK ÖZETİ</div><h2>${esc(block.title)}</h2><p>${flow.readComplete || completed ? 'Okuma tamamlandı.' : 'Okumayı henüz tamamlandı olarak işaretlemedin.'} ${answered} cevap yazıldı. ${pending.length} görev bekliyor.${deferred ? ` ${deferred} görev tekrar için ertelendi.` : ''}</p>${!flow.readComplete && !completed ? '<button class="text-button" data-action="workspace-stage" data-stage="consume">Okuma adımına dön →</button>' : ''}${pending.length ? `<p>Eksik göreve dön veya bloğu sonraya bırak.</p><div class="pending-tasks">${pending.map(({ task }) => `<button class="answer-button" data-action="workspace-task" data-task-index="${tasks.findIndex(item => item.task.id === task.id)}">${esc(task.id)} · ${esc(shorten(task.prompt, 65))}</button>`).join('')}</div>` : '<p>Hazır olduğunda bloğu tamamlayıp devam edebilirsin.</p>'}${course.studyGuide?.length ? `<details class="pacer-guide"><summary>P.A.C.E.R. çalışma rehberi</summary><ol>${course.studyGuide.filter(line => /^\d+[.)]/.test(line)).map(line => `<li>${esc(line.replace(/^\d+[.)]\s*/, ''))}</li>`).join('')}</ol></details>` : ''}<details class="knowledge-profile"><summary>Bu derste hangi tür bilgi var?</summary>${(course.knowledgeProfile || []).map(item => `<p><strong>${esc(item.type)} · ${esc(item.label)}</strong> ${esc(item.description)}</p>`).join('')}</details></div>`;
}

function renderStudy() {
  const course = currentCourse();
  if (!course) return renderCourses();
  const progress = lessonProgress(course.id);
  if (activeBlock >= course.blocks.length) return renderWrapUp(course, progress);
  const block = course.blocks[activeBlock], flow = blockFlow(course.id, block.number);
  const steps = studySteps(block), index = currentStudyStep(block, flow), entry = steps[index];
  if (entry.stage === 'consume' || studyTool === 'reading') wordIndex = Math.max(0, Math.min(Number(progress.reader?.[String(activeBlock)]) || 0, Math.max(0, splitWords(block).length - 1)));
  const stages = [['consume','Oku'], ['notes','Kendi notların'], ['digest','Sorular'], ['summary','Özet']].filter(([stage]) => steps.some(item => item.stage === stage));
  const stepper = `<nav class="workspace-stepper" aria-label="Bloktaki çalışma sırası">${stages.map(([stage,label], i) => `<button class="workspace-step ${entry.stage === stage ? 'active' : ''}" data-action="workspace-stage" data-stage="${stage}" ${entry.stage === stage ? 'aria-current="step"' : ''}><span>${i + 1}</span>${label}</button>`).join('')}</nav>`;
  let body = studyTool === 'map' ? renderAnswerMap(course) : studyTool === 'reading' || entry.stage === 'consume' ? renderStudyReading(course, block) : entry.stage === 'summary' ? renderBlockSummary(course, block, flow) : renderStudyTask(course, block, entry);
  const pending = getBlockTasks(block).filter(({task}) => !taskIsDone(course.id, taskKey(block, task))).length;
  const canComplete = progressBlockDone(course.id, block.number) || (flow.readComplete && pending === 0);
  const stageTasks = steps.filter(item => item.stage === entry.stage);
  const stepLabel = entry.task ? `${stageTasks.indexOf(entry) + 1} / ${stageTasks.length} · ${entry.task.id}` : `Adım ${index + 1} / ${steps.length}`;
  const footer = studyTool ? `<button class="btn ghost" data-action="close-study-tool">← Çalıştığım adıma dön</button>` : `<button class="btn ghost small" data-action="workspace-prev" ${index === 0 && activeBlock === 0 ? 'disabled' : ''}>← Geri</button><span class="workspace-position">${esc(stepLabel)}<small>Otomatik kaydediliyor</small></span><button class="btn" data-action="${entry.stage === 'summary' ? (canComplete ? 'next-block' : 'leave-block') : 'workspace-next'}">${entry.stage === 'summary' ? (canComplete ? 'Bloğu tamamla →' : 'Bloğu sonraya bırak →') : entry.stage === 'consume' ? 'Okudum, devam →' : index === steps.length - 2 ? 'Kaydet ve özeti gör →' : 'Kaydet ve devam →'}</button>`;
  return `${renderStudyHeading(course, `BLOK ${activeBlock + 1} / ${course.blocks.length} · ${block.title}`)}${stepper}<section class="study-card sequential-workspace">${renderStudyTools()}<div class="workspace-body ${!studyTool && entry.stage === 'consume' || studyTool === 'reading' ? 'is-reading' : ''}" id="workspace-body">${body}</div></section><footer class="workspace-footer">${footer}</footer>`;
}

function bionic(text, strength = state.preferences.boldPercent) {
  return String(text).split(/(\s+)/u).map(piece => {
    if (!piece.trim()) return piece;
    const letters = [...piece];
    const letterCount = letters.filter(char => /[\p{L}\p{N}]/u.test(char)).length;
    const count = Math.max(1, Math.min(letterCount, Math.round(letterCount * strength / 100)));
    let used = 0, index = 0;
    while (index < letters.length && used < count) { if (/[\p{L}\p{N}]/u.test(letters[index])) used++; index++; }
    return `<strong>${esc(letters.slice(0, index).join(''))}</strong>${esc(letters.slice(index).join(''))}`;
  }).join('');
}

function renderReadingPanel(block) {
  const direction = renderReadDirection(block);
  if (!block.reading.length) return `${direction}<div class="reading-panel"><p class="reader-empty">Bu blok için ayrıca kaynak paragrafı ayrılmamış. Görevlerini aşağıdan açıp çalışabilirsin.</p></div>`;
  const prefs = state.preferences;
  let index = 0;
  const body = block.reading.map((para, i) => {
    const text = String(para.text).split(/(\s+)/u).map(piece => {
      if (!piece.trim()) return piece;
      return `<span class="reading-word" data-reader-word="${index++}">${prefs.bionic ? bionic(piece) : esc(piece)}</span>`;
    }).join('');
    return `<p class="reading-paragraph" data-reading-paragraph="${i}">${text}</p>`;
  }).join('');
  return `${direction}${renderReaderControls(splitWords(block).length)}<div aria-live="off" class="reading-panel ${prefs.focusParagraph ? 'focus-mode' : ''}" id="reading-panel">${body}</div><div class="paragraph-focus"><button class="answer-button" data-action="reading-prev">↑ Önceki paragraf</button><button class="answer-button" data-action="reading-next">Sonraki paragraf ↓</button><span class="reading-mode-line" id="reading-position">${block.reading.length} kaynak paragrafı</span></div>`;
}

function renderReadDirection(block) {
  return block.readInstruction ? `<details class="read-direction"><summary>Bu blokta ne okuyacağım?</summary><p>${esc(block.readInstruction)}</p></details>` : '';
}

function renderReaderControls(wordCount) {
  const prefs = state.preferences;
  return `<div class="reader-controls" aria-live="off" aria-label="Kelime takibi kontrolleri"><div class="reader-control-row"><div class="reader-transport"><button class="answer-button" data-action="word-prev" aria-label="Önceki kelime" ${wordCount ? '' : 'disabled'}>←</button><button class="btn reader-play" data-action="word-play" id="word-play" aria-label="${playerRunning ? 'Durdur' : 'Oynat'}" ${wordCount ? '' : 'disabled'}>${readerPlayLabel()}</button><button class="answer-button" data-action="word-next" aria-label="Sonraki kelime" ${wordCount ? '' : 'disabled'}>→</button></div><label class="reader-speed">Hız <input type="number" min="60" max="1000" step="10" value="${prefs.wpm}" data-setting-number="wpm" aria-label="Dakikadaki kelime hızı"><span>kelime/dk</span></label><span class="reader-counter"><span id="word-current">${wordCount ? wordIndex + 1 : 0}</span> / ${wordCount}</span></div><input class="reader-slider" type="range" min="0" max="${Math.max(wordCount - 1, 0)}" value="${wordIndex}" data-word-slider aria-label="Metinde ilerle" ${wordCount ? '' : 'disabled'}><p class="reader-tip">${prefs.readingMode === 'page' ? "Oynat’a bas: vurgu kelime kelime ilerler. Kelimeye tıklayıp oradan devam et." : "Oynat’a bas: kelimeler sırayla ortada gösterilir. Oklarla veya sürgüyle konum seç."}</p></div>`;
}

function readerPlayLabel() {
  const path = playerRunning ? 'M4 3h3v10H4zM9 3h3v10H9z' : 'M4 2.5L13 8L4 13.5z';
  return `<svg class="reader-play-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="${path}"/></svg><span>${playerRunning ? 'Durdur' : 'Oynat'}</span>`;
}

function renderAnswerMap(course) {
  const maps = course.answerMaps || [];
  if (!maps.length) return '';
  const route = maps.find(map => map.id === activeMapRouteId) || maps[0];
  const task = course.mapWalks.find(item => item.id === route.id);
  const names = [...new Set(route.links.flatMap(([from, , to]) => [from, to]))];
  return `<section class="study-card answer-map-card" id="answer-map-card"><details open class="answer-map-details"><summary><span class="type-tag c">C</span><span>Kaynaklı kavram haritası<small>Cevap anahtarına göre hazır çizildi</small></span></summary><div class="answer-map-tabs" aria-label="Kavram bağlantı yolları">${maps.map(map => {
    const item = course.mapWalks.find(value => value.id === map.id);
    return `<button class="answer-map-tab ${map.id === route.id ? 'active' : ''}" data-action="map-route" data-map-route="${esc(map.id)}" aria-pressed="${map.id === route.id}">${esc(map.id)} · ${esc(item?.prompt.replace(/\s*→\s*…\s*→\s*/u, ' → ') || map.id)}</button>`;
  }).join('')}</div><div class="answer-map-scroll" tabindex="0" aria-label="Kavram haritası; büyük haritalarda kaydırarak ilerle"><div class="answer-map-board" data-answer-map="${esc(route.id)}"><svg class="answer-map-connections" aria-hidden="true"></svg>${names.map((name, index) => `<div class="answer-map-node" data-map-node="${index}">${esc(name)}</div>`).join('')}</div></div><p class="answer-map-hint">Büyük haritaları yana ve aşağı kaydırarak inceleyebilirsin.</p><div class="answer-map-source">Kaynak: ${esc(course.title)} · Cevap anahtarı ${esc(route.id)}</div><details class="answer-map-key"><summary>Cevap anahtarındaki açıklamayı oku</summary><p>${esc(task?.answer || '')}</p></details><details class="answer-map-text"><summary>Bağlantıları liste olarak gör</summary><ul>${route.links.map(([from, relation, to]) => `<li><strong>${esc(from)}</strong> → ${esc(relation)} → <strong>${esc(to)}</strong></li>`).join('')}</ul></details></details></section>`;
}

function drawAnswerMap() {
  const board = $('[data-answer-map]');
  const svg = $('.answer-map-connections', board || document);
  const route = currentCourse()?.answerMaps?.find(map => map.id === board?.dataset.answerMap);
  if (!board || !svg || !route || !board.parentElement.offsetWidth) return;
  const names = [...new Set(route.links.flatMap(([from, , to]) => [from, to]))];
  const graph = new window.dagre.graphlib.Graph({ multigraph: true }).setGraph({ rankdir: 'TB', nodesep: 28, edgesep: 18, ranksep: 38, marginx: 20, marginy: 16 });
  const nodeWidth = board.parentElement.clientWidth < 450 ? 150 : 200;
  for (let index = 0; index < names.length; index++) {
    const node = $(`[data-map-node="${index}"]`, board);
    node.style.width = `${nodeWidth}px`;
    graph.setNode(String(index), { width: nodeWidth, height: node.offsetHeight });
  }
  route.links.forEach(([from, relation, to], index) => {
    const label = document.createElement('div');
    label.className = 'answer-map-relation';
    label.textContent = relation;
    Object.assign(label.style, { width: '142px', visibility: 'hidden', position: 'absolute' });
    board.append(label);
    const height = label.offsetHeight;
    label.remove();
    graph.setEdge(String(names.indexOf(from)), String(names.indexOf(to)), { width: 142, height, labelpos: 'c', relation }, String(index));
  });
  window.dagre.layout(graph);
  const { width, height } = graph.graph();
  board.style.width = `${Math.ceil(width)}px`;
  board.style.height = `${Math.ceil(height)}px`;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  names.forEach((name, index) => {
    const node = graph.node(String(index));
    Object.assign($(`[data-map-node="${index}"]`, board).style, { left: `${node.x - node.width / 2}px`, top: `${node.y - node.height / 2}px` });
  });
  svg.innerHTML = `<defs><marker id="answer-map-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M1 1 L8 5 L1 9"/></marker></defs>` + graph.edges().map(edgeId => {
    const edge = graph.edge(edgeId);
    const path = edge.points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
    return `<path class="answer-map-arrow" d="${path}" marker-end="url(#answer-map-arrow)"/><foreignObject x="${edge.x - edge.width / 2}" y="${edge.y - edge.height / 2}" width="${edge.width}" height="${edge.height}"><div xmlns="http://www.w3.org/1999/xhtml" class="answer-map-relation">${esc(edge.relation)}</div></foreignObject>`;
  }).join('');
}

function observeAnswerMap() {
  mapResizeObserver?.disconnect();
  const board = $('[data-answer-map]');
  if (!board) return;
  mapResizeObserver = new ResizeObserver(drawAnswerMap);
  mapResizeObserver.observe(board.parentElement);
  requestAnimationFrame(drawAnswerMap);
}

function renderMapPreview(raw) {
  const links = String(raw || '').split(/\n+/u).map(line => {
    const [body, source = ''] = line.split(/\s*\|\s*/u);
    const parts = body.split('→').map(part => part.trim());
    const citation = source.match(/B([^\s|]+)\s*¶\s*(\d+)/u);
    const sourceNumber = source.match(/¶\s*(\d+)/u)?.[1] || '';
    return { from: parts[0], relation: parts[1], to: parts.slice(2).join(' → '), sourceNumber, sourceBlock: citation?.[1] || '' };
  }).filter(link => link.from && link.relation && link.to);
  if (!links.length) return '<p class="map-empty">Bağlantıları yazdıkça harita burada görünür.</p>';
  const height = Math.max(130, links.length * 92 + 24);
  const rows = links.map((link, index) => {
    const y = 45 + index * 92;
    return `<g class="map-edge"><path d="M 230 ${y} C 310 ${y}, 410 ${y}, 490 ${y}" marker-end="url(#map-arrow)"/><rect x="8" y="${y - 20}" width="222" height="40" rx="12"/><text x="119" y="${y + 5}" text-anchor="middle">${esc(link.from)}</text><rect x="490" y="${y - 20}" width="222" height="40" rx="12"/><text x="601" y="${y + 5}" text-anchor="middle">${esc(link.to)}</text><text class="map-relation" x="360" y="${y - 9}" text-anchor="middle">${esc(link.relation)}</text>${link.sourceNumber ? `<text class="map-source" x="700" y="${y + 34}" text-anchor="end">Kaynak ${link.sourceBlock ? `Blok ${esc(link.sourceBlock)} · ` : ''}¶${esc(link.sourceNumber)}</text>` : ''}</g>`;
  }).join('');
  return `<svg class="knowledge-map" viewBox="0 0 720 ${height}" role="img" aria-label="Kavram bağlantı haritası"><defs><marker id="map-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z"/></marker></defs>${rows}</svg>`;
}

function splitWords(block) {
  const text = block.reading.map(p => p.text).join(' ');
  return text.match(/\S+/gu) || [];
}

function renderWordContext(words, start, active, count = 1) {
  return words.slice(start, active + 10).map((word, offset) => {
    const index = start + offset;
    const current = state.preferences.highlightWord && index >= active && index < active + count;
    return `<span class="context-word ${current ? 'current' : ''}">${esc(word)}</span>`;
  }).join(' ');
}

function renderWordPlayer(course, block, blockIndex) {
  const prefs = state.preferences;
  const words = splitWords(block);
  const position = lessonProgress(course.id).reader?.[String(blockIndex)] ?? 0;
  wordIndex = Math.max(0, Math.min(position, Math.max(0, words.length - 1)));
  const contextStart = Math.max(0, wordIndex - 9);
  const context = renderWordContext(words, contextStart, wordIndex, Math.max(1, Number(state.preferences.groupWords) || 1));
  const current = words[wordIndex] || 'Bu blokta kelime bulunamadı';
  return `${renderReadDirection(block)}${renderReaderControls(words.length)}<div class="word-player" aria-live="off" id="word-player" data-word-count="${words.length}"><p class="player-context">${context}</p><div class="player-word" id="player-word">${prefs.bionic ? bionic(current) : esc(current)}</div></div>`;
}

function taskKey(block, task) { return `${block.number}:${task.id}`; }

function renderSection(course, block, section, label) {
  const guidance = section.guidance?.length ? `<div class="section-guidance">${section.guidance.map(text => `<p>${esc(text)}</p>`).join('')}</div>` : '';
  return `<div class="task-section"><div class="task-section-head"><span class="type-tag ${section.type.toLowerCase()}">${section.type === 'ER' ? 'E/R' : esc(section.type)}</span><strong>${esc(label || section.label)}</strong><small>${section.tasks.length} görev</small></div>${section.instruction ? `<p class="task-prompt" style="padding:0 13px 7px;margin:0">${esc(section.instruction)}</p>` : ''}${guidance}${section.tasks.map(task => renderTask(course, block, task)).join('')}</div>`;
}

function renderTask(course, block, task) {
  const key = taskKey(block, task);
  const saved = lessonProgress(course.id).tasks[key] || {};
  const revealed = !!saved.revealed;
  const answer = task.answer || 'Bu görev için cevap anahtarında ayrı bir örnek yanıt yok. Önce kendi çözümünü yazıp dersin genel ölçütleriyle değerlendirebilirsin.';
  const answerPlaceholder = task.expectedKind === 'E' ? 'Bu kanıt hangi kavramı somutlaştırıyor? Nasıl kullanırsın?' : task.expectedKind === 'R' ? 'Bu ayrıntıyı hatırladığın kadarıyla yaz…' : 'Düşünceni buraya yaz…';
  const due = state.review[`${course.id}:${key}`]?.due;
  const classification = task.expectedKind ? `<div class="knowledge-choice"><span>Bu bilgi türü:</span><button class="answer-button ${saved.kindChoice === 'E' ? 'selected' : ''}" data-kind-choice="E" data-course-id="${esc(course.id)}" data-task-key="${esc(key)}">E · Kanıt</button><button class="answer-button ${saved.kindChoice === 'R' ? 'selected' : ''}" data-kind-choice="R" data-course-id="${esc(course.id)}" data-task-key="${esc(key)}">R · Referans</button>${revealed ? `<small>${saved.kindChoice === task.expectedKind ? 'Doğru sınıflandırdın.' : `Kaynakta ${task.expectedKind} olarak işaretli.`}</small>` : ''}</div>` : '';
  return `<article class="task-card" data-task-card="${esc(key)}"><div class="task-prompt"><span class="task-id">${esc(task.id)}</span>${esc(task.prompt || 'Bu görev için soru metni bulunamadı.')}</div>${classification}<div class="task-answer"><div class="answer-toolbar"><label for="answer-${esc(task.id)}-${block.number}">Cevabın</label><div class="answer-actions"><button class="answer-button reveal" data-task-action="reveal" data-course-id="${esc(course.id)}" data-task-key="${esc(key)}">${revealed ? 'Cevabı gizle' : '? Cevabı göster'}</button><button class="answer-button ${saved.copied ? 'copied' : ''}" data-task-action="copy" data-course-id="${esc(course.id)}" data-task-key="${esc(key)}">${saved.copied ? 'Kopyalandı ✓' : 'Cevabı kopyala'}</button></div></div><textarea id="answer-${esc(task.id)}-${block.number}" class="answer-text" data-answer="${esc(task.id)}" data-course-id="${esc(course.id)}" data-task-key="${esc(key)}" placeholder="${esc(answerPlaceholder)}" spellcheck="true">${esc(saved.answer || '')}</textarea>${revealed ? `<div class="model-answer ${task.answer ? '' : 'no-key'}" data-model-answer="${esc(task.id)}">${esc(answer)}</div>` : ''}<div class="answer-footer"><span class="answer-hint">Yazdıkların otomatik kaydolur · Ctrl + Enter ile devam et</span><span class="save-status">${saved.updatedAt ? 'Kaydedildi ✓' : ''}${due ? ` · Tekrar: ${esc(due)}` : ''}</span></div></div></article>`;
}

function wrapUpSteps(course) {
  return [...(course.mapWalks || course.wrapUp || []).map(task => ({ stage: 'map', task })),
    ...(course.reflectionQuestions || []).map((question, reflectionIndex) => ({ stage: 'reflection', question, reflectionIndex })), { stage: 'finish' }];
}

function renderWrapUp(course, progress) {
  const steps = wrapUpSteps(course), index = Math.max(0, Math.min(progress.wrapStep || 0, steps.length - 1)), entry = steps[index];
  const groups = [['map','Haritada gezin'], ['reflection','Değerlendir'], ['finish','Tamamla']].filter(([stage]) => steps.some(item => item.stage === stage));
  let body;
  if (studyTool === 'map') body = renderAnswerMap(course);
  else if (entry.task) body = `<div class="workspace-task"><h2>Haritada gezin · ${esc(entry.task.id)}</h2><p>Kavram haritasını üstteki düğmeden aynı alanda açabilirsin.</p>${renderTask(course, {number: 'son'}, entry.task)}</div>`;
  else if (entry.stage === 'reflection') body = `<div class="workspace-task"><h2>Oturum sonu değerlendirmesi</h2><label class="reflection-item"><span>${esc(entry.question)}</span><textarea data-reflection="${entry.reflectionIndex}" data-course-id="${esc(course.id)}" placeholder="Kısa notunu yaz…">${esc(progress.reflections?.[String(entry.reflectionIndex)] || '')}</textarea></label></div>`;
  else body = `<div class="final-card"><h2>${progress.completedAt ? 'Değerlendirmeni güncelle' : 'Nasıl hissettin?'}</h2><div class="rating-row">${[['confident','Rahat hatırlıyorum'],['review','Tekrar gerekli'],['difficult','Zorlandım']].map(([key,label]) => `<button class="rating-option ${progress.rating === key ? 'active' : ''}" data-rating="${key}">${label}</button>`).join('')}</div><div class="finish-summary">${progress.completedBlocks || 0} / ${course.blocks.length} blok tamamlandı · ${Object.values(progress.tasks).filter(task => task.answer?.trim()).length} cevap yazıldı</div><p>Eksik bloklar tamamlanmış sayılmaz; daha sonra kaldığın yerden çalışabilirsin.</p></div>`;
  return `${renderStudyHeading(course, 'OTURUM SONU')}<nav class="workspace-stepper" aria-label="Oturum sonu çalışma sırası">${groups.map(([stage,label],i) => `<button class="workspace-step ${entry.stage === stage ? 'active' : ''}" data-action="wrap-stage" data-stage="${stage}" ${entry.stage === stage ? 'aria-current="step"' : ''}><span>${i+1}</span>${label}</button>`).join('')}</nav><section class="study-card sequential-workspace">${renderStudyTools(false)}<div class="workspace-body" id="workspace-body">${body}</div></section><footer class="workspace-footer">${studyTool ? '<button class="btn ghost" data-action="close-study-tool">← Çalıştığım adıma dön</button>' : `<button class="btn ghost small" data-action="wrap-prev">← Geri</button><span class="workspace-position">Adım ${index+1} / ${steps.length}<small>Otomatik kaydediliyor</small></span><button class="btn" data-action="${entry.stage === 'finish' ? 'finish-course' : 'wrap-next'}">${entry.stage === 'finish' ? 'Oturumu tamamla' : 'Kaydet ve devam →'}</button>`}</footer>`;
}

function renderSyncConflicts() {
  const conflicts = (state.syncConflicts || []).map((item, index) => ({ ...item, index })).filter(item => !item.resolved);
  if (!conflicts.length) return '';
  return `<section class="setting-card sync-conflict-card"><h2>Eşitlemede farklı cevaplar var</h2><p>İki cihazda aynı alan kısa aralıkla değişmiş. Saklanacak metni seç.</p>${conflicts.map(conflict => `<article class="sync-conflict"><strong>${esc(conflict.path.at(-1) || 'Çalışma notu')}</strong><details><summary>Bu cihazdaki metin</summary><p>${esc(conflict.local)}</p><button class="answer-button" data-action="resolve-conflict" data-conflict-index="${conflict.index}" data-conflict-choice="local">Bunu sakla</button></details><details><summary>Diğer cihazdaki metin</summary><p>${esc(conflict.remote)}</p><button class="answer-button" data-action="resolve-conflict" data-conflict-index="${conflict.index}" data-conflict-choice="remote">Bunu sakla</button></details></article>`).join('')}</section>`;
}

function renderSettings() {
  const p = state.preferences;
  const isConnected = Boolean(github.owner && github.repo && github.token);
  const supabaseConnected = Boolean(supabaseSession?.access_token && supabaseSession?.user?.id);
  return `<div class="eyebrow">KİŞİSEL ÇALIŞMA ALANIN</div><h1 class="page-title">Ayarlar</h1><p class="page-subtitle">Okuma biçimini, görünümü ve cihazlar arası ilerleme kaydını buradan yönetebilirsin.</p>
    <div class="setting-grid">
      <section class="setting-card"><h2>Okuma tercihi</h2><p>Bionik vurgu ve kelime oynatıcısını sana göre ayarla.</p>
        <div class="setting-row"><div><label for="pref-mode">Okuma biçimi</label><small>Metnin tamamı veya kelime kelime</small></div><select id="pref-mode" class="select-small setting-control" data-pref="readingMode"><option value="page" ${p.readingMode === 'page' ? 'selected' : ''}>Metinde kelime takibi</option><option value="word" ${p.readingMode === 'word' ? 'selected' : ''}>Ortada kelime göster</option></select></div>
        <div class="setting-row"><div><label>Bionik kelime vurgusu</label><small>Uzun kelimelerin başlangıcını belirginleştir</small></div><button class="toggle ${p.bionic ? 'active' : ''}" data-setting-toggle="bionic">${p.bionic ? 'Açık' : 'Kapalı'}</button></div>
        <div class="setting-row"><div><label>Geçerli kelimeyi vurgula</label><small>Her iki görünümde aktif kelimenin arka planını boya</small></div><button class="toggle ${p.highlightWord ? 'active' : ''}" data-setting-toggle="highlightWord">${p.highlightWord ? 'Açık' : 'Kapalı'}</button></div>
        <div class="setting-row"><div><label for="bold-range">Kalın başlangıç miktarı</label><small>Kelimenin başlangıç bölümünün uzunluğu</small></div><span class="range-control"><input id="bold-range" type="range" min="15" max="60" step="5" value="${p.boldPercent}" data-setting-range="boldPercent"><span data-range-label="boldPercent">${p.boldPercent}%</span></span></div>
        <div class="setting-row"><div><label for="wpm-pref">Okuma hızı</label><small>Dakikadaki kelime sayısı</small></div><span class="speed-control"><input id="wpm-range" type="range" min="60" max="1000" step="10" value="${p.wpm}" data-setting-range="wpm" aria-label="Okuma hızı"><input id="wpm-pref" class="field-input" type="number" min="60" max="1000" step="10" value="${p.wpm}" data-setting-number="wpm"><span data-range-label="wpm">${p.wpm} k/dk</span></span></div>
        <div class="setting-row"><div><label>Kelime grubu</label><small>Her adımda gösterilen kelime sayısı</small></div><select class="select-small setting-control" data-setting-select="groupWords"><option value="1" ${p.groupWords === 1 ? 'selected' : ''}>1 kelime</option><option value="2" ${p.groupWords === 2 ? 'selected' : ''}>2 kelime</option><option value="3" ${p.groupWords === 3 ? 'selected' : ''}>3 kelime</option></select></div>
        <div class="setting-row"><div><label>Noktalama duraklaması</label><small>Cümle sonlarında eklenecek bekleme</small></div><input class="setting-control field-input" type="number" min="0" max="2000" step="50" value="${p.punctuationPause}" data-setting-number="punctuationPause"></div>
        <div class="setting-row"><div><label>Metni otomatik kaydır</label><small>Vurgu ekranın dışına geldiğinde metin onu takip eder</small></div><button class="toggle ${p.autoScroll ? 'active' : ''}" data-setting-toggle="autoScroll">${p.autoScroll ? 'Açık' : 'Kapalı'}</button></div>
        <div class="setting-row"><div><label>Hareketi azalt</label><small>Kaydırmada geçiş animasyonunu kaldırır</small></div><button class="toggle ${p.reduceMotion ? 'active' : ''}" data-setting-toggle="reduceMotion">${p.reduceMotion ? 'Açık' : 'Kapalı'}</button></div>
        <div class="setting-row"><div><label>Paragraf takibi</label><small>Okurken bulunduğun paragrafı vurgula</small></div><button class="toggle ${p.focusParagraph ? 'active' : ''}" data-setting-toggle="focusParagraph">${p.focusParagraph ? 'Açık' : 'Kapalı'}</button></div>
      </section>
      <section class="setting-card"><h2>Ekran görünümü</h2><p>Yazıların rahat okunması için metin görünümünü değiştir.</p>
        <div class="setting-row"><div><label for="font-size">Metin boyutu</label><small>Okuma panelindeki yazı</small></div><input id="font-size" class="setting-control field-input" type="number" min="13" max="30" step="1" value="${p.fontSize}" data-setting-number="fontSize"></div>
        <div class="setting-row"><div><label for="line-height">Satır aralığı</label><small>Okuma metninin aralığı</small></div><input id="line-height" class="setting-control field-input" type="number" min="1.3" max="2.8" step="0.1" value="${p.lineHeight}" data-setting-number="lineHeight"></div>
        <div class="setting-row"><div><label>Çalışırken odak görünümü</label><small>Ders ekranında ana menüyü gizleyip metne daha fazla yer açar</small></div><button class="toggle ${p.studyFocus ? 'active' : ''}" data-setting-toggle="studyFocus">${p.studyFocus ? 'Açık' : 'Kapalı'}</button></div>
        <div class="setting-row"><div><label>Renk teması</label><small>Açık veya koyu görünüm</small></div><select class="select-small setting-control" data-pref="theme"><option value="light" ${p.theme === 'light' ? 'selected' : ''}>Açık</option><option value="dark" ${p.theme === 'dark' ? 'selected' : ''}>Koyu</option></select></div>
        <div class="setting-row"><div><label>Verilerini dışa aktar</label><small>Çalışma kaydının JSON yedeğini indir</small></div><button class="btn ghost small" data-action="export">Yedek indir</button></div>
        <div class="setting-row"><div><label>Yedekten geri yükle</label><small>Önceden indirdiğin yedek dosyasını aç</small></div><label class="btn ghost small" for="import-file">Yedek seç</label><input id="import-file" type="file" accept="application/json" hidden></div>
      </section>
      <section class="setting-card"><h2>Supabase cihazlar arası kayıt</h2><p>İlerlemeni Supabase hesabına güvenli biçimde eşitler. Her cihazda aynı e-posta ve şifreyle giriş yap; bu cihazın yerel kaydı korunur ve hesapla birleştirilir.</p>
        ${supabaseConnected ? `<div class="sync-status-box" id="supabase-sync-status">${esc(syncLabel)} · ${esc(supabaseSession.user.email || '')}</div><div class="setting-actions"><button class="btn ghost small" data-action="supabase-sync">Şimdi eşitle</button><button class="btn ghost small" data-action="supabase-disconnect">Bu cihazdan çıkış yap</button></div>` : `<form id="supabase-auth-form" autocomplete="on"><div class="field"><label for="supabase-email">E-posta</label><input id="supabase-email" type="email" autocomplete="email" required></div><div class="field"><label for="supabase-password">Şifre</label><input id="supabase-password" type="password" autocomplete="current-password" minlength="8" required></div><div class="sync-status-box" id="supabase-sync-status">Aynı hesapla diğer cihazlardan da giriş yapabilirsin. Yeni hesap oluşturulursa e-posta doğrulaması istenebilir.</div><div class="setting-actions"><button type="submit" class="btn small" data-supabase-submit="login">Giriş yap ve eşitle</button><button type="submit" class="btn ghost small" data-supabase-submit="signup">Hesap oluştur</button></div></form>`}
      </section>
      <section class="setting-card"><h2>GitHub cihazlar arası eşitleme</h2><p>İlerlemeni özel GitHub depona kaydet. GitHub koduyla bu tarayıcıyı yetkilendir; kişisel erişim anahtarını kopyalayıp yapıştırman gerekmez.</p>
        <ol class="guide-list"><li>GitHub’da bir <strong>private</strong> ilerleme deposu oluştur.</li><li><a href="https://github.com/settings/apps/new" target="_blank" rel="noopener">GitHub App oluştur</a>; webhook’u kapat, yalnızca <strong>Contents: Read and write</strong> depo izni ver ve Device Flow’u etkinleştir.</li><li>App’i yalnızca ilerleme deposuna kur. Client ID’yi, depo sahibini ve depo adını gir; ardından GitHub’ın verdiği kodu onayla.</li></ol>
        <form id="github-device-form" autocomplete="off">
        <div class="field"><label for="github-client-id">GitHub App Client ID</label><input id="github-client-id" value="${esc(github.clientId || DEFAULT_GITHUB_CLIENT_ID)}" autocomplete="off" readonly></div>
        <div class="field"><label for="github-owner">Depo sahibi</label><input id="github-owner" value="${esc(github.owner)}" placeholder="kullanıcı-adın" autocomplete="username"></div>
        <div class="field"><label for="github-repo">Özel ilerleme deposu</label><input id="github-repo" value="${esc(github.repo)}" placeholder="ders-ilerlemem" autocomplete="off"></div>
        <p class="help-text">Client ID uygulamaya tanımlı. Yetkilendirme kodu GitHub’da onaylanır; uygulama erişimi, GitHub App’ini kurduğun depolarla sınırlıdır.</p>
        <div class="sync-status-box" id="settings-sync-status">${isConnected ? esc(syncLabel) : 'GitHub bağlantısı isteğe bağlıdır. Bağlamadan bu cihazda çalışmaya devam edebilirsin.'}</div>
        <div class="setting-actions"><button type="submit" class="btn small">${isConnected ? 'GitHub bağlantısını yenile' : 'GitHub ile yetkilendir'}</button>${isConnected ? '<button type="button" class="btn ghost small" data-action="disconnect-github">Bu cihazdan bağlantıyı kaldır</button>' : ''}</div>
        </form>
        <details class="legacy-token-option"><summary>Fine-grained token ile bağlan</summary><p class="help-text">Önceden oluşturduğun, yalnızca bu private depoda Contents: Read and write izni olan fine-grained tokenı kullanabilirsin.</p>
          <form id="github-form" autocomplete="off"><div class="field"><label for="github-token">Fine-grained token</label><input id="github-token" type="password" placeholder="github_pat_…" autocomplete="new-password"></div><button type="submit" class="btn ghost small" data-action="connect-github">Token ile bağlan</button></form>
        </details>
      </section>
      ${renderSyncConflicts()}
      <section class="setting-card"><h2>Kelime kelime oynatıcı</h2><p>Aktif ders ekranında boşluk çubuğuyla başlat/durdur; ok tuşlarıyla kelimeleri değiştir. Kısayollar metin ve ortada kelime gösteriminde çalışır; yazı yazarken devreye girmez.</p><div class="sync-status-box">Hız: ${p.wpm} kelime/dakika · Kelime grubu: ${p.groupWords} · Noktalama duraklaması: ${p.punctuationPause} ms<br>Oynatma konumun çalışma ilerlemenle birlikte saklanır.</div></section>
    </div>`;
}

function renderStats() {
  const done = courses.filter(course => getCourseStats(course).percent === 100).length;
  const blocks = courses.reduce((sum, course) => sum + getCourseStats(course).completedBlocks, 0);
  const answers = Object.values(state.lessons).reduce((sum, lesson) => sum + Object.values(lesson.tasks || {}).filter(task => task.answer?.trim()).length, 0);
  const revealed = Object.values(state.lessons).reduce((sum, lesson) => sum + Object.values(lesson.tasks || {}).filter(task => task.revealed).length, 0);
  const phaseSeconds = Object.values(state.lessons).flatMap(lesson => Object.values(lesson.flow || {})).reduce((totals, flow) => {
    totals.consume += Number(flow.seconds?.consume || 0);
    totals.digest += Number(flow.seconds?.digest || 0);
    return totals;
  }, { consume: 0, digest: 0 });
  const typeStats = { P: { total: 0, worked: 0 }, A: { total: 0, worked: 0 }, C: { total: 0, worked: 0 }, E: { total: 0, worked: 0 }, R: { total: 0, worked: 0 } };
  for (const course of courses) for (const block of course.blocks) for (const section of block.sections) {
    for (const task of section.tasks) {
      const saved = lessonProgress(course.id).tasks[`${block.number}:${task.id}`];
      if (section.type === 'ER') {
        const type = task.expectedKind;
        if (!['E', 'R'].includes(type)) continue;
        typeStats[type].total++;
        if (saved?.kindChoice === type) typeStats[type].worked++;
      } else if (typeStats[section.type]) {
        typeStats[section.type].total++;
        if (['worked', 'again'].includes(saved?.status)) typeStats[section.type].worked++;
      }
    }
  }
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(); day.setDate(day.getDate() - (6 - i)); const key = dayKey(day.getTime());
    const seconds = state.activeDays[key] === true ? 1 : Number(state.activeDays[key] || 0);
    return { label: new Intl.DateTimeFormat('tr-TR', { weekday: 'short' }).format(day).replace('.', ''), seconds, today: i === 6 };
  });
  const max = Math.max(1, ...week.map(day => day.seconds));
  const categories = categoryList().slice(1).map(category => {
    const items = courses.filter(course => course.category === category);
    const completed = items.reduce((n, course) => n + getCourseStats(course).completedBlocks, 0);
    const total = items.reduce((n, course) => n + course.blocks.length, 0);
    return { category, completed, total, percent: total ? Math.round(completed / total * 100) : 0 };
  });
  return `<div class="eyebrow">DÜZENLİ ÇALIŞMA İZLERİ</div><h1 class="page-title">İlerleme</h1><p class="page-subtitle">Bitirdiğin adımları, yazdığın cevapları ve kendi hatırlama değerlendirmeni ayrı ayrı gör.</p>
    <div class="stats-overview">${statCard('DERS TAMAMLANDI', `${done} / ${courses.length}`, 'Ders sonu değerlendirmesiyle')}${statCard('BLOK TAMAMLANDI', String(blocks), `${courses.reduce((s,c) => s+c.blocks.length,0)} blok içinde`)}${statCard('YAZILI CEVAP', String(answers), `${revealed} örnek cevap açıldı`)}</div>
    <section class="phase-time-summary"><div><span>Tüket · okuma</span><strong>${fmtTime(phaseSeconds.consume)}</strong></div><div><span>Sindir · işleme</span><strong>${fmtTime(phaseSeconds.digest)}</strong></div><p>Bu süreler, sayfa görünür ve yakın zamanda etkileşim varken sayılır; sınav başarısı ölçümü değildir.</p></section>
    <div class="home-grid"><section class="chart-card"><div class="chart-title">Son 7 gün · etkin çalışma izi</div><div class="bar-chart">${week.map((day, i) => `<div class="bar-column"><div class="bar ${day.today ? 'today' : ''}" style="height:${day.seconds ? Math.max(9, day.seconds / max * 73) : 3}px" title="${day.seconds ? fmtTime(day.seconds) : 'Kayıt yok'}"></div><span class="bar-label">${esc(day.label)}</span></div>`).join('')}</div><p class="help-text">Süre, sayfa görünürken ve yakın zamanda etkileşim olduğunda sayılır.</p></section><section class="chart-card"><div class="chart-title">Cevap çalışma yaklaşımı</div><div class="chart-number">${answers ? Math.round(100 * Math.max(0, answers - revealed) / answers) : 0}%</div><div class="chart-sub">Yazdığın cevapların içinde örnek cevabı açmadıkların</div><div class="sync-status-box">Bu oran doğruluk puanı değildir; sadece kendin yazıp sonra karşılaştırabildiğin yanıtları gösterir.</div></section></div>
    <div class="section-heading"><div><h2>Bilgi türlerine göre çalışma</h2><p>İşlediğin görev sayısı</p></div></div>${Object.entries(typeStats).map(([type, stat]) => `<div class="category-row"><span>${type} · ${{ P: 'İşlemsel', A: 'Analojik', C: 'Kavramsal', E: 'Kanıt', R: 'Referans' }[type]}</span><div class="progress-track"><div class="progress-fill" style="width:${stat.total ? Math.round(100 * stat.worked / stat.total) : 0}%"></div></div><small>${stat.worked}/${stat.total}</small></div>`).join('')}<div class="section-heading"><div><h2>Konu başlıklarına göre</h2><p>Tamamlanan bloklar</p></div></div>${categories.map(row => `<div class="category-row"><span>${esc(row.category)}</span><div class="progress-track"><div class="progress-fill" style="width:${row.percent}%"></div></div><small>${row.completed}/${row.total}</small></div>`).join('')}`;
}

function renderReviews() {
  const due = getDueCards();
  const selected = courses.find(course => course.id === activeReviewCourseId) || courses[0];
  activeReviewCourseId = selected?.id || '';
  const cardState = item => state.review[`${item.course.id}:${item.key}`] || {};
  const dueMarkup = due.length ? `<div class="review-list">${due.map(item => { const saved = cardState(item); return `<article class="review-course"><div class="eyebrow">${esc(item.course.title)} · ${esc(item.card.id)}</div><h2 class="review-question">${esc(item.card.front)}</h2><label class="review-answer-label">Önce hatırladığını yaz<textarea class="answer-text" data-card-answer data-course-id="${esc(item.course.id)}" data-review-key="${esc(item.key)}" placeholder="Cevabı kendin hatırlamaya çalış…">${esc(saved.answer || '')}</textarea></label><div class="answer-actions"><button class="answer-button reveal" data-card-action="show" data-course-id="${esc(item.course.id)}" data-review-key="${esc(item.key)}">${saved.revealed ? 'Cevabı gizle' : '? Cevabı göster'}</button><button class="answer-button" data-card-action="again" data-course-id="${esc(item.course.id)}" data-review-key="${esc(item.key)}">Unuttum · yarın</button><button class="answer-button" data-card-action="known" data-course-id="${esc(item.course.id)}" data-review-key="${esc(item.key)}">Hatırladım</button></div>${saved.revealed ? `<div class="model-answer">${esc(item.card.back)}</div>` : ''}<small class="review-interval">${saved.interval ? `Şu anki aralık: ${saved.interval} gün` : 'Bugün tekrar'}</small></article>`; }).join('')}</div>` : '<div class="empty-state">Bugün için kart yok. Belgelerdeki hazır referans kartlarından çalışmak istediklerini aşağıdan sıraya ekleyebilirsin.</div>';
  const cards = selected?.referenceCards || [];
  const cardLibrary = cards.length ? `<details class="card-library"><summary>${esc(selected.title)} · ${cards.length} hazır referans kartı</summary><div class="card-library-list">${cards.map(card => { const key = `K:${card.id}`, saved = state.review[`${selected.id}:${key}`]; return `<div class="card-library-item"><span><strong>${esc(card.id)}</strong> ${esc(card.front)}</span><button class="answer-button" data-card-action="queue" data-course-id="${esc(selected.id)}" data-review-key="${esc(key)}">${saved ? 'Tekrar listesinde' : 'Bugün çalış'}</button></div>`; }).join('')}</div></details>` : '<div class="empty-state">Bu ders için kaynakta hazır kart bulunmuyor.</div>';
  const proof = selected?.proofPractice?.tasks || [];
  const savedEvidence = (selected?.evidenceBank || []).filter(item => item.expectedKind === 'E');
  const proofMarkup = proof.length ? `<details class="proof-library"><summary>Gün sonu / hafta sonu kanıt provası · ${proof.length} görev</summary><p>${esc((selected.proofPractice.instructions || []).join(' '))}</p><div class="tasks-stack">${proof.map(task => renderTask(selected, { number: 'kanıt' }, task)).join('')}</div>${savedEvidence.length ? `<details class="evidence-library"><summary>${savedEvidence.length} saklanmış kanıtı aç</summary><ul>${savedEvidence.map(item => `<li><strong>${esc(item.id)}</strong> ${esc(item.text)} <small>${esc(item.sourceRefs.join(', '))}</small></li>`).join('')}</ul></details>` : ''}</details>` : '';
  return `<div class="eyebrow">GÜNLÜK REFERANS · HAFTALIK KANIT PROVASI</div><h1 class="page-title">Tekrarlar</h1><p class="page-subtitle">Kaynak belgelerdeki hazır kartları sıraya ekle. Hatırladığını yazıp cevabı açtıktan sonra tekrar aralığını seç.</p><div class="section-heading"><div><h2>${due.length ? `${due.length} kart hazır` : 'Bugün bekleyen kart yok'}</h2><p>${due.length ? 'Önce kendin hatırla; cevap görünce kopyalamak öğrenme puanı sayılmaz.' : 'Çalışmak istediğin referans kartlarını ders havuzundan seç.'}</p></div></div>${dueMarkup}<section class="study-card reference-pool"><div class="study-card-head"><span class="step-badge">R</span><div><h2>Hazır referans kartları</h2><p>Kaynak çalışma kâğıdındaki soru ve cevapları seçerek günlük sıraya ekle.</p></div><select class="select-small" data-card-course aria-label="Kart dersi">${courses.map(course => `<option value="${esc(course.id)}" ${course.id === selected?.id ? 'selected' : ''}>${esc(course.title)}</option>`).join('')}</select></div>${cardLibrary}</section>${proofMarkup}`;
}

function applyReadingSettings() {
  const prefs = state.preferences;
  document.documentElement.style.setProperty('--font-reading', `${prefs.fontSize / 16}rem`);
  document.documentElement.style.setProperty('--line-reading', String(prefs.lineHeight));
  document.documentElement.style.setProperty('--bold-share', `${prefs.boldPercent}%`);
  $('#sync-mini-label').textContent = syncLabel;
  $('#profile-label').textContent = supabaseSession?.user?.email || (github.token ? `${github.owner}/${github.repo}` : 'Bu cihazda kayıt açık');
  $$('.status-dot').forEach(dot => dot.classList.toggle('error', syncLabel.toLocaleLowerCase('tr').includes('hata')));
}

function updateSyncBadge() {
  const label = $('#sync-mini-label');
  if (label) label.textContent = syncLabel;
}

function setSyncLabel(label, kind = 'ok') {
  syncLabel = label;
  const dot = $('#sync-dot');
  if (dot) { dot.classList.toggle('busy', kind === 'busy'); dot.classList.toggle('error', kind === 'error'); }
  const mini = $('#sync-mini-label'); if (mini) mini.textContent = label;
  const panel = $('#settings-sync-status');
  if (panel) panel.textContent = label;
  const supabasePanel = $('#supabase-sync-status');
  if (supabasePanel) supabasePanel.textContent = label;
}

function showToast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 2500);
}

function saveAnswer(courseId, key, answer, reveal = undefined) {
  const p = taskProgress(courseId, key);
  p.answer = answer;
  if (reveal !== undefined) p.revealed = reveal;
  p.updatedAt = Date.now();
  const [blockNo] = key.split(':');
  const course = courses.find(item => item.id === courseId);
  const blockIndex = course?.blocks.findIndex(block => String(block.number) === blockNo) ?? -1;
  changeLesson(courseId, { activeBlock: blockIndex >= 0 ? blockIndex : lessonProgress(courseId).activeBlock }, 15_000);
}

function setTaskReveal(card, task, saved, courseId, key) {
  const button = card?.querySelector('[data-task-action="reveal"], [data-task-action="copy"]');
  const text = task?.answer || 'Bu görev için cevap anahtarında ayrı bir örnek yanıt yok.';
  let answer = card?.querySelector('[data-model-answer]');
  if (saved.revealed) {
    if (!answer) {
      answer = document.createElement('div');
      answer.className = `model-answer ${task?.answer ? '' : 'no-key'}`;
      answer.dataset.modelAnswer = task?.id || '';
      card.querySelector('.task-answer textarea')?.after(answer);
    }
    if (answer) answer.textContent = text;
  } else answer?.remove();
  if (button?.dataset.taskAction === 'reveal') button.textContent = saved.revealed ? 'Cevabı gizle' : '? Cevabı göster';
  const kindLabel = card?.querySelector('.knowledge-choice small');
  if (kindLabel) kindLabel.textContent = saved.kindChoice === task?.expectedKind ? 'Doğru sınıflandırdın.' : `Kaynakta ${task?.expectedKind} olarak işaretli.`;
}

function taskForKey(courseId, key) {
  return getAllTasks().find(item => item.course.id === courseId && item.key === key)?.task;
}

function nextTaskField(current) {
  if (view === 'study' && !studyTool) {
    if (activeBlock < currentCourse().blocks.length) moveDigestTask(1);
    else moveWrapStep(1);
    return;
  }
  const fields = $$('textarea[data-answer]:not([data-answer="review"])', $('#app'));
  const i = fields.indexOf(current);
  const next = fields[i + 1];
  if (next) { next.focus(); next.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  else showToast('Bu bölümde başka cevap alanı yok. Sonraki bloğa geçebilirsin.');
}

function changeBlock(delta) {
  const course = currentCourse();
  if (!course) return;
  const next = Math.max(0, Math.min(course.blocks.length, activeBlock + delta));
  if (next === activeBlock) return;
  stopPlayer();
  studyTool = '';
  activeBlock = next;
  changeLesson(course.id, { activeBlock }, 2_000);
  render();
  scrollTo({ top: 0, behavior: 'smooth' });
}

function markBlockDone() {
  const course = currentCourse();
  const block = course?.blocks[activeBlock];
  if (!block) return;
  if (!blockFlow(course.id, block.number).readComplete && !progressBlockDone(course.id, block.number)) { showToast('Önce okuma adımını tamamla.'); return; }
  studyTool = '';
  const pending = progressBlockDone(course.id, block.number) ? [] : getBlockTasks(block).filter(({ task }) => !taskIsDone(course.id, taskKey(block, task)));
  if (pending.length) { showToast(`${pending.length} görev bekliyor. Bunları sonraya bırakıp ilerleyebilirsin.`); return; }
  const p = lessonProgress(course.id);
  p.blocks[block.number] = { completed: true, updatedAt: Date.now() };
  changeLesson(course.id, { activeBlock: activeBlock + 1 }, 1_500);
  activeBlock = Math.min(activeBlock + 1, course.blocks.length);
  stopPlayer();
  render();
  scrollTo({ top: 0, behavior: 'smooth' });
}

function leaveBlock() {
  studyTool = '';
  const course = currentCourse();
  if (!course) return;
  activeBlock = Math.min(activeBlock + 1, course.blocks.length);
  changeLesson(course.id, { activeBlock }, 1_500);
  stopPlayer();
  render();
  scrollTo({ top: 0, behavior: 'smooth' });
}

function setStudyStep(block, index) {
  const course = currentCourse(), flow = blockFlow(course.id, block.number), steps = studySteps(block);
  const entry = steps[Math.max(0, Math.min(index, steps.length - 1))];
  flow.phase = entry.stage === 'consume' || entry.stage === 'summary' ? entry.stage : 'digest';
  if (entry.task) { flow.taskIndex = entry.taskIndex; flow.taskId = entry.task.id; }
  studyTool = ''; stopPlayer();
  changeLesson(course.id, { flow: lessonProgress(course.id).flow }, 1_500);
  render();
}

function moveDigestTask(delta) {
  const course = currentCourse(), block = course?.blocks[activeBlock];
  if (!block) return;
  const flow = blockFlow(course.id, block.number), index = currentStudyStep(block, flow), entry = studySteps(block)[index];
  if (delta < 0 && index === 0) { changeBlock(-1); return; }
  if (delta > 0) {
    if (entry.stage === 'consume') flow.readComplete = true;
    if (entry.task) {
      const saved = taskProgress(course.id, taskKey(block, entry.task));
      if (['todo', 'skipped'].includes(saved.status)) saved.status = saved.answer?.trim() ? 'worked' : 'skipped';
      saved.updatedAt = Date.now();
    }
  }
  setStudyStep(block, index + delta);
}

function moveWrapStep(delta) {
  const course = currentCourse(), progress = lessonProgress(course.id);
  const index = progress.wrapStep || 0;
  if (delta < 0 && index === 0) { changeBlock(-1); return; }
  studyTool = ''; stopPlayer();
  changeLesson(course.id, { wrapStep: Math.max(0, Math.min(index + delta, wrapUpSteps(course).length - 1)) }, 1_500);
  render();
}

function finishCourse() {
  const course = currentCourse();
  if (!course) return;
  const p = lessonProgress(course.id);
  if (!p.rating) { showToast('Önce nasıl hissettiğini seçebilirsin.'); return; }
  changeLesson(course.id, { completedAt: new Date().toISOString(), activeBlock: course.blocks.length }, 1_000);
  showToast('Oturum tamamlandı. İlerlemen kaydedildi.');
  render();
}

function updateReadingSetting(key, raw) {
  let value = raw;
  if (['boldPercent','wpm','groupWords','punctuationPause','fontSize','lineHeight'].includes(key)) value = Number(raw);
  const limits = { boldPercent: [15,60], wpm: [60,1000], groupWords: [1,3], punctuationPause: [0,2000], fontSize:[13,30], lineHeight:[1.3,2.8] };
  if (limits[key]) value = Math.max(limits[key][0], Math.min(limits[key][1], Number(value) || limits[key][0]));
  if (key === 'lineHeight') value = Math.round(value * 10) / 10;
  state.preferences[key] = value;
  state.preferences.updatedAt = Date.now();
  touchState(5_000);
  applyReadingSettings();
  $$(`[data-range-label="${key}"]`).forEach(node => { node.textContent = key === 'wpm' ? `${value} k/dk` : `${value}%`; });
  $$(`[data-setting-range="${key}"]`).forEach(node => { if (node.value !== String(value)) node.value = String(value); });
  $$(`[data-setting-number="${key}"]`).forEach(node => { if (node.value !== String(value)) node.value = String(value); });
  if (['readingMode','groupWords','fontSize','focusParagraph','theme','bionic','highlightWord','boldPercent','autoScroll','reduceMotion','studyFocus'].includes(key)) {
    const scroll = $('#reading-panel')?.scrollTop || 0;
    render();
    const panel = $('#reading-panel'); if (panel) panel.scrollTop = scroll;
  }
  if (playerRunning && ['wpm','groupWords','punctuationPause'].includes(key)) {
    clearTimeout(playerTimer); runPlayerStep();
  }
}

function applyReaderPosition(delta) {
  const paragraphs = $$('.reading-paragraph', $('#reading-panel'));
  if (!paragraphs.length) return;
  const currentParagraph = $(`[data-reader-word="${wordIndex}"]`)?.closest('.reading-paragraph');
  const current = paragraphs.indexOf(currentParagraph);
  const target = Math.max(0, Math.min(paragraphs.length - 1, current + delta));
  const first = $('[data-reader-word]', paragraphs[target]);
  if (first) seekWord(Number(first.dataset.readerWord));
  const panel = $('#reading-panel');
  const rect = paragraphs[target].getBoundingClientRect(), bounds = panel.getBoundingClientRect();
  panel.scrollTo({ top: panel.scrollTop + rect.top - bounds.top - 16, behavior: readerScrollBehavior() });
  const position = $('#reading-position'); if (position) position.textContent = `Paragraf ${target + 1} / ${paragraphs.length}`;
}

function saveWordPosition() {
  const course = currentCourse();
  if (!course) return;
  const p = lessonProgress(course.id);
  p.reader ||= {};
  p.reader[String(activeBlock)] = wordIndex;
  changeLesson(course.id, { reader: p.reader, activeBlock }, 15_000);
  refreshPlayerDisplay();
}

function refreshPlayerDisplay() {
  if (!$('#word-play')) return;
  const course = currentCourse(); const block = course?.blocks[activeBlock];
  if (!block) return;
  const words = splitWords(block);
  const count = Math.max(1, Number(state.preferences.groupWords) || 1);
  const word = words.slice(wordIndex, wordIndex + count).join(' ') || 'Blok tamamlandı';
  const wordNode = $('#player-word'); if (wordNode) wordNode.innerHTML = state.preferences.bionic ? bionic(word) : esc(word);
  const counter = $('#word-current'); if (counter) counter.textContent = String(words.length ? wordIndex + 1 : 0);
  const slider = $('[data-word-slider]'); if (slider) slider.value = String(wordIndex);
  const context = $('#word-player .player-context'); if (context) context.innerHTML = renderWordContext(words, Math.max(0, wordIndex - 8), wordIndex, count);
  const button = $('#word-play');
  if (button) { button.innerHTML = readerPlayLabel(); button.setAttribute('aria-label', playerRunning ? 'Durdur' : 'Oynat'); }
  $$('.reading-word.current').forEach(node => { node.classList.remove('current'); node.removeAttribute('aria-current'); });
  const active = $(`[data-reader-word="${wordIndex}"]`);
  if (state.preferences.highlightWord) for (let index = wordIndex; index < Math.min(words.length, wordIndex + count); index++) {
    const node = $(`[data-reader-word="${index}"]`);
    if (node) { node.classList.add('current'); node.setAttribute('aria-current', 'true'); }
  }
  const paragraph = active?.closest('[data-reading-paragraph]');
  $$('.reading-paragraph').forEach(node => node.classList.toggle('current', state.preferences.focusParagraph && node === paragraph));
  const position = $('#reading-position');
  if (position && paragraph) position.textContent = `Paragraf ${Number(paragraph.dataset.readingParagraph) + 1} / ${block.reading.length}`;
  const panel = $('#reading-panel');
  if (active && panel && playerRunning && state.preferences.autoScroll) {
    const rect = active.getBoundingClientRect(), bounds = panel.getBoundingClientRect();
    if (rect.top < bounds.top + 24 || rect.bottom > bounds.bottom - 40) {
      panel.scrollTo({ top: panel.scrollTop + rect.top - bounds.top - panel.clientHeight * .35, behavior: readerScrollBehavior() });
    }
  }
}

function readerScrollBehavior() {
  return state.preferences.reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
}

function wordDelay(word, count = 1) {
  const base = count * 60_000 / (state.preferences.wpm || 220);
  const end = word.slice(-1);
  const extra = /[.!?…]/u.test(end) ? state.preferences.punctuationPause : /[,;:]/u.test(end) ? state.preferences.punctuationPause * .45 : 0;
  return base + extra;
}

function advanceWord(delta) {
  seekWord(wordIndex + delta);
}

function seekWord(position) {
  const block = currentCourse()?.blocks[activeBlock];
  if (!block) return;
  wordIndex = Math.max(0, Math.min(Math.max(0, splitWords(block).length - 1), position));
  saveWordPosition();
  if (playerRunning) { clearTimeout(playerTimer); runPlayerStep(); }
}

function stopPlayer() {
  playerRunning = false;
  clearTimeout(playerTimer);
  playerTimer = 0;
  refreshPlayerDisplay();
}

function runPlayerStep() {
  const block = currentCourse()?.blocks[activeBlock];
  const words = block ? splitWords(block) : [];
  if (!playerRunning || !words.length) return;
  const group = Math.min(Math.max(1, Number(state.preferences.groupWords) || 1), words.length - wordIndex);
  playerTimer = setTimeout(() => {
    if (!playerRunning) return;
    if (wordIndex + group >= words.length) { stopPlayer(); saveWordPosition(); return; }
    wordIndex += group;
    saveWordPosition();
    runPlayerStep();
  }, wordDelay(words[wordIndex + group - 1] || '', group));
}

function togglePlayer() {
  if (playerRunning) stopPlayer();
  else {
    const words = currentCourse()?.blocks[activeBlock] ? splitWords(currentCourse().blocks[activeBlock]) : [];
    if (!words.length) return;
    if (wordIndex >= words.length - 1) { wordIndex = 0; saveWordPosition(); }
    playerRunning = true; runPlayerStep();
  }
  refreshPlayerDisplay();
}

function mergeNode(local, remote, key = '', localUpdatedAt = 0, remoteUpdatedAt = 0, path = []) {
  if (local == null) return remote;
  if (remote == null) return local;
  if (key === 'syncConflicts' && Array.isArray(local) && Array.isArray(remote)) {
    const merged = new Map();
    for (const item of [...local, ...remote]) {
      const id = JSON.stringify({ path: item.path, local: item.local, remote: item.remote });
      if (!merged.has(id) || item.resolved) merged.set(id, item);
    }
    return [...merged.values()];
  }
  const leftObject = local && typeof local === 'object' && !Array.isArray(local);
  const rightObject = remote && typeof remote === 'object' && !Array.isArray(remote);
  if (!leftObject || !rightObject) {
    const isEditableText = ['answer', 'mapNotes', 'analogyNotes'].includes(key);
    if (isEditableText && typeof local === 'string' && typeof remote === 'string' && local !== remote && Math.abs(localUpdatedAt - remoteUpdatedAt) <= 5_000) {
      const conflict = { path, local, remote, updatedAt: Date.now() };
      if (!mergeConflicts.some(item => JSON.stringify({ path: item.path, local: item.local, remote: item.remote }) === JSON.stringify({ path, local, remote }))) mergeConflicts.push(conflict);
    }
    return localUpdatedAt >= remoteUpdatedAt ? local : remote;
  }
  const leftTime = Number(local.updatedAt ?? localUpdatedAt);
  const rightTime = Number(remote.updatedAt ?? remoteUpdatedAt);
  if (key === 'preferences' && leftTime !== rightTime) return leftTime > rightTime ? local : remote;
  const merged = {};
  for (const childKey of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    merged[childKey] = mergeNode(local[childKey], remote[childKey], childKey, leftTime, rightTime, [...path, childKey]);
  }
  return merged;
}

function mergeWithConflicts(remote) {
  mergeConflicts = [];
  const merged = mergeNode(state, remote);
  if (mergeConflicts.length) {
    const known = new Set((merged.syncConflicts || []).map(item => JSON.stringify({ path: item.path, local: item.local, remote: item.remote })));
    merged.syncConflicts = [...(merged.syncConflicts || []), ...mergeConflicts.filter(item => {
      const key = JSON.stringify({ path: item.path, local: item.local, remote: item.remote });
      if (known.has(key)) return false;
      known.add(key); return true;
    })];
  }
  mergeConflicts = [];
  state = merged;
}

function resolveSyncConflict(index, choice) {
  const conflict = state.syncConflicts?.[index];
  if (!conflict) return;
  let target = state;
  for (const segment of conflict.path.slice(0, -1)) target = target?.[segment];
  if (target) target[conflict.path.at(-1)] = conflict[choice];
  conflict.resolved = true;
  touchState(1_000);
  render();
}

function githubPath() { return `https://api.github.com/repos/${encodeURIComponent(github.owner)}/${encodeURIComponent(github.repo)}/contents/study-progress.json`; }

async function githubRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${github.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    let detail = '';
    try { detail = (await response.json()).message || ''; } catch {}
    const message = response.status === 401 ? 'GitHub token geçersiz veya süresi dolmuş.' : response.status === 404 ? 'Depo bulunamadı ya da tokenın bu özel depoya erişemiyor.' : response.status === 403 ? 'GitHub isteği reddetti. Depo içeriği iznini veya API sınırını kontrol et.' : `GitHub yanıtı ${response.status}${detail ? `: ${detail}` : ''}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

function base64ToText(value) { const bytes = Uint8Array.from(atob(value.replace(/\s/g, '')), c => c.charCodeAt(0)); return new TextDecoder().decode(bytes); }
function textToBase64(text) { const bytes = new TextEncoder().encode(text); let binary = ''; for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(binary); }

async function readRemote() {
  try {
    const data = await githubRequest(githubPath());
    github.sha = data.sha;
    persistGithub();
    return JSON.parse(base64ToText(data.content));
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

async function writeRemote() {
  const body = {
    message: `Update study progress (${new Date().toISOString().slice(0, 10)})`,
    content: textToBase64(JSON.stringify(state)),
    ...(github.sha ? { sha: github.sha } : {}),
  };
  try {
    const result = await githubRequest(githubPath(), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    github.sha = result.content.sha;
    persistGithub();
  } catch (error) {
    if (!/409|422|update|sha|conflict/i.test(error.message)) throw error;
    const remote = await readRemote();
    if (remote) mergeWithConflicts(remote);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const retryBody = { message: `Merge study progress (${new Date().toISOString().slice(0, 10)})`, content: textToBase64(JSON.stringify(state)), ...(github.sha ? { sha: github.sha } : {}) };
    const result = await githubRequest(githubPath(), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(retryBody) });
    github.sha = result.content.sha;
    persistGithub();
  }
}

function supabaseErrorMessage(status, body) {
  const message = body?.msg || body?.message || body?.error_description || body?.error || '';
  if (status === 400 && /invalid login credentials/i.test(message)) return 'E-posta veya şifre hatalı.';
  if (status === 400 && /email not confirmed/i.test(message)) return 'Önce Supabase’den gelen e-posta doğrulama bağlantısına tıkla.';
  if (status === 429) return 'Supabase istek sınırına ulaşıldı; biraz sonra tekrar dene.';
  if (status === 401) return 'Supabase oturumu geçersiz veya süresi dolmuş. Yeniden giriş yap.';
  if (status === 404) return 'Supabase tablosu bulunamadı. supabase/setup.sql dosyasını SQL Editor’da çalıştır.';
  if (status === 400 && /relation .* does not exist|schema cache/i.test(message)) return 'Supabase tablosu hazır değil. supabase/setup.sql dosyasını SQL Editor’da çalıştır.';
  return message || `Supabase isteği başarısız oldu (${status}).`;
}

async function supabaseRequest(path, options = {}, accessToken = null) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken || SUPABASE_PUBLISHABLE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  let data = null;
  try { data = await response.json(); } catch {}
  if (!response.ok) throw new Error(supabaseErrorMessage(response.status, data));
  return data;
}

async function refreshSupabaseSession() {
  if (!supabaseSession?.refresh_token) throw new Error('Supabase oturumu sona erdi. Yeniden giriş yap.');
  const data = await supabaseRequest('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST', body: JSON.stringify({ refresh_token: supabaseSession.refresh_token }),
  });
  supabaseSession = { ...data, expires_at: Date.now() + Number(data.expires_in || 3600) * 1000 };
  persistSupabaseSession();
  return supabaseSession;
}

async function supabaseUserRequest(path, options = {}) {
  if (!supabaseSession?.access_token) throw new Error('Supabase hesabına giriş yap.');
  if (supabaseSession.expires_at && supabaseSession.expires_at < Date.now() + 30_000) await refreshSupabaseSession();
  try { return await supabaseRequest(path, options, supabaseSession.access_token); }
  catch (error) {
    if (/oturumu geçersiz/i.test(error.message) && supabaseSession?.refresh_token) {
      await refreshSupabaseSession();
      return supabaseRequest(path, options, supabaseSession.access_token);
    }
    throw error;
  }
}

async function readSupabaseRemote() {
  const userId = encodeURIComponent(supabaseSession.user.id);
  const rows = await supabaseUserRequest(`/rest/v1/${SUPABASE_PROGRESS_TABLE}?select=progress&user_id=eq.${userId}`);
  return rows?.[0]?.progress || null;
}

async function writeSupabaseRemote() {
  await supabaseUserRequest(`/rest/v1/${SUPABASE_PROGRESS_TABLE}?on_conflict=user_id`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: supabaseSession.user.id, progress: state, updated_at: new Date().toISOString() }),
  });
}

async function connectSupabaseSession(session) {
  const expiry = Number(session.expires_at || 0);
  supabaseSession = { ...session, expires_at: expiry > 10_000_000_000 ? expiry : expiry ? expiry * 1000 : Date.now() + Number(session.expires_in || 3600) * 1000 };
  persistSupabaseSession();
  setSyncLabel('Supabase ilerlemesi yükleniyor…', 'busy');
  render();
  const synced = await syncNow();
  if (synced) showToast('Supabase hesabına bağlandın. İlerlemen eşitlendi.');
}

async function submitSupabaseAuth(form, mode) {
  const email = $('#supabase-email')?.value.trim();
  const password = $('#supabase-password')?.value;
  const status = $('#supabase-sync-status');
  if (!email || !password) { if (status) status.textContent = 'E-posta ve şifreyi doldur.'; return; }
  if (password.length < 8) { if (status) status.textContent = 'Şifre en az 8 karakter olmalı.'; return; }
  const buttons = $$('button[type="submit"]', form); buttons.forEach(button => { button.disabled = true; });
  if (status) status.textContent = mode === 'signup' ? 'Hesap oluşturuluyor…' : 'Supabase hesabına giriş yapılıyor…';
  try {
    const data = mode === 'signup'
      ? await supabaseRequest(`/auth/v1/signup?redirect_to=${encodeURIComponent(`${location.origin}${location.pathname}`)}`, { method: 'POST', body: JSON.stringify({ email, password, data: { app: 'ders-maliye' } }) })
      : await supabaseRequest('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (data.access_token && data.user) await connectSupabaseSession(data);
    else if (status) status.textContent = 'Hesap oluşturuldu. Gelen doğrulama e-postasındaki bağlantıya tıkla, sonra burada giriş yap.';
  } catch (error) {
    if (status) status.textContent = `${error.message} · Bu cihazdaki yerel kayıt korunuyor.`;
    setSyncLabel(error.message, 'error');
  } finally { buttons.forEach(button => { button.disabled = false; }); }
}

function scheduleSync(delay = 12_000) {
  if (!activeSyncProvider()) return;
  clearTimeout(syncTimer);
  setSyncLabel(activeSyncProvider() === 'supabase' ? 'Supabase’e kaydedilecek' : 'GitHub’a kaydedilecek', 'busy');
  syncTimer = setTimeout(syncNow, delay);
}

let syncPromise = null;
async function syncNow() {
  const provider = activeSyncProvider();
  if (!provider) return;
  if (syncPromise) return syncPromise;
  const startedRevision = stateRevision;
  clearTimeout(syncTimer);
  syncPromise = (async () => {
    setSyncLabel(provider === 'supabase' ? 'Supabase ile eşitleniyor…' : 'GitHub ile eşitleniyor…', 'busy');
    try {
      const remote = provider === 'supabase' ? await readSupabaseRemote() : await readRemote();
      if (remote) mergeWithConflicts(remote);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      const remoteText = JSON.stringify(remote || {});
      if (!remote || JSON.stringify(state) !== remoteText) {
        if (provider === 'supabase') await writeSupabaseRemote();
        else await writeRemote();
      }
      setSyncLabel(`${provider === 'supabase' ? 'Supabase' : 'GitHub'} ile eşitlendi · ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`);
      if ($('#settings-sync-status') || !document.activeElement?.matches('textarea,input,select')) render();
      return true;
    } catch (error) {
      console.error(`${provider} eşitleme hatası:`, error);
      setSyncLabel(error.message || 'GitHub eşitleme hatası', 'error');
      const panel = provider === 'supabase' ? $('#supabase-sync-status') : $('#settings-sync-status');
      if (panel) panel.textContent = `${error.message} · Bu cihazdaki yerel kayıt çalışmaya devam ediyor.`;
      return false;
    } finally {
      syncPromise = null;
      if (activeSyncProvider() && stateRevision > startedRevision) scheduleSync(1_500);
    }
  })();
  return syncPromise;
}

function validGithubTarget(owner, repo) {
  return /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(owner) && /^[a-z\d._-]{1,100}$/i.test(repo);
}

function setGithubAuthStatus(message, isHtml = false) {
  const panel = $('#settings-sync-status');
  if (!panel) return;
  if (isHtml) panel.innerHTML = message;
  else panel.textContent = message;
}

async function connectGithubWithToken(owner, repo, token, clientId = github.clientId || '') {
  const old = github;
  github = { ...github, clientId, owner, repo, token, sha: '' };
  setSyncLabel('Depo erişimi kontrol ediliyor…', 'busy');
  setGithubAuthStatus('Özel depo erişimi kontrol ediliyor…');
  try {
    const info = await githubRequest(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
    if (!info.private) throw new Error('İlerleme bilgileri için bu deponun GitHub’da özel (private) olması gerekiyor.');
    const remote = await readRemote();
    if (remote) mergeWithConflicts(remote);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (!remote || JSON.stringify(state) !== JSON.stringify(remote)) await writeRemote();
    persistGithub();
    setSyncLabel(`GitHub ile eşitlendi · ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`);
    showToast('GitHub bağlantısı kuruldu. İlerlemen eşitlendi.');
    render();
    return true;
  } catch (error) {
    github = old;
    setSyncLabel(error.message || 'GitHub bağlantısı kurulamadı', 'error');
    setGithubAuthStatus(`${error.message} · Bu cihazdaki yerel kayıt çalışmaya devam ediyor.`);
    return false;
  }
}

async function connectGithub() {
  const owner = $('#github-owner')?.value.trim();
  const repo = $('#github-repo')?.value.trim();
  const token = $('#github-token')?.value.trim();
  if (!owner || !repo || !token) { showToast('Depo sahibini, depo adını ve fine-grained tokenı gir.'); return; }
  if (!validGithubTarget(owner, repo)) { showToast('GitHub depo sahibi veya depo adını kontrol et.'); return; }
  await connectGithubWithToken(owner, repo, token);
}

async function githubDeviceRequest(url, fields) {
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields),
    });
  } catch {
    throw new Error('GitHub yetkilendirme servisine erişilemedi. Sayfayı HTTPS üzerinden açıp tekrar dene.');
  }
  let data;
  try { data = await response.json(); }
  catch { throw new Error('GitHub beklenmeyen bir yanıt verdi. GitHub App’inde Device Flow’un açık olduğunu kontrol et.'); }
  if (!response.ok) throw new Error(data.error_description || data.message || `GitHub yanıtı ${response.status}.`);
  return data;
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function authorizeGithubDevice() {
  if (githubDeviceFlowActive) return;
  const clientId = $('#github-client-id')?.value.trim();
  const owner = $('#github-owner')?.value.trim() || DEFAULT_GITHUB_OWNER;
  const repo = $('#github-repo')?.value.trim() || DEFAULT_GITHUB_REPO;
  if ($('#github-owner')) $('#github-owner').value = owner;
  if ($('#github-repo')) $('#github-repo').value = repo;
  if (!clientId) { setGithubAuthStatus('GitHub App Client ID bulunamadı.'); return; }
  if (!validGithubTarget(owner, repo)) { setGithubAuthStatus('GitHub depo sahibi veya depo adını kontrol et.'); return; }
  githubDeviceFlowActive = true;
  github = { ...github, clientId, owner, repo };
  persistGithub();
  setGithubAuthStatus('GitHub onay kodu alınıyor…');
  setSyncLabel('GitHub yetkilendirmesi bekleniyor…', 'busy');
  try {
    const device = await githubDeviceRequest('https://github.com/login/device/code', { client_id: clientId });
    if (!device.device_code || !device.user_code || !device.verification_uri) throw new Error('GitHub App Client ID geçersiz veya Device Flow kapalı.');
    const safeUri = device.verification_uri.startsWith('https://github.com/') ? device.verification_uri : 'https://github.com/login/device';
    setGithubAuthStatus(`GitHub’da <a href="${esc(safeUri)}" target="_blank" rel="noopener">cihaz yetkilendirme sayfasını aç</a> ve şu kodu gir: <strong><code>${esc(device.user_code)}</code></strong>. Bu sayfayı kapatma; onay sonrası bağlantı tamamlanacak.`, true);
    let interval = Math.max(5, Number(device.interval) || 5) * 1000;
    const expiresAt = Date.now() + Math.max(60, Number(device.expires_in) || 900) * 1000;
    let accessToken = '';
    while (Date.now() < expiresAt) {
      await wait(interval);
      const result = await githubDeviceRequest('https://github.com/login/oauth/access_token', {
        client_id: clientId,
        device_code: device.device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      });
      if (result.access_token) { accessToken = result.access_token; break; }
      if (result.error === 'authorization_pending') continue;
      if (result.error === 'slow_down') { interval += 5000; continue; }
      if (result.error === 'expired_token') throw new Error('Onay kodunun süresi doldu. Yeniden GitHub ile yetkilendir.');
      if (result.error === 'access_denied') throw new Error('GitHub yetkilendirmesi iptal edildi.');
      if (result.error) throw new Error(result.error_description || `GitHub yetkilendirmesi başarısız: ${result.error}`);
    }
    if (!accessToken) throw new Error('Onay kodunun süresi doldu. Yeniden GitHub ile yetkilendir.');
    const connected = await connectGithubWithToken(owner, repo, accessToken, clientId);
    if (!connected) throw new Error('Yetkilendirme alındı, ancak seçilen özel depoya erişilemedi. App kurulumunu ve Contents yazma iznini kontrol et.');
  } catch (error) {
    setSyncLabel(error.message || 'GitHub yetkilendirmesi tamamlanamadı', 'error');
    setGithubAuthStatus(error.message || 'GitHub yetkilendirmesi tamamlanamadı.');
  } finally {
    githubDeviceFlowActive = false;
  }
}

function exportState() {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), progress: state }, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `maliye-calisma-yedegi-${dayKey()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('Çalışma yedeğin indirildi.');
}

async function importState(file) {
  try {
    const data = JSON.parse(await file.text());
    const imported = data.progress || data;
    if (imported.version !== 1 || !imported.lessons) throw new Error('Bu dosya geçerli bir çalışma yedeği değil.');
    mergeWithConflicts(imported);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    scheduleSync(1500);
    render();
    showToast('Yedek yüklendi.');
  } catch (error) { showToast(error.message); }
}

function updateReview(courseId, key, action) {
  const item = getAllTasks().find(x => x.course.id === courseId && x.key === key);
  if (!item) return;
  const reviewKey = `${courseId}:${key}`;
  const current = state.review[reviewKey] || { interval: 1 };
  const saved = taskProgress(courseId, key);
  if (action === 'show') { saved.reviewRevealed = !saved.reviewRevealed; saved.updatedAt = Date.now(); }
  if (action === 'again') { current.interval = 1; current.due = dayKey(Date.now() + DAY); }
  if (action === 'known') { current.interval = 3; current.due = dayKey(Date.now() + 3 * DAY); }
  current.updatedAt = Date.now();
  state.review[reviewKey] = current;
  touchState(1500);
  render();
}

function updateCardReview(courseId, key, action) {
  const reviewKey = `${courseId}:${key}`;
  const saved = state.review[reviewKey];
  if (!saved) return;
  if (action === 'again') { saved.streak = 0; saved.interval = 1; saved.due = dayKey(Date.now() + DAY); }
  if (action === 'known') {
    saved.streak = (saved.streak || 0) + 1;
    const schedule = [1, 1, 1, 3, 7, 14, 30];
    saved.interval = schedule[Math.min(saved.streak - 1, schedule.length - 1)];
    saved.due = dayKey(Date.now() + saved.interval * DAY);
  }
  saved.updatedAt = Date.now();
  touchState(1_500);
  render();
}

document.addEventListener('click', async event => {
  markActivity();
  const readingWord = event.target.closest('[data-reader-word]');
  if (readingWord) { seekWord(Number(readingWord.dataset.readerWord)); return; }
  const viewButton = event.target.closest('[data-view]');
  if (viewButton) { navTo(viewButton.dataset.view); return; }
  const courseButton = event.target.closest('[data-course]');
  if (courseButton) { const course = courses.find(c => c.id === courseButton.dataset.course); if (course) startCourse(course); return; }
  const category = event.target.closest('[data-category]');
  if (category) { activeCategory = category.dataset.category; render(); return; }
  const blockButton = event.target.closest('[data-block]');
  if (blockButton) { stopPlayer(); activeBlock = Number(blockButton.dataset.block); changeLesson(currentCourse().id, { activeBlock }, 1_500); render(); return; }
  const settingToggle = event.target.closest('[data-setting-toggle]');
  if (settingToggle) { const key = settingToggle.dataset.settingToggle; updateReadingSetting(key, !state.preferences[key]); return; }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'show-answer-map' || action === 'show-study-reading' || action === 'close-study-tool') {
    stopPlayer(); studyTool = action === 'show-answer-map' ? 'map' : action === 'show-study-reading' ? 'reading' : '';
    render(); return;
  }
  if (action === 'workspace-next' || action === 'workspace-prev') { moveDigestTask(action === 'workspace-next' ? 1 : -1); return; }
  if (action === 'workspace-stage' || action === 'workspace-task') {
    const block = currentCourse()?.blocks[activeBlock]; if (!block) return;
    const button = event.target.closest('[data-action]'), steps = studySteps(block);
    const index = steps.findIndex(item => action === 'workspace-task' ? item.taskIndex === Number(button.dataset.taskIndex) : item.stage === button.dataset.stage);
    if (index >= 0) setStudyStep(block, index);
    return;
  }
  if (action === 'wrap-next' || action === 'wrap-prev') { moveWrapStep(action === 'wrap-next' ? 1 : -1); return; }
  if (action === 'wrap-stage') {
    const course = currentCourse(), button = event.target.closest('[data-stage]');
    studyTool = ''; stopPlayer();
    changeLesson(course.id, { wrapStep: wrapUpSteps(course).findIndex(item => item.stage === button.dataset.stage) }, 1_500);
    render(); return;
  }
  if (action === 'map-route') {
    activeMapRouteId = event.target.closest('[data-map-route]').dataset.mapRoute;
    const card = $('#answer-map-card');
    if (card) { card.outerHTML = renderAnswerMap(currentCourse()); observeAnswerMap(); }
    return;
  }
  if (action === 'resolve-conflict') {
    const button = event.target.closest('[data-action="resolve-conflict"]');
    resolveSyncConflict(Number(button.dataset.conflictIndex), button.dataset.conflictChoice); return;
  }
  if (action === 'continue') { const course = continueTarget(); if (course) startCourse(course); return; }
  if (action === 'session-start') {
    const minutes = Math.max(1, Math.min(180, Number(state.preferences.sessionMinutes) || 20));
    state.session = { phase: 'work', startedAt: Date.now(), endsAt: Date.now() + minutes * 60_000, durationMinutes: minutes, breakMinutes: Number(state.preferences.breakMinutes) || 5 };
    touchState(1_000); render(); return;
  }
  if (action === 'session-stop') { state.session = null; touchState(1_000); render(); return; }
  if (action === 'supabase-sync') { await syncNow(); return; }
  if (action === 'supabase-disconnect') {
    supabaseSession = null; persistSupabaseSession(); setSyncLabel('Bu cihazda kayıt açık');
    showToast('Supabase hesabından bu cihazda çıkış yapıldı. Yerel ilerlemen korundu.'); render(); return;
  }
  if (action === 'map-add') {
    const form = event.target.closest('.map-editor');
    const from = form?.querySelector('[data-map-from]')?.value.trim();
    const relation = form?.querySelector('[data-map-relation]')?.value.trim();
    const to = form?.querySelector('[data-map-to]')?.value.trim();
    const source = form?.querySelector('[data-map-source]')?.value;
    if (!from || !relation || !to) { showToast('Bağlantı için kavram, ilişki ve hedef kavramı yaz.'); return; }
    const textarea = form.querySelector('[data-flow-field="mapNotes"]');
    const [sourceBlock, sourceParagraph] = source ? source.split(':') : [];
    const line = `${from} → ${relation} → ${to}${source ? ` | B${sourceBlock} ¶${sourceParagraph}` : ''}`;
    textarea.value = `${textarea.value.trim()}${textarea.value.trim() ? '\n' : ''}${line}`;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    form.querySelectorAll('[data-map-from], [data-map-relation], [data-map-to]').forEach(input => { input.value = ''; });
    form.querySelector('[data-map-source]').value = '';
    form.querySelector('[data-map-from]').focus(); return;
  }
  if (action === 'task-defer' || action === 'task-undefer') {
    const button = event.target.closest('[data-action]');
    const date = button.closest('.task-defer')?.querySelector('[data-defer-date]')?.value;
    const saved = taskProgress(button.dataset.courseId, button.dataset.taskKey);
    if (action === 'task-defer') {
      if (!date || date < dayKey()) { showToast('Bugün veya ileri bir tekrar tarihi seç.'); return; }
      saved.status = 'deferred'; saved.deferUntil = date;
    } else { saved.status = 'todo'; delete saved.deferUntil; }
    saved.updatedAt = Date.now(); touchState(1_500); render(); return;
  }
  if (action === 'resume-deferred') {
    const button = event.target.closest('[data-action="resume-deferred"]');
    const item = getDeferredTasks(true).find(task => task.course.id === button.dataset.courseId && task.key === button.dataset.taskKey);
    if (!item) return;
    const progress = lessonProgress(item.course.id); const block = item.course.blocks.find(value => String(value.number) === String(item.block.number));
    delete progress.blocks[item.block.number]; progress.completedAt = null;
    const saved = taskProgress(item.course.id, item.key); saved.status = 'todo'; delete saved.deferUntil; saved.updatedAt = Date.now();
    const flow = blockFlow(item.course.id, item.block.number); flow.phase = 'digest'; flow.taskId = item.task.id; flow.taskIndex = getBlockTasks(block).findIndex(entry => entry.task.id === item.task.id);
    touchState(1_000); startCourse(item.course, item.course.blocks.indexOf(block)); return;
  }
  if (action === 'next-block') { markBlockDone(); return; }
  if (action === 'leave-block') { leaveBlock(); return; }
  if (action === 'phase-consume' || action === 'phase-digest' || action === 'consume-done') {
    stopPlayer();
    const course = currentCourse(), block = course?.blocks[activeBlock];
    if (!course || !block) return;
    const flow = blockFlow(course.id, block.number);
    flow.phase = action === 'phase-consume' ? 'consume' : 'digest';
    if (action === 'consume-done') flow.readComplete = true;
    changeLesson(course.id, { flow: lessonProgress(course.id).flow }, 1_500);
    render(); scrollTo({ top: 0, behavior: 'smooth' }); return;
  }
  if (action === 'task-next' || action === 'task-prev') { moveDigestTask(action === 'task-next' ? 1 : -1); return; }
  if (action === 'task-status') {
    const saved = taskProgress(event.target.closest('[data-course-id]').dataset.courseId, event.target.closest('[data-task-key]').dataset.taskKey);
    saved.status = event.target.dataset.status; delete saved.deferUntil; saved.updatedAt = Date.now();
    touchState(1_500); render(); return;
  }
  if (action === 'prev-block') { changeBlock(-1); return; }
  if (action === 'word-play') { togglePlayer(); return; }
  if (action === 'word-prev') { advanceWord(-1); return; }
  if (action === 'word-next') { advanceWord(1); return; }
  if (action === 'reading-prev') { applyReaderPosition(-1); return; }
  if (action === 'reading-next') { applyReaderPosition(1); return; }
  if (action === 'finish-course') { finishCourse(); return; }
  if (action === 'search') { navTo('courses'); setTimeout(() => $('#course-search')?.focus(), 0); return; }
  if (action === 'connect-github') { event.preventDefault(); await connectGithub(); return; }
  if (action === 'disconnect-github') { localStorage.removeItem(SYNC_KEY); github = { owner: '', repo: '', token: '', sha: '' }; setSyncLabel('Bu cihazda kaydediliyor'); showToast('GitHub bağlantısı bu tarayıcıdan kaldırıldı.'); render(); return; }
  if (action === 'export') { exportState(); return; }
  const rating = event.target.closest('[data-rating]');
  if (rating) { changeLesson(currentCourse().id, { rating: rating.dataset.rating }, 1_500); render(); return; }
  const noteAction = event.target.closest('[data-note-answer-action]');
  if (noteAction) {
    const panel = noteAction.closest('[data-note-source]'), model = panel.querySelector('.note-model-answer');
    const reveal = panel.querySelector('[data-note-answer-action="reveal"]');
    const show = visible => {
      model.hidden = !visible;
      reveal.textContent = visible ? 'Cevabı gizle' : '? Cevabı göster';
      reveal.setAttribute('aria-expanded', String(visible));
    };
    if (noteAction.dataset.noteAnswerAction === 'reveal') show(model.hidden);
    else {
      const course = courses.find(item => item.id === panel.dataset.courseId);
      const block = course?.blocks.find(item => String(item.number) === panel.dataset.blockNumber);
      if (!block) return;
      const answers = noteSourceAnswers(course, block, panel.dataset.noteSource);
      try {
        await navigator.clipboard.writeText(answers.map(task => task.answer).join('\n\n'));
        show(true); noteAction.textContent = 'Kopyalandı ✓';
        showToast('Notun örnek cevabı panoya kopyalandı.');
      } catch { show(true); showToast('Cevabı seçerek kopyalayabilirsin.'); }
    }
    return;
  }
  const taskAction = event.target.closest('[data-task-action]');
  if (taskAction) {
    const courseId = taskAction.dataset.courseId, key = taskAction.dataset.taskKey;
    const p = taskProgress(courseId, key);
    const card = taskAction.closest('.task-card'); const task = taskForKey(courseId, key);
    if (taskAction.dataset.taskAction === 'reveal') { p.revealed = !p.revealed; p.updatedAt = Date.now(); touchState(5000); setTaskReveal(card, task, p, courseId, key); }
    if (taskAction.dataset.taskAction === 'copy') {
      const text = task?.answer || 'Bu görev için ayrıca örnek cevap yok.';
      try { await navigator.clipboard.writeText(text); p.copied = true; p.revealed = true; p.updatedAt = Date.now(); touchState(5000); setTaskReveal(card, task, p, courseId, key); taskAction.textContent = 'Kopyalandı ✓'; taskAction.classList.add('copied'); showToast('Örnek cevap panoya kopyalandı.'); }
      catch { showToast('Pano izni alınamadı. Cevabı açıp metni seçerek kopyalayabilirsin.'); }
    }
    return;
  }
  const cardAction = event.target.closest('[data-card-action]');
  if (cardAction) {
    const { courseId, reviewKey } = cardAction.dataset;
    const reviewId = `${courseId}:${reviewKey}`;
    if (cardAction.dataset.cardAction === 'queue') {
      if (!state.review[reviewId]) state.review[reviewId] = { interval: 1, streak: 0, due: dayKey(), revealed: false, updatedAt: Date.now() };
      touchState(1_500); render(); return;
    }
    if (cardAction.dataset.cardAction === 'show') {
      const saved = state.review[reviewId]; if (!saved) return;
      saved.revealed = !saved.revealed; saved.updatedAt = Date.now(); touchState(1_500);
      const item = getDueCards().find(card => card.course.id === courseId && card.key === reviewKey);
      let model = cardAction.closest('.review-course')?.querySelector('.model-answer');
      if (saved.revealed) {
        if (!model) { model = document.createElement('div'); model.className = 'model-answer'; cardAction.closest('.review-course')?.append(model); }
        if (model) model.textContent = item?.card.back || '';
        cardAction.textContent = 'Cevabı gizle';
      } else { model?.remove(); cardAction.textContent = '? Cevabı göster'; }
      return;
    }
    updateCardReview(courseId, reviewKey, cardAction.dataset.cardAction); return;
  }
  const kindChoice = event.target.closest('[data-kind-choice]');
  if (kindChoice) {
    const { courseId, taskKey } = kindChoice.dataset; const saved = taskProgress(courseId, taskKey);
    saved.kindChoice = kindChoice.dataset.kindChoice; saved.updatedAt = Date.now(); touchState(1_500);
    const task = taskForKey(courseId, taskKey);
    const reviewKey = `${courseId}:R:${taskKey}`;
    if (saved.kindChoice === 'R' && task?.expectedKind === 'R' && !state.review[reviewKey]) {
      state.review[reviewKey] = { interval: 1, streak: 0, due: dayKey(), revealed: false, updatedAt: Date.now() };
      touchState(1_500);
    } else if (saved.kindChoice !== 'R') delete state.review[reviewKey];
    kindChoice.parentElement.querySelectorAll('[data-kind-choice]').forEach(button => button.classList.toggle('selected', button === kindChoice));
    return;
  }
  const reviewAction = event.target.closest('[data-review-action]');
  if (reviewAction) { updateReview(reviewAction.dataset.courseId, reviewAction.dataset.taskKey, reviewAction.dataset.reviewAction); return; }
});

document.addEventListener('input', event => {
  markActivity();
  const input = event.target;
  if (input.matches('#course-search')) {
    searchQuery = input.value;
    const cursor = input.selectionStart;
    render();
    const next = $('#course-search'); if (next) { next.focus(); next.setSelectionRange(cursor, cursor); }
    return;
  }
  if (input.matches('[data-reflection]')) {
    const progress = lessonProgress(input.dataset.courseId);
    progress.reflections ||= {};
    progress.reflections[input.dataset.reflection] = input.value;
    changeLesson(input.dataset.courseId, { reflections: progress.reflections }, 12_000);
    return;
  }
  if (input.matches('[data-answer]')) {
    const id = input.dataset.courseId, key = input.dataset.taskKey;
    const p = taskProgress(id, key);
    if (input.dataset.answer === 'review') p.reviewAnswer = input.value;
    else p.answer = input.value;
    p.updatedAt = Date.now();
    changeLesson(id, {}, 15_000);
    const status = input.closest('.task-answer')?.querySelector('.save-status'); if (status) status.textContent = 'Kaydedildi ✓';
    return;
  }
  if (input.matches('[data-flow-field]')) {
    const courseId = input.dataset.courseId, blockNumber = input.dataset.blockNumber, progress = lessonProgress(courseId);
    if (input.dataset.flowField === 'mapNotes') progress.mapNotes = input.value;
    else blockFlow(courseId, blockNumber)[input.dataset.flowField] = input.value;
    changeLesson(courseId, { flow: progress.flow, mapNotes: progress.mapNotes }, 10_000);
    if (input.dataset.flowField === 'mapNotes') {
      const preview = input.closest('.map-editor')?.querySelector('[data-map-preview]');
      if (preview) preview.innerHTML = renderMapPreview(input.value);
    }
    return;
  }
  if (input.matches('[data-card-answer]')) {
    const key = `${input.dataset.courseId}:${input.dataset.reviewKey}`;
    const saved = state.review[key]; if (!saved) return;
    saved.answer = input.value; saved.updatedAt = Date.now(); touchState(10_000);
    return;
  }
  if (input.matches('[data-setting-range]')) { updateReadingSetting(input.dataset.settingRange, input.value); return; }
  if (input.matches('[data-setting-number]')) { updateReadingSetting(input.dataset.settingNumber, input.value); return; }
  if (input.matches('[data-word-slider]')) { seekWord(Number(input.value)); }
});

document.addEventListener('change', event => {
  const input = event.target;
  if (input.matches('#reading-mode')) { stopPlayer(); updateReadingSetting('readingMode', input.value); return; }
  if (input.matches('[data-pref]')) { updateReadingSetting(input.dataset.pref, input.value); return; }
  if (input.matches('[data-setting-select]')) { updateReadingSetting(input.dataset.settingSelect, input.value); return; }
  if (input.matches('[data-session-setting]')) {
    const key = input.dataset.sessionSetting;
    if (key === 'sessionMinutes' && input.value === 'custom') { const custom = $('[data-session-custom]'); custom.hidden = false; custom.focus(); return; }
    state.preferences[key] = Number(input.value); state.preferences.updatedAt = Date.now(); touchState(1_500);
    if (key === 'sessionMinutes') { const custom = $('[data-session-custom]'); if (custom) custom.hidden = true; }
    return;
  }
  if (input.matches('[data-session-custom]')) {
    const value = Math.max(1, Math.min(180, Number(input.value) || 20)); input.value = value;
    state.preferences.sessionMinutes = value; state.preferences.updatedAt = Date.now(); touchState(1_500); return;
  }
  if (input.matches('[data-card-course]')) { activeReviewCourseId = input.value; render(); return; }
  if (input.matches('#import-file') && input.files[0]) { importState(input.files[0]); input.value = ''; }
});

document.addEventListener('submit', event => {
  if (event.target.matches('#github-device-form')) { event.preventDefault(); authorizeGithubDevice(); return; }
  if (event.target.matches('#github-form')) { event.preventDefault(); connectGithub(); }
  if (event.target.matches('#supabase-auth-form')) {
    event.preventDefault(); submitSupabaseAuth(event.target, event.submitter?.dataset.supabaseSubmit || 'login');
  }
});

document.addEventListener('keydown', event => {
  markActivity();
  if (view === 'study' && $('#word-play') && !document.activeElement?.closest('textarea, input, select, button, a, summary, [role="button"], [contenteditable]')) {
    if (event.code === 'Space') { event.preventDefault(); togglePlayer(); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); advanceWord(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); advanceWord(1); }
  }
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && event.target.matches('textarea[data-answer]:not([data-answer="review"])')) {
    event.preventDefault();
    event.target.dispatchEvent(new Event('input', { bubbles: true }));
    nextTaskField(event.target);
  }
  if (event.target.matches('[data-course][role="button"]') && ['Enter',' '].includes(event.key)) {
    event.preventDefault(); event.target.click();
  }
});

document.addEventListener('focusout', event => {
  if (event.target.matches('textarea[data-answer]:not([data-answer="review"])')) {
    const id = event.target.dataset.courseId, key = event.target.dataset.taskKey;
    const text = event.target.value;
    saveAnswer(id, key, text, undefined);
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopPlayer();
    touchState(15_000);
    if (activeSyncProvider()) syncNow();
  }
});
addEventListener('pagehide', () => { touchState(15_000); if (activeSyncProvider()) syncNow(); });

document.addEventListener('pointerdown', markActivity, { passive: true });
document.addEventListener('keydown', markActivity, { passive: true });
setInterval(() => {
  if (document.hidden || Date.now() - lastTouch > 90_000) return;
  activeSecondsRemainder += 10;
  state.activitySeconds += 10;
  state.activeDays[dayKey()] = Number(state.activeDays[dayKey()] || 0) + 10;
  if (view === 'study' && currentCourse() && activeBlock < currentCourse().blocks.length) {
    const block = currentCourse().blocks[activeBlock]; const flow = blockFlow(currentCourse().id, block.number);
    flow.seconds ||= { consume: 0, digest: 0 };
    flow.seconds[flow.phase] = (flow.seconds[flow.phase] || 0) + 10;
  }
  if (activeSecondsRemainder >= 60) { activeSecondsRemainder = 0; touchState(15_000); }
}, 10_000);

setInterval(() => {
  const session = state.session;
  if (session && Date.now() >= session.endsAt) {
    if (session.phase === 'work') {
      session.phase = 'break'; session.endsAt = Date.now() + session.breakMinutes * 60_000;
      showToast(`Çalışma süresi tamamlandı. ${session.breakMinutes} dakikalık mola başladı.`);
    } else {
      state.session = null; showToast('Mola bitti. Hazır olduğunda yeni oturum başlatabilirsin.');
    }
    touchState(1_000);
    if (view === 'home') render();
  }
  if (view === 'home' && state.session) {
    const status = $('[data-session-status]');
    if (status) status.textContent = `${state.session.phase === 'break' ? 'Mola' : 'Çalışma'} · ${countdown(state.session.endsAt)}`;
  }
}, 1_000);

async function init() {
  try {
    const contentURL = new URL('./data/courses.json', import.meta.url);
    contentURL.search = new URL(import.meta.url).search;
    const response = await fetch(contentURL);
    if (!response.ok) throw new Error(`Dersler yüklenemedi (${response.status}).`);
    courses = await response.json();
    if (!Array.isArray(courses) || !courses.length) throw new Error('Ders listesi boş. İçerik oluşturucusunu çalıştır.');
    await consumeSupabaseCallback();
    render();
    if (activeSyncProvider()) syncNow();
  } catch (error) {
    $('#app').innerHTML = `<section class="study-card"><h1 class="page-title">Ders içeriği açılamadı</h1><p class="page-subtitle">${esc(error.message)} Bu klasörü yerel web sunucusuyla açabilir veya GitHub Pages yayınının tamamlanmasını bekleyebilirsin.</p></section>`;
  }
}

async function consumeSupabaseCallback() {
  if (!location.hash.includes('access_token=')) return;
  const params = new URLSearchParams(location.hash.slice(1));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return;
  try {
    const user = await supabaseRequest('/auth/v1/user', {}, accessToken);
    const session = { access_token: accessToken, refresh_token: refreshToken, expires_in: Number(params.get('expires_in') || 3600), user };
    history.replaceState(null, '', `${location.pathname}${location.search}`);
    await connectSupabaseSession(session);
  } catch (error) {
    history.replaceState(null, '', `${location.pathname}${location.search}`);
    showToast(error.message);
  }
}

init();
