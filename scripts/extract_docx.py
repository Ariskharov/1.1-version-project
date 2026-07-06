import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def get_text_and_styles(docx_path):
    with zipfile.ZipFile(docx_path) as z:
        xml = z.read('word/document.xml').decode('utf-8')
        styles_xml = z.read('word/styles.xml').decode('utf-8') if 'word/styles.xml' in z.namelist() else ''
    root = ET.fromstring(xml)
    lines = []
    fonts = set()
    sizes = set()
    for p in root.iter(f'{W}p'):
        texts = []
        bold = False
        align = 'left'
        pPr = p.find('w:pPr', NS)
        if pPr is not None:
            jc = pPr.find('w:jc', NS)
            if jc is not None:
                align = jc.get(f'{W}val', 'left')
        for r in p.iter(f'{W}r'):
            rPr = r.find('w:rPr', NS)
            if rPr is not None:
                if rPr.find('w:b', NS) is not None:
                    bold = True
                sz = rPr.find('w:sz', NS)
                if sz is not None:
                    sizes.add(sz.get(f'{W}val'))
                rFonts = rPr.find('w:rFonts', NS)
                if rFonts is not None:
                    for attr in ['ascii', 'hAnsi', 'cs', 'eastAsia']:
                        v = rFonts.get(f'{W}{attr}')
                        if v:
                            fonts.add(v)
            for t in r.iter(f'{W}t'):
                if t.text:
                    texts.append(t.text)
        line = ''.join(texts).strip()
        if line:
            lines.append((align, bold, line))
    return lines, fonts, sizes, styles_xml


def dump_tables(docx_path):
    with zipfile.ZipFile(docx_path) as z:
        xml = z.read('word/document.xml').decode('utf-8')
    root = ET.fromstring(xml)
    tables = []
    for tbl in root.iter(f'{W}tbl'):
        rows = []
        for tr in tbl.iter(f'{W}tr'):
            cells = []
            for tc in tr.iter(f'{W}tc'):
                cell_text = []
                for t in tc.iter(f'{W}t'):
                    if t.text:
                        cell_text.append(t.text)
                cells.append(''.join(cell_text).strip())
            rows.append(cells)
        tables.append(rows)
    return tables


if __name__ == '__main__':
    folder = Path(r'D:\projekt_filse\1-version-project\договоры')
    # Use a representative contract
    sample = folder / 'МУЦА.docx'
    if not sample.exists():
        sample = next(folder.glob('*.docx'))

    lines, fonts, sizes, styles = get_text_and_styles(sample)
    tables = dump_tables(sample)

    print('FILE:', sample.name)
    print('FONTS:', fonts)
    print('SIZES:', sorted(sizes))
    print('\n--- DOCUMENT TEXT ---')
    for i, (a, b, t) in enumerate(lines):
        mark = 'B' if b else ' '
        print(f'{i+1:3}| {a:6}|{mark}| {t[:200]}')

    print('\n--- TABLES ---')
    for ti, table in enumerate(tables):
        print(f'Table {ti+1}:')
        for row in table:
            print(' | '.join(row))

    print('\n--- STYLES (head) ---')
    print(styles[:3000])