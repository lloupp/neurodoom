#!/usr/bin/env python3
"""Summarize local recorder chunks. No upload; no external dependencies."""
import argparse, json
from collections import Counter, defaultdict
from pathlib import Path

def summarize(paths):
    sessions = defaultdict(list)
    rejected = []
    for path in paths:
        try:
            data = json.loads(Path(path).read_text())
            if not isinstance(data, dict) or not isinstance(data.get('events'), list):
                raise ValueError('missing events')
            sessions[data.get('session', str(path))].append(data)
        except (OSError, ValueError) as error:
            rejected.append({'path': str(path), 'error': str(error)})
    reports = []
    for session, chunks in sessions.items():
        chunks.sort(key=lambda c: (c.get('chunk', 0), c.get('duration_ms', 0)))
        events = [event for chunk in chunks for event in chunk['events'] if isinstance(event, dict)]
        kinds = Counter(e.get('kind', 'unknown') for e in events)
        heat = Counter()
        for e in events:
            payload = e.get('payload', {})
            if e.get('kind') == 'position_sample' and isinstance(payload, dict):
                heat[f"sector {e.get('level')}: {round(payload.get('x', 0)/2)},{round(payload.get('z', 0)/2)}"] += 1
        last = chunks[-1]
        reports.append({'session': session, 'chunks': len(chunks), 'completed': last.get('completed'),
                        'stats': last.get('stats'), 'headless': last.get('headless'),
                        'performance': last.get('performance'), 'events': dict(kinds),
                        'most_visited_cells': heat.most_common(10), 'objectives': last.get('objectives', [])})
    return {'sessions': reports, 'rejected_files': rejected}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('files', nargs='+', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    text = json.dumps(summarize(args.files), indent=2, ensure_ascii=False)
    if args.output: args.output.write_text(text + '\n')
    else: print(text)
