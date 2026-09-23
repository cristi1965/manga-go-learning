"""Structural/source-parity checks; conversational quality requires editorial review."""
import hashlib
import json
from collections import Counter
from pathlib import Path
from sync_dialogue import source_stories
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
        expected=[dict(speaker=s,text=t) for s,t in turns]
        if unit['dialogue']!=expected or unit['opening']!=story['opening'] or unit['closing']!=story['closing']: failures.append(f'{key}: narrative drift')
        lines.extend(text for _,text in turns)
    duplicates=[text for text,n in Counter(lines).items() if n>1]
    if duplicates: failures.append('Repeated dialogue lines')
    report={'status':'fail' if failures else 'pass','units':len(units),'turns':len(lines),'book_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'failures':failures,'duplicate_lines':duplicates,'scope':'Structure and exact source parity only; no pedagogical score.'}
    (ROOT/'evidence/dialogue-quality-v16.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False))
    if failures: raise SystemExit(1)

if __name__=='__main__': main()
