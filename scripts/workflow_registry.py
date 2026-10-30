"""Load registered workflow document and output IDs from one public catalog."""
import json
from pathlib import Path
import re

REGISTRY = Path(__file__).resolve().parents[1] / 'workflows/registry.json'

def load_workflows(path=REGISTRY):
    workflows = json.loads(Path(path).read_text(encoding='utf-8'))
    if not isinstance(workflows, list) or not workflows:
        raise ValueError('Workflow registry must be a non-empty list')
    slugs, prefixes, outputs = set(), set(), set()
    for item in workflows:
        if not isinstance(item, dict):
            raise ValueError('Each workflow must be an object')
        slug, prefix = item.get('slug', ''), item.get('prefix', '')
        if not isinstance(slug, str) or not re.fullmatch(r'[a-z][a-z0-9]*(?:-[a-z0-9]+)*', slug) or slug in slugs:
            raise ValueError('Invalid or duplicate workflow slug')
        if not isinstance(prefix, str) or not re.fullmatch(r'[A-Z]+', prefix) or prefix in prefixes:
            raise ValueError('Invalid or duplicate workflow prefix')
        if not isinstance(item.get('name'), str) or not item['name'].strip():
            raise ValueError('Workflow name is required')
        for key in ('sop_stages', 'prd_requirements'):
            if type(item.get(key)) is not int or not 1 <= item[key] <= 999:
                raise ValueError(f'Invalid workflow count: {key}')
        kinds = item.get('outputs')
        if not isinstance(kinds, dict) or not kinds:
            raise ValueError('Workflow outputs must be a non-empty object')
        for key, name in kinds.items():
            if not re.fullmatch(prefix + r'[1-9][0-9]*', key) or key in outputs or not isinstance(name, str) or not name.strip():
                raise ValueError('Invalid or duplicate output type')
            outputs.add(key)
        slugs.add(slug)
        prefixes.add(prefix)
    return workflows
