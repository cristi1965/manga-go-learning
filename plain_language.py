"""Apply reviewed display wording without changing exercises or grading values."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FILES = [ROOT / 'manuscript/plain-language' / f'{part}.json' for part in ('go', 'backend', 'harness')]

def apply_plain_language(book):
    units = {u['id']: u for chapter in book['chapters'] for u in [chapter, *chapter['supplements']]}
    seen = set()
    briefs = {}
    for path in FILES:
        data = json.loads(path.read_text())
        for key, fields in data['units'].items():
            if key in seen or key not in units:
                raise ValueError(f'Duplicate or unknown unit: {key}')
            seen.add(key)
            for field, value in fields.items():
                parts = field.split('.')
                target = units[key]
                for part in parts[:-1]:
                    target = target[int(part)] if isinstance(target, list) else target[part]
                last = int(parts[-1]) if isinstance(target, list) else parts[-1]
                if isinstance(target, dict) and last not in target and last not in {'choiceLabels', 'optionLabels'}:
                    raise ValueError(f'Unexpected new field: {key}.{field}')
                if parts[-1] in {'code', 'choices', 'options', 'correctIndex', 'id'}:
                    raise ValueError(f'Cannot replace execution/grading field: {field}')
                target[last] = value
        for key, brief in data.get('briefs', {}).items():
            briefs[f'chapter-{key}' if key.isdigit() else key] = brief
    if seen != set(units):
        raise ValueError(f'Missing copy: {set(units)-seen}')
    for unit in units.values():
        for quiz in unit.get('selfCheck', []):
            if 'choiceLabels' in quiz and len(quiz['choiceLabels']) != len(quiz['choices']):
                raise ValueError(f'Choice count changed: {unit["id"]}')
        for field in unit.get('workshop', {}).get('fields', []):
            if 'optionLabels' in field and len(field['optionLabels']) != len(field['options']):
                raise ValueError(f'Option count changed: {unit["id"]}')
        number = unit.get('number') if unit['kind'] == 'chapter' else unit.get('chapter')
        volume = 1 if number <= 8 else 2 if number <= 16 else 3
        unit['volume']['title'] = {1:'第一部分：学会写 Go',2:'第二部分：做一个后端服务',3:'第三部分：让 AI 安全可靠地办事'}[volume]
    return briefs

def main():
    path = ROOT / 'interactive/data/book.json'
    book = json.loads(path.read_text())
    briefs = apply_plain_language(book)
    if len(briefs) != 24:
        raise ValueError('Expected 24 lesson introductions')
    path.write_text(json.dumps(book, ensure_ascii=False, indent=2)+'\n')
    (ROOT/'interactive/lesson-briefs.js').write_text('export const lessonBriefs = '+json.dumps(briefs,ensure_ascii=False,indent=2)+';\n')
    print(f'Updated {len(briefs)} introductions and all unit display copy')

if __name__ == '__main__':
    main()
