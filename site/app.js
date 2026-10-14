const $ = (q, root = document) => root.querySelector(q);
const $$ = (q, root = document) => [...root.querySelectorAll(q)];
const STORAGE_KEY = 'ders-maliye-progress-v1';
const SYNC_KEY = 'ders-maliye-github-v1';
const DEFAULT_GITHUB_CLIENT_ID = 'Iv23liJeFWuLkdXEkG4K';
const DEFAULT_GITHUB_OWNER = 'soltackle';
const DEFAULT_GITHUB_REPO = 'ders-ilerlemem';
const DAY = 86_400_000;
const ICONS = ['◌', '↗', '▦', '◇', '◒', '▤', '◍', '⌁'];
const DEFAULTS = {
  readingMode: 'page', bionic: true, highlightWord: true, boldPercent: 38, wpm: 220, groupWords: 1,
  punctuationPause: 320, fontSize: 19, lineHeight: 1.85, focusParagraph: false, theme: 'light',
};

let courses = [];
let state = loadState();
let github = loadGithub();
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

function freshState() {
  return { version: 1, updatedAt: 0, lastCourseId: '', preferences: { ...DEFAULTS, updatedAt: 0 }, lessons: {}, review: {}, activeDays: {}, activitySeconds: 0, syncConflicts: [] };
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
  return progress.flow[String(blockNumber)];
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
  if (github.token && github.owner && github.repo) scheduleSync(delay);
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
  if (view === 'home') app.innerHTML = renderHome();
  else if (view === 'courses') app.innerHTML = renderCourses();
  else if (view === 'study') app.innerHTML = renderStudy();
  else if (view === 'settings') app.innerHTML = renderSettings();
  else if (view === 'stats') app.innerHTML = renderStats();
  else if (view === 'reviews') app.innerHTML = renderReviews();
  $('#breadcrumb').textContent = view === 'study' ? `Dersler  /  ${currentCourse()?.title || 'Çalışma'}` : view === 'home' ? 'Kişisel çalışma alanın' : ({ courses: 'Derslerin', reviews: 'Günlük tekrarların', stats: 'Çalışma istatistikleri', settings: 'Kişisel ayarların' })[view];
  applyReadingSettings();
  if (view === 'study' && activeBlock < (currentCourse()?.blocks.length || 0) && state.preferences.readingMode === 'word') refreshPlayerDisplay();
}

function renderHome() {
  const unfinished = courses.filter(c => !lessonProgress(c.id).completedAt).length;
  const completed = courses.length - unfinished;
  const blocksDone = courses.reduce((n, c) => n + getCourseStats(c).completedBlocks, 0);
  const due = getDueCards().length;
  const target = continueTarget();
  const targetStats = getCourseStats(target);
  const startBlock = Math.min(Number.isInteger(targetStats.activeBlock) ? targetStats.activeBlock : targetStats.completedBlocks, target.blocks.length);
  const block = target.blocks[startBlock];
  const flow = block ? blockFlow(target.id, block.number) : { phase: 'consume' };
  const duration = target.durationMinutes ? Math.round(target.durationMinutes) : 0;
  const seenMinutes = fmtTime(state.activitySeconds);
  const dayCount = Object.keys(state.activeDays).length;
  const groups = categoryList();
  return `<section class="home-focus"><div class="home-focus-main"><div class="eyebrow">KALDIĞIN YER</div><h1>${esc(target.title)}</h1><p class="home-next-block">${block ? `Blok ${startBlock + 1} · ${esc(block.title)}` : 'Oturum sonu'}</p><div class="home-next-phase">${block ? (flow.phase === 'digest' ? 'Şimdi sindir' : 'Şimdi tüket') : 'Kısa öz değerlendirme'} · ${duration} dk oturum</div><div class="progress-track"><div class="progress-fill" style="width:${targetStats.percent}%"></div></div><small>${targetStats.completedBlocks} / ${target.blocks.length} blok tamamlandı</small><button class="btn" data-action="continue">Çalışmaya devam et →</button></div><aside class="home-focus-side"><div class="eyebrow">BUGÜN</div><strong>${due} tekrar kartı</strong><p>${seenMinutes} çalışma süresi · ${dayCount} etkin gün</p><button class="btn secondary small" data-view="reviews">Tekrarlara git</button><div class="home-lesson-count">${blocksDone} blok · ${completed} ders tamamlandı</div></aside></section><div class="section-heading"><div><h2>Derslerin</h2><p>${courses.length} çalışma kâğıdı · ${groups.length} konu başlığı</p></div><button class="text-button" data-view="courses">Tüm dersleri gör →</button></div><div class="course-grid">${courses.slice(0, 6).map(courseCard).join('')}</div>`;
}

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

function renderStudy() {
  const course = currentCourse();
  if (!course) return renderCourses();
  const progress = lessonProgress(course.id);
  const percent = getCourseStats(course).percent;
  if (activeBlock >= course.blocks.length) return renderWrapUp(course, progress);
  const block = course.blocks[activeBlock];
  const prefs = state.preferences;
  const flow = blockFlow(course.id, block.number);
  const tasks = getBlockTasks(block);
  const current = tasks[Math.min(flow.taskIndex || 0, Math.max(0, tasks.length - 1))];
  const statuses = tasks.map(({ task }) => progress.blocks[block.number]?.completed ? 'worked' : taskProgress(course.id, taskKey(block, task)).status);
  const worked = statuses.filter(status => ['worked', 'again'].includes(status)).length;
  const remaining = statuses.filter(status => !['worked', 'again'].includes(status)).length;
  const navigation = `<div class="lesson-actions"><button class="btn ghost small" data-action="prev-block" ${activeBlock === 0 ? 'disabled' : ''}>← Önceki blok</button><small>${percent}% · ${progress.completedBlocks || 0} blok tamam</small><button class="btn ghost small" data-action="leave-block">${activeBlock === course.blocks.length - 1 ? 'Oturum sonuna geç' : 'Sonraki bloğa geç'}</button></div>`;
  const phaseTabs = `<div class="phase-tabs" role="tablist" aria-label="Çalışma aşaması"><button class="phase-tab ${flow.phase === 'consume' ? 'active' : ''}" data-action="phase-consume">1 · Tüket</button><button class="phase-tab ${flow.phase === 'digest' ? 'active' : ''}" data-action="phase-digest">2 · Sindir</button></div>`;
  let workspace = '';
  if (flow.phase === 'consume') {
    workspace = `<section class="study-card phase-card"><div class="phase-title"><span class="step-badge">1</span><div><div class="eyebrow">TÜKET · ${block.readMinutes ? `~${block.readMinutes} DK` : 'OKU'}</div><h2>${esc(block.title)}</h2><p>${esc(block.readInstruction || 'Metni kendi hızında oku. Kavram haritanı veya analoji notunu istediğin anda ekleyebilirsin.')}</p></div></div>${course.studyGuide?.length ? `<details class="pacer-guide"><summary>P.A.C.E.R. çalışma rehberi</summary><ol>${course.studyGuide.filter(line => /^\d+[.)]/.test(line)).map(line => `<li>${esc(line.replace(/^\d+[.)]\s*/, ''))}</li>`).join('')}</ol></details>` : ''}
      <div class="reading-tools"><label class="tool-select">Gösterim <select id="reading-mode" class="select-small" aria-label="Okuma biçimi"><option value="page" ${prefs.readingMode === 'page' ? 'selected' : ''}>Metni oku</option><option value="word" ${prefs.readingMode === 'word' ? 'selected' : ''}>Kelime kelime</option></select></label><button class="toggle ${prefs.bionic ? 'active' : ''}" data-setting-toggle="bionic">Bionik ${prefs.bionic ? 'Açık' : 'Kapalı'}</button><button class="toggle ${prefs.highlightWord ? 'active' : ''}" data-setting-toggle="highlightWord">Kelime arka planı ${prefs.highlightWord ? 'Açık' : 'Kapalı'}</button><button class="text-button" data-view="settings">Okuma ayarları →</button></div>
      ${prefs.readingMode === 'word' ? renderWordPlayer(course, block, activeBlock) : renderReadingPanel(block)}
        <details class="quick-workbench"><summary>Okurken çalış · P / A / C</summary><label><span>C · Kavram haritası ${course.mapSetup?.starter ? `· başlangıç: ${esc(course.mapSetup.starter)}` : ''}</span><textarea data-flow-field="mapNotes" data-course-id="${esc(course.id)}" data-block-number="${block.number}" placeholder="Kavram → ilişki fiili → kavram">${esc(progress.mapNotes || '')}</textarea></label><label><span>A · Analoji notu</span><textarea data-flow-field="analogyNotes" data-course-id="${esc(course.id)}" data-block-number="${block.number}" placeholder="Neye benziyor? Nerede ayrılıyor?">${esc(flow.analogyNotes || '')}</textarea></label></details>
      ${course.knowledgeProfile?.length ? `<details class="knowledge-profile"><summary>Bu derste hangi tür bilgi var?</summary><div class="knowledge-profile-list">${course.knowledgeProfile.map(item => `<article><strong>${esc(item.type)} · ${esc(item.label)}</strong><span>${esc(item.weight)}</span><p>${esc(item.description)}</p></article>`).join('')}</div></details>` : ''}
      <div class="phase-footer"><span>Bu notlar ve okuma konumun otomatik kaydolur.</span><button class="btn" data-action="consume-done">Okudum, sindirmeye geç →</button></div></section>`;
  } else {
    const taskPanel = current ? renderSection(course, block, { ...current.section, tasks: [current.task] }, `${current.section.label || current.section.type} · ${current.task.id}`) : '<p>Bu blokta ayrıca sindirme görevi yok.</p>';
    const saved = current ? taskProgress(course.id, taskKey(block, current.task)) : null;
    const taskStatus = progress.blocks[block.number]?.completed ? 'worked' : saved?.status;
    const taskStep = current ? `<div class="task-step"><span>Görev ${flow.taskIndex + 1} / ${tasks.length} · ${worked} işlendi</span><span>${taskStatus === 'again' ? 'Tekrar gerekli' : taskStatus === 'worked' ? 'İşlendi' : 'Henüz işlenmedi'}</span></div>${taskPanel}<div class="self-check"><span>Nasıl gitti?</span><button class="answer-button ${taskStatus === 'worked' ? 'selected' : ''}" data-action="task-status" data-status="worked" data-task-key="${esc(taskKey(block, current.task))}" data-course-id="${esc(course.id)}">Hatırladım / işledim</button><button class="answer-button ${taskStatus === 'again' ? 'selected' : ''}" data-action="task-status" data-status="again" data-task-key="${esc(taskKey(block, current.task))}" data-course-id="${esc(course.id)}">Tekrar gerekli</button></div><div class="task-pagination"><button class="btn ghost small" data-action="task-prev" ${flow.taskIndex === 0 ? 'disabled' : ''}>← Önceki</button><button class="btn small" data-action="task-next">${flow.taskIndex === tasks.length - 1 ? 'Özeti gör' : 'Sonraki görev →'}</button></div>` : '<div class="empty-state">Bu blokta sindirme sorusu yok. Okuma adımını tamamladıktan sonra bloğu bitirebilirsin.</div>';
    const canComplete = remaining === 0;
    workspace = `<section class="study-card phase-card"><div class="phase-title"><span class="step-badge">2</span><div><div class="eyebrow">SİNDİR · ${block.digestMinutes ? `~${block.digestMinutes} DK` : 'İŞLE'}</div><h2>${esc(block.title)}</h2><p>Kendi cevabını yaz. Örneği açıp karşılaştırabilir, sonra hatırlama durumunu işaretleyebilirsin.</p></div></div><div class="digest-note"><strong>P · A · C · E · R</strong><span>Görev türü, kullanacağın işlemi belirtir. P/A/C/E/R sırası zorunlu bir liste değildir.</span></div>${taskStep}<div class="phase-footer"><span>${remaining ? `${remaining} görev işlenmedi; bloğu sonraya bırakabilirsin.` : 'Bloktaki görevler işlendi.'}</span><button class="btn ${canComplete ? '' : 'ghost'}" data-action="${canComplete ? 'next-block' : 'leave-block'}">${canComplete ? (activeBlock === course.blocks.length - 1 ? 'Bloğu bitir ve oturum sonuna geç →' : 'Bloğu tamamla →') : 'Sonraki bloğa geç →'}</button></div></section>`;
  }
  return `<div class="study-heading"><div><div class="eyebrow">${esc(course.category.toLocaleUpperCase('tr'))} · BLOK ${activeBlock + 1} / ${course.blocks.length}</div><h1>${esc(course.title)}</h1><p>${esc(block.title)}</p></div><button class="btn ghost small" data-view="courses">Ders listesi</button></div>${phaseTabs}${workspace}${navigation}`;
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
  const direction = block.readInstruction ? `<div class="read-direction"><span>BU BLOKTA OKU</span><p>${esc(block.readInstruction)}</p></div>` : '';
  if (!block.reading.length) return `${direction}<div class="reading-panel"><p class="reader-empty">Bu blok için ayrıca kaynak paragrafı ayrılmamış. Görevlerini aşağıdan açıp çalışabilirsin.</p></div>`;
  const prefs = state.preferences;
  const body = block.reading.map((para, i) => `<p class="reading-paragraph ${prefs.focusParagraph && i === 0 ? 'current' : ''}" data-reading-paragraph="${i}">${prefs.bionic ? bionic(para.text) : esc(para.text)}</p>`).join('');
  return `${direction}<div class="reading-panel ${prefs.focusParagraph ? 'focus-mode' : ''}" id="reading-panel">${body}</div><div class="paragraph-focus"><button class="answer-button" data-action="reading-prev">↑ Önceki paragraf</button><button class="answer-button" data-action="reading-next">Sonraki paragraf ↓</button><span class="reading-mode-line" id="reading-position">${block.reading.length} kaynak paragrafı</span></div>`;
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
  const speed = state.preferences.wpm;
  return `${block.readInstruction ? `<div class="read-direction"><span>BU BLOKTA OKU</span><p>${esc(block.readInstruction)}</p></div>` : ''}<div class="word-player" id="word-player" data-word-count="${words.length}"><p class="player-context">${context}</p><div class="player-word" id="player-word">${prefs.bionic ? bionic(current) : esc(current)}</div><div class="player-word-counter"><span id="word-current">${words.length ? wordIndex + 1 : 0}</span> / ${words.length} kelime</div><div class="player-controls"><button data-action="word-prev" aria-label="Önceki kelime">←</button><button class="play-button" data-action="word-play" id="word-play" aria-label="${playerRunning ? 'Durdur' : 'Oynat'}">${playerRunning ? 'Ⅱ' : '▶'}</button><button data-action="word-next" aria-label="Sonraki kelime">→</button></div><input class="player-slider" type="range" min="0" max="${Math.max(words.length - 1, 0)}" value="${wordIndex}" data-word-slider aria-label="Metinde ilerle"><div class="player-options"><label>Hız <input type="number" min="60" max="1000" step="10" value="${speed}" data-setting-number="wpm" aria-label="Dakikadaki kelime hızı"> kelime / dk</label><label>Gösterim <select class="select-small" data-setting-select="groupWords"><option value="1" ${state.preferences.groupWords === 1 ? 'selected' : ''}>1 kelime</option><option value="2" ${state.preferences.groupWords === 2 ? 'selected' : ''}>2 kelime</option><option value="3" ${state.preferences.groupWords === 3 ? 'selected' : ''}>3 kelime</option></select></label><label>Duraklama <input type="number" min="0" max="2000" step="50" value="${state.preferences.punctuationPause}" data-setting-number="punctuationPause" aria-label="Noktalama duraklama süresi"> ms</label></div></div>`;
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

function renderWrapUp(course, progress) {
  const done = !!progress.completedAt;
  const rating = progress.rating || '';
  const wrapGroups = course.wrapUp.length ? `<section class="study-card"><div class="study-card-head"><span class="step-badge">✦</span><div><h2>Kanıtları kullanarak prova et</h2><p>İddianı örnek, tarih veya sayıyla destekle. Cevap anahtarını açıp sonra yanıtını karşılaştır.</p></div></div><div class="tasks-stack">${course.wrapUp.map(task => renderTask(course, { number: 'son' }, task)).join('')}</div></section>` : '';
  return `<div class="lesson-head"><div><div class="eyebrow">${esc(course.category.toLocaleUpperCase('tr'))} · OTURUM SONU</div><h1>${esc(course.title)}</h1><p class="page-subtitle">Bu oturumda ${progress.completedBlocks || 0} / ${course.blocks.length} blok işaretledin. Cevapların kaydedildi; şimdi ne kadar rahat hatırladığını işaretle.</p></div><button class="btn ghost small" data-view="courses">Ders listesi</button></div>
    ${wrapGroups}<section class="study-card"><div class="final-card"><div class="eyebrow">KISA ÖZ DEĞERLENDİRME</div><h2>${done ? 'Bu dersi tekrar açabilirsin.' : 'Nasıl hissettin?'}</h2><p>Bu seçim tamamlanma sayacından ayrı tutulur ve tekrar önerilerine yardımcı olur.</p><div class="rating-row">${[['confident','Rahat hatırlıyorum'],['review','Tekrar gerekli'],['difficult','Zorlandım']].map(([key,label]) => `<button class="rating-option ${rating === key ? 'active' : ''}" data-rating="${key}">${label}</button>`).join('')}</div><div class="finish-summary">${progress.completedBlocks || 0} blok tamamlandı · ${Object.values(progress.tasks).filter(task => task.answer?.trim()).length} cevap yazıldı · ${Object.values(progress.tasks).filter(task => task.revealed).length} örnek cevap görüldü</div><div class="lesson-actions"><button class="btn ghost small" data-action="prev-block">← Son bloğa dön</button><button class="btn" data-action="finish-course">${done ? 'Değerlendirmeyi güncelle' : 'Oturumu tamamla'}</button></div></div></section>`;
}

function renderSyncConflicts() {
  const conflicts = (state.syncConflicts || []).map((item, index) => ({ ...item, index })).filter(item => !item.resolved);
  if (!conflicts.length) return '';
  return `<section class="setting-card sync-conflict-card"><h2>Eşitlemede farklı cevaplar var</h2><p>İki cihazda aynı alan kısa aralıkla değişmiş. Saklanacak metni seç.</p>${conflicts.map(conflict => `<article class="sync-conflict"><strong>${esc(conflict.path.at(-1) || 'Çalışma notu')}</strong><details><summary>Bu cihazdaki metin</summary><p>${esc(conflict.local)}</p><button class="answer-button" data-action="resolve-conflict" data-conflict-index="${conflict.index}" data-conflict-choice="local">Bunu sakla</button></details><details><summary>Diğer cihazdaki metin</summary><p>${esc(conflict.remote)}</p><button class="answer-button" data-action="resolve-conflict" data-conflict-index="${conflict.index}" data-conflict-choice="remote">Bunu sakla</button></details></article>`).join('')}</section>`;
}

function renderSettings() {
  const p = state.preferences;
  const isConnected = Boolean(github.owner && github.repo && github.token);
  return `<div class="eyebrow">KİŞİSEL ÇALIŞMA ALANIN</div><h1 class="page-title">Ayarlar</h1><p class="page-subtitle">Okuma biçimini, görünümü ve ilerlemenin eşitleneceği GitHub alanını buradan yönetebilirsin.</p>
    <div class="setting-grid">
      <section class="setting-card"><h2>Okuma tercihi</h2><p>Bionik vurgu ve kelime oynatıcısını sana göre ayarla.</p>
        <div class="setting-row"><div><label for="pref-mode">Okuma biçimi</label><small>Metnin tamamı veya kelime kelime</small></div><select id="pref-mode" class="select-small setting-control" data-pref="readingMode"><option value="page" ${p.readingMode === 'page' ? 'selected' : ''}>Metin görünümü</option><option value="word" ${p.readingMode === 'word' ? 'selected' : ''}>Kelime kelime</option></select></div>
        <div class="setting-row"><div><label>Bionik kelime vurgusu</label><small>Uzun kelimelerin başlangıcını belirginleştir</small></div><button class="toggle ${p.bionic ? 'active' : ''}" data-setting-toggle="bionic">${p.bionic ? 'Açık' : 'Kapalı'}</button></div>
        <div class="setting-row"><div><label>Geçerli kelimeyi vurgula</label><small>Kelime kelime oynatıcıda sıradaki kelimenin arka planını boya</small></div><button class="toggle ${p.highlightWord ? 'active' : ''}" data-setting-toggle="highlightWord">${p.highlightWord ? 'Açık' : 'Kapalı'}</button></div>
        <div class="setting-row"><div><label for="bold-range">Kalın başlangıç miktarı</label><small>Kelimenin başlangıç bölümünün uzunluğu</small></div><span class="range-control"><input id="bold-range" type="range" min="15" max="60" step="5" value="${p.boldPercent}" data-setting-range="boldPercent"><span data-range-label="boldPercent">${p.boldPercent}%</span></span></div>
        <div class="setting-row"><div><label for="wpm-pref">Kayma hızı</label><small>Dakikadaki kelime sayısı</small></div><span class="speed-control"><input id="wpm-range" type="range" min="60" max="1000" step="10" value="${p.wpm}" data-setting-range="wpm" aria-label="Kayma hızı"><input id="wpm-pref" class="field-input" type="number" min="60" max="1000" step="10" value="${p.wpm}" data-setting-number="wpm"><span data-range-label="wpm">${p.wpm} k/dk</span></span></div>
        <div class="setting-row"><div><label>Kelime grubu</label><small>Her adımda gösterilen kelime sayısı</small></div><select class="select-small setting-control" data-setting-select="groupWords"><option value="1" ${p.groupWords === 1 ? 'selected' : ''}>1 kelime</option><option value="2" ${p.groupWords === 2 ? 'selected' : ''}>2 kelime</option><option value="3" ${p.groupWords === 3 ? 'selected' : ''}>3 kelime</option></select></div>
        <div class="setting-row"><div><label>Noktalama duraklaması</label><small>Cümle sonlarında eklenecek bekleme</small></div><input class="setting-control field-input" type="number" min="0" max="2000" step="50" value="${p.punctuationPause}" data-setting-number="punctuationPause"></div>
        <div class="setting-row"><div><label>Paragraf takibi</label><small>Okurken bulunduğun paragrafı vurgula</small></div><button class="toggle ${p.focusParagraph ? 'active' : ''}" data-setting-toggle="focusParagraph">${p.focusParagraph ? 'Açık' : 'Kapalı'}</button></div>
      </section>
      <section class="setting-card"><h2>Ekran görünümü</h2><p>Yazıların rahat okunması için metin görünümünü değiştir.</p>
        <div class="setting-row"><div><label for="font-size">Metin boyutu</label><small>Okuma panelindeki yazı</small></div><input id="font-size" class="setting-control field-input" type="number" min="13" max="30" step="1" value="${p.fontSize}" data-setting-number="fontSize"></div>
        <div class="setting-row"><div><label for="line-height">Satır aralığı</label><small>Okuma metninin aralığı</small></div><input id="line-height" class="setting-control field-input" type="number" min="1.3" max="2.8" step="0.1" value="${p.lineHeight}" data-setting-number="lineHeight"></div>
        <div class="setting-row"><div><label>Renk teması</label><small>Açık veya koyu görünüm</small></div><select class="select-small setting-control" data-pref="theme"><option value="light" ${p.theme === 'light' ? 'selected' : ''}>Açık</option><option value="dark" ${p.theme === 'dark' ? 'selected' : ''}>Koyu</option></select></div>
        <div class="setting-row"><div><label>Verilerini dışa aktar</label><small>Çalışma kaydının JSON yedeğini indir</small></div><button class="btn ghost small" data-action="export">Yedek indir</button></div>
        <div class="setting-row"><div><label>Yedekten geri yükle</label><small>Önceden indirdiğin yedek dosyasını aç</small></div><label class="btn ghost small" for="import-file">Yedek seç</label><input id="import-file" type="file" accept="application/json" hidden></div>
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
      <section class="setting-card"><h2>Kelime kelime oynatıcı</h2><p>Aktif ders ekranında boşluk çubuğuyla başlat/durdur; ok tuşlarıyla kelimeleri değiştir. Yalnızca oynatıcı açıksa klavye kısayolları çalışır.</p><div class="sync-status-box">Hız: ${p.wpm} kelime/dakika · Kelime grubu: ${p.groupWords} · Noktalama duraklaması: ${p.punctuationPause} ms<br>Oynatma konumun çalışma ilerlemenle birlikte saklanır.</div></section>
    </div>`;
}

function renderStats() {
  const done = courses.filter(course => getCourseStats(course).percent === 100).length;
  const blocks = courses.reduce((sum, course) => sum + getCourseStats(course).completedBlocks, 0);
  const answers = Object.values(state.lessons).reduce((sum, lesson) => sum + Object.values(lesson.tasks || {}).filter(task => task.answer?.trim()).length, 0);
  const revealed = Object.values(state.lessons).reduce((sum, lesson) => sum + Object.values(lesson.tasks || {}).filter(task => task.revealed).length, 0);
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
  $('#profile-label').textContent = github.token ? `${github.owner}/${github.repo}` : 'Çevrimdışı kayıt açık';
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
  const nextBlock = Number(blockNo);
  changeLesson(courseId, { activeBlock: Number.isFinite(nextBlock) ? nextBlock - 1 : lessonProgress(courseId).activeBlock }, 15_000);
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
  activeBlock = next;
  changeLesson(course.id, { activeBlock }, 2_000);
  render();
  scrollTo({ top: 0, behavior: 'smooth' });
}

function markBlockDone() {
  const course = currentCourse();
  const block = course?.blocks[activeBlock];
  if (!block) return;
  const pending = progressBlockDone(course.id, block.number) ? [] : getBlockTasks(block).filter(({ task }) => !['worked', 'again'].includes(taskProgress(course.id, taskKey(block, task)).status));
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
  const course = currentCourse();
  if (!course) return;
  activeBlock = Math.min(activeBlock + 1, course.blocks.length);
  changeLesson(course.id, { activeBlock }, 1_500);
  stopPlayer();
  render();
  scrollTo({ top: 0, behavior: 'smooth' });
}

function moveDigestTask(delta) {
  const course = currentCourse(); const block = course?.blocks[activeBlock];
  if (!block) return;
  const flow = blockFlow(course.id, block.number); const tasks = getBlockTasks(block);
  const task = tasks[flow.taskIndex];
  if (delta > 0 && task) {
    const saved = taskProgress(course.id, taskKey(block, task));
    if (saved.status === 'todo') saved.status = saved.answer?.trim() ? 'worked' : 'skipped';
    saved.updatedAt = Date.now();
  }
  const pendingIndices = tasks.map(({ task }, i) => ['worked', 'again'].includes(taskProgress(course.id, taskKey(block, task)).status) ? -1 : i).filter(i => i >= 0);
  if (delta > 0 && flow.taskIndex >= tasks.length - 1 && pendingIndices.length === 0) {
    changeLesson(course.id, {}, 1_500);
    markBlockDone();
    return;
  }
  if (delta > 0 && flow.taskIndex >= tasks.length - 1 && pendingIndices.length) flow.taskIndex = pendingIndices[0];
  else flow.taskIndex = Math.max(0, Math.min(Math.max(0, tasks.length - 1), flow.taskIndex + delta));
  flow.phase = 'digest';
  changeLesson(course.id, { flow: lessonProgress(course.id).flow }, 1_500);
  render();
  scrollTo({ top: 0, behavior: 'smooth' });
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
  if (view === 'study' && key === 'boldPercent' && state.preferences.readingMode === 'page') {
    const course = currentCourse(); if (course) { const block = course.blocks[activeBlock]; if (block) { const panel = $('#reading-panel'); if (panel) panel.innerHTML = renderReadingPanel(block).match(/<div class="reading-panel[\s\S]*?<\/div>/)?.[0] || panel.innerHTML; } }
  }
  if (['readingMode','groupWords','fontSize','focusParagraph','theme','bionic','highlightWord'].includes(key)) render();
}

function applyReaderPosition(delta) {
  const paragraphs = $$('.reading-paragraph', $('#reading-panel'));
  if (!paragraphs.length) return;
  const current = paragraphs.findIndex(el => el.classList.contains('current'));
  const target = Math.max(0, Math.min(paragraphs.length - 1, current + delta));
  paragraphs.forEach((el, i) => el.classList.toggle('current', i === target));
  paragraphs[target].scrollIntoView({ behavior: 'smooth', block: 'center' });
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
  const player = $('#word-player');
  if (!player) return;
  const course = currentCourse(); const block = course?.blocks[activeBlock];
  if (!block) return;
  const words = splitWords(block);
  const count = Math.max(1, Number(state.preferences.groupWords) || 1);
  const word = words.slice(wordIndex, wordIndex + count).join(' ') || 'Blok tamamlandı';
  const wordNode = $('#player-word'); if (wordNode) wordNode.innerHTML = state.preferences.bionic ? bionic(word) : esc(word);
  const counter = $('#word-current'); if (counter) counter.textContent = String(words.length ? wordIndex + 1 : 0);
  const slider = $('[data-word-slider]'); if (slider) slider.value = String(wordIndex);
  const context = $('#word-player .player-context'); if (context) context.innerHTML = renderWordContext(words, Math.max(0, wordIndex - 8), wordIndex, count);
  const button = $('#word-play'); if (button) { button.textContent = playerRunning ? 'Ⅱ' : '▶'; button.setAttribute('aria-label', playerRunning ? 'Durdur' : 'Oynat'); }
}

function wordDelay(word) {
  const base = 60_000 / (state.preferences.wpm || 220);
  const end = word.slice(-1);
  const extra = /[.!?…]/u.test(end) ? state.preferences.punctuationPause : /[,;:]/u.test(end) ? state.preferences.punctuationPause * .45 : 0;
  return base + extra;
}

function advanceWord(delta) {
  const block = currentCourse()?.blocks[activeBlock];
  if (!block) return;
  wordIndex = Math.max(0, Math.min(splitWords(block).length - 1, wordIndex + delta));
  saveWordPosition();
}

function stopPlayer() {
  playerRunning = false;
  clearTimeout(playerTimer);
  playerTimer = 0;
}

function runPlayerStep() {
  const block = currentCourse()?.blocks[activeBlock];
  const words = block ? splitWords(block) : [];
  if (!playerRunning || !words.length) return;
  if (wordIndex >= words.length - 1) { stopPlayer(); refreshPlayerDisplay(); saveWordPosition(); return; }
  playerTimer = setTimeout(() => {
    if (!playerRunning) return;
    const group = Math.max(1, Number(state.preferences.groupWords) || 1);
    const last = words.slice(wordIndex, wordIndex + group).at(-1) || '';
    wordIndex = Math.min(words.length - 1, wordIndex + group);
    saveWordPosition();
    runPlayerStep();
  }, wordDelay(words[Math.min(wordIndex + Math.max(1, Number(state.preferences.groupWords)) - 1, words.length - 1)] || ''));
}

function togglePlayer() {
  if (playerRunning) stopPlayer();
  else { playerRunning = true; runPlayerStep(); }
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

function scheduleSync(delay = 12_000) {
  if (!github.token || !github.repo || !github.owner) return;
  clearTimeout(syncTimer);
  setSyncLabel('GitHub’a kaydedilecek', 'busy');
  syncTimer = setTimeout(syncNow, delay);
}

let syncPromise = null;
async function syncNow() {
  if (!github.token || !github.repo || !github.owner) return;
  if (syncPromise) return syncPromise;
  const startedRevision = stateRevision;
  clearTimeout(syncTimer);
  syncPromise = (async () => {
    setSyncLabel('GitHub ile eşitleniyor…', 'busy');
    try {
      const remote = await readRemote();
      if (remote) mergeWithConflicts(remote);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      const remoteText = JSON.stringify(remote || {});
      if (!remote || JSON.stringify(state) !== remoteText) await writeRemote();
      setSyncLabel(`GitHub ile eşitlendi · ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`);
      if ($('#settings-sync-status') || !document.activeElement?.matches('textarea,input,select')) render();
    } catch (error) {
      console.error('GitHub eşitleme hatası:', error);
      setSyncLabel(error.message || 'GitHub eşitleme hatası', 'error');
      if ($('#settings-sync-status')) $('#settings-sync-status').textContent = `${error.message} · Bu cihazdaki yerel kayıt çalışmaya devam ediyor.`;
    } finally {
      syncPromise = null;
      if (github.token && stateRevision > startedRevision) scheduleSync(1_500);
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
  const viewButton = event.target.closest('[data-view]');
  if (viewButton) { navTo(viewButton.dataset.view); return; }
  const courseButton = event.target.closest('[data-course]');
  if (courseButton) { const course = courses.find(c => c.id === courseButton.dataset.course); if (course) startCourse(course); return; }
  const category = event.target.closest('[data-category]');
  if (category) { activeCategory = category.dataset.category; render(); return; }
  const blockButton = event.target.closest('[data-block]');
  if (blockButton) { stopPlayer(); activeBlock = Number(blockButton.dataset.block); changeLesson(currentCourse().id, { activeBlock }, 1_500); render(); return; }
  const settingToggle = event.target.closest('[data-setting-toggle]');
  if (settingToggle) { const key = settingToggle.dataset.settingToggle; updateReadingSetting(key, !state.preferences[key]); render(); return; }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'resolve-conflict') {
    const button = event.target.closest('[data-action="resolve-conflict"]');
    resolveSyncConflict(Number(button.dataset.conflictIndex), button.dataset.conflictChoice); return;
  }
  if (action === 'continue') { const course = continueTarget(); if (course) startCourse(course); return; }
  if (action === 'next-block') { markBlockDone(); return; }
  if (action === 'leave-block') { leaveBlock(); return; }
  if (action === 'phase-consume' || action === 'phase-digest' || action === 'consume-done') {
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
    saved.status = event.target.dataset.status; saved.updatedAt = Date.now();
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
  if (input.matches('[data-word-slider]')) { wordIndex = Number(input.value); saveWordPosition(); }
});

document.addEventListener('change', event => {
  const input = event.target;
  if (input.matches('#reading-mode')) { stopPlayer(); updateReadingSetting('readingMode', input.value); return; }
  if (input.matches('[data-pref]')) { updateReadingSetting(input.dataset.pref, input.value); return; }
  if (input.matches('[data-setting-select]')) { updateReadingSetting(input.dataset.settingSelect, input.value); return; }
  if (input.matches('[data-card-course]')) { activeReviewCourseId = input.value; render(); return; }
  if (input.matches('#import-file') && input.files[0]) { importState(input.files[0]); input.value = ''; }
});

document.addEventListener('submit', event => {
  if (event.target.matches('#github-device-form')) { event.preventDefault(); authorizeGithubDevice(); return; }
  if (event.target.matches('#github-form')) { event.preventDefault(); connectGithub(); }
});

document.addEventListener('keydown', event => {
  markActivity();
  if (view === 'study' && state.preferences.readingMode === 'word' && $('#word-player') && !['TEXTAREA','INPUT','SELECT'].includes(document.activeElement?.tagName)) {
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
    touchState(15_000);
    if (github.token) syncNow();
  }
});
addEventListener('pagehide', () => { touchState(15_000); if (github.token) syncNow(); });

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

async function init() {
  try {
    const response = await fetch(new URL('./data/courses.json', document.baseURI));
    if (!response.ok) throw new Error(`Dersler yüklenemedi (${response.status}).`);
    courses = await response.json();
    if (!Array.isArray(courses) || !courses.length) throw new Error('Ders listesi boş. İçerik oluşturucusunu çalıştır.');
    render();
    if (github.token && github.owner && github.repo) syncNow();
  } catch (error) {
    $('#app').innerHTML = `<section class="study-card"><h1 class="page-title">Ders içeriği açılamadı</h1><p class="page-subtitle">${esc(error.message)} Bu klasörü yerel web sunucusuyla açabilir veya GitHub Pages yayınının tamamlanmasını bekleyebilirsin.</p></section>`;
  }
}

init();
