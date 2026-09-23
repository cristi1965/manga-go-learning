"""Apply reviewed narrative only; leave code, quizzes and proof contracts unchanged."""
import json
from pathlib import Path
from build_text_review import load_source, load_story_layers
ROOT = Path(__file__).resolve().parent

def source_stories():
    stories, _ = load_story_layers(load_source())
    result = {f'chapter-{key}': value for key, value in stories['chapters'].items()}
    result.update({f'supplement-{key}': value for key, value in stories['supplements'].items()})
    result.update(json.loads((ROOT / 'manuscript/story-ai-projects.json').read_text()))
    return result

def main():
    path = ROOT / 'interactive/data/book.json'
    book = json.loads(path.read_text())
    units = [u for c in book['chapters'] for u in [c, *c['supplements']]]
    stories = source_stories()
    if set(stories) != {u['id'] for u in units}:
        raise ValueError('Story coverage mismatch')
    for unit in units:
        story = stories[unit['id']]
        unit.update(opening=story['opening'], closing=story['closing'], dialogue=[dict(speaker=s,text=t) for s,t in story['dialogue']])
    book['stats']['dialogueTurns'] = sum(len(u['dialogue']) for u in units)
    path.write_text(json.dumps(book,ensure_ascii=False,indent=2)+'\n')
    print(f'Applied narrative to {len(units)} units')

if __name__ == '__main__': main()
