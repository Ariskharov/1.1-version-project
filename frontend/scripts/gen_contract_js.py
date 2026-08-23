import json
import re
from pathlib import Path

lines = json.loads(Path(__file__).parent.joinpath('contract_template.json').read_text(encoding='utf-8'))

def classify(text, idx):
    t = text.strip()
    if idx == 0:
        return 'title'
    if idx == 1:
        return 'dateCity'
    if idx == 2:
        return 'preamble'
    if re.match(r'^\d+\.\s*[А-ЯA-Z]', t) and not re.match(r'^\d+\.\d+', t):
        return 'sectionHeader'
    if t.startswith('2.2.'):
        return 'totalLine'
    if '5.1.' in t and 'обязуется поставить' in t:
        return 'deliveryLine'
    return 'body'


items = []
for i, text in enumerate(lines):
    kind = classify(text, i)
    items.append({'type': kind, 'text': text})

out = Path(__file__).parent.parent / 'src' / 'utils' / 'contractBodyTemplate.js'
out.write_text(
    '/* Auto-generated from original договоры/МУЦА.docx */\n'
    'export const CONTRACT_BODY_TEMPLATE = '
    + json.dumps(items, ensure_ascii=False, indent=2)
    + ';\n',
    encoding='utf-8',
)
print('Wrote', out, 'items:', len(items))