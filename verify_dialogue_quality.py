"""Structural/source-parity checks; conversational quality requires editorial review."""
import hashlib
import json
from collections import Counter
from pathlib import Path
from sync_dialogue import source_stories
from build_html import normalize_learning_story_terms
ROOT = Path(__file__).resolve().parent

def main():
    stories = source_stories()
    path = ROOT / 'interactive/data/book.json'
    book = json.loads(path.read_text())
    units = [u for c in book['chapters'] for u in [c, *c['supplements']]]
    failures = []
    if set(stories) != {u['id'] for u in units}: failures.append('Source/render coverage mismatch')
    lines=[]
    for unit in units:
        key=unit['id']; story=stories[key]; turns=story['dialogue']
        if not 4<=len(turns)<=6: failures.append(f'{key}: expected 4–6 utterances')
        if not 2<=len(set(s for s,t in turns))<=3: failures.append(f'{key}: expected 2–3 speakers')
        if any(not text.strip() or len(text)>180 for _,text in turns): failures.append(f'{key}: empty/oversized turn')
        expected = normalize_learning_story_terms({
            'dialogue': [dict(speaker=s, text=t) for s, t in turns],
            'opening': story['opening'],
            'closing': story['closing'],
        })
        if key == 'chapter-5':
            expected['dialogue'][-2:] = [
                {'speaker': '陈平安', 'text': '外部 package 怎样知道哪些名字可以用？'},
                {'speaker': '宁姚', 'text': '看首字母。Order、ID 和 Label 大写开头，外部可以引用；helper 小写开头，只留在 orders 包内。'},
            ]
            expected['closing'] = '对外只暴露 Order、ID 和 Label，helper 保持包内可见；固定测试从另一个 package 验证这条边界。'
        if unit['dialogue'] != expected['dialogue'] or unit['opening'] != expected['opening'] or unit['closing'] != expected['closing']:
            failures.append(f'{key}: narrative drift')
        lines.extend(text for _,text in turns)
    duplicates=[text for text,n in Counter(lines).items() if n>1]
    if duplicates: failures.append('Repeated dialogue lines')
    report={'status':'fail' if failures else 'pass','units':len(units),'turns':len(lines),'book_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'failures':failures,'duplicate_lines':duplicates,'scope':'Structure and source parity after approved learner-facing terminology normalization; no pedagogical score.'}
    (ROOT/'evidence/dialogue-quality-v16.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False))
    if failures: raise SystemExit(1)

if __name__=='__main__': main()
