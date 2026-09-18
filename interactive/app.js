const state = {
  data: null,
  units: [],
  currentIndex: 0,
  stage: 'understand',
  completed: new Set(JSON.parse(localStorage.getItem('jianjian-completed') || '[]')),
  wrong: JSON.parse(localStorage.getItem('jianjian-wrong') || '[]'),
  answered: new Set(JSON.parse(localStorage.getItem('jianjian-answered') || '[]')),
  responses: JSON.parse(localStorage.getItem('jianjian-responses') || '{}'),
  practices: JSON.parse(localStorage.getItem('manga-go-practices') || '{}'),
  reviewHistory: JSON.parse(localStorage.getItem('manga-go-review-history') || '[]'),
};

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function flattenUnits(data) {
  const units = [];
  data.chapters.forEach((chapter) => {
    units.push(chapter);
    chapter.supplements.forEach((supplement) => units.push(supplement));
  });
  return units;
}

function avatar(data, speaker) {
  const path = data.avatars[speaker];
  return path ? `<img class="avatar" src="${encodeURI(path)}" alt="${esc(speaker)}头像">` : `<span class="avatar" aria-hidden="true"></span>`;
}

function dialogueHtml(data, lines) {
  return `<div class="chat-list">${lines.map(({speaker, text}) => {
    const learner = speaker === '陈平安';
    return `<div class="chat-row ${learner ? 'learner' : ''}" data-speaker="${esc(speaker)}"><div class="chat-person">${avatar(data, speaker)}<span class="speaker">${esc(speaker)}</span></div><div class="bubble">${esc(text)}</div></div>`;
  }).join('')}</div>`;
}

function renderNav() {
  const nav = $('#chapterNav');
  let html = '';
  state.data.chapters.forEach((chapter) => {
    const current = state.units[state.currentIndex]?.id === chapter.id;
    if (chapter.number === 1 || state.data.chapters[chapter.number - 2]?.volume.title !== chapter.volume.title) {
      html += `<div class="volume-label">${esc(chapter.volume.title)}</div>`;
    }
    html += `<button class="nav-item ${current ? 'active' : ''}" data-unit="${chapter.id}"><span class="nav-num">${String(chapter.number).padStart(2, '0')}</span><span>${esc(chapter.shortTitle)}</span>${state.completed.has(chapter.id) ? '<span aria-label="已完成">·</span>' : ''}</button>`;
    if (current || chapter.supplements.some((item) => state.units[state.currentIndex]?.id === item.id)) chapter.supplements.forEach((supplement) => {
      const subCurrent = state.units[state.currentIndex]?.id === supplement.id;
      html += `<button class="nav-item sub ${subCurrent ? 'active' : ''}" data-unit="${supplement.id}"><span class="nav-num">↳</span><span>${esc(supplement.title)}</span>${state.completed.has(supplement.id) ? '<span>·</span>' : ''}</button>`;
    });
  });
  nav.innerHTML = html;
  nav.querySelectorAll('[data-unit]').forEach((button) => button.addEventListener('click', () => { openUnit(button.dataset.unit); closeSidebar(); }));
  nav.querySelector('.active')?.scrollIntoView({block: 'nearest'});
}

function progress() {
  const count = state.data.chapters.filter((chapter) => state.completed.has(chapter.id)).length;
  const projects = state.units.filter((unit) => unit.projectLab);
  const projectDone = projects.filter((unit) => state.completed.has(unit.id)).length;
  const value = Math.round(((count + projectDone) / (state.data.chapters.length + projects.length)) * 100) || 0;
  $('#progressLabel').textContent = `${value}%`;
  $('#progressButton').setAttribute('aria-label', `总进度 ${value}%，主线 ${count}/${state.data.chapters.length}，项目 ${projectDone}/${projects.length}，待复习 ${state.wrong.length} 题`);
  $('.progress-ring').style.setProperty('--progress', `${value}%`);
}

function saveState() {
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

function renderIncident(unit) {
  $('#incidentCard').innerHTML = `<div class="card-kicker">闯祸现场 · 先看发生了什么</div>${(unit.opening || [unit.goal || unit.kicker]).map((paragraph) => `<p>${esc(paragraph)}</p>`).join('')}`;
}

function renderChat(unit) {
  const dialogue = unit.dialogue || [];
  $('#chatCard').innerHTML = `<h2 class="sr-only">本章内容</h2><div class="chat-title"><h3>人物对话</h3><span>${dialogue.length} 句</span></div>${dialogueHtml(state.data, dialogue)}<div class="chat-close"><b>这一幕的结论</b><span>${esc(unit.closing || unit.accept)}</span></div>`;
}

function renderMemory(unit) {
  $('#memoryCard').innerHTML = `<h3>小白先懂</h3><p class="memory-quote">“${esc(unit.mnemonic || unit.kicker)}”</p><p class="memory-analogy">${esc(unit.analogy || unit.goal)}</p>`;
  const glossary = unit.glossary?.length ? unit.glossary : [{term: '本节先不加黑话', meaning: '沿着事故和代码往下走。'}];
  $('#glossaryCard').innerHTML = `<h3>黑话翻译</h3><ul class="glossary-list">${glossary.map(({term, meaning}) => `<li><b>${esc(term)}</b><span>${esc(meaning)}</span></li>`).join('')}</ul>`;
}

function renderFlow(unit) {
  const nodes = [
    ['事故', unit.opening?.[0] || unit.goal || unit.kicker],
    ['关键边界', unit.principles[0] || unit.kicker],
    ['代码动作', unit.code ? '看输入、状态与出口' : '看状态、证据与验收'],
    ['验收', unit.accept],
  ];
  $('#flowCard').innerHTML = `<div class="section-heading"><h3>点击路线图，看这一节怎么收住</h3><small>本节路线</small></div><div class="flow-map">${nodes.map(([title, detail], index) => `<button class="flow-node ${index === 0 ? 'active' : ''}" data-flow="${index}"><b>${esc(title)}</b><span>${esc(detail).slice(0, 32)}${detail.length > 32 ? '…' : ''}</span></button>${index < nodes.length - 1 ? '<span class="flow-arrow" aria-hidden="true">→</span>' : ''}`).join('')}</div><div class="flow-detail" id="flowDetail">${esc(nodes[0][1])}</div>`;
  $('#flowCard').querySelectorAll('[data-flow]').forEach((item, index) => item.setAttribute('aria-pressed', String(index === 0)));
  const detail = $('#flowDetail');
  $('#flowCard').querySelectorAll('[data-flow]').forEach((button) => button.addEventListener('click', () => {
    $('#flowCard').querySelectorAll('[data-flow]').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    $('#flowCard').querySelectorAll('[data-flow]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    detail.textContent = nodes[Number(button.dataset.flow)][1];
  }));
}

function highlightGo(line) {
  let result = esc(line);
  result = result.replace(/(\/\/.*)$/g, '<span class="comment">$1</span>');
  result = result.replace(/(&quot;.*?&quot;|`.*?`)/g, '<span class="str">$1</span>');
  result = result.replace(/\b(package|import|func|return|if|else|for|range|switch|case|type|struct|interface|var|const|go|select|defer)\b/g, '<span class="kw">$1</span>');
  result = result.replace(/\b(string|int|int64|uint64|float64|bool|error|Context|Time)\b/g, '<span class="type">$1</span>');
  return result;
}

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
      ? `${subject} 是这段代码的主角。先别逐字翻译，只追三件事：它收到什么，在哪里拦下坏情况，最后交回什么。`
      : `这段代码只为本节的目标服务：${unit.kicker || unit.mnemonic || unit.goal || '把输入变成可以验收的结果'}。先看数据从哪里来、到哪里去。`,
    steps: guides.map((guide, index) => ({
      label: labelFor(guide, index),
      explanation: guide,
    })),
    cases: [],
    terms: [],
  };
}

function codeLinesHtml(code) {
  return code.split('\n').map((line, index) => `<span class="code-line" data-code-line="${index + 1}"><span class="line-number">${String(index + 1).padStart(2, '0')}</span>${highlightGo(line)}</span>`).join('');
}

function codeLessonHtml(unit) {
  const lesson = codeLessonFor(unit);
  const steps = lesson.steps || [];
  const cases = lesson.cases?.length ? `<div class="case-table" role="table" aria-label="测试场景"><div class="case-row case-head" role="row"><b role="columnheader">场景</b><b role="columnheader">给什么</b><b role="columnheader">应该得到什么</b></div>${lesson.cases.map((item) => `<div class="case-row" role="row"><strong role="cell">${esc(item.name)}</strong><span role="cell">${esc(item.given)}</span><span role="cell">${esc(item.expect)}</span></div>`).join('')}</div>` : '';
  const terms = lesson.terms?.length ? `<div class="code-terms"><h4>五个符号，先认脸就够了</h4>${lesson.terms.map((item) => `<div><code>${esc(item.code)}</code><span>${esc(item.meaning)}</span></div>`).join('')}</div>` : '';
  const stepButtons = steps.length ? `<div class="code-steps" aria-label="代码阅读步骤">${steps.map((step, index) => `<button class="code-step ${index === 0 ? 'active' : ''}" data-code-step="${index}" aria-pressed="${index === 0}"><span>${index + 1}</span>${esc(step.label)}</button>`).join('')}</div><div class="step-explanation" aria-live="polite">${esc(steps[0].explanation)}</div>` : '';
  const labels = {go: 'Go 核心代码', json: 'JSON 契约', dockerfile: 'Dockerfile', tree: '目录结构', concept: '概念页'};
  const runnable = Boolean(unit.runnable && unit.verified);
  const codeLabel = runnable ? `运行已验证 · ${labels[unit.codeKind] || '可运行示例'}` : `${unit.syntaxVerified ? '语法已校验 · ' : ''}${labels[unit.codeKind] || '核心代码片段'}`;
  const codeHint = runnable ? `${unit.verificationCommand} 已通过` : (unit.codeKind === 'go' ? '省略 package、import 与上一章已有类型' : '这是配置或结构示例，不按 Go 编译');
  const runButton = runnable ? `<button class="run-code" data-run-unit="${esc(unit.id)}">编译运行</button>` : '';
  const codeView = runnable
    ? `<textarea class="code-editor" aria-label="Go 代码编辑器" spellcheck="false" wrap="off">${esc(unit.code)}</textarea>`
    : `<pre class="code-block">${codeLinesHtml(unit.code)}</pre>`;
  return `<div class="code-teacher" data-code-lesson><p class="code-first-label">先讲人话</p><h3>${esc(lesson.summary)}</h3>${cases}${stepButtons}${terms}</div><details class="full-code"><summary><span>${codeLabel}</span><small>${codeHint}</small></summary><div class="code-shell"><div class="code-toolbar"><span>${runnable ? '可修改代码；刷新页面恢复原稿' : '当前步骤会在代码中标亮'}</span><div class="code-actions">${runButton}<button class="copy-code">复制代码</button></div></div><div class="code-wrap">${codeView}</div><div class="run-result hidden" aria-live="polite"><div><b>运行结果</b><span></span></div><pre></pre></div></div></details>`;
}

async function runCode(button, container, unitID) {
  const scope = button.closest('.code-shell, .lab-callout') || container;
  const result = scope.querySelector('.run-result');
  const output = result.querySelector('pre');
  const meta = result.querySelector('span');
  result.classList.remove('hidden', 'success', 'failure');
  button.disabled = true;
  button.textContent = '运行中…';
  output.textContent = '正在启动隔离的临时工作目录…';
  meta.textContent = '';
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
  } catch (_error) {
    result.classList.add('failure');
    output.textContent = '运行服务未启动。请使用项目里的 run-preview.sh 启动预览。';
  } finally {
    button.disabled = false;
    button.textContent = unitID === 'harness-lab' ? '运行实验' : '编译运行';
  }
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
  container.querySelectorAll('[data-run-unit]').forEach((button) => button.addEventListener('click', () => {
    const details = button.closest('.full-code');
    if (details) details.open = true;
    runCode(button, container, button.dataset.runUnit);
  }));
  container.querySelector('[data-code-step]')?.click();
  const initialDetails = container.querySelector('.full-code');
  if (initialDetails) initialDetails.open = false;
}

function renderCode(unit) {
  const card = $('#codeCard');
  if (!unit.code) { card.classList.add('hidden'); card.innerHTML = ''; return; }
  card.classList.remove('hidden');
  const lab = unit.kind === 'chapter' && unit.number >= 19 ? `<div class="lab-callout"><div><b>第 19–24 章共用的基础实验</b><span>只验证审批、绑定、Unknown 对账、重复调用和回执摘要；不代表本章全部架构已实现。</span></div><div><button class="run-code lab-run" data-run-unit="harness-lab">运行实验</button><a href="labs/harness-lab/harness_test.go" target="_blank">查看测试代码</a></div><div class="run-result hidden" aria-live="polite"><div><b>运行结果</b><span></span></div><pre></pre></div></div>` : '';
  card.innerHTML = codeLessonHtml(unit) + lab;
  bindCodeLesson(card, unit);
}

function renderTechnical(unit) {
  const principles = unit.principles || [];
  const pitfalls = unit.pitfalls || [];
  $('#technicalCard').innerHTML = `<div class="section-heading"><h3>技术真相</h3><small>这里不卖萌，只守边界</small></div><ul class="bullet-list">${principles.map((item) => `<li>${esc(item)}</li>`).join('')}</ul><details><summary>最容易怎么翻车</summary>${pitfalls.length ? `<ul class="bullet-list">${pitfalls.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : '<p class="muted">本补页不另起炉灶，先把上一个边界钉牢。</p>'}</details>`;
}

function quizHtml(unit) {
  return (unit.selfCheck || []).map((quiz, index) => {
    const key = `${unit.id}:${index}`;
    const response = state.responses[key];
    const hasResponse = Number.isInteger(response);
    const correct = hasResponse && response === quiz.correctIndex;
    const choices = quiz.choices.map((choice, choiceIndex) => `<label><input type="radio" name="${esc(key)}" value="${choiceIndex}" ${response === choiceIndex ? 'checked' : ''}><span>${esc(choice)}</span></label>`).join('');
    const reason = quiz.feedback?.[response] || '';
    const feedback = hasResponse ? `<b>${correct ? '答对了' : '还差一步'}</b>${!correct && reason ? `<p>${esc(reason)}</p>` : ''}<p>${esc(quiz.answer)}</p>` : '';
    return `<fieldset class="quiz-item ${state.wrong.includes(key) ? 'review' : ''} ${hasResponse ? 'open' : ''}" data-quiz="${index}" data-key="${key}" tabindex="-1"><legend class="quiz-question">${index + 1}. ${esc(quiz.question)}</legend><div class="quiz-choices">${choices}</div><button class="answer-button" data-submit-answer>${hasResponse ? '重新提交' : '提交答案'}</button><div class="answer" aria-live="polite">${feedback}</div></fieldset>`;
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
    item.querySelector('.answer').innerHTML = `<b>${correct ? '答对了' : '还差一步'}</b>${!correct && reason ? `<p>${esc(reason)}</p>` : ''}<p>${esc(quiz.answer)}</p>`;
    saveState(); renderNav();
    showToast(correct ? '答对了，已记入掌握证据' : '已加入复习，看看解析再试一次');
  }));
}

function renderExercise(unit) {
  const saved = state.practices[unit.id];
  const exercise = unit.projectExercise || unit.workshop?.codeExercise;
  const resultId = `run-result-${unit.id}`;
  const hintHtml = exercise?.hints?.length ? `<details class="exercise-hints"><summary>卡住了？按顺序看提示</summary><ol>${exercise.hints.map((hint) => `<li>${esc(hint)}</li>`).join('')}</ol></details>` : '';
  const codeExercise = exercise ? `<div class="code-exercise" data-code-exercise><div><h3>${esc(exercise.title)}</h3><p>${esc(exercise.prompt)}</p><p class="test-intent"><b>固定测试会检查什么：</b>${esc(exercise.testIntent || '')}</p></div><textarea class="code-editor" aria-label="${esc(exercise.title)}代码编辑器" aria-describedby="${resultId}" spellcheck="false" wrap="off">${esc(saved?.code || exercise.code)}</textarea>${hintHtml}<div class="code-actions"><button class="run-code" data-run-exercise>运行固定测试</button><button class="text-button" data-reset-exercise>恢复初始代码</button></div><div id="${resultId}" class="run-result ${saved?.codeOk ? 'success' : 'hidden'}" aria-live="polite" tabindex="-1"><div><b>测试结果</b><span>${saved?.codeOk ? esc(saved.codeDigest) : ''}</span></div><p class="failure-guide"></p><pre>${saved?.codeOk ? 'PASS（已保存本次代码的验收摘要）' : ''}</pre></div></div>` : '';
  const resumePitch = `【核心项目架构：高可用 Go 智能体微服务系统 (Ledger Agent)】
· 基于 Go 1.24+ 纯标准库独立设计高并发智能体微服务，实现租户级并发隔离、容量上限非阻塞 Worker 槽位控制与动态过载背压。
· 落地分布式 Lease 续约与递增 Fencing Token 防幽灵写入，结合 Postgres/Sqlite 原生事务守住资金与凭证一致性。
· 建立生产级 LLM 契约边界：严格 JSON 反序列化未知字段防御（DisallowUnknownFields+EOF）、Fail Closed 安全熔断及沙箱只读/写动作审批。
· 跨网络端到端交付：集成 SSE 实时事件流与断线补偿游标，通过包含正常、并发争抢、幂等重试、超时故障注入的自动化测试套件。`;
  const capstone = unit.workshop?.capstone ? `<section class="capstone-brief"><p class="code-first-label">企业级作品集交付 (Capstone Portfolio)</p><h3>${esc(unit.workshop.capstone.title)}</h3><p class="capstone-desc">${esc(unit.workshop.capstone.brief)}</p><div class="capstone-actions"><a href="${esc(unit.workshop.capstone.downloadUrl || 'downloads/ledger-agent-starter.zip')}" download class="capstone-download-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>下载完整工程 Starter (${esc(unit.workshop.capstone.downloadName || 'ledger-agent-starter.zip')})</a><span class="capstone-tag">Go 1.24+ · 纯标准库 · 独立微服务</span></div><div class="capstone-arch"><h4>系统架构与全链路装配</h4><ul>${(unit.workshop.capstone.architecture || []).map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div><div class="capstone-checklist"><h4>交付与验收清单</h4><ol>${unit.workshop.capstone.deliverables.map((item) => `<li>${esc(item)}</li>`).join('')}</ol></div><details class="capstone-resume-box"><summary class="capstone-resume-toggle">🛠️ 项目技术架构亮点与核心设计（点击展开，可直接复制）</summary><div class="capstone-resume-body"><pre class="capstone-resume-text">${esc(resumePitch)}</pre><button class="copy-resume-btn" type="button">复制技术架构亮点</button></div></details></section>` : '';
  const projectLab = unit.projectLab ? `<div class="project-lab" data-project-lab><div><p class="code-first-label">同一个项目，继续往前</p><h3>${esc(unit.projectLab.title)}</h3><p>把当前提交编译进 Ledger Agent，再运行本节具名测试，确认这条生产边界成立。通过结果会成为本节完成条件。</p></div><div class="project-lab-actions"><button class="run-code" data-run-project="${esc(unit.projectLab.id)}">运行企业实验</button><a href="${esc(unit.projectLab.path)}" target="_blank">查看项目源码</a></div><div class="run-result ${saved?.labOk ? 'success' : 'hidden'}" aria-live="polite" tabindex="-1"><div><b>项目测试</b><span>${saved?.labOk ? esc(saved.labDigest) : ''}</span></div><pre>${saved?.labOk ? 'PASS（已保存本版本的项目验收）' : ''}</pre></div></div>` : '';
  const workshop = unit.workshop ? `<div class="workshop" data-workshop><div><h3>${esc(unit.workshop.title)}</h3><p>${esc(unit.workshop.prompt)}</p></div>${capstone}${codeExercise}<div class="workshop-fields">${unit.workshop.fields.map((field, index) => `<label><b>${index + 1}. ${esc(field.label)}</b>${field.kind === 'text' ? `<textarea data-workshop-field="${index}" rows="3" placeholder="${esc(field.placeholder)}">${esc(saved?.answers?.[index] || '')}</textarea>` : `<select data-workshop-field="${index}"><option value="">请选择</option>${field.options.map((option) => `<option value="${esc(option)}" ${saved?.answers?.[index] === option ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select>`}</label>`).join('')}</div><button class="answer-button" data-submit-workshop>提交工程演练</button><div class="workshop-result ${saved?.workshopOk ? 'success' : ''}" aria-live="polite">${saved?.workshopOk ? `<b>已通过</b><span>${esc(saved.workshopDigest)}</span>` : ''}</div></div>` : '';
  const projectExercise = unit.projectExercise ? codeExercise : '';
  $('#exerciseCard').innerHTML = `<div class="section-heading"><h2>动手与验收</h2><small>答题和工程演练都通过，才算完成</small></div><div class="pitfall-grid"><div class="pitfall-panel"><h3>跟着做</h3><p>${esc(unit.task)}</p></div><div class="task-panel"><h3>做到什么算过关</h3><p>${esc(unit.accept)}</p></div></div>${projectExercise}${projectLab}${workshop}<div class="quiz-list">${quizHtml(unit)}</div>`;
  bindQuiz($('#exerciseCard'), unit);
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
      saveState(); renderNav();
    } catch (error) {
      result.className = 'workshop-result failure';
      result.innerHTML = error.message === 'stale workshop response' ? '<b>内容已改变</b><span>旧验收结果已丢弃，请重新提交。</span>' : '<b>验收器未启动</b><span>请使用 run-preview.sh 打开教材。</span>';
    } finally { submitButton.disabled = false; mutableFields.forEach((field) => { field.disabled = false; }); }
  });
  const codeRoot = $('#exerciseCard').querySelector('[data-code-exercise]');
  const editor = codeRoot?.querySelector('.code-editor');
  editor?.addEventListener('input', () => {
    state.practices[unit.id] = {...state.practices[unit.id], code: editor.value, codeOk: false, codeDigest: '', runProof: '', completionDigest: ''};
    state.completed.delete(unit.id);
    // Persist the draft synchronously so a reload immediately after typing cannot lose work.
    saveState(); renderNav();
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
    try {
      const response = await fetch('/api/run', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unitId:`exercise-${unit.id}`,code:submittedCode})});
      const payload = await response.json();
      if (editor.value !== submittedCode) throw new Error('stale code response');
      result.classList.add(payload.ok ? 'success' : 'failure');
      result.querySelector('.failure-guide').textContent = payload.ok ? '通过：这份代码已经过本章固定测试。' : exercise.failureHint;
      result.querySelector('pre').textContent = payload.output || (payload.ok ? 'PASS' : '测试失败');
      result.querySelector('span').textContent = `${payload.command || 'go test'} · ${payload.durationMs ?? 0}ms`;
      state.practices[unit.id] = {...state.practices[unit.id], codeOk: payload.ok, code: submittedCode, codeDigest: payload.artifactDigest, runProof: payload.runProof, codeVerifierVersion: payload.verifierVersion};
      if (!payload.ok) state.completed.delete(unit.id);
      saveState(); renderNav(); result.focus();
    } catch (error) { result.classList.add('failure'); result.querySelector('.failure-guide').textContent = '先确认预览服务已启动，再重新运行。'; result.querySelector('pre').textContent = error.message === 'stale code response' ? '代码已改变，旧测试结果已丢弃。' : '运行服务未启动，请使用 run-preview.sh。'; result.focus(); }
    finally { button.disabled = false; editor.disabled = false; button.textContent = '运行固定测试'; }
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
      state.practices[unit.id] = {...state.practices[unit.id], labOk: payload.ok, labDigest: payload.artifactDigest, labRunProof: payload.runProof, labVerifierVersion: payload.verifierVersion};
      if (!payload.ok) { state.completed.delete(unit.id); if (!state.reviewHistory.includes(`${unit.id}:lab`)) state.reviewHistory.push(`${unit.id}:lab`); }
      saveState(); renderNav(); result.focus();
    } catch (_error) {
      result.classList.add('failure'); result.querySelector('pre').textContent = '实验服务不可用，请从项目根目录运行 run-preview.sh。';
    } finally { button.disabled = false; button.textContent = '运行企业实验'; }
  });
}

function discardStaleEvidence() {
  if (localStorage.getItem('manga-go-version') === state.data.version) return;
  state.completed.clear(); state.answered.clear(); state.wrong = []; state.responses = {}; state.practices = {};
}

async function revalidateCompletedEvidence() {
  const candidates = [...state.completed];
  for (const id of candidates) {
    const unit = state.units.find((item) => item.id === id);
    const proof = state.practices[id];
    if (!unit) { state.completed.delete(id); continue; }
    const quizKeys = (unit.selfCheck || []).map((quiz, index) => ({key: `${id}:${index}`, quiz}));
    const quizAnswers = quizKeys.map(({key}) => state.responses[key]);
    const quizzesValid = quizKeys.length > 0 && quizKeys.every(({quiz}, index) => quizAnswers[index] === quiz.correctIndex);
    if (!quizzesValid) { state.completed.delete(id); continue; }
    if (unit.kind !== 'chapter') {
      if (unit.projectLab) {
        if (!proof?.codeOk || proof.codeVerifierVersion !== state.data.version || !proof.code) { state.completed.delete(id); continue; }
        if (!proof.labOk || proof.labVerifierVersion !== state.data.version) { state.completed.delete(id); continue; }
        try {
          const codeResponse = await fetch('/api/run', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unitId:`exercise-${id}`,code:proof.code})});
          const codeChecked = await codeResponse.json();
          if (!codeResponse.ok || !codeChecked.ok || !codeChecked.artifactDigest || !codeChecked.runProof) throw new Error('challenge revalidation failed');
          const labResponse = await fetch('/api/run', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unitId:unit.projectLab.id,code:proof.code})});
          const labChecked = await labResponse.json();
          if (!labResponse.ok || !labChecked.ok || !labChecked.artifactDigest || !labChecked.runProof) throw new Error('project lab revalidation failed');
          const freshEvidence = {
            codeDigest: codeChecked.artifactDigest,
            runProof: codeChecked.runProof,
            codeVerifierVersion: codeChecked.verifierVersion,
            labDigest: labChecked.artifactDigest,
            labRunProof: labChecked.runProof,
            labVerifierVersion: labChecked.verifierVersion,
          };
          const response = await fetch('/api/check', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unitId:id,quizAnswers,codeDigest:freshEvidence.labDigest,runProof:freshEvidence.labRunProof,challengeDigest:freshEvidence.codeDigest,challengeRunProof:freshEvidence.runProof})});
          const checked = await response.json();
          if (!response.ok || !checked.ok || !checked.completionDigest) throw new Error('completion revalidation failed');
          Object.assign(proof, freshEvidence, {completionDigest: checked.completionDigest});
        } catch (_error) { state.completed.delete(id); continue; }
      }
      quizKeys.forEach(({key}) => state.answered.add(key));
      state.completed.add(id);
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
}

function supplementHtml(supplement) {
  const chat = dialogueHtml(state.data, supplement.dialogue);
  const glossary = supplement.glossary.length ? `<ul class="glossary-list">${supplement.glossary.slice(0, 5).map(({term, meaning}) => `<li><b>${esc(term)}</b><span>${esc(meaning)}</span></li>`).join('')}</ul>` : '<p class="muted">这一节先不加新词，重点看它如何收住上一处事故。</p>';
  const code = supplement.code ? `<section class="code-card supplement-code">${codeLessonHtml(supplement)}</section>` : '';
  return `<details class="supplement-card" id="${esc(supplement.id)}"><summary>选修补页 · ${esc(supplement.title)} <span>＋</span></summary><div class="supplement-inner"><div class="incident-card"><div class="card-kicker">${esc(supplement.kicker)}</div>${supplement.opening.map((p) => `<p>${esc(p)}</p>`).join('')}</div><div class="chat-card">${chat}<div class="chat-close"><b>这一幕的结论</b><span>${esc(supplement.closing)}</span></div></div><div class="memory-card"><h3>像什么</h3><p class="memory-analogy">${esc(supplement.analogy)}</p></div><div class="glossary-card"><h3>黑话翻译</h3>${glossary}</div>${code}<div class="pitfall-grid"><div class="pitfall-panel"><h3>动手</h3><p>${esc(supplement.task)}</p></div><div class="task-panel"><h3>过关</h3><p>${esc(supplement.accept)}</p></div></div><div class="quiz-list supplement-quiz">${quizHtml(supplement)}</div></div></details>`;
}

function renderSupplements(unit) {
  if (unit.kind !== 'chapter' || !unit.supplements.length) { $('#supplementList').innerHTML = ''; return; }
  $('#supplementList').innerHTML = `<h3>本章补页 · 继续把边界钉牢</h3>${unit.supplements.map(supplementHtml).join('')}`;
  unit.supplements.forEach((supplement) => {
    const container = document.getElementById(supplement.id);
    if (container && supplement.code) bindCodeLesson(container, supplement);
    if (container) bindQuiz(container, supplement);
  });
}

function openUnit(id, stage = 'understand') {
  const index = state.units.findIndex((unit) => unit.id === id);
  if (index < 0) return;
  state.currentIndex = index;
  const unit = state.units[index];
  $('#welcome').classList.add('hidden');
  $('#unitView').classList.remove('hidden');
  $('#unitVolume').textContent = unit.volume?.title || 'Go 后端与 Harness AI';
  $('#unitTitle').textContent = unit.kind === 'chapter' ? unit.shortTitle : `补页 · ${unit.title}`;
  $('#unitGoal').textContent = unit.kind === 'chapter' ? `目标：${unit.goal}` : unit.kicker;
  const learning = unit.learning || {level: 3, label: '进阶', required: unit.kind === 'chapter', estimatedMinutes: 20, prerequisite: ''};
  const timeLabel = learning.readingMinutes ? `阅读 ${learning.readingMinutes} 分钟 · 动手 ${learning.practiceMinutes} 分钟` : `约 ${learning.estimatedMinutes} 分钟`;
  $('#unitMeta').innerHTML = `<span>难度 ${'●'.repeat(learning.level)}${'○'.repeat(5 - learning.level)} · ${esc(learning.label)}</span><span>${learning.required ? '主线' : '选修'} · ${timeLabel}</span><span>${esc(learning.prerequisite)}</span>`;
  $('#lkj').textContent = unit.transitionIn || '';
  $('#transitionOut').textContent = unit.transitionOut || unit.nextHook || '';
  renderIncident(unit); renderChat(unit); renderMemory(unit); renderFlow(unit); renderTechnical(unit); renderCode(unit); renderExercise(unit); renderSupplements(unit); renderNav();
  setStage(stage, false);
  $('#completeButton').innerHTML = state.completed.has(unit.id) ? '本节已完成 <span>✓</span>' : '标记本节完成 <span>✓</span>';
  $('#continueUnitButton').classList.toggle('hidden', !state.completed.has(unit.id) || index === state.units.length - 1);
  $('#prevButton').disabled = index === 0; $('#nextButton').disabled = index === state.units.length - 1;
  localStorage.setItem('manga-go-last-unit', unit.id);
  localStorage.setItem('manga-go-last-stage', stage);
  history.replaceState(null, '', `#${unit.id}`);
  window.scrollTo({top: 0, behavior: 'smooth'});
  $('#unitTitle').tabIndex = -1;
  $('#unitTitle').focus({preventScroll: true});
}

function setStage(stage, moveFocus = true) {
  state.stage = stage;
  $('#unitView').dataset.stage = stage;
  document.querySelectorAll('button[data-stage]').forEach((button) => { const active = button.dataset.stage === stage; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
  const index = ['understand', 'read', 'practice'].indexOf(stage);
  $('#stageButton').classList.toggle('hidden', index === 2);
  $('#completeButton').classList.toggle('hidden', index !== 2);
  if (index < 2) $('#stageButton').innerHTML = `下一步：${index === 0 ? '会读' : '会做'} <span>→</span>`;
  localStorage.setItem('manga-go-last-stage', stage);
  if (moveFocus) {
    const target = $(`.stage-${stage}:not(.hidden)`);
    if (target) {
      target.tabIndex = -1;
      target.scrollIntoView({block: 'start', behavior: 'smooth'});
      target.focus({preventScroll: true});
    }
  }
}

function showWelcome() {
  $('#unitView').classList.add('hidden');
  $('#welcome').classList.remove('hidden');
  history.replaceState(null, '', '#top');
  window.scrollTo({top: 0, behavior: 'smooth'});
  $('#startButton').focus({preventScroll: true});
}

function closeSidebar({restoreFocus = false} = {}) { const sidebar = $('.sidebar'); sidebar.classList.remove('open'); if (window.innerWidth <= 900) { sidebar.inert = true; sidebar.setAttribute('aria-hidden', 'true'); } $('#sidebarOverlay').classList.remove('open'); $('#menuToggle').setAttribute('aria-expanded', 'false'); if (restoreFocus) $('#menuToggle').focus(); }
function toggleSidebar() { const sidebar = $('.sidebar'); const open = sidebar.classList.toggle('open'); sidebar.inert = !open; sidebar.setAttribute('aria-hidden', String(!open)); $('#sidebarOverlay').classList.toggle('open', open); $('#menuToggle').setAttribute('aria-expanded', String(open)); if (open) sidebar.querySelector('button')?.focus(); }

function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); window.clearTimeout(showToast.timer); showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 1800); }

function openSearch() { $('#dialogTitle').textContent = '搜索教材'; $('#searchInput').hidden = false; $('#searchDialog').showModal(); $('#searchInput').focus(); }

function openReview() {
  const reviewKeys = [...new Set([...state.reviewHistory, ...state.wrong])];
  $('#dialogTitle').textContent = `复习记录 ${reviewKeys.length} 项`;
  $('#searchDialog').showModal();
  $('#searchInput').value = '';
  $('#searchInput').hidden = true;
  const items = reviewKeys.map((key) => {
    if (key.endsWith(':lab')) {
      const id = key.slice(0, -4); const unit = state.units.find((candidate) => candidate.id === id);
      return unit ? `<button class="search-result" data-unit="${id}" data-review-key="${esc(key)}"><b>${esc(unit.title)}</b><span>企业实验曾失败，需要重新运行并解释失败边界</span></button>` : '';
    }
    const [id, rawIndex] = key.split(':');
    const unit = state.units.find((candidate) => candidate.id === id);
    const quiz = unit?.selfCheck?.[Number(rawIndex)];
    return unit && quiz ? `<button class="search-result" data-unit="${id}" data-review-key="${esc(key)}"><b>${esc(unit.shortTitle || unit.title)}</b><span>${state.wrong.includes(key) ? '待纠正 · ' : '已纠正 · '}${esc(quiz.question)}</span></button>` : '';
  }).join('');
  $('#searchResults').innerHTML = items || '<p class="muted">暂时没有待复习题。答题时点“还不会”，它会出现在这里。</p>';
  $('#searchResults').querySelectorAll('[data-unit]').forEach((button) => button.addEventListener('click', () => { const key = button.dataset.reviewKey; $('#searchDialog').close(); openUnit(button.dataset.unit, 'practice'); requestAnimationFrame(() => { const target = key.endsWith(':lab') ? document.querySelector('[data-project-lab]') : document.querySelector(`[data-key="${CSS.escape(key)}"]`); if (target) { target.tabIndex = -1; target.scrollIntoView({block: 'center'}); target.focus(); } }); }));
}

function renderSearch(query) {
  const value = query.trim().toLowerCase();
  if (!value) { $('#searchResults').innerHTML = '<p class="muted">输入关键词开始搜索</p>'; return; }
  const results = [];
  state.units.forEach((unit) => {
    const haystack = JSON.stringify(unit).toLowerCase();
    if (haystack.includes(value)) results.push(unit);
  });
  $('#searchResults').innerHTML = results.length ? results.slice(0, 14).map((unit) => `<button class="search-result" data-unit="${unit.id}"><b>${esc(unit.kind === 'chapter' ? `第 ${unit.number} 章 · ${unit.shortTitle}` : `补页 · ${unit.title}`)}</b><span>${esc(unit.goal || unit.kicker || unit.analogy)}</span></button>`).join('') : '<p class="muted">暂时没有找到，换个词试试。</p>';
  $('#searchResults').querySelectorAll('[data-unit]').forEach((button) => button.addEventListener('click', () => { $('#searchDialog').close(); openUnit(button.dataset.unit); }));
}

async function boot() {
  const response = await fetch('data/book.json?v=18.7.0', {cache: 'no-store'});
  state.data = await response.json();
  state.units = flattenUnits(state.data);
  discardStaleEvidence();
  const revalidation = revalidateCompletedEvidence();
  $('#statChapters').textContent = state.data.chapters.length;
  $('#statSupplements').textContent = state.units.length - state.data.chapters.length;
  $('#statDialogues').textContent = state.data.stats.dialogueTurns;
  renderNav(); saveState();
  $('#startButton').addEventListener('click', () => openUnit(state.units[0].id));
  document.querySelectorAll('[data-start-chapter]').forEach((button) => button.addEventListener('click', () => openUnit(`chapter-${button.dataset.startChapter}`)));
  document.querySelectorAll('[data-start-unit]').forEach((button) => button.addEventListener('click', () => openUnit(button.dataset.startUnit)));
  $('#continueButton').addEventListener('click', () => openUnit(localStorage.getItem('manga-go-last-unit') || state.data.chapters.find((unit) => !state.completed.has(unit.id))?.id || state.data.chapters[0].id, localStorage.getItem('manga-go-last-stage') || 'understand'));
  $('#prevButton').addEventListener('click', () => openUnit(state.units[state.currentIndex - 1]?.id));
  $('#nextButton').addEventListener('click', () => openUnit(state.units[state.currentIndex + 1]?.id));
  document.querySelectorAll('button[data-stage]').forEach((button) => button.addEventListener('click', () => setStage(button.dataset.stage)));
  $('#stageButton').addEventListener('click', () => setStage(state.stage === 'understand' ? 'read' : 'practice'));
  $('#completeButton').addEventListener('click', async () => {
    const unit = state.units[state.currentIndex];
    if (state.completed.has(unit.id)) { state.completed.delete(unit.id); saveState(); renderNav(); $('#completeButton').innerHTML = '标记本节完成 <span>✓</span>'; $('#continueUnitButton').classList.add('hidden'); showToast('已取消完成标记'); return; }
    const keys = (unit.selfCheck || []).map((_, index) => `${unit.id}:${index}`);
    const pending = keys.filter((key) => !state.answered.has(key) || state.wrong.includes(key));
    if (pending.length) { showToast(`还有 ${pending.length} 道题需要确认掌握`); return; }
    if (unit.kind !== 'chapter') {
      if (unit.projectExercise && !state.practices[unit.id]?.codeOk) { showToast('先完成里程碑代码并通过固定测试'); return; }
      if (unit.projectLab && !state.practices[unit.id]?.labOk) { showToast('先运行并通过企业实验'); return; }
      const practice = state.practices[unit.id];
      try {
        const response = await fetch('/api/check', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unitId:unit.id,quizAnswers:keys.map((key)=>state.responses[key]),codeDigest:practice.labDigest,runProof:practice.labRunProof,challengeDigest:practice.codeDigest,challengeRunProof:practice.runProof})});
        const proof = await response.json();
        if (!proof.ok || !proof.completionDigest) throw new Error('completion rejected');
        state.practices[unit.id] = {...practice, completionDigest:proof.completionDigest};
        state.completed.add(unit.id); saveState(); renderNav(); $('#completeButton').innerHTML = '本节已完成 <span>✓</span>'; $('#continueUnitButton').classList.remove('hidden'); showToast('项目里程碑已完成');
      } catch (_error) { showToast('企业实验凭证无效，请重新运行'); }
      return;
    }
    const practice = state.practices[unit.id];
    if (unit.kind === 'chapter' && !practice?.workshopOk) { showToast('先通过三步工程演练'); return; }
    if (unit.workshop?.codeExercise && !practice?.codeOk) { showToast('先让固定 Go 测试通过'); return; }
    const quizAnswers = keys.map((key) => state.responses[key]);
    try {
      const response = await fetch('/api/check', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unitId:unit.id,answers:practice.answers,quizAnswers,codeDigest:practice.codeDigest || '',runProof:practice.runProof || ''})});
      const proof = await response.json();
      if (!proof.ok || !proof.completionDigest) throw new Error('completion rejected');
      state.practices[unit.id] = {...practice, completionDigest: proof.completionDigest};
      state.completed.add(unit.id); saveState(); renderNav();
      $('#completeButton').innerHTML = '本节已完成 <span>✓</span>'; $('#continueUnitButton').classList.remove('hidden'); showToast('已生成完整掌握凭证');
    } catch (_error) { showToast('完整凭证生成失败，请确认运行服务已启动'); }
  });
  $('#backToTop').addEventListener('click', () => window.scrollTo({top: 0, behavior: 'smooth'}));
  $('#continueUnitButton').addEventListener('click', () => openUnit(state.units[state.currentIndex + 1]?.id));
  $('#searchToggle').addEventListener('click', openSearch); $('#searchInput').addEventListener('input', (event) => renderSearch(event.target.value));
  $('#progressButton').addEventListener('click', openReview);
  $('#themeToggle').addEventListener('click', () => { document.body.classList.toggle('dark'); localStorage.setItem('jianjian-theme', document.body.classList.contains('dark') ? 'dark' : 'light'); });
  if (localStorage.getItem('jianjian-theme') === 'dark') document.body.classList.add('dark');
  $('#sidebarCollapse').addEventListener('click', () => $('.sidebar').classList.toggle('collapsed'));
  $('#menuToggle').addEventListener('click', toggleSidebar);
  $('#sidebarOverlay').addEventListener('click', () => closeSidebar({restoreFocus: true}));
  $('.brand').addEventListener('click', (event) => { event.preventDefault(); showWelcome(); });
  closeSidebar();
  $('#unitView').addEventListener('click', (event) => { if (event.target.closest('a')) return; });
  const initial = location.hash.slice(1); if (initial && state.units.some((unit) => unit.id === initial)) openUnit(initial, initial === localStorage.getItem('manga-go-last-unit') ? (localStorage.getItem('manga-go-last-stage') || 'understand') : 'understand');
  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (id === 'top') showWelcome();
    else if (id && state.units[state.currentIndex]?.id !== id && state.units.some((unit) => unit.id === id)) openUnit(id);
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeSidebar({restoreFocus: true}); if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); } });
  revalidation.then(() => {
    saveState(); renderNav();
    const current = state.units[state.currentIndex];
    if (current) {
      $('#completeButton').innerHTML = state.completed.has(current.id) ? '本节已完成 <span>✓</span>' : '标记本节完成 <span>✓</span>';
      $('#continueUnitButton').classList.toggle('hidden', !state.completed.has(current.id) || state.currentIndex === state.units.length - 1);
    }
  });
}

boot().catch((error) => { document.body.innerHTML = `<main style="padding:40px;font-family:system-ui"><h1>教材加载失败</h1><p>${esc(error.message)}</p><p>请通过本地开发服务器打开，而不是直接双击 HTML 文件。</p></main>`; });
