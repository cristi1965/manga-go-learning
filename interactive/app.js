import { enhanceTerms } from './term-help.js';
import { mountCodeEditor } from './vendor/editor.js?v=learning-flow-v21';
import { mountStarter } from './starter.js';
import { lessonBriefs } from './lesson-briefs.js';
import { courseDiagrams } from './diagram-definitions.js';
import { renderMermaid } from './vendor/diagram-renderer.js';
import { decorateDatabaseNav, hideDatabaseCourse, initDatabaseCourse, isDatabaseUnit, openDatabaseUnit, searchDatabaseUnits, startDatabaseTrack } from './database-course.js';
const staticHosted = location.hostname.endsWith('github.io') || new URLSearchParams(location.search).get('static') === '1';
const state = {
  data: null,
  units: [],
  currentIndex: 0,
  stage: 'understand',
  readSupplements: new Set(JSON.parse(localStorage.getItem('manga-go-read-supplements') || '[]')),
  completed: new Set(JSON.parse(localStorage.getItem('jianjian-completed') || '[]')),
  wrong: JSON.parse(localStorage.getItem('jianjian-wrong') || '[]'),
  answered: new Set(JSON.parse(localStorage.getItem('jianjian-answered') || '[]')),
  responses: JSON.parse(localStorage.getItem('jianjian-responses') || '{}'),
  practices: JSON.parse(localStorage.getItem('manga-go-practices') || '{}'),
  reviewHistory: JSON.parse(localStorage.getItem('manga-go-review-history') || '[]'),
  supplementOrigin: JSON.parse(sessionStorage.getItem('manga-go-supplement-origin') || 'null'),
  routeMode: localStorage.getItem('manga-go-route-mode') || sessionStorage.getItem('manga-go-route-mode') || 'main',
  databaseCompleted: 0,
  databaseTotal: 0,
};

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const richText = (value) => esc(value).replace(/`([^`\n]+)`/g, '<code>$1</code>');
const firstSentence = (value, fallback = '') => String(value || fallback).split(/[。！？]/)[0].trim();
const readableVolumeTitle = (title) => title === '第一部分：学会写 Go' ? '第一部分：先把 Go 写起来' : title;
const AI_ROUTE_IDS = [
  'chapter-17', 'supplement-go-ai-01', 'supplement-go-ai-02',
  'chapter-18', 'supplement-go-ai-03', 'supplement-go-ai-04',
  'chapter-19', 'supplement-go-ai-05', 'supplement-go-ai-06',
  'chapter-20', 'chapter-21', 'chapter-22', 'supplement-go-ai-07',
  'chapter-23', 'supplement-go-ai-08', 'chapter-24',
];
const WAILS_ROUTE_IDS = ['chapter-2', 'chapter-4', 'chapter-5', 'chapter-6', 'chapter-7', 'chapter-8'];
const MILESTONE_LABELS = new Map([
  ['supplement-go-ai-01', 'M1'], ['supplement-go-ai-02', 'M2'],
  ['supplement-go-ai-04', 'M4'], ['supplement-go-ai-03', 'M3'],
  ['supplement-go-ai-05', 'M5'], ['supplement-go-ai-06', 'M6'],
  ['supplement-go-ai-07', 'M7'], ['supplement-go-ai-08', 'M8'],
]);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const lessonPaneMedia = window.matchMedia('(max-width: 900px)');
let revealObserver = null;
let draftSaveTimer = null;
let mobileLessonPane = 'explain';
let currentLessonTask = 'observe';
const lessonPaneOffsets = new Map();
const LESSON_TASKS = new Set(['observe', 'understand', 'practice']);

function lessonPaneKey(pane) {
  return `${state.units[state.currentIndex]?.id || 'none'}:${pane}`;
}

function prepareLessonPanesForRender() {
  ['lessonExplainPane', 'lessonPracticePane'].forEach((id) => {
    const pane = document.getElementById(id);
    if (!pane) return;
    pane.hidden = false;
    pane.inert = false;
  });
}

function setLessonPane(paneName, {restore = false, focusTab = false} = {}) {
  const nextPane = paneName === 'practice' ? 'practice' : 'explain';
  const workspace = $('#lessonWorkspace');
  if (!workspace) return;
  if (lessonPaneMedia.matches && mobileLessonPane !== nextPane && !$('#unitView').classList.contains('hidden')) {
    lessonPaneOffsets.set(lessonPaneKey(mobileLessonPane), window.scrollY);
  }
  mobileLessonPane = nextPane;
  document.querySelectorAll('[data-lesson-pane]').forEach((tab) => {
    const selected = tab.dataset.lessonPane === nextPane;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    tab.classList.toggle('active', selected);
  });
  const explain = $('#lessonExplainPane');
  const practice = $('#lessonPracticePane');
  if (lessonPaneMedia.matches) {
    explain.hidden = nextPane !== 'explain';
    explain.inert = nextPane !== 'explain';
    practice.hidden = nextPane !== 'practice';
    practice.inert = nextPane !== 'practice';
    if (restore) requestAnimationFrame(() => {
      const scrollTop = lessonPaneOffsets.get(lessonPaneKey(nextPane)) ?? workspace.offsetTop;
      window.scrollTo({top: scrollTop, behavior: 'auto'});
      revealOnce(nextPane === 'explain' ? explain : practice);
    });
  } else {
    explain.hidden = false;
    explain.inert = false;
    practice.hidden = false;
    practice.inert = false;
  }
  if (focusTab) document.querySelector(`[data-lesson-pane="${nextPane}"]`)?.focus({preventScroll: true});
  const unitID = state.units[state.currentIndex]?.id;
  if (unitID && !$('#unitView')?.classList.contains('hidden')) recordLastLocation({kind: 'go', id: unitID, routeMode: state.routeMode, task: currentLessonTask, pane: nextPane});
}

function setLessonTask(taskName, {focusTab = false, syncPane = true, preserveViewport = true} = {}) {
  const nextTask = LESSON_TASKS.has(taskName) ? taskName : 'observe';
  const workspace = $('#lessonWorkspace');
  const scrollTop = window.scrollY;
  const viewportGuardHeight = workspace ? Math.max(0, scrollTop + window.innerHeight - workspace.offsetTop + 24) : 0;
  if (workspace) workspace.style.minHeight = preserveViewport ? `${viewportGuardHeight}px` : '';
  currentLessonTask = nextTask;
  document.querySelectorAll('[data-lesson-task]').forEach((tab) => {
    const selected = tab.dataset.lessonTask === nextTask;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  const visible = (selector, show) => {
    const element = $(selector);
    if (element) element.hidden = !show;
  };
  visible('#comicOpening', nextTask === 'observe');
  visible('#mechanismSection', nextTask !== 'observe');
  visible('#supplementList', nextTask === 'practice');
  visible('#transitionOut', nextTask === 'practice');
  visible('#codeCard', nextTask !== 'practice');
  visible('#exerciseCard', nextTask === 'practice');
  visible('#completionChecklist', nextTask === 'practice');
  const unitID = state.units[state.currentIndex]?.id;
  if (unitID) localStorage.setItem(`manga-go-task:${unitID}`, nextTask);
  localStorage.setItem('manga-go-last-task', nextTask);
  if (unitID && !$('#unitView')?.classList.contains('hidden')) recordLastLocation({kind: 'go', id: unitID, routeMode: state.routeMode, task: nextTask, pane: mobileLessonPane});
  if (lessonPaneMedia.matches && syncPane) setLessonPane(nextTask === 'practice' ? 'practice' : 'explain');
  if (focusTab) document.querySelector(`[data-lesson-task="${nextTask}"]`)?.focus({preventScroll: true});
  requestAnimationFrame(() => {
    if (preserveViewport) window.scrollTo({top: scrollTop, behavior: 'auto'});
    revealOnce(lessonPaneMedia.matches
      ? (nextTask === 'practice' ? $('#lessonPracticePane') : $('#lessonExplainPane'))
      : workspace);
  });
}

function scheduleSaveState() {
  window.clearTimeout(draftSaveTimer);
  draftSaveTimer = window.setTimeout(() => {
    draftSaveTimer = null;
    saveState();
  }, 300);
}

function revealOnce(root = document) {
  const targets = [...root.querySelectorAll([
    '.unit-header', '.lesson-contract', '.lesson-taskbar', '.incident-card', '.comic-opening',
    '.overview-diagram', '.memory-card', '.glossary-card', '.flow-card',
    '.technical-card', '.code-card', '.exercise-card', '.supplement-list',
  ].join(','))].filter((node) => node.offsetParent !== null);
  revealObserver?.disconnect();
  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    targets.forEach((node) => node.classList.add('is-visible'));
    return;
  }
  document.documentElement.classList.add('motion-ready');
  targets.forEach((node, index) => {
    node.classList.remove('is-visible');
    node.classList.add('motion-reveal');
    node.style.setProperty('--motion-order', String(index % 3));
  });
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  }, {rootMargin: '0px 0px -8% 0px', threshold: 0.08});
  targets.forEach((node) => revealObserver.observe(node));
}

function replayFeedback(node, className = 'motion-feedback') {
  if (!node || reducedMotion.matches) return;
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
}

function flattenUnits(data) {
  const units = [];
  data.chapters.forEach((chapter) => {
    units.push(chapter);
    chapter.supplements.forEach((supplement) => units.push(supplement));
  });
  return units;
}

function isReadingSupplement(unit) {
  return unit && unit.kind !== 'chapter' && !unit.projectLab;
}

function hasRunnableSupplementExercise(unit) {
  return unit?.id === 'supplement-go-real-test-file';
}

function parentChapter(unit) {
  return state.data.chapters.find((chapter) => chapter.supplements.some((item) => item.id === unit.id));
}

function learningRoute() {
  const unitsByID = new Map(state.units.map((unit) => [unit.id, unit]));
  if (state.routeMode === 'wails') return WAILS_ROUTE_IDS.map((id) => unitsByID.get(id)).filter(Boolean);
  return [
    ...state.data.chapters.filter((chapter) => chapter.number <= 16),
    ...AI_ROUTE_IDS.map((id) => unitsByID.get(id)).filter(Boolean),
  ];
}

function adjacentUnit(direction) {
  const unit = state.units[state.currentIndex];
  if (isReadingSupplement(unit)) return parentChapter(unit);
  const route = learningRoute();
  const index = route.findIndex((item) => item.id === unit.id);
  return route[index + direction];
}

function routeLabel(unit) {
  if (!unit) return '';
  if (unit.kind === 'chapter') return `第 ${unit.number} 章：${unit.shortTitle || unit.title}`;
  return `${unit.projectLab ? '里程碑' : '补充'}：${unit.title}`;
}

function storyArc(unit) {
  const number = Number(unit.chapter || unit.number || 1);
  if (number <= 8) return '奶茶小店结账器';
  if (number <= 16) return '奶茶小店订单服务';
  return '奶茶小店订单 Agent';
}

function renderCompletionControls() {
  const unit = state.units[state.currentIndex];
  const reading = isReadingSupplement(unit);
  const done = reading ? state.readSupplements.has(unit.id) : state.completed.has(unit.id);
  $('#completeButton').innerHTML = hasRunnableSupplementExercise(unit)
    ? (done ? '练习已完成（点击取消） <span>✓</span>' : '检查练习是否完成 <span>✓</span>')
    : reading
    ? (done ? '已阅读（点击取消） <span>✓</span>' : '标记已阅读 <span>✓</span>')
    : (done ? '本节已完成 <span>✓</span>' : '检查本节是否过关 <span>✓</span>');
  $('#continueUnitButton').classList.toggle('hidden', !done || !adjacentUnit(1));
  const previous = adjacentUnit(-1);
  const next = adjacentUnit(1);
  $('#continueUnitButton').textContent = reading ? `返回：${routeLabel(next)} →` : `下一单元：${routeLabel(next)} →`;
  $('#prevButton').classList.toggle('hidden', reading);
  $('#nextButton').classList.toggle('hidden', reading);
  $('#prevButton').disabled = !previous;
  $('#nextButton').disabled = !next;
  $('#prevButton').textContent = '←';
  $('#nextButton').textContent = reading ? '返回所属章' : '→';
  $('#prevButton').title = previous ? `上一单元：${routeLabel(previous)}` : '没有上一单元';
  $('#nextButton').title = next ? `下一单元：${routeLabel(next)}` : '已经到达最终总装';
  $('#prevButton').setAttribute('aria-label', $('#prevButton').title);
  $('#nextButton').setAttribute('aria-label', $('#nextButton').title);
  renderCompletionChecklist(unit);
}

function completionRequirements(unit) {
  if (!unit) return [];
  if (hasRunnableSupplementExercise(unit)) {
    const quizKeys = (unit.selfCheck || []).map((_, index) => `${unit.id}:${index}`);
    const practice = state.practices[unit.id] || {};
    return [
      {id: 'failure', label: '故意改错一次，确认测试能失败', done: Boolean(practice.codeFailureSeen), target: '[data-code-exercise]'},
      {id: 'exercise', label: '新增边界用例并让 go test 通过', done: Boolean(practice.codeOk && practice.codeChanged), target: '[data-code-exercise]'},
      {id: 'quiz', label: '迁移题答对', done: quizKeys.every((key) => state.answered.has(key) && !state.wrong.includes(key)), target: '.quiz-list'},
    ];
  }
  if (isReadingSupplement(unit)) return [{id: 'read', label: '这是按需补充，不阻塞主线', done: true, target: '#transitionIn'}];
  const practice = state.practices[unit.id] || {};
  const quizKeys = (unit.selfCheck || []).map((_, index) => `${unit.id}:${index}`);
  const quizzesDone = quizKeys.length === 0 || quizKeys.every((key) => state.answered.has(key) && !state.wrong.includes(key));
  if (unit.foundationLesson) return [
    {id: 'prediction', label: '预测一次并检查', done: Boolean(practice.foundationPredictionChecked && practice.foundationPredictionCorrect), target: '.foundation-prediction'},
    {id: 'baseline', label: '原样运行一次', done: Boolean(practice.foundationBaselineRan), target: '.foundation-code-shell'},
    {id: 'change', label: '只改一处再运行', done: Boolean(practice.foundationChangedRan && practice.foundationBaselineDigest !== practice.foundationChangedDigest), target: '.foundation-change'},
    {id: 'exercise', label: '独立代码通过固定测试', done: Boolean(practice.codeOk), target: '[data-code-exercise]'},
    {id: 'quiz', label: '迁移题答对', done: quizzesDone, target: '.quiz-list'},
  ];
  const requirements = [];
  if (unit.quickstartLab) requirements.push({id: 'quickstart', label: '运行最小 Agent，看见四阶段状态', done: Boolean(practice.quickstartOk), target: '.agent-quickstart'});
  if (unit.projectExercise || unit.workshop?.codeExercise) requirements.push({id: 'exercise', label: '当前代码通过固定测试', done: Boolean(practice.codeOk), target: '[data-code-exercise]'});
  if (unit.projectLab && unit.kind === 'chapter') requirements.push({id: 'project', label: '完整实验通过', done: Boolean(practice.labOk), target: '[data-project-lab]'});
  if (unit.id === 'chapter-24') {
    const milestones = AI_ROUTE_IDS.filter((id) => id.startsWith('supplement-go-ai-'));
    requirements.unshift({
      id: 'milestones',
      label: 'M1-M8 必修里程碑全部完成',
      done: milestones.every((id) => state.completed.has(id)),
      target: '#chapterNav',
    });
  }
  if (unit.kind === 'chapter' && unit.workshop && !unit.foundationLesson && unit.id !== 'chapter-24') requirements.push({id: 'workshop', label: '三项引导练习通过', done: Boolean(practice.workshopOk), target: '[data-workshop]'});
  if (quizKeys.length) requirements.push({id: 'quiz', label: '检查题全部答对', done: quizzesDone, target: '.quiz-list'});
  return requirements;
}

function renderCompletionChecklist(unit = state.units[state.currentIndex]) {
  const root = $('#completionChecklist');
  if (!root || !unit) return;
  const requirements = completionRequirements(unit);
  const done = requirements.filter((item) => item.done).length;
  const next = requirements.find((item) => !item.done);
  root.innerHTML = `<header><div><h2>过关状态</h2><small>${next ? `下一项：${esc(next.label)}` : '本节证据已齐全'}</small></div><span>${done} / ${requirements.length} 已完成</span></header><div class="completion-items" role="list">${requirements.map((item) => `<div class="completion-item ${item.done ? 'done' : ''}" role="listitem" aria-label="${item.done ? '已完成' : '待完成'}：${esc(item.label)}">${esc(item.label)}</div>`).join('')}</div>`;
}

function avatar(data, speaker) {
  const path = data.avatars[speaker];
  return path ? `<img class="avatar" src="${encodeURI(path)}?v=original-avatars" alt="${esc(speaker)}头像">` : `<span class="avatar" aria-hidden="true"></span>`;
}

function dialogueHtml(data, lines) {
  return `<div class="chat-list">${lines.map(({speaker, text}) => {
    const learner = speaker === '陈平安';
    return `<div class="chat-row ${learner ? 'learner' : ''}" data-speaker="${esc(speaker)}"><div class="chat-person">${avatar(data, speaker)}<span class="speaker">${esc(speaker)}</span></div><div class="bubble">${richText(text)}</div></div>`;
  }).join('')}</div>`;
}

function comicOpeningHtml(data, lines, scene) {
  return `<div class="comic-heading"><div><span>场景对话</span><h2>${richText(scene || '先看一个具体场景')}</h2></div><small>像看消息一样读完</small></div><div class="wechat-conversation">${lines.map(({speaker, text}, index) => {
    const outgoing = index % 2 === 1;
    return `<div class="wechat-message ${outgoing ? 'outgoing' : 'incoming'}" data-speaker="${esc(speaker)}"><div class="wechat-avatar">${avatar(data, speaker)}</div><div class="wechat-body"><b>${esc(speaker)}</b><blockquote>${richText(text)}</blockquote></div></div>`;
  }).join('')}</div>`;
}

function renderNav() {
  const nav = $('#chapterNav');
  let html = '<div class="volume-label">Go 起步 · 必修</div><button type="button" class="nav-item starter-nav-entry" data-open-starter><span class="nav-num">00</span><span>6 步建立语法地图</span></button>';
  const currentUnit = $('#unitView')?.classList.contains('hidden') ? null : state.units[state.currentIndex];
  const renderChapter = (chapter) => {
    const current = currentUnit?.id === chapter.id;
    let block = `<button type="button" class="nav-item ${current ? 'active' : ''}" aria-current="${current ? 'page' : 'false'}" data-unit="${chapter.id}"><span class="nav-num">${String(chapter.number).padStart(2, '0')}</span><span>${esc(chapter.shortTitle)}</span>${state.completed.has(chapter.id) ? '<span aria-label="已完成">·</span>' : ''}</button>`;
    if (current || chapter.supplements.some((item) => !item.projectLab && currentUnit?.id === item.id)) chapter.supplements.filter((item) => !item.projectLab).forEach((supplement) => {
      const subCurrent = currentUnit?.id === supplement.id;
      block += `<button type="button" class="nav-item sub ${subCurrent ? 'active' : ''}" aria-current="${subCurrent ? 'page' : 'false'}" data-unit="${supplement.id}"><span class="nav-num">↳</span><span>${esc(supplement.title)}</span>${state.readSupplements.has(supplement.id) ? '<span aria-label="已阅读">·</span>' : ''}</button>`;
    });
    return block;
  };
  const mobileNav = window.matchMedia('(max-width: 720px)').matches;
  const chapterGroups = [];
  state.data.chapters.filter((chapter) => chapter.number <= 16).forEach((chapter) => {
    const title = readableVolumeTitle(chapter.volume.title);
    const previous = chapterGroups[chapterGroups.length - 1];
    if (!previous || previous.title !== title) chapterGroups.push({title, chapters: []});
    chapterGroups[chapterGroups.length - 1].chapters.push(chapter);
  });
  chapterGroups.forEach((group) => {
    const current = group.chapters.some((chapter) => chapter.id === currentUnit?.id || chapter.supplements.some((item) => item.id === currentUnit?.id));
    html += `<details class="nav-volume" ${!mobileNav || current ? 'open' : ''}><summary>${esc(group.title)}</summary>${group.chapters.map(renderChapter).join('')}</details>`;
  });
  const aiUnits = learningRoute().filter((unit) => unit.projectLab || unit.number > 16);
  const aiCurrent = aiUnits.some((unit) => unit.id === currentUnit?.id);
  html += `<details class="nav-volume" ${!mobileNav || aiCurrent ? 'open' : ''}><summary>AI Agent 教程 · 从最小闭环开始</summary>`;
  aiUnits.forEach((unit) => {
    if (unit.kind === 'chapter') { html += renderChapter(unit); return; }
    const current = currentUnit?.id === unit.id;
    html += `<button type="button" class="nav-item ${current ? 'active' : ''}" aria-current="${current ? 'page' : 'false'}" data-unit="${unit.id}"><span class="nav-num">${MILESTONE_LABELS.get(unit.id) || 'M'}</span><span>${esc(unit.title)}</span>${state.completed.has(unit.id) ? '<span aria-label="已完成">·</span>' : ''}</button>`;
  });
  html += '</details>';
  nav.innerHTML = html;
  decorateDatabaseNav(nav);
  nav.querySelector('[data-open-starter]')?.addEventListener('click', () => {
    showWelcome();
    closeSidebar();
    requestAnimationFrame(() => document.getElementById('starterPanel')?.scrollIntoView({block: 'start', behavior: reducedMotion.matches ? 'auto' : 'smooth'}));
  });
  nav.querySelectorAll('[data-unit]').forEach((button) => button.addEventListener('click', () => { setRouteMode('main'); openUnit(button.dataset.unit); closeSidebar(); }));
  nav.querySelector('.active')?.scrollIntoView({block: 'nearest'});
}

function progress() {
  const count = state.data.chapters.filter((chapter) => state.completed.has(chapter.id)).length;
  const projects = state.units.filter((unit) => unit.projectLab);
  const projectDone = projects.filter((unit) => state.completed.has(unit.id)).length;
  const completedTotal = count + projectDone + state.databaseCompleted;
  const learningTotal = state.data.chapters.length + projects.length + state.databaseTotal;
  const value = Math.round((completedTotal / Math.max(1, learningTotal)) * 100) || 0;
  $('#progressLabel').textContent = `${value}%`;
  $('#progressButton').setAttribute('aria-label', `总进度 ${value}%，Go 主线 ${count}/${state.data.chapters.length}，AI 项目 ${projectDone}/${projects.length}，数据库 ${state.databaseCompleted}/${state.databaseTotal}，待复习 ${state.wrong.length} 题`);
  $('.progress-ring').style.setProperty('--progress', `${value}%`);

  const midDone = [1,2,3,4,5,6,7,8].filter((num) => state.completed.has(`chapter-${num}`)).length;
  const natDone = (count - midDone) + projectDone;
  const totalTarget = 24 + projects.length; // 32
  const currentTotal = count + projectDone;
  const fill = $('#holidayProgressFill');
  if (fill) fill.style.width = `${Math.min(100, Math.round((currentTotal / totalTarget) * 100))}%`;
  const targetText = $('#holidayTargetText');
  if (targetText) targetText.textContent = `${currentTotal}/${totalTarget} 里程碑已完成 (${Math.round((currentTotal / totalTarget) * 100)}%)`;
  const midElem = $('#stepMidAutumn');
  if (midElem) {
    midElem.className = `holiday-step ${midDone === 8 ? 'done' : 'active'}`;
    const desc = $('#midAutumnStatus');
    if (desc) desc.textContent = midDone === 8 ? '✓ 已全部通关 (8/8 章)' : `正在冲刺：已完成 ${midDone}/8 章`;
  }
  const natElem = $('#stepNational');
  if (natElem) {
    natElem.className = `holiday-step ${natDone === 24 ? 'done' : (midDone === 8 ? 'active' : '')}`;
    const desc = $('#nationalStatus');
    if (desc) desc.textContent = natDone === 24 ? '✓ 已全链路通关 (24/24 关卡)' : (midDone === 8 ? `正在攻坚：已完成 ${natDone}/24 关卡` : `等待中秋阶段通关后开启 · 已完成 ${natDone}/24 关卡`);
  }
  // Today's recommendation
  const todayElem = $('#todayRecommend');
  if (todayElem && state.data) {
    const target = learningRoute().find((unit) => !state.completed.has(unit.id));
    if (!target) {
      todayElem.innerHTML = '<span class="today-rec-done">🎉 全链路通关！</span>';
    } else {
      const label = target.kind === 'chapter' ? `第 ${target.number} 章 · ${esc(target.shortTitle)}` : `里程碑 · ${esc(target.title)}`;
      todayElem.innerHTML = `<span class="today-rec-label">今日建议：</span><button class="today-rec-link" data-today-unit="${target.id}">${label} →</button>`;
      todayElem.querySelector('[data-today-unit]')?.addEventListener('click', () => openUnit(target.id));
    }
  }
}

function saveState() {
  localStorage.setItem('manga-go-read-supplements', JSON.stringify([...state.readSupplements]));
  localStorage.setItem('jianjian-completed', JSON.stringify([...state.completed]));
  localStorage.setItem('jianjian-wrong', JSON.stringify(state.wrong));
  localStorage.setItem('jianjian-answered', JSON.stringify([...state.answered]));
  localStorage.setItem('jianjian-responses', JSON.stringify(state.responses));
  localStorage.setItem('manga-go-practices', JSON.stringify(state.practices));
  localStorage.setItem('manga-go-review-history', JSON.stringify(state.reviewHistory));
  if (state.data?.version) localStorage.setItem('manga-go-version', state.data.version);
  const count = state.data.chapters.filter((chapter) => state.completed.has(chapter.id)).length;
  const projects = state.units.filter((unit) => unit.projectLab);
  const projectDone = projects.filter((unit) => state.completed.has(unit.id)).length;
  $('#savedStatus').textContent = `主线 ${count}/${state.data.chapters.length} · 项目 ${projectDone}/${projects.length} · 复习 ${state.wrong.length}`;
  progress();
}

window.addEventListener('pagehide', () => {
  if (!draftSaveTimer || !state.data) return;
  window.clearTimeout(draftSaveTimer);
  draftSaveTimer = null;
  saveState();
});

function renderIncident(unit) {
  const brief = lessonBriefs[unit.id];
  $('#incidentCard').innerHTML = brief
    ? `<div class="card-kicker">这节解决一个问题</div><h2>${richText(brief.task)}</h2><p>${richText(brief.why)}</p><div class="lesson-mechanism"><b>先把机制讲清楚</b><p>${richText(brief.mechanism)}</p></div><details class="lesson-recall"><summary>学完后，用自己的话回答</summary><p>${richText(brief.check)}</p></details>`
    : `<div class="card-kicker">本节任务</div><h2>${richText(unit.projectExercise?.title || unit.title)}</h2><p>${richText(unit.task || unit.goal || unit.kicker)}</p><div class="lesson-mechanism"><b>完成后应看到</b><p>${richText(unit.accept)}</p></div>`;
}

function renderChat(unit) {
  const dialogue = unit.dialogue || [];
  const opening = dialogue.slice(0, 2);
  const rest = dialogue.slice(2);
  $('#comicOpening').innerHTML = comicOpeningHtml(state.data, opening, unit.opening?.[0]);
  $('#chatCard').innerHTML = `<h2 class="sr-only">继续问答</h2><div class="chat-title"><h3>继续问答</h3><span>${rest.length} 句</span></div>${dialogueHtml(state.data, rest)}<div class="chat-close"><b>回顾一下</b><span>${richText(unit.closing || unit.accept)}</span></div>`;
}

function renderMemory(unit) {
  $('#memoryCard').innerHTML = `<h3>小白先懂</h3><p class="memory-quote">“${richText(unit.mnemonic || unit.kicker)}”</p><p class="memory-analogy">${richText(unit.analogy || unit.goal)}</p>`;
  const glossary = unit.glossary?.length ? unit.glossary : [{term: '本节先不加黑话', meaning: '沿着事故和代码往下走。'}];
  $('#glossaryCard').innerHTML = `<h3>术语速查</h3><p class="term-note">带虚线的术语可悬停看中文，点击查看详细说明。</p><ul class="glossary-list">${glossary.map(({term, meaning}) => `<li><b>${esc(term)}</b><span>${richText(meaning)}</span></li>`).join('')}</ul>`;
}

function renderFlow(unit) {
  const nodes = [
    ['发生了什么', unit.opening?.[0] || unit.goal || unit.kicker],
    ['哪条规则最重要', unit.principles[0] || unit.kicker],
    ['代码怎么做', unit.codeGuides?.[0] || (unit.code ? '先找输入、条件判断和返回结果' : '先记状态，再保存可查的结果')],
    ['怎么确认做对', unit.accept],
  ];
  $('#flowCard').innerHTML = `<div class="section-heading"><h3>本章细节路线</h3><small>点击节点看解释</small></div><div class="flow-map">${nodes.map(([title, detail], index) => `<button class="flow-node ${index === 0 ? 'active' : ''}" data-flow="${index}"><b>${esc(title)}</b><span>${esc(detail).slice(0, 32)}${detail.length > 32 ? '…' : ''}</span></button>${index < nodes.length - 1 ? '<span class="flow-arrow" aria-hidden="true">→</span>' : ''}`).join('')}</div><div class="flow-detail" id="flowDetail">${esc(nodes[0][1])}</div>`;
  $('#flowCard').querySelectorAll('[data-flow]').forEach((item, index) => item.setAttribute('aria-pressed', String(index === 0)));
  const detail = $('#flowDetail');
  $('#flowCard').querySelectorAll('[data-flow]').forEach((button) => button.addEventListener('click', () => {
    $('#flowCard').querySelectorAll('[data-flow]').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    $('#flowCard').querySelectorAll('[data-flow]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    detail.textContent = nodes[Number(button.dataset.flow)][1];
    replayFeedback(detail);
  }));
}

function renderOverviewDiagram(unit) {
  const number = unit.number || unit.chapter || 1;
  const volume = number <= 8 ? 'go' : number <= 16 ? 'backend' : 'ai';
  const diagram = courseDiagrams[volume];
  $('#overviewDiagram').innerHTML = `<div class="diagram-heading"><div><span>全局图</span><h2>${diagram.title}</h2><p>${diagram.caption}</p></div><small>当前在第 ${number} 章</small></div><div class="mermaid-host" role="img" aria-label="${diagram.title}" tabindex="0"><span>正在绘制图示…</span></div>`;
  $('#overviewDiagram').classList.remove('hidden');
  const host = $('#overviewDiagram .mermaid-host');
  renderMermaid(host, diagram.source).then(() => {
    replayFeedback(host, 'diagram-ready');
  }).catch(() => {
    $('#overviewDiagram .mermaid-host').innerHTML = '<p class="diagram-error">图示暂时无法显示，请刷新页面。</p>';
  });
}

function highlightLine(line, kind = 'go') {
  if (!line) return '';
  if (kind === 'json') {
    const jsonRegex = /("(?:\\.|[^"\\])*"(?=\s*:))|("(?:\\.|[^"\\])*")|(\b(?:true|false|null)\b)|(\b-?\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)/g;
    let last = 0, out = '', m;
    while ((m = jsonRegex.exec(line)) !== null) {
      if (m.index > last) out += esc(line.slice(last, m.index));
      const [, key, str, bool, num] = m;
      if (key) out += `<span class="type">${esc(key)}</span>`;
      else if (str) out += `<span class="str">${esc(str)}</span>`;
      else if (bool) out += `<span class="const">${esc(bool)}</span>`;
      else if (num) out += `<span class="num">${esc(num)}</span>`;
      last = jsonRegex.lastIndex;
    }
    if (last < line.length) out += esc(line.slice(last));
    return out;
  }
  if (kind === 'dockerfile') {
    const dfRegex = /(#[^\n]*)|(\b(?:FROM|RUN|CMD|LABEL|EXPOSE|ENV|ADD|COPY|ENTRYPOINT|VOLUME|USER|WORKDIR|ARG)\b)|("(?:\\.|[^"\\])*")/gi;
    let last = 0, out = '', m;
    while ((m = dfRegex.exec(line)) !== null) {
      if (m.index > last) out += esc(line.slice(last, m.index));
      const [, cmt, kw, str] = m;
      if (cmt) out += `<span class="comment">${esc(cmt)}</span>`;
      else if (kw) out += `<span class="kw">${esc(kw)}</span>`;
      else if (str) out += `<span class="str">${esc(str)}</span>`;
      last = dfRegex.lastIndex;
    }
    if (last < line.length) out += esc(line.slice(last));
    return out;
  }
  // Default: Go
  const goRegex = /(\/\/[^\n]*)|("(?:\\.|[^"\\])*"|`[^`]*`)|(\b[a-z_][a-z0-9_]*(?=\.[A-Z]))|(\b(?:package|import|func|return|if|else|for|range|switch|case|default|type|struct|interface|var|const|go|select|defer|map|chan|continue|break|goto|fallthrough)\b)|(\b(?:string|int|int8|int16|int32|int64|uint|uint8|uint16|uint32|uint64|uintptr|float32|float64|complex64|complex128|bool|byte|rune|error|any|Context|Time|Duration|Reader|Writer|Header|Request|Response|Handler|WaitGroup|Mutex|RWMutex)\b)|(\b(?:true|false|nil|iota)\b)|(\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b|0x[0-9a-fA-F]+\b)|(\b[A-Za-z_]\w*(?=\s*\())|(:=|\+\+|--|<=|>=|==|!=|&&|\|\||<-)/g;
  let last = 0, out = '', m;
  while ((m = goRegex.exec(line)) !== null) {
    if (m.index > last) out += esc(line.slice(last, m.index));
    const [, cmt, str, pkg, kw, type, constant, num, fn, op] = m;
    if (cmt) out += `<span class="comment">${esc(cmt)}</span>`;
    else if (str) out += `<span class="str">${esc(str)}</span>`;
    else if (pkg) out += `<span class="pkg">${esc(pkg)}</span>`;
    else if (kw) out += `<span class="kw">${esc(kw)}</span>`;
    else if (type) out += `<span class="type">${esc(type)}</span>`;
    else if (constant) out += `<span class="const">${esc(constant)}</span>`;
    else if (num) out += `<span class="num">${esc(num)}</span>`;
    else if (fn) out += `<span class="fn">${esc(fn)}</span>`;
    else if (op) out += `<span class="op">${esc(op)}</span>`;
    last = goRegex.lastIndex;
  }
  if (last < line.length) out += esc(line.slice(last));
  return out;
}

function highlightGo(line) {
  return highlightLine(line, 'go');
}

function gutterLinesHtml(code) {
  const lineCount = (code || '').split('\n').length;
  let html = '';
  for (let i = 1; i <= lineCount; i++) {
    html += `<span class="gutter-num" data-code-line="${i}">${String(i).padStart(2, '0')}</span>`;
  }
  return html;
}

function editorBackdropHtml(code, kind = 'go') {
  return (code || '').split('\n').map((line, index) =>
    `<span class="code-line" data-code-line="${index + 1}">${highlightLine(line, kind) || ' '}</span>`
  ).join('');
}

function bindEditorSync(editor) { mountCodeEditor(editor); }

function codeLessonFor(unit) {
  if (unit.beginnerCode) return unit.beginnerCode;
  const guides = (unit.codeGuides || []).slice(0, 4);
  const subject = guides[0]?.match(/^先看 ([A-Za-z_]\w*)/)?.[1];
  const labelFor = (guide, index) => {
    if (/输入和返回值|字段和约束|读写什么状态/.test(guide)) return '先认入口出口';
    if (/守门条件/.test(guide)) return '找到坏输入';
    if (/ctx|取消和超时/.test(guide)) return '跟住取消信号';
    if (/err|错误/.test(guide)) return '别让错误失踪';
    if (/稳定身份|号码/.test(guide)) return '认准同一件事';
    if (/最后核对|状态出口/.test(guide)) return '核对最后结果';
    return `第 ${index + 1} 步`;
  };
  return {
    summary: subject
      ? `从 ${subject} 开始读：先看传进来的数据，再看条件判断，最后看返回的结果。下面按这个顺序解释。`
      : '先看这段代码接收什么数据，再看它怎样处理，最后看它返回什么。下面分步解释。',
    steps: guides.map((guide, index) => ({
      label: labelFor(guide, index),
      explanation: guide,
    })),
    cases: [],
    terms: [],
  };
}

function codeLinesHtml(code, kind = 'go') {
  return (code || '').split('\n').map((line, index) => `<span class="code-line" data-code-line="${index + 1}"><span class="line-number">${String(index + 1).padStart(2, '0')}</span>${highlightLine(line, kind)}</span>`).join('');
}

function foundationLessonHtml(unit) {
  const lesson = unit.foundationLesson;
  const saved = state.practices[unit.id] || {};
  const code = saved.foundationCode || lesson.code;
  const prediction = lesson.prediction;
  const choices = prediction.choices.map((choice, index) => `<label><input type="radio" name="foundation-prediction-${esc(unit.id)}" value="${index}" ${saved.foundationPrediction === index ? 'checked' : ''}><span>${esc(choice)}</span></label>`).join('');
  const terms = lesson.concepts.map((concept) => `<span>${esc(concept)}</span>`).join('');
  return `<div class="foundation-workbench" data-foundation-workbench>
    <header class="foundation-heading"><div><p class="code-first-label">先运行，再讲原理</p><h2>${esc(lesson.title)}</h2><p>${esc(lesson.purpose)}</p></div><div class="foundation-concepts" aria-label="本节只记三个概念">${terms}</div><button class="run-code foundation-quick-run" data-run-foundation data-run-label="先运行看看">先运行看看</button></header>
    <section class="foundation-prediction"><p><b>先猜一下：</b>${esc(prediction.question)}</p><div class="prediction-options">${choices}</div><button class="text-button" data-check-prediction>检查预测</button><span class="prediction-feedback" aria-live="polite"></span></section>
    <div class="foundation-code-shell code-shell"><div class="code-toolbar"><span>完整程序，可以直接修改</span><div class="code-actions"><button class="run-code" data-run-foundation data-run-label="运行这段代码">运行这段代码</button><button class="text-button" data-reset-foundation>恢复原始代码</button></div></div><textarea class="code-editor foundation-editor" aria-label="${esc(lesson.title)}完整 Go 程序" spellcheck="false" wrap="off">${esc(code)}</textarea><div class="run-result hidden" aria-live="polite" tabindex="-1"><div><b>运行结果</b><span></span></div><p class="failure-guide"></p><details class="raw-run-details"><summary>查看程序输出或原始日志</summary><pre></pre></details></div></div>
    <section class="foundation-change"><div><b>接着只改一处</b><p>${richText(lesson.changePrompt)}</p></div><div><b>改前应看到</b><pre>${esc(lesson.expectedOutput)}</pre><b>改后应看到</b><pre>${esc(lesson.changedOutput)}</pre></div></section>
    <details class="foundation-explanation" ${saved.foundationRan ? 'open' : ''}><summary>为什么会这样？</summary><p>${richText(lesson.explanation)}</p><p class="enterprise-bridge"><b>以后在企业项目里：</b>${richText(lesson.enterpriseBridge)}</p></details>
  </div>`;
}

function diagnoseGoFailure(output) {
  const text = String(output || '');
  let type = '测试未通过';
  let current = '程序或固定测试已在第一个失败点停下。';
  let expected = '代码能编译，并满足页面上的输出或测试契约。';
  let next = '只看原始日志的第一条失败信息，修一处后重新运行。';
  if (/syntax error|expected .*found|unexpected/.test(text)) { type = '语法错误'; current = '编译器无法读懂某一行的结构。'; expected = '括号、逗号和关键字构成完整语句。'; next = '打开原始日志，只修第一个带行号的错误。'; }
  else if (/undefined:/.test(text)) { type = '名字未定义'; current = '代码使用了当前作用域中找不到的名字。'; expected = '名字已声明且拼写与使用处一致。'; next = '复制第一条 undefined 后的名字，回到定义处逐字对照。'; }
  else if (/assignment mismatch|too many values|not enough values/.test(text)) { type = '返回值数量不一致'; current = '左边接收的变量数和函数返回值数不同。'; expected = '接收数量与函数签名一致。'; next = '只对照报错函数的签名和赋值左侧。'; }
  else if (/cannot use|mismatched types/.test(text)) { type = '类型不匹配'; current = '参数或赋值两边的类型不同。'; expected = '传入值的类型满足函数或变量声明。'; next = '只修第一条 cannot use 指向的赋值或参数。'; }
  else if (/deadlock/.test(text)) { type = '并发死锁'; current = '所有 goroutine 都在等待，没有人能继续。'; expected = 'channel 发送与接收成对，取消后发送方能退出。'; next = '先检查第一个 channel 是否同时有发送方和接收方。'; }
  else if (/--- FAIL:|\bFAIL\b|got .*want|want .*got/.test(text)) { type = '边界条件测试失败'; current = '代码已经能编译，但某组输入的实际结果与固定测试不同。'; expected = '正常、空值、错误和边界输入都返回测试中的 want 值。'; next = '打开原始日志，找第一个 got/want，只修它对应的分支。'; }
  return `错误类型：${type}。 当前行为：${current} 期望行为：${expected} 下一步只改：${next}`;
}

function codeLessonHtml(unit) {
  const lesson = codeLessonFor(unit);
  const steps = lesson.steps || [];
  const cases = lesson.cases?.length ? `<div class="case-table" role="table" aria-label="测试场景"><div class="case-row case-head" role="row"><b role="columnheader">场景</b><b role="columnheader">给什么</b><b role="columnheader">应该得到什么</b></div>${lesson.cases.map((item) => `<div class="case-row" role="row"><strong role="cell">${esc(item.name)}</strong><span role="cell">${esc(item.given)}</span><span role="cell">${esc(item.expect)}</span></div>`).join('')}</div>` : '';
  const terms = lesson.terms?.length ? `<div class="code-terms"><h3>五个符号，先认脸就够了</h3>${lesson.terms.map((item) => `<div><code>${esc(item.code)}</code><span>${esc(item.meaning)}</span></div>`).join('')}</div>` : '';
  const stepButtons = steps.length ? `<div class="code-steps" aria-label="代码阅读步骤">${steps.map((step, index) => `<button class="code-step ${index === 0 ? 'active' : ''}" data-code-step="${index}" aria-pressed="${index === 0}"><span>${index + 1}</span>${esc(step.label)}</button>`).join('')}</div><div class="step-explanation" aria-live="polite">${esc(steps[0].explanation)}</div>` : '';
  const labels = {go: 'Go 核心代码', json: 'JSON 契约', dockerfile: 'Dockerfile', tree: '目录结构', concept: '概念页'};
  const runnable = Boolean(unit.runnable && unit.verified);
  const codeLabel = runnable ? `运行已验证 · ${labels[unit.codeKind] || '可运行示例'}` : `${unit.syntaxVerified ? '语法已校验 · ' : ''}${labels[unit.codeKind] || '代码片段'}`;
  const codeHint = runnable ? `${unit.verificationCommand} 已通过` : (unit.codeKind === 'go' ? '省略 package、import 与上一章已有类型' : '这是配置或结构示例，不按 Go 编译');
  const runButton = runnable ? `<button class="run-code" data-run-unit="${esc(unit.id)}">编译运行</button>` : '';
  const codeView = `<pre class="code-block">${codeLinesHtml(unit.code, unit.codeKind || 'go')}</pre>`;
  return `<div class="code-teacher" data-code-lesson><p class="code-first-label">这段代码做什么</p><h2>${esc(lesson.summary)}</h2>${cases}${stepButtons}${terms}</div><details class="full-code"><summary><span>${codeLabel}</span><small>${codeHint}</small></summary><div class="code-shell"><div class="code-toolbar"><span>${runnable ? '完整示例；修改代码请进入独立练习' : '当前步骤会在代码中标亮'}</span><div class="code-actions">${runButton}<button class="copy-code">复制代码</button></div></div><div class="code-wrap" tabindex="0" aria-label="完整示例代码">${codeView}</div><div class="run-result hidden" aria-live="polite"><div><b>运行结果</b><span></span></div><pre></pre></div></div></details>`;
}

async function runCode(button, container, unitID) {
  const scope = button.closest('.code-shell, .lab-callout') || container;
  const result = scope.querySelector('.run-result');
  const output = result.querySelector('pre');
  const meta = result.querySelector('span');
  const guide = result.querySelector('.failure-guide');
  result.classList.remove('hidden', 'success', 'failure');
  button.disabled = true;
  button.textContent = '运行中…';
  output.textContent = '正在启动隔离的临时工作目录…';
  meta.textContent = '';
  const startedAt = Date.now();
  const progressTimer = setInterval(() => {
    const seconds = Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
    output.textContent = seconds < 4
      ? `正在启动隔离的临时工作目录… ${seconds}s`
      : `仍在编译真实 Go 测试… ${seconds}s（首次运行通常需要 5-12 秒）`;
  }, 1000);
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({unitId: unitID, code: scope.querySelector('.code-editor')?.value || ''}),
    });
    const payload = await response.json();
    result.classList.add(payload.ok ? 'success' : 'failure');
    output.textContent = payload.output || (payload.ok ? '运行成功（程序没有输出）' : '运行失败');
    meta.textContent = `${payload.command || 'Go'} · ${payload.durationMs ?? 0}ms`;
    if (guide) guide.textContent = payload.ok
      ? (button.dataset.successGuide || '运行成功。对照输出确认输入、状态变化和最终结果。')
      : diagnoseGoFailure(payload.output);
    return payload;
  } catch (_error) {
    result.classList.add('failure');
    if (guide) guide.textContent = '本地运行服务没有响应。';
    output.textContent = '运行服务未启动。请使用项目里的 run-preview.sh 启动预览。';
    return null;
  } finally {
    clearInterval(progressTimer);
    button.disabled = false;
    button.textContent = button.dataset.runLabel || (unitID === 'harness-lab' ? '运行实验' : '编译运行');
  }
}

function bindFoundationLesson(container, unit) {
  const lesson = unit.foundationLesson;
  const editor = container.querySelector('.foundation-editor');
  if (editor) bindEditorSync(editor, 'go');
  container.querySelector('[data-check-prediction]')?.addEventListener('click', () => {
    const selected = container.querySelector('input[name^="foundation-prediction-"]:checked');
    const feedback = container.querySelector('.prediction-feedback');
    if (!selected) { feedback.textContent = '先选一个答案。'; return; }
    const answer = Number(selected.value);
    const correct = answer === lesson.prediction.correctIndex;
    feedback.textContent = correct ? '预测正确。现在运行代码验证。' : lesson.prediction.wrongFeedback;
    feedback.className = `prediction-feedback ${correct ? 'success' : 'failure'}`;
    state.practices[unit.id] = {...state.practices[unit.id], foundationPrediction: answer, foundationPredictionChecked: true, foundationPredictionCorrect: correct};
    saveState();
    renderCompletionChecklist(unit);
  });
  editor?.addEventListener('input', () => {
    state.practices[unit.id] = {...state.practices[unit.id], foundationCode: editor.value, completionDigest: ''};
    scheduleSaveState();
  });
  container.querySelector('[data-reset-foundation]')?.addEventListener('click', () => {
    editor.value = lesson.code;
    editor.dispatchEvent(new Event('input'));
    container.querySelector('.run-result').className = 'run-result hidden';
  });
  container.querySelectorAll('[data-run-foundation]').forEach((button) => button.addEventListener('click', async (event) => {
    const submittedCode = editor.value;
    const payload = await runCode(event.currentTarget, container, unit.id);
    const result = container.querySelector('.foundation-code-shell .run-result');
    result.querySelector('.raw-run-details').open = Boolean(payload?.ok);
    if (!payload?.ok) return;
    const baseline = submittedCode.trim() === lesson.code.trim();
    const evidence = baseline
      ? {foundationBaselineRan: true, foundationBaselineDigest: payload.artifactDigest, foundationBaselineRunProof: payload.runProof}
      : {foundationChangedRan: true, foundationChangedCode: submittedCode, foundationChangedDigest: payload.artifactDigest, foundationChangedRunProof: payload.runProof};
    state.practices[unit.id] = {...state.practices[unit.id], ...evidence, foundationCode: submittedCode, foundationRan: true};
    saveState();
    renderCompletionChecklist(unit);
    container.querySelector('.foundation-explanation').open = true;
  }));
}

function bindCodeLesson(container, unit) {
  const lesson = codeLessonFor(unit);
  const explanation = container.querySelector('.step-explanation');
  container.querySelectorAll('[data-code-step]').forEach((button) => button.addEventListener('click', () => {
    const step = lesson.steps[Number(button.dataset.codeStep)];
    container.querySelectorAll('[data-code-step]').forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    if (explanation) explanation.textContent = step.explanation;
    const details = container.querySelector('.full-code');
    if (details) details.open = true;
    const [start, end] = step.lines || [];
    container.querySelectorAll('[data-code-line]').forEach((line) => {
      const number = Number(line.dataset.codeLine);
      line.classList.toggle('focused', Boolean(start && number >= start && number <= end));
    });
  }));
  container.querySelector('.copy-code')?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(container.querySelector('.code-editor')?.value || unit.code);
    showToast('代码已复制');
  });
  container.querySelectorAll('[data-agent-prediction]').forEach((choice) => choice.addEventListener('change', () => {
    state.practices[unit.id] = {...state.practices[unit.id], agentPrediction: choice.value};
    container.querySelector('[data-run-unit]').disabled = false;
    saveState();
  }));
  container.querySelectorAll('[data-run-unit]').forEach((button) => button.addEventListener('click', async () => {
    const details = button.closest('.full-code');
    if (details) details.open = true;
    const payload = await runCode(button, container, button.dataset.runUnit);
    if (payload?.ok && unit.quickstartLab) {
      const prediction = state.practices[unit.id]?.agentPrediction;
      state.practices[unit.id] = {...state.practices[unit.id], quickstartOk: true};
      saveState();
      container.querySelector('.agent-state-track')?.classList.add('verified');
      container.querySelectorAll('.agent-state-track li').forEach((item) => item.classList.add('done'));
      renderCompletionChecklist(unit);
      const guide = button.closest('.lab-callout')?.querySelector('.failure-guide');
      if (guide) guide.textContent = `${prediction === '0' ? '你预测对了：' : '实际答案是 0：'}模型只生成并校验草稿，确认前订单列表不会新增记录。`;
    }
  }));
  const editor = container.querySelector('.code-editor');
  if (editor) bindEditorSync(editor, unit.codeKind || 'go');
  container.querySelector('[data-code-step]')?.click();
  const initialDetails = container.querySelector('.full-code');
  if (initialDetails) initialDetails.open = true;
}

function renderCode(unit) {
  const card = $('#codeCard');
  if (!unit.code) {
    card.classList.remove('hidden');
    card.innerHTML = `<div class="verification-workbench"><p class="code-first-label">本课不写新代码</p><h2>用命令和验收结果确认</h2><p>${richText(unit.task || unit.goal || '按页面中的检查步骤完成验证。')}</p><div><b>完成时应该看到</b><p>${richText(unit.accept || '检查命令通过，且结果符合当前边界。')}</p></div>${unit.verificationCommand ? `<pre><code>${esc(unit.verificationCommand)}</code></pre>` : ''}</div>`;
    return;
  }
  card.classList.remove('hidden');
  if (unit.foundationLesson) {
    card.innerHTML = foundationLessonHtml(unit);
    bindFoundationLesson(card, unit);
    return;
  }
  const quickstartPrediction = state.practices[unit.id]?.agentPrediction;
  const quickstartDone = Boolean(state.practices[unit.id]?.quickstartOk);
  const quickstartTrace = `<ol class="agent-state-track ${quickstartDone ? 'verified' : ''}" aria-label="Agent 状态轨迹"><li class="${quickstartDone ? 'done' : ''}"><span>1</span><b>收到输入</b><small>奶茶 12 元</small></li><li class="${quickstartDone ? 'done' : ''}"><span>2</span><b>生成草稿</b><small>还未保存</small></li><li class="${quickstartDone ? 'done' : ''}"><span>3</span><b>Go 校验</b><small>检查金额与字段</small></li><li class="${quickstartDone ? 'done' : ''}"><span>4</span><b>等待确认</b><small>订单数仍为 0</small></li></ol>`;
  const quickstart = unit.quickstartLab ? `<div class="lab-callout agent-quickstart stage-understand"><div><b>${esc(unit.quickstartLab.title)}</b><span>${esc(unit.quickstartLab.description)}</span></div><fieldset class="agent-prediction"><legend>先猜：模型生成草稿后，订单列表新增了几条？</legend><label><input type="radio" name="agent-prediction" data-agent-prediction value="0" ${quickstartPrediction === '0' ? 'checked' : ''}>0 条</label><label><input type="radio" name="agent-prediction" data-agent-prediction value="1" ${quickstartPrediction === '1' ? 'checked' : ''}>1 条</label><label><input type="radio" name="agent-prediction" data-agent-prediction value="unknown" ${quickstartPrediction === 'unknown' ? 'checked' : ''}>还不能确定</label></fieldset>${quickstartTrace}<div><button class="run-code lab-run" data-run-unit="${esc(unit.quickstartLab.id)}" data-run-label="${esc(unit.quickstartLab.buttonLabel)}" data-success-guide="${esc(unit.quickstartLab.successGuide || '')}" ${quickstartPrediction ? '' : 'disabled'}>${esc(unit.quickstartLab.buttonLabel)}</button><a href="${esc(unit.quickstartLab.path)}" target="_blank">查看完整项目</a></div><div class="run-result ${quickstartDone ? 'success' : 'hidden'}" aria-live="polite"><div><b>最小闭环证据</b><span></span></div><p class="failure-guide">${quickstartDone ? '四个状态已验证：确认前订单列表仍为 0。' : ''}</p><details class="raw-run-details" open><summary>查看测试输出</summary><pre>${quickstartDone ? '上次运行已通过；可再次运行刷新证据。' : ''}</pre></details></div></div>` : '';
  const lab = unit.kind === 'chapter' && unit.number >= 19 ? `<div class="lab-callout"><div><b>第 19–24 章共用的基础实验</b><span>只验证审批、绑定、Unknown 对账、重复调用和回执摘要；不代表本章全部架构已实现。</span></div><div><button class="run-code lab-run" data-run-unit="harness-lab">运行实验</button><a href="labs/harness-lab/harness_test.go" target="_blank">查看测试代码</a></div><div class="run-result hidden" aria-live="polite"><div><b>运行结果</b><span></span></div><pre></pre></div></div>` : '';
  card.innerHTML = quickstart ? `${quickstart}<div class="quickstart-code-detail stage-read">${codeLessonHtml(unit)}</div>${lab}` : codeLessonHtml(unit) + lab;
  bindCodeLesson(card, unit);
}

function configureUnitStages(unit) {
  const foundation = Boolean(unit.foundationLesson);
  const quickstart = Boolean(unit.quickstartLab);
  $('#unitView').classList.toggle('foundation-mode', foundation);
  const codeCard = $('#codeCard');
  codeCard.classList.toggle('quickstart-mode', quickstart);
}

function renderTechnical(unit) {
  const principles = unit.principles || [];
  const pitfalls = unit.pitfalls || [];
  $('#technicalCard').innerHTML = `<div class="section-heading"><h3>要理解的规则</h3><small>结合下一步示例逐条确认</small></div><ul class="bullet-list">${principles.map((item) => `<li>${richText(item)}</li>`).join('')}</ul><details><summary>常见错误</summary>${pitfalls.length ? `<ul class="bullet-list">${pitfalls.map((item) => `<li>${richText(item)}</li>`).join('')}</ul>` : '<p class="muted">本补页不另起炉灶，先把上一个边界钉牢。</p>'}</details>`;
}

function quizHtml(unit) {
  return (unit.selfCheck || []).map((quiz, index) => {
    const key = `${unit.id}:${index}`;
    const response = state.responses[key];
    const hasResponse = Number.isInteger(response);
    const correct = hasResponse && response === quiz.correctIndex;
    const choices = quiz.choices.map((choice, choiceIndex) => `<label><input type="radio" name="${esc(key)}" value="${choiceIndex}" ${response === choiceIndex ? 'checked' : ''}><span>${richText(quiz.choiceLabels?.[choiceIndex] || choice)}</span></label>`).join('');
    const reason = quiz.feedback?.[response] || '';
    const feedback = hasResponse ? `<b>${correct ? '答对了' : '还差一步'}</b>${!correct && reason ? `<p>${richText(reason)}</p>` : ''}<p>${richText(quiz.answer)}</p>` : '';
    return `<fieldset class="quiz-item ${state.wrong.includes(key) ? 'review' : ''} ${hasResponse ? 'open' : ''}" data-quiz="${index}" data-key="${key}" tabindex="-1"><legend class="quiz-question">${index + 1}. ${richText(quiz.question)}</legend><div class="quiz-choices">${choices}</div><button class="answer-button" data-submit-answer>${hasResponse ? '重新提交' : '提交答案'}</button><div class="answer" aria-live="polite">${feedback}</div></fieldset>`;
  }).join('');
}

function bindQuiz(container, unit) {
  container.querySelectorAll('[data-submit-answer]').forEach((button) => button.addEventListener('click', () => {
    const item = button.closest('.quiz-item');
    const index = Number(item.dataset.quiz);
    const selected = item.querySelector('input:checked');
    if (!selected) { showToast('先选一个答案'); return; }
    const quiz = unit.selfCheck[index];
    const correct = Number(selected.value) === quiz.correctIndex;
    const key = item.dataset.key;
    state.responses[key] = Number(selected.value);
    state.wrong = state.wrong.filter((value) => value !== key);
    if (correct) state.answered.add(key);
    else {
      state.answered.delete(key); state.wrong.push(key); state.completed.delete(unit.id);
      if (!state.reviewHistory.includes(key)) state.reviewHistory.push(key);
    }
    item.classList.toggle('review', !correct);
    item.classList.add('open');
    const reason = quiz.feedback?.[Number(selected.value)] || '';
    item.querySelector('.answer').innerHTML = `<b>${correct ? '答对了' : '还差一步'}</b>${!correct && reason ? `<p>${richText(reason)}</p>` : ''}<p>${richText(quiz.answer)}</p>`;
    saveState(); renderNav();
    renderCompletionChecklist(unit);
    showToast(correct ? '答对了，结果已保存' : '已加入复习，看看解析再试一次');
  }));
}

function renderExercise(unit) {
  const saved = state.practices[unit.id];
  const supplementExercise = hasRunnableSupplementExercise(unit) ? {
    title: '让四种结账测试真正跑起来',
    prompt: '先运行原测试，再改动一个期望值观察失败；恢复后补一条边界用例，让整组测试重新通过。',
    testIntent: unit.accept,
    code: unit.code,
    hints: ['先直接运行，确认四个 t.Run 场景都能执行。', '把 change 场景的 wantChange 暂时改错，观察失败用例名，再恢复。'],
    failureHint: '先看失败的子测试名称，再对照输入、期望找零和错误类型。',
    runnerUnitId: unit.id,
  } : null;
  const exercise = unit.projectExercise || unit.workshop?.codeExercise || supplementExercise;
  const resultId = `run-result-${unit.id}`;
  const hintHtml = exercise?.hints?.length ? `<div class="exercise-hints"><p>卡住时只展开一条，回到代码再试。</p>${exercise.hints.map((hint, i) => `<details><summary>提示 ${i + 1}</summary><p>${richText(hint)}</p></details>`).join('')}</div>` : '';
  const m1Bridge = unit.id === 'supplement-go-ai-01' ? `<div class="concept-bridge"><b>从第 17 章到 Provider，只多三步</b><ol><li>父 context 表示“这次请求还要不要继续”。</li><li><code>context.WithTimeout</code> 给它加一个最晚结束时间。</li><li>把新 ctx 传给 Provider，返回后再检查是否已过期。</li></ol><p>本题只改这两处：派生带超时的 ctx，并把它传给 <code>Provider.Decide</code>。</p></div>` : '';
  const codeExercise = exercise ? `<div class="code-exercise" data-code-exercise>${m1Bridge}<div><h3>${esc(exercise.title)}</h3><p>${richText(exercise.prompt)}</p><p class="test-intent"><b>固定测试会检查什么：</b>${richText(exercise.testIntent || '')}</p></div><textarea class="code-editor" aria-label="${esc(exercise.title)}代码编辑器" aria-describedby="${resultId}" spellcheck="false" wrap="off">${esc(saved?.code || exercise.code)}</textarea>${hintHtml}<div class="code-actions"><button class="run-code" data-run-exercise>运行固定测试</button><button class="text-button" data-reset-exercise>恢复初始代码</button></div><div id="${resultId}" class="run-result ${saved?.codeOk ? 'success' : 'hidden'}" aria-live="polite" tabindex="-1"><div><b>测试结果</b><span>${saved?.codeOk ? esc(saved.codeDigest) : ''}</span></div><p class="failure-guide"></p><details class="raw-run-details" ${saved?.codeOk ? 'open' : ''}><summary>查看测试输出或原始日志</summary><pre>${saved?.codeOk ? '这份代码已通过测试；修改后需要重新运行。' : ''}</pre></details></div></div>` : '';
  const resumePitch = `这个示例项目用 Go 接收请求、调用模型、检查模型返回的数据，再决定是否执行工具。
练习包括：拒绝不合法的输入、处理重复请求、限制同时运行的任务，以及保留能用于排查问题的记录。
介绍自己的实现时，应写清实际完成了哪些功能、运行了哪些测试。没有测过的性能或可靠性不要当成结果。`;
  const capstone = unit.workshop?.capstone ? `<section class="capstone-brief"><p class="code-first-label">完整项目练习</p><h3>${esc(unit.workshop.capstone.title)}</h3><p class="capstone-desc">${richText(unit.workshop.capstone.brief)}</p><div class="capstone-actions"><a href="${esc(unit.workshop.capstone.downloadUrl || 'downloads/ledger-agent-starter.zip')}" download class="capstone-download-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>下载完整工程 Starter (${esc(unit.workshop.capstone.downloadName || 'ledger-agent-starter.zip')})</a><span class="capstone-tag">Go 1.24+ · 纯标准库 · 独立微服务</span></div><details class="capstone-extension"><summary>结业扩展：架构、交付清单与复盘</summary><div class="capstone-arch"><h4>系统架构与全链路装配</h4><ul>${(unit.workshop.capstone.architecture || []).map((item) => `<li>${richText(item)}</li>`).join('')}</ul></div><div class="capstone-checklist"><h4>交付与验收清单</h4><ol>${unit.workshop.capstone.deliverables.map((item) => `<li>${richText(item)}</li>`).join('')}</ol></div><div class="capstone-resume-body"><pre class="capstone-resume-text">${esc(resumePitch)}</pre><button class="copy-resume-btn" type="button">复制技术架构要点</button></div></details></section>` : '';
  const fieldsHtml = unit.workshop ? `<div class="workshop-fields">${unit.workshop.fields.map((field, index) => `<label><b>${index + 1}. ${esc(field.label)}</b>${field.kind === 'text' ? `<textarea data-workshop-field="${index}" rows="3" placeholder="${esc(field.placeholder)}">${esc(saved?.answers?.[index] || '')}</textarea>` : `<select data-workshop-field="${index}"><option value="">请选择</option>${field.options.map((option, optionIndex) => `<option value="${esc(option)}" ${saved?.answers?.[index] === option ? 'selected' : ''}>${esc(field.optionLabels?.[optionIndex] || option)}</option>`).join('')}</select>`}</label>`).join('')}</div><button class="answer-button" data-submit-workshop>检查我的选择</button><div class="workshop-result ${saved?.workshopOk ? 'success' : ''}" aria-live="polite">${saved?.workshopOk ? `<b>已通过</b><span>${esc(saved.workshopDigest)}</span>` : ''}</div>` : '';
  const guidedPractice = unit.id === 'chapter-24' ? `<details class="capstone-extension guided-review"><summary>选做复盘：审批、缓存与上线证据</summary>${fieldsHtml}</details>` : fieldsHtml;
  const labOutcome = {
    'supplement-go-ai-02': ['多余 JSON 字段', '拒绝解析，不执行工具'],
    'supplement-go-ai-04': ['越出指定根目录', '阻断路径，不读取文件'],
    'supplement-go-ai-08': ['容量已满时的第二请求', '立即返回 429，不隐藏排队'],
  }[unit.id];
  const outcomePanel = labOutcome ? `<div class="milestone-outcome ${saved?.codeOk ? 'verified' : ''}"><span>${saved?.codeOk ? '已验证' : '运行后验证'}</span><b>${esc(labOutcome[0])}</b><strong>${esc(labOutcome[1])}</strong></div>` : '';
  const capstonePath = unit.id === 'chapter-24' ? `<ol class="capstone-path ${saved?.labOk ? 'verified' : ''}" aria-label="订单 Agent 总装轨迹"><li>输入</li><li>草稿</li><li>确认</li><li>订单</li><li>回执</li></ol><p class="capstone-receipt">${saved?.labOk ? '回执已生成：同一订单只保存一次，摘要可重新计算。' : '通过最终测试后，这里会显示完整回执。'}</p>` : '';
  const projectLab = unit.projectLab ? (unit.kind === 'chapter'
    ? `<div class="project-lab" data-project-lab><div><p class="code-first-label">在完整项目中试一试</p><h3>${esc(unit.projectLab.title)}</h3><p>把你写的函数放进示例项目，再运行本节对应的测试。</p></div>${capstonePath}<div class="project-lab-actions"><button class="run-code" data-run-project="${esc(unit.projectLab.id)}">运行项目测试</button><a href="${esc(unit.projectLab.path)}" target="_blank">查看项目源码</a></div><div class="run-result ${saved?.labOk ? 'success' : 'hidden'}" aria-live="polite" tabindex="-1"><div><b>项目测试</b><span>${saved?.labOk ? esc(saved.labDigest) : ''}</span></div><p class="failure-guide">${saved?.labOk ? '已通过完整链路测试。' : ''}</p><details class="raw-run-details" ${saved?.labOk ? 'open' : ''}><summary>查看项目测试输出</summary><pre>${saved?.labOk ? '测试通过，结果已保存。' : ''}</pre></details></div></div>`
    : `<div class="project-lab milestone-proof"><div><p class="code-first-label">一次运行，两层证据</p><h3>${esc(unit.projectLab.title)}</h3><p>上方“运行固定测试”会同时运行当前函数契约和真实项目里程碑，不需要再等第二次。</p></div>${outcomePanel}<div class="project-lab-actions"><a href="${esc(unit.projectLab.path)}" target="_blank">查看项目源码</a></div></div>`)
    : '';
  const workshop = unit.workshop ? (unit.foundationLesson
    ? `<div class="workshop foundation-independent-practice"><div><h3>${esc(unit.workshop.title)}</h3><p>${richText(unit.workshop.prompt)}</p></div>${codeExercise}</div>`
    : `<div class="workshop" data-workshop><div><h3>${esc(unit.workshop.title)}</h3><p>${richText(unit.workshop.prompt)}</p></div>${capstone}${codeExercise}${guidedPractice}</div>`)
    : '';
  const projectExercise = unit.projectExercise || supplementExercise ? codeExercise : '';
  const wailsPractice = unit.wailsPractice ? `<section class="wails-go-practice" data-wails-go-practice>
    <header><div><p class="code-first-label">选做 · Wails + React 语法迁移 · ${esc(unit.wailsPractice.step)}</p><h3>${esc(unit.wailsPractice.title)}</h3><p>本节过关不要求再跑一次；想看桌面界面如何调用同一个 Go 方法时再做。</p></div><span class="wails-go-badge">主学 Go</span></header>
    <div class="wails-layer-grid"><div><b>Go 要掌握</b><p>${esc(unit.wailsPractice.goFocus)}</p></div><div><b>Wails 只连接</b><p>${esc(unit.wailsPractice.wailsRole)}</p></div><div><b>React 只展示</b><p>${esc(unit.wailsPractice.reactRole)}</p></div></div>
    <div class="wails-observe"><b>这次看什么</b><p>${esc(unit.wailsPractice.observe)}</p></div>
    <div class="wails-go-actions"><button class="run-code" data-run-wails="${esc(unit.wailsPractice.id)}" data-run-label="运行本节 Go 测试">运行本节 Go 测试</button><a href="${esc(unit.wailsPractice.reactExample)}" target="_blank">查看 React 调用</a><a href="${esc(unit.wailsPractice.path)}WAILS_REACT.md" target="_blank">查看桌面连接</a></div>
    <div class="run-result hidden" aria-live="polite" tabindex="-1"><div><b>Go 语法测试</b><span></span></div><p class="failure-guide"></p><details class="raw-run-details" open><summary>查看 go test 输出</summary><pre></pre></details></div>
  </section>` : '';
  $('#exerciseCard').innerHTML = `<div class="section-heading"><h2>${hasRunnableSupplementExercise(unit) ? '自己写测试' : isReadingSupplement(unit) ? '阅读回顾' : '自己试一试'}</h2><small>${hasRunnableSupplementExercise(unit) ? '真实 go test 结果与答题记录分别保存' : isReadingSupplement(unit) ? '回顾不计入工程掌握进度' : '运行结果与答题记录分别保存'}</small></div><div class="pitfall-grid"><div class="pitfall-panel"><h3>跟着做</h3><p>${richText(lessonBriefs[unit.id]?.task || unit.task)}</p></div><div class="task-panel"><h3>怎样检查自己做对了</h3><p>${richText(unit.accept)}</p></div></div>${projectExercise}${projectLab}${workshop}${wailsPractice}<div class="quiz-list">${quizHtml(unit)}</div>`;
  bindQuiz($('#exerciseCard'), unit);
  $('#exerciseCard').querySelector('[data-run-wails]')?.addEventListener('click', (event) => {
    runCode(event.currentTarget, event.currentTarget.closest('[data-wails-go-practice]'), event.currentTarget.dataset.runWails).then((payload) => {
      if (!payload?.ok) return;
      state.practices[unit.id] = {...state.practices[unit.id], wailsOk: true};
      saveState();
      renderCompletionChecklist(unit);
    });
  });
  $('#exerciseCard').querySelector('.copy-resume-btn')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(resumePitch);
      showToast('项目技术亮点已复制到剪贴板');
    } catch (_e) {
      showToast('复制失败，请手动选择复制');
    }
  });
  const workshopRoot = $('#exerciseCard').querySelector('[data-workshop]');
  workshopRoot?.querySelectorAll('[data-workshop-field]').forEach((field) => field.addEventListener(field.tagName === 'SELECT' ? 'change' : 'input', () => {
    state.practices[unit.id] = {...state.practices[unit.id], workshopOk: false, answers: []};
    state.completed.delete(unit.id);
    workshopRoot.querySelector('.workshop-result').innerHTML = '';
    workshopRoot.querySelector('.workshop-result').className = 'workshop-result';
    saveState(); renderNav();
  }));
  workshopRoot?.querySelector('[data-submit-workshop]')?.addEventListener('click', async (event) => {
    const submitButton = event.currentTarget;
    const answers = [...workshopRoot.querySelectorAll('[data-workshop-field]')].map((field) => field.value);
    if (answers.some((answer) => !answer)) { showToast('三步都要选择'); return; }
    const mutableFields = [...workshopRoot.querySelectorAll('[data-workshop-field]')];
    mutableFields.forEach((field) => { field.disabled = true; });
    submitButton.disabled = true;
    const result = workshopRoot.querySelector('.workshop-result');
    try {
      const response = await fetch('/api/check', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({unitId: unit.id, answers})});
      const payload = await response.json();
      const unchanged = mutableFields.every((field, index) => field.value === answers[index]);
      if (!unchanged) throw new Error('stale workshop response');
      result.className = `workshop-result ${payload.ok ? 'success' : 'failure'}`;
      result.innerHTML = `<b>${payload.ok ? '已通过' : '还没过关'}</b><span>${esc(payload.message)}</span>`;
      if (payload.ok) state.practices[unit.id] = {...state.practices[unit.id], workshopOk: true, answers, workshopDigest: payload.artifactDigest, workshopVerifierVersion: payload.verifierVersion};
      else { state.practices[unit.id] = {...state.practices[unit.id], workshopOk: false, answers: []}; state.completed.delete(unit.id); }
      saveState(); renderNav(); renderCompletionChecklist(unit);
    } catch (error) {
      result.className = 'workshop-result failure';
      result.innerHTML = error.message === 'stale workshop response' ? '<b>内容已改变</b><span>旧验收结果已丢弃，请重新提交。</span>' : '<b>验收器未启动</b><span>请使用 run-preview.sh 打开教材。</span>';
    } finally { submitButton.disabled = false; mutableFields.forEach((field) => { field.disabled = false; }); }
  });
  const codeRoot = $('#exerciseCard').querySelector('[data-code-exercise]');
  const editor = codeRoot?.querySelector('.code-editor');
  if (editor) bindEditorSync(editor, 'go');
  editor?.addEventListener('input', () => {
    state.practices[unit.id] = {...state.practices[unit.id], code: editor.value, codeOk: false, codeDigest: '', runProof: '', completionDigest: ''};
    state.completed.delete(unit.id);
    scheduleSaveState();
    renderCompletionChecklist(unit);
  });
  codeRoot?.querySelector('[data-reset-exercise]')?.addEventListener('click', () => {
    editor.value = exercise.code;
    editor.dispatchEvent(new Event('input'));
  });
  codeRoot?.querySelector('[data-run-exercise]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const result = codeRoot.querySelector('.run-result');
    const submittedCode = editor.value;
    button.disabled = true; editor.disabled = true; button.textContent = '测试中…';
    result.className = 'run-result'; result.querySelector('pre').textContent = '正在编译并运行固定测试…';
    const startedAt = Date.now();
    const progressTimer = setInterval(() => {
      const seconds = Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
      result.querySelector('pre').textContent = seconds < 4
        ? `正在编译并运行固定测试… ${seconds}s`
        : `仍在运行真实 Go 测试… ${seconds}s（Agent 首次运行通常需要 8-15 秒）`;
    }, 1000);
    try {
      const response = await fetch('/api/run', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unitId:exercise.runnerUnitId || `exercise-${unit.id}`,code:submittedCode})});
      const payload = await response.json();
      if (editor.value !== submittedCode) throw new Error('stale code response');
      result.classList.add(payload.ok ? 'success' : 'failure');
      result.querySelector('.failure-guide').textContent = payload.ok ? '通过：这份代码已经过本章固定测试。' : `${diagnoseGoFailure(payload.output)} ${exercise.failureHint}`;
      result.querySelector('.raw-run-details').open = Boolean(payload.ok);
      result.querySelector('pre').textContent = payload.output || (payload.ok ? 'PASS' : '测试失败');
      result.querySelector('span').textContent = `${payload.command || 'go test'} · ${payload.durationMs ?? 0}ms`;
      state.practices[unit.id] = {
        ...state.practices[unit.id],
        codeOk: payload.ok,
        codeChanged: submittedCode.trim() !== exercise.code.trim(),
        codeFailureSeen: Boolean(state.practices[unit.id]?.codeFailureSeen || !payload.ok),
        code: submittedCode,
        codeDigest: payload.artifactDigest,
        runProof: payload.runProof,
        codeVerifierVersion: payload.verifierVersion,
      };
      if (!payload.ok) state.completed.delete(unit.id);
      if (payload.ok) {
        const outcome = $('#exerciseCard').querySelector('.milestone-outcome');
        outcome?.classList.add('verified');
        if (outcome?.querySelector('span')) outcome.querySelector('span').textContent = '已验证';
      }
      saveState(); renderNav(); renderCompletionChecklist(unit);
    } catch (error) { result.classList.add('failure'); result.querySelector('.failure-guide').textContent = '先确认预览服务已启动，再重新运行。'; result.querySelector('pre').textContent = error.message === 'stale code response' ? '代码已改变，旧测试结果已丢弃。' : '运行服务未启动，请使用 run-preview.sh。'; }
    finally { clearInterval(progressTimer); button.disabled = false; editor.disabled = false; button.textContent = '运行固定测试'; }
  });
  const projectRoot = $('#exerciseCard').querySelector('[data-project-lab]');
  projectRoot?.querySelector('[data-run-project]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const result = projectRoot.querySelector('.run-result');
    button.disabled = true; button.textContent = '运行中…';
    result.className = 'run-result'; result.querySelector('pre').textContent = '正在运行正常、并发、安全与恢复测试…';
    try {
      const response = await fetch('/api/run', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unitId:button.dataset.runProject,code:editor?.value || ''})});
      const payload = await response.json();
      result.classList.add(payload.ok ? 'success' : 'failure');
      result.querySelector('span').textContent = `${payload.command || 'go test'} · ${payload.durationMs ?? 0}ms`;
      result.querySelector('pre').textContent = payload.output || (payload.ok ? 'PASS' : '测试失败');
      const failureGuide = result.querySelector('.failure-guide');
      if (failureGuide) failureGuide.textContent = payload.ok
        ? '通过：这份代码已经过完整项目测试。'
        : (unit.id === 'chapter-24'
          ? `先完成上方 StartOrResume 的 TODO，再运行总装。${diagnoseGoFailure(payload.output)}`
          : `${diagnoseGoFailure(payload.output)} 先修复当前里程碑的 TODO，再重试完整实验。`);
      state.practices[unit.id] = {...state.practices[unit.id], labOk: payload.ok, labDigest: payload.artifactDigest, labRunProof: payload.runProof, labVerifierVersion: payload.verifierVersion};
      if (!payload.ok) { state.completed.delete(unit.id); if (!state.reviewHistory.includes(`${unit.id}:lab`)) state.reviewHistory.push(`${unit.id}:lab`); }
      if (payload.ok) {
        projectRoot.querySelector('.milestone-outcome')?.classList.add('verified');
        const outcomeLabel = projectRoot.querySelector('.milestone-outcome span');
        if (outcomeLabel) outcomeLabel.textContent = '已验证';
        projectRoot.querySelector('.capstone-path')?.classList.add('verified');
        const receipt = projectRoot.querySelector('.capstone-receipt');
        if (receipt) receipt.textContent = '回执已生成：同一订单只保存一次，摘要可重新计算。';
      }
      saveState(); renderNav(); renderCompletionChecklist(unit);
    } catch (_error) {
      result.classList.add('failure'); result.querySelector('pre').textContent = '实验服务不可用，请从项目根目录运行 run-preview.sh。';
    } finally { button.disabled = false; button.textContent = '运行项目测试'; }
  });
}

function discardStaleEvidence() {
  if (localStorage.getItem('manga-go-version') === state.data.version) return;
  state.completed.clear(); state.answered.clear(); state.wrong = []; state.responses = {}; state.practices = {};
}

async function revalidateCompletedEvidence() {
  // Revalidate prerequisites first regardless of localStorage insertion order.
  const candidates = [...state.completed].sort((left, right) => Number(left === 'chapter-24') - Number(right === 'chapter-24'));
  for (const id of candidates) {
    const unit = state.units.find((item) => item.id === id);
    const proof = state.practices[id];
    if (!unit) { state.completed.delete(id); continue; }
    if (isReadingSupplement(unit)) { state.readSupplements.add(id); state.completed.delete(id); continue; }
    const quizKeys = (unit.selfCheck || []).map((quiz, index) => ({key: `${id}:${index}`, quiz}));
    const quizAnswers = quizKeys.map(({key}) => state.responses[key]);
    const quizzesValid = quizKeys.length > 0 && quizKeys.every(({quiz}, index) => quizAnswers[index] === quiz.correctIndex);
    if (!quizzesValid) { state.completed.delete(id); continue; }
    if (unit.kind !== 'chapter') {
      if (unit.projectLab) {
        if (!proof?.codeOk || proof.codeVerifierVersion !== state.data.version || !proof.code) { state.completed.delete(id); continue; }
        try {
          const codeResponse = await fetch('/api/run', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unitId:`exercise-${id}`,code:proof.code})});
          const codeChecked = await codeResponse.json();
          if (!codeResponse.ok || !codeChecked.ok || !codeChecked.artifactDigest || !codeChecked.runProof) throw new Error('challenge revalidation failed');
          const freshEvidence = {
            codeDigest: codeChecked.artifactDigest,
            runProof: codeChecked.runProof,
            codeVerifierVersion: codeChecked.verifierVersion,
          };
          const response = await fetch('/api/check', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unitId:id,quizAnswers,challengeDigest:freshEvidence.codeDigest,challengeRunProof:freshEvidence.runProof})});
          const checked = await response.json();
          if (!response.ok || !checked.ok || !checked.completionDigest) throw new Error('completion revalidation failed');
          Object.assign(proof, freshEvidence, {completionDigest: checked.completionDigest});
        } catch (_error) { state.completed.delete(id); continue; }
      }
      quizKeys.forEach(({key}) => state.answered.add(key));
      state.completed.add(id);
      continue;
    }
    if (unit.foundationLesson) {
      if (!proof?.foundationBaselineRan || !proof.foundationChangedRan || !proof.foundationChangedCode || !proof.codeOk || proof.codeVerifierVersion !== state.data.version || !proof.code) { state.completed.delete(id); continue; }
      try {
        const baselineResponse = await fetch('/api/run', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unitId:id,code:unit.foundationLesson.code})});
        const baseline = await baselineResponse.json();
        const changedResponse = await fetch('/api/run', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unitId:id,code:proof.foundationChangedCode})});
        const changed = await changedResponse.json();
        const codeResponse = await fetch('/api/run', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unitId:`exercise-${id}`,code:proof.code})});
        const codeChecked = await codeResponse.json();
        if (!baseline.ok || !changed.ok || !codeChecked.ok || baseline.artifactDigest === changed.artifactDigest) throw new Error('foundation evidence invalid');
        const freshEvidence = {
          foundationBaselineDigest: baseline.artifactDigest, foundationBaselineRunProof: baseline.runProof,
          foundationChangedDigest: changed.artifactDigest, foundationChangedRunProof: changed.runProof,
          codeDigest: codeChecked.artifactDigest, runProof: codeChecked.runProof,
        };
        const response = await fetch('/api/check', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unitId:id,quizAnswers,foundationPrediction:proof.foundationPrediction,...freshEvidence})});
        const checked = await response.json();
        if (!response.ok || !checked.ok || !checked.completionDigest) throw new Error('foundation completion invalid');
        Object.assign(proof, freshEvidence, {completionDigest: checked.completionDigest});
        quizKeys.forEach(({key}) => state.answered.add(key));
        state.completed.add(id);
      } catch (_error) { state.completed.delete(id); }
      continue;
    }
    if (unit.id === 'chapter-24') {
      const milestones = AI_ROUTE_IDS.filter((item) => item.startsWith('supplement-go-ai-'));
      if (!milestones.every((item) => state.completed.has(item))) { state.completed.delete(id); continue; }
      if (!proof?.codeOk || !proof.code || proof.codeVerifierVersion !== state.data.version || !proof.labOk || proof.labVerifierVersion !== state.data.version) { state.completed.delete(id); continue; }
      try {
        const challengeResponse = await fetch('/api/run', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unitId:'exercise-chapter-24',code:proof.code})});
        const challenge = await challengeResponse.json();
        const labResponse = await fetch('/api/run', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unitId:'ledger-agent-lab/capstone',code:proof.code})});
        const lab = await labResponse.json();
        if (!challengeResponse.ok || !challenge.ok || !challenge.artifactDigest || !challenge.runProof || !labResponse.ok || !lab.ok || !lab.artifactDigest || !lab.runProof) throw new Error('capstone evidence invalid');
        const response = await fetch('/api/check', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
          unitId:id, quizAnswers,
          challengeDigest:challenge.artifactDigest, challengeRunProof:challenge.runProof,
          codeDigest:lab.artifactDigest, runProof:lab.runProof,
        })});
        const checked = await response.json();
        if (!response.ok || !checked.ok || !checked.completionDigest) throw new Error('capstone completion invalid');
        Object.assign(proof, {
          codeDigest:challenge.artifactDigest, runProof:challenge.runProof, codeVerifierVersion:challenge.verifierVersion,
          labDigest:lab.artifactDigest, labRunProof:lab.runProof, labVerifierVersion:lab.verifierVersion,
          completionDigest:checked.completionDigest,
        });
        quizKeys.forEach(({key}) => state.answered.add(key));
        state.completed.add(id);
      } catch (_error) { state.completed.delete(id); }
      continue;
    }
    if (!proof?.workshopOk || proof.workshopVerifierVersion !== state.data.version || !proof.completionDigest) { state.completed.delete(id); continue; }
    try {
      if (unit.workshop?.codeExercise) {
        if (!proof.codeOk || proof.codeVerifierVersion !== state.data.version || !proof.code) { state.completed.delete(id); continue; }
        const codeResponse = await fetch('/api/run', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unitId:`exercise-${id}`,code:proof.code})});
        const codeChecked = await codeResponse.json();
        if (!codeChecked.ok || codeChecked.artifactDigest !== proof.codeDigest) { state.completed.delete(id); continue; }
        proof.runProof = codeChecked.runProof;
      }
      const response = await fetch('/api/check', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unitId:id,answers:proof.answers,quizAnswers,codeDigest:proof.codeDigest || '',runProof:proof.runProof || ''})});
      const checked = await response.json();
      if (!checked.ok || checked.artifactDigest !== proof.workshopDigest || checked.completionDigest !== proof.completionDigest) { state.completed.delete(id); continue; }
      quizKeys.forEach(({key}) => state.answered.add(key));
      state.completed.add(id);
    } catch (_error) { state.completed.delete(id); }
  }
  saveState();
  renderNav();
  if (!$('#unitView').classList.contains('hidden')) renderCompletionControls();
}

function supplementHtml(supplement) {
  const chat = dialogueHtml(state.data, supplement.dialogue);
  const glossary = supplement.glossary.length ? `<ul class="glossary-list">${supplement.glossary.slice(0, 5).map(({term, meaning}) => `<li><b>${esc(term)}</b><span>${richText(meaning)}</span></li>`).join('')}</ul>` : '<p class="muted">这一节先不加新词，重点看它如何收住上一处事故。</p>';
  const code = supplement.code ? `<section class="code-card supplement-code">${codeLessonHtml(supplement)}</section>` : '';
  return `<details class="supplement-card" id="${esc(supplement.id)}"><summary>选修补页 · ${esc(supplement.title)} <span>＋</span></summary><div class="supplement-inner"><div class="incident-card"><div class="card-kicker">${richText(supplement.kicker)}</div>${supplement.opening.map((p) => `<p>${richText(p)}</p>`).join('')}</div><div class="chat-card">${chat}<div class="chat-close"><b>回顾一下</b><span>${richText(supplement.closing)}</span></div></div><div class="memory-card"><h3>像什么</h3><p class="memory-analogy">${richText(supplement.analogy)}</p></div><div class="glossary-card"><h3>黑话翻译</h3>${glossary}</div>${code}<div class="pitfall-grid"><div class="pitfall-panel"><h3>动手</h3><p>${richText(supplement.task)}</p></div><div class="task-panel"><h3>过关</h3><p>${richText(supplement.accept)}</p></div></div><div class="quiz-list supplement-quiz">${quizHtml(supplement)}</div></div></details>`;
}

function renderSupplements(unit) {
  const supplements = unit.kind === 'chapter' ? unit.supplements.filter((item) => !item.projectLab) : [];
  $('#supplementList').innerHTML = supplements.length ? `<h3>按需查阅 · 本章补页</h3><p>补页不影响主线进度，阅读后可以返回本章。</p>${supplements.map((item) => `<button class="nav-item" data-supplement="${esc(item.id)}">${esc(item.title)}${state.readSupplements.has(item.id) ? ' · 已阅读' : ''} →</button>`).join('')}` : '';
  $('#supplementList').querySelectorAll('[data-supplement]').forEach((button) => button.addEventListener('click', () => {
    state.supplementOrigin = {
      unitId: unit.id,
      scrollY: window.scrollY,
      anchor: 'supplementList',
      anchorTop: document.getElementById('supplementList')?.getBoundingClientRect().top ?? 0,
      task: currentLessonTask,
      pane: mobileLessonPane,
    };
    sessionStorage.setItem('manga-go-supplement-origin', JSON.stringify(state.supplementOrigin));
    openUnit(button.dataset.supplement, null, {preserveSupplementOrigin: true});
  }));
}

function returnFromSupplement(unit = state.units[state.currentIndex]) {
  const parent = parentChapter(unit);
  if (!parent) return false;
  const origin = state.supplementOrigin?.unitId === parent.id ? state.supplementOrigin : null;
  state.supplementOrigin = null;
  sessionStorage.removeItem('manga-go-supplement-origin');
  openUnit(origin?.unitId || parent.id, origin?.task || 'practice', {restoreY: origin?.scrollY ?? null, restorePosition: origin});
  if (origin?.pane && lessonPaneMedia.matches) setLessonPane(origin.pane);
  return true;
}

function openUnit(id, requestedTask = null, options = {}) {
  const {historyMode = 'push', restoreY = null, restorePosition = null, preserveScroll = false, preserveSupplementOrigin = false} = options;
  const index = state.units.findIndex((unit) => unit.id === id);
  if (index < 0) return;
  if (state.routeMode === 'wails' && !WAILS_ROUTE_IDS.includes(id)) setRouteMode('main');
  const previousID = state.units[state.currentIndex]?.id;
  state.currentIndex = index;
  const unit = state.units[index];
  const workspace = $('#lessonWorkspace');
  if (previousID !== unit.id && workspace) workspace.style.minHeight = '';
  const practiceTaskLabel = document.querySelector('[data-lesson-task="practice"]');
  if (practiceTaskLabel) {
    practiceTaskLabel.querySelector('b').textContent = isReadingSupplement(unit) && !hasRunnableSupplementExercise(unit) ? '回顾确认' : '动手过关';
    practiceTaskLabel.querySelector('small').textContent = isReadingSupplement(unit) && !hasRunnableSupplementExercise(unit) ? '要点回顾 + 自测' : '独立任务 + 固定测试';
  }
  if (!preserveSupplementOrigin && isReadingSupplement(unit)) {
    state.supplementOrigin = null;
    sessionStorage.removeItem('manga-go-supplement-origin');
  }
  if (previousID !== unit.id) mobileLessonPane = 'explain';
  hideDatabaseCourse();
  $('#unitView').dataset.ready = 'false';
  $('#unitView').dataset.unitId = unit.id;
  prepareLessonPanesForRender();
  configureUnitStages(unit);
  $('#welcome').classList.add('hidden');
  $('#unitView').classList.remove('hidden');
  $('#unitVolume').textContent = state.routeMode === 'wails' && WAILS_ROUTE_IDS.includes(unit.id)
    ? 'Wails + React 路线 · 主学 Go'
    : readableVolumeTitle(unit.volume?.title || 'Go 后端与 Harness AI');
  $('#unitTitle').textContent = unit.kind === 'chapter' ? unit.shortTitle : `${unit.projectLab ? '项目里程碑' : '参考补页'} · ${unit.title}`;
  $('#unitGoal').innerHTML = unit.kind === 'chapter' ? `<b>目标：</b>${richText(unit.goal)}` : richText(unit.kicker);
  const learning = unit.learning || {level: 3, label: '进阶', required: unit.kind === 'chapter', estimatedMinutes: 20, prerequisite: ''};
  const timeLabel = learning.readingMinutes ? `阅读 ${learning.readingMinutes} 分钟 · 动手 ${learning.practiceMinutes} 分钟` : `约 ${learning.estimatedMinutes} 分钟`;
  $('#unitMeta').innerHTML = `<span>难度 ${'●'.repeat(learning.level)}${'○'.repeat(5 - learning.level)} · ${esc(learning.label)}</span><span>${unit.projectLab ? 'AI 项目' : learning.required ? '主线' : '选修参考'} · ${timeLabel}</span>`;
  const focus = unit.foundationLesson?.concepts?.join(' · ') || firstSentence(unit.goal, unit.title);
  const outcome = firstSentence(unit.accept, unit.task);
  $('#lessonContract').innerHTML = `<div><span>正在搭建 · ${esc(storyArc(unit))}</span><b>${esc(firstSentence(learning.prerequisite, '只需要上一单元的运行经验'))}</b></div><div class="current"><span>今天只学</span><b>${esc(focus)}</b></div><div><span>过关后能做</span><b>${esc(outcome)}</b></div>`;
  $('#transitionIn').innerHTML = unit.transitionIn ? `<span class="transition-tag">这次遇到的问题</span><span>${richText(unit.transitionIn)}</span>` : '';
  const parent = isReadingSupplement(unit) ? parentChapter(unit) : null;
  if (parent) {
    $('#transitionIn').innerHTML = `<button class="nav-item" data-return-chapter="${parent.id}">← 返回第 ${parent.number} 章 · ${esc(parent.shortTitle)}</button>`;
    $('#transitionIn [data-return-chapter]').addEventListener('click', () => returnFromSupplement(unit));
  }
  const nextInRoute = adjacentUnit(1);
  const hook = unit.transitionOut || unit.nextHook || '';
  $('#transitionOut').innerHTML = nextInRoute
    ? `<span class="transition-tag">接下来</span><span>${hook ? `${richText(hook)}<br>` : ''}<b>下一单元：${esc(routeLabel(nextInRoute))}</b></span>`
    : '<span class="transition-tag">路线终点</span><span><b>最终总装完成后，没有新的必修单元。</b></span>';
  renderIncident(unit); renderChat(unit); renderOverviewDiagram(unit); renderMemory(unit); renderFlow(unit); renderTechnical(unit); renderCode(unit); renderExercise(unit); renderSupplements(unit); renderNav();
  enhanceTerms(document.getElementById('unitView'), unit);
  const lessonTask = LESSON_TASKS.has(requestedTask)
    ? requestedTask
    : requestedTask === 'practice'
      ? 'practice'
      : localStorage.getItem(`manga-go-task:${unit.id}`) || 'observe';
  setStage(lessonTask, false, null, true, false);
  setLessonPane(mobileLessonPane);
  requestAnimationFrame(() => revealOnce(document.getElementById('unitView')));
  renderCompletionControls();
  localStorage.setItem('manga-go-last-unit', unit.id);
  localStorage.setItem('manga-go-last-stage', lessonTask);
  recordLastLocation({kind: 'go', id: unit.id, routeMode: state.routeMode, task: lessonTask, pane: mobileLessonPane});
  $('#continueButton').hidden = false;
  if (historyMode === 'replace') history.replaceState({unitId: unit.id}, '', `#${unit.id}`);
  else if (historyMode === 'push' && location.hash !== `#${unit.id}`) history.pushState({unitId: unit.id}, '', `#${unit.id}`);
  if (restorePosition?.anchor && Number.isFinite(restorePosition.anchorTop)) {
    const restoreAnchor = () => {
      const anchor = document.getElementById(restorePosition.anchor);
      if (anchor) window.scrollBy({top: anchor.getBoundingClientRect().top - restorePosition.anchorTop, behavior: 'auto'});
      else if (Number.isFinite(restoreY)) window.scrollTo({top: restoreY, behavior: 'auto'});
    };
    requestAnimationFrame(() => requestAnimationFrame(() => {
      restoreAnchor();
      window.setTimeout(restoreAnchor, 80);
    }));
  }
  else if (Number.isFinite(restoreY)) requestAnimationFrame(() => window.scrollTo({top: restoreY, behavior: 'auto'}));
  else if (!preserveScroll && previousID !== unit.id) window.scrollTo({top: 0, behavior: 'auto'});
  $('#unitTitle').tabIndex = -1;
  requestAnimationFrame(() => requestAnimationFrame(() => { $('#unitView').dataset.ready = 'true'; }));
}

function setStage(stage, moveFocus = true, requestedTarget = null, syncPane = true, preserveViewport = true) {
  const targetTask = requestedTarget === 'exerciseCard' || requestedTarget === 'completionChecklist' || stage === 'practice'
    ? 'practice'
    : requestedTarget === 'mechanismSection' || stage === 'read'
      ? 'understand'
      : LESSON_TASKS.has(stage) ? stage : 'observe';
  state.stage = targetTask;
  setLessonTask(targetTask, {focusTab: moveFocus, syncPane, preserveViewport});
  localStorage.setItem('manga-go-last-stage', targetTask);
}

function continueFromCurrent(direction) {
  const unit = state.units[state.currentIndex];
  if (direction > 0 && isReadingSupplement(unit) && returnFromSupplement(unit)) return;
  const target = adjacentUnit(direction);
  if (!target) return;
  let reminder = '';
  if (direction > 0 && !isReadingSupplement(unit) && !state.completed.has(unit.id)) {
    const missing = completionRequirements(unit).find((item) => !item.done);
    if (missing) reminder = `已打开下一课；本课还可回来完成：${missing.label}`;
  }
  openUnit(target.id);
  if (reminder) showToast(reminder);
}

function showWelcome() {
  $('#unitView').classList.add('hidden');
  hideDatabaseCourse();
  $('#welcome').classList.remove('hidden');
  history.replaceState({welcome: true}, '', '#top');
  window.scrollTo({top: 0, behavior: 'auto'});
}

function closeSidebar({restoreFocus = false} = {}) { const sidebar = $('.sidebar'); sidebar.classList.remove('open'); if (window.innerWidth <= 900) { sidebar.inert = true; sidebar.setAttribute('aria-hidden', 'true'); } $('#sidebarOverlay').classList.remove('open'); $('#menuToggle').setAttribute('aria-expanded', 'false'); if (restoreFocus) $('#menuToggle').focus(); }
function toggleSidebar() { const sidebar = $('.sidebar'); const open = sidebar.classList.toggle('open'); sidebar.inert = !open; sidebar.setAttribute('aria-hidden', String(!open)); $('#sidebarOverlay').classList.toggle('open', open); $('#menuToggle').setAttribute('aria-expanded', String(open)); if (open) (sidebar.querySelector('.nav-item.active') || sidebar.querySelector('.nav-item'))?.focus(); }

function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); window.clearTimeout(showToast.timer); showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 1800); }

function openSearch() { $('#dialogTitle').textContent = '搜索课程'; $('#searchLine').hidden = false; $('#searchInput').value = ''; renderSearch(''); $('#searchDialog').showModal(); $('#searchInput').focus(); }

function openReview() {
  const reviewKeys = [...new Set([...state.reviewHistory, ...state.wrong])];
  $('#dialogTitle').textContent = `复习记录 ${reviewKeys.length} 项`;
  $('#searchInput').value = '';
  $('#searchLine').hidden = true;
  const items = reviewKeys.map((key) => {
    if (key.endsWith(':lab')) {
      const id = key.slice(0, -4); const unit = state.units.find((candidate) => candidate.id === id);
      return unit ? `<button class="search-result" data-unit="${id}" data-review-key="${esc(key)}"><b>${esc(unit.title)}</b><span>上次项目测试没有通过。打开后查看报错，再修改代码重试。</span></button>` : '';
    }
    const [id, rawIndex] = key.split(':');
    const unit = state.units.find((candidate) => candidate.id === id);
    const quiz = unit?.selfCheck?.[Number(rawIndex)];
    return unit && quiz ? `<button class="search-result" data-unit="${id}" data-review-key="${esc(key)}"><b>${esc(unit.shortTitle || unit.title)}</b><span>${state.wrong.includes(key) ? '待纠正 · ' : '已纠正 · '}${esc(quiz.question)}</span></button>` : '';
  }).join('');
  $('#searchResults').innerHTML = items || '<p class="muted">还没有需要复习的题。答错的题和没通过的项目测试会记录在这里，方便你回来重做。</p>';
  $('#searchResults').querySelectorAll('[data-unit]').forEach((button) => button.addEventListener('click', () => { const key = button.dataset.reviewKey; $('#searchDialog').close(); openUnit(button.dataset.unit, 'practice'); requestAnimationFrame(() => { const target = key.endsWith(':lab') ? document.querySelector('[data-project-lab]') : document.querySelector(`[data-key="${CSS.escape(key)}"]`); if (target) { target.tabIndex = -1; target.scrollIntoView({block: 'center'}); target.focus(); } }); }));
  $('#searchDialog').showModal();
  $('#dialogTitle').focus({preventScroll: true});
}

function renderSearch(query) {
  const value = query.trim().toLowerCase();
  if (!value) { $('#searchResults').innerHTML = '<p class="muted">输入关键词开始搜索</p>'; return; }
  const results = [];
  state.units.forEach((unit) => {
    const haystack = JSON.stringify(unit).toLowerCase();
    if (haystack.includes(value)) results.push(unit);
  });
  const databaseResults = searchDatabaseUnits(value);
  const goHTML = results.slice(0, 10).map((unit) => `<button class="search-result" data-unit="${unit.id}"><b>${esc(unit.kind === 'chapter' ? `第 ${unit.number} 章 · ${unit.shortTitle}` : `${unit.projectLab ? '项目里程碑' : '参考补页'} · ${unit.title}`)}</b><span>${esc(unit.goal || unit.kicker || unit.analogy)}</span></button>`).join('');
  const databaseHTML = databaseResults.slice(0, 6).map((unit) => `<button class="search-result" data-database-result="${esc(unit.id)}"><b>${esc(unit.trackTitle)} · ${esc(unit.title)}</b><span>${esc(unit.goal)}</span></button>`).join('');
  $('#searchResults').innerHTML = goHTML || databaseHTML ? `${goHTML}${databaseHTML}` : '<p class="muted">暂时没有找到，换个词试试。</p>';
  $('#searchResults').querySelectorAll('[data-unit]').forEach((button) => button.addEventListener('click', () => { $('#searchDialog').close(); setRouteMode('main'); openUnit(button.dataset.unit); }));
  $('#searchResults').querySelectorAll('[data-database-result]').forEach((button) => button.addEventListener('click', () => { $('#searchDialog').close(); openDatabaseUnit(button.dataset.databaseResult); }));
}

function starterComplete() {
  try {
    const starter = JSON.parse(localStorage.getItem('starter-v1') || '{}');
    return Array.isArray(starter.ranSteps) && starter.ranSteps.length === 6 && starter.ranSteps.every(Boolean);
  } catch (_error) {
    return false;
  }
}

function setRouteMode(mode) {
  state.routeMode = mode === 'wails' ? 'wails' : 'main';
  sessionStorage.setItem('manga-go-route-mode', state.routeMode);
  localStorage.setItem('manga-go-route-mode', state.routeMode);
}

function recordLastLocation(location) {
  localStorage.setItem('manga-go-last-location', JSON.stringify(location));
  const continueButton = $('#continueButton');
  if (continueButton) continueButton.hidden = false;
}

function lastLocation() {
  try { return JSON.parse(localStorage.getItem('manga-go-last-location') || 'null'); }
  catch (_error) { return null; }
}

function openStarter() {
  showWelcome();
  requestAnimationFrame(() => $('#starterPanel')?.scrollIntoView({block: 'start', behavior: reducedMotion.matches ? 'auto' : 'smooth'}));
}

function openLearningRoute(targetChapter) {
  setRouteMode('main');
  const prerequisites = state.data.chapters.filter((chapter) => chapter.number < targetChapter);
  const firstMissing = prerequisites.find((chapter) => !state.completed.has(chapter.id));
  openUnit(`chapter-${targetChapter}`);
  if (!starterComplete() || firstMissing) showToast(`已直接打开第 ${targetChapter} 章；看不懂时再回看 ${firstMissing ? routeLabel(firstMissing) : 'Go 起步 6 步'}`);
}

function openWailsRoute() {
  setRouteMode('wails');
  const target = WAILS_ROUTE_IDS.find((id) => !state.practices[id]?.wailsOk) || WAILS_ROUTE_IDS[0];
  openUnit(target);
  showToast(state.completed.has('chapter-1') ? 'Wails + React 路线已开启：主学 Go，界面只负责调用与展示' : '已直接打开 Wails 路线；函数和 error 不熟时可回看第 1 章');
}

async function boot() {
  if (staticHosted) {
    document.body.classList.add('static-hosted');
    $('#hostingNotice').hidden = false;
    document.addEventListener('click', (event) => {
      const control = event.target.closest('.run-code,[data-submit-workshop],[data-run-exercise],[data-run-project]');
      if (!control) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      showToast('在线版不执行服务器代码；请在本地完整版运行测试');
    }, true);
  }
  const response = await fetch('data/book.json?v=19.0.0', {cache: 'no-store'});
  state.data = await response.json();
  state.units = flattenUnits(state.data);
  const databaseProgress = await initDatabaseCourse({
    staticHosted,
    showToast,
    closeSidebar,
    renderNav,
    openGoUnit: (id) => { setRouteMode('main'); openUnit(id); },
    recordLastLocation,
  });
  state.databaseCompleted = databaseProgress.completed;
  state.databaseTotal = databaseProgress.units;
  window.addEventListener('database-progress', (event) => {
    state.databaseCompleted = event.detail.completed;
    state.databaseTotal = event.detail.total;
    progress();
  });
  mountStarter(document.getElementById('starterMount'));
  discardStaleEvidence();
  const revalidation = revalidateCompletedEvidence();
  $('#statChapters').textContent = state.data.chapters.length;
  $('#statSupplements').textContent = state.units.length - state.data.chapters.length;
  $('#statDialogues').textContent = state.data.stats.dialogueTurns;
  renderNav(); saveState();
  const hasHistory = Boolean(lastLocation() || localStorage.getItem('manga-go-last-unit')) || state.completed.size > 0;
  $('#continueButton').hidden = !hasHistory;
  $('#startButton').textContent = starterComplete() ? '进入第 1 章 →' : '开始 6 步 Go 起步 →';
  $('#startButton').addEventListener('click', () => { setRouteMode('main'); starterComplete() ? openUnit('chapter-1') : openStarter(); });
  document.querySelectorAll('[data-start-chapter]').forEach((button) => button.addEventListener('click', () => openLearningRoute(Number(button.dataset.startChapter))));
  document.querySelector('[data-start-wails]')?.addEventListener('click', openWailsRoute);
  document.querySelectorAll('[data-start-database]').forEach((button) => button.addEventListener('click', () => startDatabaseTrack(button.dataset.startDatabase)));
  document.querySelectorAll('[data-start-unit]').forEach((button) => button.addEventListener('click', () => openUnit(button.dataset.startUnit)));
  $('#continueButton').addEventListener('click', () => {
    const saved = lastLocation();
    if (saved?.kind === 'database' && isDatabaseUnit(saved.id)) { openDatabaseUnit(saved.id); return; }
    if (saved?.routeMode) setRouteMode(saved.routeMode);
    openUnit(saved?.id || localStorage.getItem('manga-go-last-unit') || learningRoute().find((unit) => !state.completed.has(unit.id))?.id || state.data.chapters[0].id, saved?.task || localStorage.getItem('manga-go-last-stage') || 'observe');
    if (saved?.pane && lessonPaneMedia.matches) setLessonPane(saved.pane);
  });
  window.addEventListener('starter-progress', (event) => {
    $('#startButton').textContent = event.detail.complete ? '进入第 1 章 →' : '继续 6 步 Go 起步 →';
  });
  $('#prevButton').addEventListener('click', () => continueFromCurrent(-1));
  $('#nextButton').addEventListener('click', () => continueFromCurrent(1));
  const lessonTaskOrder = ['observe', 'understand', 'practice'];
  document.querySelectorAll('[data-lesson-task]').forEach((button) => {
    button.addEventListener('click', () => setLessonTask(button.dataset.lessonTask));
    button.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const current = lessonTaskOrder.indexOf(button.dataset.lessonTask);
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? lessonTaskOrder.length - 1 : (current + (event.key === 'ArrowLeft' ? -1 : 1) + lessonTaskOrder.length) % lessonTaskOrder.length;
      setLessonTask(lessonTaskOrder[index], {focusTab: true});
    });
  });
  document.querySelectorAll('[data-lesson-pane]').forEach((tab) => {
    tab.addEventListener('click', () => setLessonPane(tab.dataset.lessonPane, {restore: true}));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const nextPane = event.key === 'ArrowLeft' || event.key === 'Home' ? 'explain' : 'practice';
      setLessonPane(nextPane, {restore: true, focusTab: true});
    });
  });
  lessonPaneMedia.addEventListener('change', () => setLessonPane(mobileLessonPane));
  $('#completeButton').addEventListener('click', async () => {
    const unit = state.units[state.currentIndex];
    if (isReadingSupplement(unit)) {
      const missingRequirement = completionRequirements(unit).find((item) => !item.done);
      if (missingRequirement) {
        renderCompletionChecklist(unit);
        showToast(`还差：${missingRequirement.label}`);
        return;
      }
      if (state.readSupplements.has(unit.id)) state.readSupplements.delete(unit.id);
      else state.readSupplements.add(unit.id);
      saveState(); renderNav(); renderCompletionControls();
      showToast(state.readSupplements.has(unit.id) ? '已记录为读过；练习进度单独保存' : '已取消阅读记录');
      return;
    }
    if (state.completed.has(unit.id)) { state.completed.delete(unit.id); saveState(); renderNav(); renderCompletionControls(); showToast('已取消完成标记'); return; }
    const missingRequirement = completionRequirements(unit).find((item) => !item.done);
    if (missingRequirement) {
      renderCompletionChecklist(unit);
      showToast(`还差：${missingRequirement.label}`);
      return;
    }
    const keys = (unit.selfCheck || []).map((_, index) => `${unit.id}:${index}`);
    const pending = keys.filter((key) => !state.answered.has(key) || state.wrong.includes(key));
    if (pending.length) { showToast(`还有 ${pending.length} 道题需要答对`); return; }
    if (unit.kind !== 'chapter') {
      if (unit.projectExercise && !state.practices[unit.id]?.codeOk) { showToast('先完成里程碑代码并通过固定测试'); return; }
      const practice = state.practices[unit.id];
      try {
        const response = await fetch('/api/check', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unitId:unit.id,quizAnswers:keys.map((key)=>state.responses[key]),challengeDigest:practice.codeDigest,challengeRunProof:practice.runProof})});
        const proof = await response.json();
        if (!proof.ok || !proof.completionDigest) throw new Error('completion rejected');
        state.practices[unit.id] = {...practice, completionDigest:proof.completionDigest};
        state.completed.add(unit.id); saveState(); renderNav(); renderCompletionControls(); showToast('项目里程碑已完成');
      } catch (_error) { showToast('之前的测试结果已失效，请重新运行项目测试'); }
      return;
    }
    const practice = state.practices[unit.id] || {};
    if (unit.foundationLesson) {
      if (!practice?.foundationPredictionChecked || !practice.foundationPredictionCorrect) { showToast('先把预测题答对，再用运行结果验证'); return; }
      if (!practice.foundationBaselineRan) { showToast('先用原始代码运行一次'); return; }
      if (!practice.foundationChangedRan || practice.foundationBaselineDigest === practice.foundationChangedDigest) { showToast('按要求只改一处，再成功运行一次'); return; }
      if (!practice.codeOk) { showToast('先独立补完 TODO，让固定测试通过'); return; }
      const quizAnswers = keys.map((key) => state.responses[key]);
      try {
        const response = await fetch('/api/check', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
          unitId:unit.id, quizAnswers, foundationPrediction:practice.foundationPrediction, codeDigest:practice.codeDigest, runProof:practice.runProof,
          foundationBaselineDigest:practice.foundationBaselineDigest, foundationBaselineRunProof:practice.foundationBaselineRunProof,
          foundationChangedDigest:practice.foundationChangedDigest, foundationChangedRunProof:practice.foundationChangedRunProof,
        })});
        const proof = await response.json();
        if (!response.ok || !proof.ok || !proof.completionDigest) throw new Error('completion rejected');
        state.practices[unit.id] = {...practice, completionDigest:proof.completionDigest};
        state.completed.add(unit.id); saveState(); renderNav(); renderCompletionControls(); showToast('基础学习闭环已通过');
      } catch (_error) { showToast('运行证据已失效，请重新运行原例、改动例和固定测试'); }
      return;
    }
    if (unit.id === 'chapter-24') {
      const quizAnswers = keys.map((key) => state.responses[key]);
      try {
        const response = await fetch('/api/check', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
          unitId:unit.id, quizAnswers, challengeDigest:practice.codeDigest, challengeRunProof:practice.runProof,
          codeDigest:practice.labDigest, runProof:practice.labRunProof,
        })});
        const proof = await response.json();
        if (!response.ok || !proof.ok || !proof.completionDigest) throw new Error('completion rejected');
        state.practices[unit.id] = {...practice, completionDigest: proof.completionDigest};
        state.completed.add(unit.id); saveState(); renderNav(); renderCompletionControls(); showToast('结业总装已通过');
      } catch (_error) { showToast('总装证据已失效，请重新运行固定测试和项目测试'); }
      return;
    }
    if (unit.kind === 'chapter' && !practice?.workshopOk) { showToast('先完成下面三项练习'); return; }
    if (unit.workshop?.codeExercise && !practice?.codeOk) { showToast('先修改代码，让测试通过'); return; }
    const quizAnswers = keys.map((key) => state.responses[key]);
    try {
      const response = await fetch('/api/check', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unitId:unit.id,answers:practice.answers,quizAnswers,codeDigest:practice.codeDigest || '',runProof:practice.runProof || ''})});
      const proof = await response.json();
      if (!proof.ok || !proof.completionDigest) throw new Error('completion rejected');
      state.practices[unit.id] = {...practice, completionDigest: proof.completionDigest};
      state.completed.add(unit.id); saveState(); renderNav();
      renderCompletionControls(); showToast('本节练习已通过，进度已保存');
    } catch (_error) { showToast('没能保存完成记录，请检查本地服务后重试'); }
  });
  $('#backToTop').addEventListener('click', () => document.querySelector('.unit-header')?.scrollIntoView({block: 'start', behavior: reducedMotion.matches ? 'auto' : 'smooth'}));
  $('#continueUnitButton').addEventListener('click', () => continueFromCurrent(1));
  $('#searchToggle').addEventListener('click', openSearch); $('#searchInput').addEventListener('input', (event) => renderSearch(event.target.value));
  $('#progressButton').addEventListener('click', openReview);
  $('#themeToggle').addEventListener('click', () => { document.body.classList.toggle('dark'); localStorage.setItem('jianjian-theme', document.body.classList.contains('dark') ? 'dark' : 'light'); if (!$('#unitView').classList.contains('hidden')) renderOverviewDiagram(state.units[state.currentIndex]); });
  if (localStorage.getItem('jianjian-theme') === 'dark') document.body.classList.add('dark');
  $('#compactToggle').addEventListener('click', () => { document.body.classList.toggle('compact'); showToast(document.body.classList.contains('compact') ? '专注模式已开启 · Alt+C 切换' : '已退出专注模式'); });
  $('#sidebarCollapse').addEventListener('click', () => $('.sidebar').classList.toggle('collapsed'));
  $('#menuToggle').addEventListener('click', toggleSidebar);
  $('#sidebarOverlay').addEventListener('click', () => closeSidebar({restoreFocus: true}));
  $('.brand').addEventListener('click', (event) => { event.preventDefault(); showWelcome(); });
  const taDialog = $('#tradingagentsDialog');
  $('#openTradingAgentsBtn')?.addEventListener('click', () => taDialog?.showModal());
  $('#closeTradingAgentsDialog')?.addEventListener('click', () => taDialog?.close());
  $('#copyTradingAgentsArch')?.addEventListener('click', async () => {
    const archSummary = `【TradingAgents: AI 多智能体 + Go 后端 + Wails React 桌面端集成架构】
1. AI 决策层 (TradingAgents - Python/LLM)：基本面、技术面、新闻情绪、宏观经济多智能体协同推演。
2. Go 高并发风控网关 (Go Backend)：Fail-Closed 严格 JSON 校验 (DisallowUnknownFields+EOF)，未知字段与非法枚举立即拒绝。
3. 状态一致性屏障 (Go CAS Lease & Fencing)：单账户并发锁与单调递增 Fencing Token，杜绝网络抖动与幽灵旧 Worker 重复下单。
4. 账本与事件溯源 (Go Ledger Agent)：复式记账原子落盘，SQLite/DuckDB 高性能存储，幂等防重保障。
5. Wails + React 展示层 (Wails v2)：公开 Go 方法通过生成绑定调用，runtime events 用于通知；React 只收集输入和展示结果。性能需在目标平台实测。`;
    try {
      await navigator.clipboard.writeText(archSummary);
      showToast('全栈集成架构说明已复制');
    } catch (_e) {
      showToast('复制失败，请手动复制');
    }
  });
  closeSidebar();
  $('#unitView').addEventListener('click', (event) => { if (event.target.closest('a')) return; });
  const hashRaw = location.hash.slice(1);
  const [initial, hashQuery] = hashRaw.split('?');
  const queryParams = new URLSearchParams(hashQuery || location.search);
  if (queryParams.get('dark') === '1') document.body.classList.add('dark');
  const requestedStage = queryParams.get('task') || queryParams.get('stage') || (initial === localStorage.getItem('manga-go-last-unit') ? (localStorage.getItem(`manga-go-task:${initial}`) || localStorage.getItem('manga-go-last-stage') || 'observe') : 'observe');
  if (initial && isDatabaseUnit(initial)) openDatabaseUnit(initial, {historyMode: 'replace'});
  else if (initial && state.units.some((unit) => unit.id === initial)) openUnit(initial, requestedStage, {historyMode: 'replace'});
  let locationHandleQueued = false;
  const handleLocation = () => {
    if (locationHandleQueued) return;
    locationHandleQueued = true;
    requestAnimationFrame(() => {
      locationHandleQueued = false;
    const raw = location.hash.slice(1);
    const [id, q] = raw.split('?');
    const stage = new URLSearchParams(q).get('task') || new URLSearchParams(q).get('stage') || 'observe';
    if (id === 'top') showWelcome();
      else if (id && isDatabaseUnit(id)) openDatabaseUnit(id, {historyMode: 'none', preserveScroll: true});
      else if (id && state.units.some((unit) => unit.id === id)) openUnit(id, stage, {historyMode: 'none', preserveScroll: true});
    });
  };
  window.addEventListener('popstate', handleLocation);
  window.addEventListener('hashchange', handleLocation);
  document.addEventListener('keydown', (event) => {
    // Boss Key: Alt+C toggles compact office-stealth view
    if (event.altKey && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      document.body.classList.toggle('compact');
      showToast(document.body.classList.contains('compact') ? '专注模式 · Esc 可关闭侧边栏' : '已退出专注模式');
      return;
    }
    if (event.key === 'Escape') closeSidebar({restoreFocus: true});
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); }
    // Code editor: Tab → indent, Shift+Tab → dedent
    if (event.key === 'Tab' && event.target.matches('.code-editor')) {
      event.preventDefault();
      const el = event.target;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      if (event.shiftKey) {
        // Dedent: remove up to 2 spaces or 1 tab at start of selected lines
        const before = el.value.slice(0, start);
        const lineStart = before.lastIndexOf('\n') + 1;
        const lineText = el.value.slice(lineStart, lineStart + 2);
        const toRemove = lineText.startsWith('\t') ? 1 : lineText.startsWith('  ') ? 2 : lineText.startsWith(' ') ? 1 : 0;
        if (toRemove > 0) {
          el.value = el.value.slice(0, lineStart) + el.value.slice(lineStart + toRemove);
          el.selectionStart = Math.max(lineStart, start - toRemove);
          el.selectionEnd = Math.max(lineStart, end - toRemove);
          el.dispatchEvent(new Event('input', {bubbles: true}));
        }
      } else {
        el.value = el.value.slice(0, start) + '\t' + el.value.slice(end);
        el.selectionStart = el.selectionEnd = start + 1;
        el.dispatchEvent(new Event('input', {bubbles: true}));
      }
      return;
    }
    // Code editor: Cmd/Ctrl+Enter → click the run button
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && event.target.matches('.code-editor')) {
      event.preventDefault();
      const runBtn = event.target.closest('[data-code-exercise],[data-project-exercise]')?.querySelector('[data-run-exercise]')
        || event.target.closest('.code-exercise,.lab-callout')?.querySelector('.lab-run,.run-code');
      runBtn?.click();
      return;
    }
  });
  revalidation.then(() => {
    saveState(); renderNav();
    const current = state.units[state.currentIndex];
    if (current) {
      renderCompletionControls();
    }
  });
}

boot().catch((error) => { document.body.innerHTML = `<main style="padding:40px;font-family:system-ui"><h1>教材加载失败</h1><p>${esc(error.message)}</p><p>请通过本地开发服务器打开，而不是直接双击 HTML 文件。</p></main>`; });
