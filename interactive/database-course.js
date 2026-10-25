const STORAGE_KEY = 'manga-go-database-v22';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const rich = (value) => esc(value).replace(/`([^`\n]+)`/g, '<code>$1</code>');

let course = null;
let units = [];
let currentID = '';
let callbacks = {};
let hosted = false;
let state = loadState();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      drafts: saved.drafts || {}, predictions: saved.predictions || {}, quizzes: saved.quizzes || {},
      runs: saved.runs || {}, completed: new Set(saved.completed || []), lastUnit: saved.lastUnit || '',
    };
  } catch (_error) {
    return {drafts: {}, predictions: {}, quizzes: {}, runs: {}, completed: new Set(), lastUnit: ''};
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({...state, completed: [...state.completed]}));
  window.dispatchEvent(new CustomEvent('database-progress', {detail: {completed: state.completed.size, total: units.length}}));
}

function byID(id) { return units.find((unit) => unit.id === id); }
function currentUnit() { return byID(currentID); }
function trackFor(unit) { return course?.tracks.find((track) => track.id === unit?.track); }
function isComplete(unit) { return state.completed.has(unit.id); }

async function updateCompletion(unit) {
  const prediction = state.predictions[unit.id];
  const quiz = state.quizzes[unit.id];
  const run = state.runs[unit.id];
  const ready = prediction?.checked && prediction.correct && run?.ok && quiz?.checked && quiz.correct;
  state.completed.delete(unit.id);
  if (ready && !hosted) {
    try {
      const response = await fetch('/api/check', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({
        unitId: unit.id,
        foundationPrediction: prediction.selected,
        quizAnswers: [quiz.selected],
        codeDigest: run.digest,
        runProof: run.proof,
      })});
      const payload = await response.json();
      if (response.ok && payload.ok && payload.completionDigest) {
        state.completed.add(unit.id);
        state.runs[unit.id].completionDigest = payload.completionDigest;
      } else {
        callbacks.showToast?.(payload.error || '完成凭证未通过，请重新运行本课代码');
      }
    } catch (_error) {
      callbacks.showToast?.('完成凭证暂时无法保存，请确认本地服务仍在运行');
    }
  }
  saveState();
}

function choiceHTML(kind, item, saved) {
  return `<div class="database-choices" role="radiogroup" aria-label="${esc(item.question)}">${item.options.map((option, index) => {
    const selected = saved?.selected === index;
    const status = saved?.checked ? (index === item.correctIndex ? 'correct' : selected ? 'wrong' : '') : '';
    return `<button type="button" class="database-choice ${selected ? 'selected' : ''} ${status}" data-${kind}-choice="${index}" aria-pressed="${selected}"><span>${String.fromCharCode(65 + index)}</span>${esc(option)}</button>`;
  }).join('')}</div>`;
}

function feedbackHTML(saved, item, correctLead, retryLead) {
  if (!saved?.checked) return '';
  const detail = saved.correct ? item.explanation : '先回看上面的示例，确认题目问的是数据对象、范围还是执行顺序，再重新选择。';
  return `<div class="database-inline-feedback ${saved.correct ? 'success' : 'error'}" role="status"><b>${saved.correct ? correctLead : retryLead}</b><p>${rich(detail)}</p></div>`;
}

function renderLesson({preserveScroll = false} = {}) {
  const unit = currentUnit();
  if (!unit) return;
  const scrollY = window.scrollY;
  const track = trackFor(unit);
  const trackUnits = units.filter((item) => item.track === unit.track);
  const trackIndex = trackUnits.findIndex((item) => item.id === unit.id);
  const completedInTrack = trackUnits.filter((item) => state.completed.has(item.id)).length;
  const prediction = state.predictions[unit.id];
  const quiz = state.quizzes[unit.id];
  const run = state.runs[unit.id];
  const starterCode = state.drafts[unit.id] ?? unit.challenge.starterCode;

  document.getElementById('databaseTrackLabel').textContent = `${track.title} · ${trackIndex + 1}/${trackUnits.length}`;
  document.getElementById('databaseUnitTitle').textContent = unit.title;
  document.getElementById('databaseUnitGoal').textContent = unit.goal;
  document.getElementById('databasePrev').disabled = trackIndex <= 0;
  document.getElementById('databasePreviousFooter').disabled = trackIndex <= 0;
  const routeBridge = unit.next?.target ? unit.next : null;
  const nextButton = document.getElementById('databaseNext');
  nextButton.dataset.openRouteTarget = routeBridge?.target || '';
  nextButton.disabled = !routeBridge && trackIndex >= trackUnits.length - 1;
  nextButton.title = routeBridge?.label || '下一课';
  nextButton.setAttribute('aria-label', routeBridge?.label || '下一课');
  const nextFooter = document.getElementById('databaseNextFooter');
  nextFooter.dataset.openRouteTarget = routeBridge?.target || '';
  nextFooter.disabled = !routeBridge && trackIndex >= trackUnits.length - 1;
  nextFooter.textContent = routeBridge
    ? `${routeBridge.label} →`
    : trackIndex >= trackUnits.length - 1 ? '本路线已完成' : `下一课：${trackUnits[trackIndex + 1].title}`;
  document.getElementById('databaseProgressText').textContent = `本路线 ${completedInTrack}/${trackUnits.length} 课完成`;
  document.getElementById('databaseProgressFill').style.width = `${Math.round(completedInTrack / Math.max(1, trackUnits.length) * 100)}%`;
  renderTrackSwitcher(unit.track);

  const hints = unit.challenge.hints || [];
  const steps = unit.explanation.steps || [];
  const boundary = unit.track === 'mysql'
    ? '<p class="database-evidence-note"><b>证据边界：</b>这里检查 MySQL 语法结构和固定订单数据，不模拟 InnoDB 的锁与并发。</p>'
    : unit.track === 'redis'
      ? '<p class="database-evidence-note"><b>真实运行：</b>命令会发给临时隔离的本机 Redis；没有 Redis 时会明确报告不可用。</p>'
      : '<p class="database-evidence-note"><b>学习目标：</b>先建立表和查询的直觉，不要求你先会后端代码。</p>';
  document.getElementById('databaseLesson').innerHTML = `
    <section class="database-context">
      <div><span>前端里你已经见过</span><h2>${rich(unit.frontendAnalogy)}</h2></div>
      <div class="database-concept"><span>数据库里叫</span><p>${rich(unit.explanation.rule)}</p></div>
    </section>
    <section class="database-example">
      <header><div><span class="database-step-number">1</span><div><p class="code-first-label">先看一遍</p><h2>${esc(unit.example.caption)}</h2></div></div><small>这段只用来观察，不需要背</small></header>
      <pre tabindex="0" aria-label="可横向滚动的代码示例"><code>${esc(unit.example.code)}</code></pre>
      <div class="database-example-output"><b>会得到</b><pre>${esc(unit.example.output)}</pre></div>
    </section>
    <section class="database-prediction">
      <header><span class="database-step-number">2</span><div><p class="code-first-label">先预测，再看答案</p><h2>${esc(unit.prediction.question)}</h2></div></header>
      ${choiceHTML('prediction', unit.prediction, prediction)}
      <button type="button" class="secondary-button" data-check-prediction ${prediction?.selected == null ? 'disabled' : ''}>检查预测</button>
      ${feedbackHTML(prediction, unit.prediction, '预测正确。现在用运行结果确认。', '先看差异，再试一次。')}
    </section>
    <section class="database-challenge">
      <header><span class="database-step-number">3</span><div><p class="code-first-label">只改这一处</p><h2>${rich(unit.challenge.prompt)}</h2></div></header>
      ${boundary}
      <textarea class="database-code-editor" id="databaseCode" spellcheck="false" aria-label="${esc(unit.challenge.language)} 练习编辑器">${esc(starterCode)}</textarea>
      <div class="database-code-actions"><button type="button" class="primary-button" data-run-database>运行并检查</button><button type="button" class="text-button" data-reset-database>恢复初始代码</button></div>
      <div class="database-run-result ${run ? (run.ok ? 'success' : 'error') : 'hidden'}" aria-live="polite">
        <b>${run?.ok ? esc(unit.challenge.successMessage) : '还没通过，按反馈改一处再试'}</b>
        <pre>${esc(run?.output || '')}</pre>
      </div>
      <details class="database-hints"><summary>卡住了，给我一层提示</summary><ol>${hints.map((hint) => `<li>${rich(hint)}</li>`).join('')}</ol></details>
    </section>
    <section class="database-explanation">
      <header><span class="database-step-number">4</span><div><p class="code-first-label">把刚才的现象说清楚</p><h2>只记住这一条规则</h2></div></header>
      <ol>${steps.map((step) => `<li>${rich(step)}</li>`).join('')}</ol>
      <div class="database-pitfall"><b>最容易踩的坑</b><p>${rich(unit.explanation.pitfall)}</p></div>
    </section>
    <section class="database-quiz">
      <header><span class="database-step-number">5</span><div><p class="code-first-label">换个场景检查</p><h2>${esc(unit.quiz.question)}</h2></div></header>
      ${choiceHTML('quiz', unit.quiz, quiz)}
      <button type="button" class="secondary-button" data-check-quiz ${quiz?.selected == null ? 'disabled' : ''}>检查答案</button>
      ${feedbackHTML(quiz, unit.quiz, '答对了，这条规则已经能迁移。', '这次只回看上面的规则。')}
    </section>
    <section class="database-complete ${isComplete(unit) ? 'done' : ''}"><div><b>${isComplete(unit) ? '本课已完成' : '本课还差一点'}</b><span>${isComplete(unit) ? '预测、真实运行和迁移题都已通过。' : '预测正确 + 运行通过 + 检查题正确，才会记录完成。'}</span></div></section>`;

  bindLesson(unit);
  if (preserveScroll) requestAnimationFrame(() => window.scrollTo({top: scrollY, behavior: 'auto'}));
}

function bindLesson(unit) {
  const root = document.getElementById('databaseLesson');
  root.querySelectorAll('[data-prediction-choice]').forEach((button) => button.addEventListener('click', () => {
    state.predictions[unit.id] = {selected: Number(button.dataset.predictionChoice), checked: false, correct: false};
    state.completed.delete(unit.id);
    saveState(); renderLesson({preserveScroll: true});
  }));
  root.querySelector('[data-check-prediction]')?.addEventListener('click', async () => {
    const answer = state.predictions[unit.id];
    if (!answer) return;
    answer.checked = true; answer.correct = answer.selected === unit.prediction.correctIndex;
    await updateCompletion(unit); renderLesson({preserveScroll: true});
  });
  root.querySelectorAll('[data-quiz-choice]').forEach((button) => button.addEventListener('click', () => {
    state.quizzes[unit.id] = {selected: Number(button.dataset.quizChoice), checked: false, correct: false};
    state.completed.delete(unit.id);
    saveState(); renderLesson({preserveScroll: true});
  }));
  root.querySelector('[data-check-quiz]')?.addEventListener('click', async () => {
    const answer = state.quizzes[unit.id];
    if (!answer) return;
    answer.checked = true; answer.correct = answer.selected === unit.quiz.correctIndex;
    await updateCompletion(unit); renderLesson({preserveScroll: true});
  });
  const editor = root.querySelector('#databaseCode');
  const resizeEditor = () => {
    if (!editor) return;
    const lines = editor.value.split('\n').length;
    editor.style.height = `${Math.min(420, Math.max(176, 76 + lines * 24))}px`;
  };
  resizeEditor();
  editor?.addEventListener('input', () => {
    state.drafts[unit.id] = editor.value;
    delete state.runs[unit.id];
    state.completed.delete(unit.id);
    resizeEditor(); saveState();
  });
  root.querySelector('[data-reset-database]')?.addEventListener('click', () => {
    state.drafts[unit.id] = unit.challenge.starterCode;
    delete state.runs[unit.id]; state.completed.delete(unit.id); saveState(); renderLesson({preserveScroll: true});
  });
  root.querySelector('[data-run-database]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    if (hosted) { callbacks.showToast?.('在线阅读版不连接本地验证器，请使用本地完整版'); return; }
    button.disabled = true; button.textContent = '正在运行…';
    try {
      const response = await fetch('/api/run', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({unitId: unit.id, code: editor.value})});
      const payload = await response.json();
      state.runs[unit.id] = {ok: Boolean(response.ok && payload.ok), output: payload.output || payload.error || '验证器没有返回结果', digest: payload.artifactDigest || '', proof: payload.runProof || ''};
    } catch (error) {
      state.runs[unit.id] = {ok: false, output: `无法连接本地验证器：${error.message}`};
    }
    await updateCompletion(unit); renderLesson({preserveScroll: true});
  });
}

function renderTrackSwitcher(activeTrack) {
  const root = document.getElementById('databaseTrackSwitcher');
  root.innerHTML = course.tracks.map((track) => {
    const trackUnits = units.filter((unit) => unit.track === track.id);
    const completed = trackUnits.filter((unit) => state.completed.has(unit.id)).length;
    return `<button type="button" class="${track.id === activeTrack ? 'active' : ''}" data-database-track="${esc(track.id)}"><b>${esc(track.title)}</b><span>${completed}/${trackUnits.length}</span></button>`;
  }).join('');
  root.querySelectorAll('[data-database-track]').forEach((button) => button.addEventListener('click', () => startDatabaseTrack(button.dataset.databaseTrack)));
}

export async function initDatabaseCourse(options = {}) {
  callbacks = options;
  hosted = Boolean(options.staticHosted);
  const response = await fetch('data/database_curriculum.json?v=22.0.0', {cache: 'no-store'});
  if (!response.ok) throw new Error('数据库课程数据加载失败');
  course = await response.json();
  units = course.tracks.flatMap((track) => track.units.map((unit) => ({...unit, track: unit.track || track.id})));
  ['databasePrev', 'databasePreviousFooter'].forEach((id) => document.getElementById(id)?.addEventListener('click', () => moveDatabase(-1)));
  ['databaseNext', 'databaseNextFooter'].forEach((id) => document.getElementById(id)?.addEventListener('click', (event) => {
    const target = event.currentTarget.dataset.openRouteTarget;
    if (target && byID(target)) openDatabaseUnit(target);
    else if (target) callbacks.openGoUnit?.(target);
    else moveDatabase(1);
  }));
  return {units: units.length, completed: state.completed.size};
}

export function isDatabaseUnit(id) { return Boolean(byID(id)); }

export function searchDatabaseUnits(query) {
  const value = String(query || '').trim().toLowerCase();
  if (!value) return [];
  return units.filter((unit) => JSON.stringify(unit).toLowerCase().includes(value)).map((unit) => ({
    id: unit.id,
    title: unit.title,
    goal: unit.goal || unit.task || '',
    trackTitle: trackFor(unit)?.title || '数据库',
  }));
}

export function startDatabaseTrack(trackID = 'database') {
  const trackUnits = units.filter((unit) => unit.track === trackID);
  if (!trackUnits.length) return;
  if (trackID !== 'database') {
    const foundationsDone = units.filter((unit) => unit.track === 'database').every((unit) => state.completed.has(unit.id));
    if (!foundationsDone) callbacks.showToast?.('建议先学数据库基础；已有经验可以直接浏览当前路线');
  }
  const target = trackUnits.find((unit) => !state.completed.has(unit.id)) || trackUnits[0];
  openDatabaseUnit(target.id);
}

export function openDatabaseUnit(id, {historyMode = 'push', preserveScroll = false} = {}) {
  const unit = byID(id);
  if (!unit) return false;
  const previous = currentID;
  currentID = id;
  state.lastUnit = id;
  saveState();
  callbacks.recordLastLocation?.({kind: 'database', id});
  document.getElementById('welcome')?.classList.add('hidden');
  document.getElementById('unitView')?.classList.add('hidden');
  document.getElementById('databaseCourse')?.classList.remove('hidden');
  if (historyMode !== 'none') history[historyMode === 'replace' ? 'replaceState' : 'pushState']({databaseUnit: id}, '', `#${id}`);
  renderLesson({preserveScroll: preserveScroll || previous === id});
  callbacks.renderNav?.();
  callbacks.closeSidebar?.();
  if (!preserveScroll && previous !== id) window.scrollTo({top: 0, behavior: 'auto'});
  return true;
}

export function hideDatabaseCourse() { document.getElementById('databaseCourse')?.classList.add('hidden'); }

export function decorateDatabaseNav(root) {
  if (!course || !root) return;
  root.querySelector('[data-database-nav]')?.remove();
  const wrapper = document.createElement('div');
  wrapper.dataset.databaseNav = 'true';
  wrapper.innerHTML = course.tracks.map((track) => {
    const trackUnits = units.filter((unit) => unit.track === track.id);
    const active = trackUnits.some((unit) => unit.id === currentID) && !document.getElementById('databaseCourse')?.classList.contains('hidden');
    return `<details class="nav-volume database-nav-volume" ${active || window.innerWidth > 720 ? 'open' : ''}><summary>${esc(track.title)}</summary>${trackUnits.map((unit, index) => `<button type="button" class="nav-item ${unit.id === currentID && active ? 'active' : ''}" aria-current="${unit.id === currentID && active ? 'page' : 'false'}" data-database-unit="${esc(unit.id)}"><span class="nav-num">${String(index + 1).padStart(2, '0')}</span><span>${esc(unit.title)}</span>${state.completed.has(unit.id) ? '<span aria-label="已完成">·</span>' : ''}</button>`).join('')}</details>`;
  }).join('');
  root.prepend(wrapper);
  wrapper.querySelectorAll('[data-database-unit]').forEach((button) => button.addEventListener('click', () => openDatabaseUnit(button.dataset.databaseUnit)));
}

function moveDatabase(direction) {
  const unit = currentUnit();
  const trackUnits = units.filter((item) => item.track === unit?.track);
  const index = trackUnits.findIndex((item) => item.id === currentID);
  const target = trackUnits[index + direction];
  if (target) openDatabaseUnit(target.id);
}
