import mermaid from 'mermaid';

let renderCount = 0;
const renderCache = new Map();

export async function renderMermaid(container, source) {
  const renderKey = String(++renderCount);
  const dark = document.body.classList.contains('dark');
  const cacheKey = `${dark ? 'dark' : 'light'}:${source}`;
  container.dataset.renderKey = renderKey;
  container.setAttribute('aria-busy', 'true');
  if (!renderCache.has(cacheKey)) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: dark ? 'dark' : 'base',
      fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif',
      flowchart: { htmlLabels: true, curve: 'basis', useMaxWidth: true },
      sequence: { useMaxWidth: true, wrap: true, mirrorActors: false },
      themeVariables: dark
        ? { primaryColor: '#1c2a35', primaryTextColor: '#f5f5f7', primaryBorderColor: '#64a9ef', lineColor: '#b9c1cb', secondaryColor: '#302329', tertiaryColor: '#1e2a27', edgeLabelBackground: '#303943', textColor: '#f5f5f7' }
        : { primaryColor: '#eaf2ff', primaryTextColor: '#17243a', primaryBorderColor: '#2867b2', lineColor: '#3a4652', secondaryColor: '#e8f7ef', tertiaryColor: '#fff2e2' },
    });
    const id = `course-diagram-cache-${renderCache.size + 1}-${dark ? 'dark' : 'light'}`;
    renderCache.set(cacheKey, mermaid.render(id, source).then(({svg}) => svg));
  }
  const svg = await renderCache.get(cacheKey);
  if (container.dataset.renderKey !== renderKey) return;
  container.innerHTML = svg;
  container.removeAttribute('aria-busy');
}
