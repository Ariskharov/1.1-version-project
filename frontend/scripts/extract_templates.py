import zipfile
import xml.etree.ElementTree as ET
import json
import re
from pathlib import Path

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def paragraphs(docx_path):
    with zipfile.ZipFile(docx_path) as z:
        xml = z.read('word/document.xml').decode('utf-8')
    root = ET.fromstring(xml)
    result = []
    for p in root.iter(f'{W}p'):
        texts = []
        for t in p.iter(f'{W}t'):
            if t.text:
                texts.append(t.text)
        line = ''.join(texts)
        if line.strip():
            result.append(line)
    return result


def extract_table_xml(docx_path):
    with zipfile.ZipFile(docx_path) as z:
        xml = z.read('word/document.xml').decode('utf-8')
    m = re.search(r'<w:tbl>.*?</w:tbl>', xml, re.DOTALL)
    return m.group(0) if m else ''


folder = Path(r'D:\projekt_filse\1-version-project\договоры')

# Contract body template from МУЦА (ends before signatures section 14)
muca = paragraphs(folder / 'МУЦА.docx')
contract_end = next(i for i, l in enumerate(muca) if l.startswith('14. Юридические'))
contract_body = muca[:contract_end]
print('Contract sections:', len(contract_body))

# Save contract template paragraphs
out = Path(__file__).parent / 'contract_template.json'
out.write_text(json.dumps(contract_body, ensure_ascii=False, indent=2), encoding='utf-8')
print('Saved', out)

# KP from hospital file
hosp = paragraphs(folder / 'Гор.Больница (1).docx')
kp_start = next(i for i, l in enumerate(hosp) if 'Коммерческое предложение' in l)
kp_end = next(i for i, l in enumerate(hosp[kp_start:], kp_start) if 'ИТОГО' in l and i > kp_start)
print('\nKP header lines:')
for line in hosp[:kp_start+1]:
    print(repr(line[:100]))
print('KP body after title:')
for line in hosp[kp_start+1:kp_start+8]:
    print(repr(line[:120]))

# Spec header from МУЦА
spec_idx = next(i for i, l in enumerate(muca) if 'С П Е Ц И Ф И К А Ц И Я' in l)
print('\nSpec context:')
for line in muca[spec_idx-3:spec_idx+2]:
    print(repr(line))

# Table xml sample
tbl = extract_table_xml(folder / 'МУЦА.docx')
print('\nTable XML length:', len(tbl))
print(tbl[:1500])