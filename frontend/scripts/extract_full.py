import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def full_text(docx_path):
    with zipfile.ZipFile(docx_path) as z:
        xml = z.read('word/document.xml').decode('utf-8')
    root = ET.fromstring(xml)
    lines = []
    for p in root.iter(f'{W}p'):
        texts = []
        for t in p.iter(f'{W}t'):
            if t.text:
                texts.append(t.text)
        line = ''.join(texts)
        if line.strip():
            lines.append(line)
    return lines


folder = Path(r'D:\projekt_filse\1-version-project\договоры')
for name in ['МУЦА.docx', 'ТПТ (1).docx', 'Гор.Больница (1).docx']:
    p = folder / name
    if not p.exists():
        continue
    lines = full_text(p)
    print('\n' + '='*80)
    print(name, 'lines:', len(lines))
    for i, line in enumerate(lines[:5]):
        print(f'P{i+1}: {line}')
    print('...')
    print('P3 FULL:', lines[2] if len(lines) > 2 else '')
    # find KP header
    for i, line in enumerate(lines):
        if 'Коммерческое' in line or 'КОММЕРЧЕСКОЕ' in line.upper():
            print('KP at', i+1, line)
    for i, line in enumerate(lines):
        if 'С П Е Ц И Ф И К А Ц И Я' in line:
            print('SPEC at', i+1)