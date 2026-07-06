import zipfile
import re
from pathlib import Path

tpl = Path(__file__).parent.parent / 'public' / 'templates' / 'contract.docx'
with zipfile.ZipFile(tpl) as z:
    xml = z.read('word/document.xml').decode('utf-8')

markers = [
    '{{CONTRACT_NO}}', '{{PREAMBLE}}', '{{TABLE_BODY}}', '{{TOTAL}}',
    '{{BUYER_SIG_ORG1}}', '{{DELIVERY_DAYS}}',
]
for m in markers:
    print(m, '->', m in xml)

# show table body placeholder context
idx = xml.find('{{TABLE_BODY}}')
print('\nTABLE context:', xml[idx-200:idx+200] if idx >= 0 else 'MISSING')

# extract one sample row from original for cloning
orig = Path(r'D:\projekt_filse\1-version-project\договоры\МУЦА.docx')
with zipfile.ZipFile(orig) as z:
    orig_xml = z.read('word/document.xml').decode('utf-8')
m = re.search(r'<w:tr w14:paraId="0F9E0F0D">.*?</w:tr>', orig_xml, re.DOTALL)
if m:
    print('\nSample row length:', len(m.group(0)))
    print(m.group(0)[:500])