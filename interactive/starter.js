import { mountCodeEditor } from './vendor/editor.js';
const STORAGE_KEY = 'starter-v1';
const STEPS = [
  {
    title: '让程序说一句话',
    code: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println(100)\n}\n',
    explanations: [
      '第 1 行 package main 表示这是能直接运行的程序；第 3 行 import "fmt" 引入打印工具。',
      '第 5 行 func main() 是程序的入口；花括号里的第 6 行会执行，fmt.Println(100) 把数字 100 打印到运行结果中。',
      '最后的 } 结束 main；空行只是为了方便阅读。',
    ],
    expected: '100', task: '只把第 6 行的 100 改成 80，再运行。', changed: '80',
    change: {from: 'fmt.Println(100)', to: 'fmt.Println(80)'},
  },
  {
    title: '用变量记住钱数',
    code: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tbalance := 100\n\tcost := 30\n\tfmt.Println(balance - cost)\n}\n',
    explanations: [
      '前 5 行和上一步一样，准备打印工具并进入 main；第 6 行 balance := 100 创建变量 balance，保存余额 100。',
      '第 7 行 cost := 30 创建变量 cost，保存支出 30；:= 表示创建变量并放入初始值。',
      '第 8 行先算 balance - cost，也就是 100 - 30，再打印结果；这个算式没有修改 balance 本身。',
    ],
    expected: '70', task: '只把第 7 行的支出 30 改成 40，再运行。', changed: '60',
    change: {from: 'cost := 30', to: 'cost := 40'},
  },
  {
    title: '钱不够时走另一条路',
    code: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tbalance := 100\n\tcost := 120\n\tif balance < cost {\n\t\tfmt.Println("钱不够")\n\t} else {\n\t\tfmt.Println(balance - cost)\n\t}\n}\n',
    explanations: [
      '第 6–7 行分别存入余额 100 和支出 120；第 8 行 if balance < cost 检查余额是否小于支出。',
      '条件成立时只执行第 9 行，打印“钱不够”；字符串两侧的双引号不会打印出来。',
      '条件不成立时执行 else 里的第 11 行，打印剩余金额；两条分支每次只走一条。',
    ],
    expected: '钱不够', task: '只把第 7 行的支出 120 改成 30，再运行，观察分支变化。', changed: '70',
    change: {from: 'cost := 120', to: 'cost := 30'},
  },
  {
    title: '让函数交回计算结果',
    code: 'package main\n\nimport "fmt"\n\nfunc remaining(balance int, cost int) int {\n\treturn balance - cost\n}\n\nfunc main() {\n\tleft := remaining(100, 30)\n\tfmt.Println(left)\n}\n',
    explanations: [
      '第 5 行定义 remaining 函数：balance 和 cost 是两个整数参数，括号后的 int 表示它会交回一个整数。',
      '程序从第 9 行 main 开始；第 10 行调用 remaining(100, 30)，把两个数字交给函数，第 6 行 return 算出并交回 70。',
      '回到第 10 行后，left 保存交回的值；第 11 行才打印它。return 本身不会打印，也不会自动检查钱够不够。',
    ],
    expected: '70', task: '只把第 10 行调用里的支出 30 改成 45，再运行。', changed: '55',
    change: {from: 'left := remaining(100, 30)', to: 'left := remaining(100, 45)'},
  },
  {
    title: '让函数同时交回结果和错误',
    code: 'package main\n\nimport (\n\t"errors"\n\t"fmt"\n)\n\nfunc remaining(balance, cost int) (int, error) {\n\tif balance < cost {\n\t\treturn 0, errors.New("钱不够")\n\t}\n\treturn balance - cost, nil\n}\n\nfunc main() {\n\tleft, err := remaining(100, 120)\n\tfmt.Println(left, err)\n}\n',
    explanations: [
      '函数签名后的 (int, error) 表示它会交回两个值：计算结果和错误。',
      '钱不够时返回 0 和一个具体错误；足够时返回剩余金额和 nil。nil 表示没有错误。',
      'left, err := ... 一次接住两个返回值。这一步先观察它们，下一步再正式处理 err。',
    ],
    expected: '0 钱不够', task: '只把 remaining(100, 120) 中的 120 改成 30，再运行。', changed: '70 <nil>',
    change: {from: 'left, err := remaining(100, 120)', to: 'left, err := remaining(100, 30)'},
  },
  {
    title: '先检查错误，再使用结果',
    code: 'package main\n\nimport (\n\t"errors"\n\t"fmt"\n)\n\nfunc remaining(balance, cost int) (int, error) {\n\tif balance < cost {\n\t\treturn 0, errors.New("钱不够")\n\t}\n\treturn balance - cost, nil\n}\n\nfunc main() {\n\tleft, err := remaining(100, 120)\n\tif err != nil {\n\t\tfmt.Println("失败:", err)\n\t\treturn\n\t}\n\tfmt.Println("剩余:", left)\n}\n',
    explanations: [
      'err != nil 表示这次调用失败。程序先输出失败原因，再用 return 提前结束 main。',
      '只有 err 是 nil 时，程序才会继续走到最后一行并使用 left。这是 Go 中最常见的错误处理顺序。',
      '这里没有隐藏的异常机制；成功和失败都由普通返回值表达。',
    ],
    expected: '失败: 钱不够', task: '只把 remaining(100, 120) 中的 120 改成 30，再运行。', changed: '剩余: 70',
    change: {from: 'left, err := remaining(100, 120)', to: 'left, err := remaining(100, 30)'},
  },
];

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function normalizeCode(value) {
  return value.replace(/\r\n/g, '\n').trimEnd();
}

function normalizeOutput(value) {
  return value.replace(/\r\n/g, '\n').trim();
}

function changedCode(step) {
  return step.code.replace(step.change.from, step.change.to);
}

function explainUnexpectedChange(step, value) {
  const current = normalizeCode(value);
  const expected = normalizeCode(changedCode(step));
  if (current.includes(step.change.to)) {
    const changedLines = current.split('\n').reduce((count, line, index) => count + (line !== expected.split('\n')[index] ? 1 : 0), 0);
    return `目标内容已经改对，但还有 ${changedLines} 行与任务无关的变化。先点“还原本步代码”，再只改：${step.change.from} → ${step.change.to}`;
  }
  if (current.includes(step.change.from)) return `还没有改到目标位置。请找到“${step.change.from}”，只替换为“${step.change.to}”。`;
  return `目标行被改成了别的内容。先点“还原本步代码”，再把“${step.change.from}”改为“${step.change.to}”。`;
}

export function mountStarter(container) {
  let saved = {};
  let storageAvailable = true;
  let legacyProgressReset = false;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (parsed && typeof parsed === 'object') saved = parsed;
  } catch { storageAvailable = false; }
  const currentSchema = saved.schemaVersion === 2;
  legacyProgressReset = !currentSchema && (Array.isArray(saved.ranSteps) || Array.isArray(saved.drafts));
  let index = currentSchema && Number.isInteger(saved.step) && saved.step >= 0 && saved.step < STEPS.length ? saved.step : 0;
  const drafts = STEPS.map((step, i) => currentSchema && typeof saved.drafts?.[i] === 'string' ? saved.drafts[i] : step.code);
  const predictions = STEPS.map((_, i) => typeof saved.predictions?.[i] === 'string' ? saved.predictions[i] : '');
  const originalRanSteps = STEPS.map((_, i) => currentSchema && Boolean(saved.originalRanSteps?.[i]));
  const changedVerifiedSteps = STEPS.map((_, i) => currentSchema && Boolean(saved.changedVerifiedSteps?.[i]));
  let pending = false;
  let storageNote;

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        schemaVersion: 2,
        step: index,
        drafts,
        predictions,
        originalRanSteps,
        changedVerifiedSteps,
        // app.js reads ranSteps to decide whether the entire starter is complete.
        ranSteps: changedVerifiedSteps,
      }));
      storageAvailable = true;
    } catch { storageAvailable = false; }
    if (storageNote) storageNote.textContent = storageAvailable
      ? (legacyProgressReset ? '起步验证规则已升级；旧完成记录已安全重置，草稿将按新规则保存。' : '草稿自动保存在此浏览器。')
      : '浏览器暂不能保存草稿；离开页面前请自行复制代码。';
  }

  function render() {
    const step = STEPS[index];
    const root = element('section', 'starter');
    root.setAttribute('aria-label', '零基础起步练习');
    root.append(element('p', 'starter-progress', `起步练习 · ${index + 1} / ${STEPS.length}`));
    const heading = element('h2', 'starter-title', step.title);
    heading.tabIndex = -1;
    root.append(heading);
    const predictionLabel = element('label', 'starter-prediction-label', '运行前先猜：这段程序会输出什么？');
    const prediction = element('input', 'starter-prediction');
    prediction.type = 'text';
    prediction.autocomplete = 'off';
    prediction.placeholder = '写下你的猜测，不要求一次猜对';
    prediction.value = predictions[index];
    predictionLabel.append(prediction);
    root.append(predictionLabel);
    prediction.addEventListener('input', () => {
      predictions[index] = prediction.value;
      persist();
    });
    const explanations = element('div', 'starter-explanations');
    step.explanations.forEach((text) => explanations.append(element('p', 'starter-explanation', text)));
    root.append(explanations);
    const label = element('label', 'starter-editor-label', '完整 Go 代码（可编辑）');
    const editor = element('textarea', 'starter-editor');
    editor.rows = 15;
    editor.spellcheck = false;
    editor.autocapitalize = 'off';
    editor.value = drafts[index];
    label.append(editor);
    root.append(label);
    editor.addEventListener('input', () => {
      drafts[index] = editor.value;
      if (normalizeCode(editor.value) !== normalizeCode(changedCode(step))) changedVerifiedSteps[index] = false;
      persist();
      status.textContent = '代码已修改；下方保留的是上一次运行结果，请重新运行查看变化。';
      renderVerificationState();
    });
    const reveal = element('section', 'starter-reveal');
    reveal.hidden = !originalRanSteps[index];
    reveal.append(element('p', 'starter-expected-label', '第一次运行应看到'));
    reveal.append(element('pre', 'starter-expected', step.expected));
    reveal.append(element('p', 'starter-task', `接着只改一个数字：${step.task}`));
    reveal.append(element('p', 'starter-task-expected', `改完后再预测，再运行。参考输出：${step.changed}`));
    root.append(reveal);
    const verification = element('div', 'starter-verification-status');
    verification.setAttribute('aria-label', '本步验证状态');
    root.append(verification);
    const actions = element('div', 'starter-actions');
    const run = element('button', 'starter-run', '运行代码');
    const reset = element('button', 'starter-reset', '还原本步代码');
    run.type = reset.type = 'button';
    actions.append(run, reset);
    root.append(actions);
    const initialStatus = changedVerifiedSteps[index]
      ? '修改已验证，本步已完成。'
      : (originalRanSteps[index] ? '原例已运行；现在只改任务指定的内容，再运行验证。' : '尚未运行原例。');
    const status = element('p', 'starter-status', initialStatus);
    status.setAttribute('role', 'status');
    const output = element('pre', 'starter-output', '运行后，程序输出会显示在这里。');
    output.setAttribute('aria-label', '运行结果');
    output.tabIndex = 0;
    root.append(status, output);
    storageNote = element('p', 'starter-storage');
    root.append(storageNote);
    persist();
    const nav = element('nav', 'starter-nav');
    nav.setAttribute('aria-label', '起步练习步骤');
    const prev = element('button', 'starter-prev', '上一步');
    const next = element('button', 'starter-next', '下一步');
    prev.type = next.type = 'button';
    prev.disabled = index === 0;
    next.disabled = index === STEPS.length - 1 || !changedVerifiedSteps[index];
    nav.append(prev, element('span', 'starter-nav-count', `${index + 1} / ${STEPS.length}`), next);
    root.append(nav);
    if (index === STEPS.length - 1) root.append(element('p', 'starter-finish', '这是最后一步。你可以返回前面的步骤，继续改数字并观察运行结果。'));
    container.replaceChildren(root);
    mountCodeEditor(editor);
    renderVerificationState();
    window.dispatchEvent(new CustomEvent('starter-progress', {detail: {complete: changedVerifiedSteps.every(Boolean), current: index + 1}}));

    function renderVerificationState() {
      verification.replaceChildren(
        element('span', originalRanSteps[index] ? 'is-complete' : 'is-pending', `${originalRanSteps[index] ? '✓' : '○'} 原例已运行`),
        element('span', changedVerifiedSteps[index] ? 'is-complete' : 'is-pending', `${changedVerifiedSteps[index] ? '✓' : '○'} 修改已验证`),
      );
    }

    function move(delta) {
      if (pending) return;
      index += delta;
      persist();
      render();
      requestAnimationFrame(() => {
        container.scrollIntoView({block: 'start', behavior: 'auto'});
        container.querySelector('.starter-title').focus({preventScroll: true});
      });
    }
    prev.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    reset.addEventListener('click', () => {
      if (pending) return;
      editor.value = drafts[index] = step.code;
      changedVerifiedSteps[index] = false;
      persist();
      status.textContent = originalRanSteps[index] ? '已还原本步代码；原例记录保留，请按任务修改后再运行。' : '已还原本步代码，请先运行原例。';
      output.textContent = '尚未运行还原后的代码。';
      renderVerificationState();
    });
    run.addEventListener('click', async () => {
      if (pending) return;
      if (!prediction.value.trim()) {
        status.textContent = '先写下你认为会出现的输出，再运行验证。';
        prediction.focus();
        return;
      }
      if (!editor.value.trim()) {
        status.textContent = '请先输入代码，或点击“还原本步代码”。';
        return;
      }
      const currentCode = normalizeCode(editor.value);
      const originalCode = normalizeCode(step.code);
      const expectedChangedCode = normalizeCode(changedCode(step));
      const runningOriginal = currentCode === originalCode;
      const runningExpectedChange = currentCode === expectedChangedCode;
      if (!originalRanSteps[index] && !runningOriginal) {
        status.textContent = '请先点击“还原本步代码”，成功运行原例后再修改。';
        return;
      }
      if (originalRanSteps[index] && !runningExpectedChange) {
        status.textContent = runningOriginal
          ? `原例已验证。${step.task}`
          : explainUnexpectedChange(step, editor.value);
        return;
      }
      pending = true;
      [run, reset, prev, next].forEach((button) => { button.disabled = true; });
      editor.readOnly = true;
      run.textContent = '运行中…';
      status.textContent = '正在运行当前代码…';
      output.textContent = '等待运行服务返回结果…';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 70000);
      try {
        // chapter-1 is the existing plain `go run main.go` route, without grading.
        const response = await fetch('/api/run', {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({unitId: 'chapter-1', code: editor.value}), signal: controller.signal,
        });
        const payload = await response.json();
        const ok = response.ok && payload.ok === true;
        output.textContent = typeof payload.output === 'string' && payload.output ? payload.output : (ok ? '程序没有输出。' : `运行失败（HTTP ${response.status}）。`);
        if (ok) {
          const actualOutput = normalizeOutput(payload.output || '');
          const expectedOutput = normalizeOutput(runningOriginal ? step.expected : step.changed);
          if (actualOutput === expectedOutput && runningOriginal) {
            originalRanSteps[index] = true;
            reveal.hidden = false;
            status.textContent = `原例已运行：输出 ${step.expected}。现在${step.task}`;
          } else if (actualOutput === expectedOutput && runningExpectedChange) {
            changedVerifiedSteps[index] = true;
            status.textContent = `修改已验证：输出 ${step.changed}。本步完成。`;
          } else {
            status.textContent = `程序运行成功，但输出与本阶段预期不同；应看到 ${expectedOutput}。`;
          }
          persist();
          renderVerificationState();
          window.dispatchEvent(new CustomEvent('starter-progress', {detail: {complete: changedVerifiedSteps.every(Boolean), current: index + 1}}));
        } else {
          status.textContent = '运行失败。请查看下面的错误信息，修改代码后再试。';
        }
      } catch (error) {
        status.textContent = '未获得运行结果。';
        output.textContent = error.name === 'AbortError' ? '等待运行结果超时，请稍后重试。' : '无法连接运行服务或读取结果。请使用项目里的 run-preview.sh 启动预览，再重试。';
      } finally {
        clearTimeout(timeout);
        pending = false;
        run.disabled = reset.disabled = false;
        prev.disabled = index === 0;
        next.disabled = index === STEPS.length - 1 || !changedVerifiedSteps[index];
        editor.readOnly = false;
        run.textContent = '运行代码';
      }
    });
  }
  render();
}
