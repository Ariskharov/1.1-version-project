import zipfile
import re
from pathlib import Path

folder = Path(r'D:\projekt_filse\1-version-project\договоры')

for name in ['МУЦА.docx', 'Гор.Больница (1).docx']:
    with zipfile.ZipFile(folder / name) as z:
        xml = z.read('word/document.xml').decode('utf-8')
        styles = z.read('word/styles.xml').decode('utf-8') if 'word/styles.xml' in z.namelist() else ''
        sect = re.search(r'<w:sectPr>.*?</w:sectPr>', xml, re.DOTALL)
        print('\n===', name, '===')
        if sect:
            print('SECTPR:', sect.group(0)[:800])
        # signature block xml around line 49
        idx = xml.find('14. Юридические')
        if idx > 0:
            snippet = xml[idx:idx+4000]
            print('SIG XML snippet:')
            print(snippet[:3500])