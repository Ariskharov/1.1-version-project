"""Build docx templates with placeholders from original samples."""
import zipfile
import re
import shutil
from pathlib import Path

SRC = Path(r'D:\projekt_filse\1-version-project\договоры')
OUT = Path(__file__).resolve().parent.parent / 'public' / 'templates'
OUT.mkdir(parents=True, exist_ok=True)


def patch_docx(src_name, dst_name, patches):
    src = SRC / src_name
    dst = OUT / dst_name
    shutil.copy2(src, dst)
    with zipfile.ZipFile(dst, 'r') as zin:
        files = {name: zin.read(name) for name in zin.namelist()}
    xml = files['word/document.xml'].decode('utf-8')
    for old, new in patches:
        if old not in xml:
            print(f'  WARN missing in {dst_name}: {old[:60]}...')
        xml = xml.replace(old, new)
    files['word/document.xml'] = xml.encode('utf-8')
    with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as zout:
        for name, data in files.items():
            zout.writestr(name, data)
    print('Created', dst)


# --- Contract + spec (from МУЦА) ---
PREAMBLE_OLD = (
    'ОсОО «Токмокское УПП КОС и КОГ», именуемая в дальнейшем «Поставщик» в лице директора '
    'Турбатова Саламата Адылбековича, действующего на основании Устава, с одной стороны '
    'Международный университет в Центральной Азии,  в лице президента  Джон Росслин Кларка '
    'именуемый в дальнейшем «Покупатель» действующего на основании Положения, заключили '
    'настоящий договор согласно закона Кыргызской Республики №27 от 14 апреля 2022 года '
    '«О государственных закупках» статья 17, часть 3, пункт 12. Методом из одного источника.'
)
PREAMBLE_NEW = '{{PREAMBLE}}'

# Table data row in МУЦА
TABLE_ROW_OLD = (
    '<w:tr w14:paraId="0F9E0F0D"><w:trPr><w:trHeight w:val="454" w:hRule="atLeast"/></w:trPr>'
)
# We'll replace the single product row block via regex
TABLE_ROW_PATTERN = re.compile(
    r'<w:tr w14:paraId="0F9E0F0D">.*?</w:tr>\s*<w:tr w14:paraId="2C8B0B0F">',
    re.DOTALL,
)

contract_patches = [
    ('Д О Г О В О Р №2', 'Д О Г О В О Р №{{CONTRACT_NO}}'),
    (
        ' «16»  января 2026 года                                                                                            г.Токмок',
        ' «{{DAY}}»  {{MONTH}} {{YEAR}} года                                                                                            г.{{CITY}}',
    ),
    (PREAMBLE_OLD, PREAMBLE_NEW),
    (
        '2.2. Общая сумма договора составляет  65000 (шестьдесят пять тысяч) сом, с учетом всех налогов и платежей.',
        '2.2. Общая сумма договора составляет  {{TOTAL}} ({{TOTAL_WORDS}}) сом, с учетом всех налогов и платежей.',
    ),
    (
        '5.1. «Поставщик» обязуется поставить продукцию в течении 30 (тридцать) рабочих дней с момента подписания настоящего договора на склад «Покупателя».',
        '5.1. «Поставщик» обязуется поставить продукцию в течении {{DELIVERY_DAYS}} ({{DELIVERY_DAYS_WORDS}}) рабочих дней с момента подписания настоящего договора на склад «Покупателя».',
    ),
    ('К договору № 2 от “16” января 2026г.', 'К договору № {{CONTRACT_NO}} от “{{DAY}}” {{MONTH}} {{YEAR}}г.'),
    ('Стол однотумбовый 600х900х750', '{{TABLE_ROWS}}'),
    ('65000', '{{TABLE_TOTAL}}'),  # in table cells - careful
    ('Международный', '{{BUYER_ORG_LINE1}}'),
    (' университет', '{{BUYER_ORG_LINE2}}'),
    ('в', '{{BUYER_LINE3_LEFT}}'),  # too risky
]

# Safer: build contract template manually with regex for table and signatures
src = SRC / 'МУЦА.docx'
dst = OUT / 'contract.docx'
shutil.copy2(src, dst)
with zipfile.ZipFile(dst, 'r') as zin:
    files = {name: zin.read(name) for name in zin.namelist()}
xml = files['word/document.xml'].decode('utf-8')

xml = xml.replace('Д О Г О В О Р №2', 'Д О Г О В О Р №{{CONTRACT_NO}}')
xml = xml.replace(
    ' «16»  января 2026 года                                                                                            г.Токмок',
    ' «{{DAY}}»  {{MONTH}} {{YEAR}} года                                                                                            г.{{CITY}}',
)
xml = xml.replace(PREAMBLE_OLD, '{{PREAMBLE}}')
xml = xml.replace(
    '2.2. Общая сумма договора составляет  65000 (шестьдесят пять тысяч) сом, с учетом всех налогов и платежей.',
    '2.2. Общая сумма договора составляет  {{TOTAL}} ({{TOTAL_WORDS}}) сом, с учетом всех налогов и платежей.',
)
xml = xml.replace(
    '5.1. «Поставщик» обязуется поставить продукцию в течении 30 (тридцать) рабочих дней с момента подписания настоящего договора на склад «Покупателя».',
    '5.1. «Поставщик» обязуется поставить продукцию в течении {{DELIVERY_DAYS}} ({{DELIVERY_DAYS_WORDS}}) рабочих дней с момента подписания настоящего договора на склад «Покупателя».',
)
xml = xml.replace('К договору № 2 от “16” января 2026г.', 'К договору № {{CONTRACT_NO}} от “{{DAY}}” {{MONTH}} {{YEAR}}г.')

# Replace product table body (between header row and ИТОГО row)
xml = re.sub(
    r'(<w:tr w14:paraId="752858DE">.*?</w:tr>)(.*?)(<w:tr w14:paraId="2C8B0B0F">)',
    r'\1{{TABLE_BODY}}\3',
    xml,
    count=1,
    flags=re.DOTALL,
)

# Buyer signature placeholders (both signature blocks)
buyer_sig_old = [
    ('Международный', '{{BUYER_SIG_ORG1}}'),
    (' университет', '{{BUYER_SIG_ORG2}}'),
    ('в Центральной Азии', '{{BUYER_SIG_ORG3}}'),
    ('ИНН: 01604200810206', '{{BUYER_INN_LINE}}'),
    ('Банк:ОАО “Оптима Банк” Токмок', '{{BUYER_BANK_LINE}}'),
    ('БИК: 109009', '{{BUYER_BIK_LINE}}'),
    ('р/сч 1090920185640158', '{{BUYER_ACCOUNT_LINE}}'),
    ('(0553)993-993', '{{BUYER_PHONE_LINE}}'),
    ('Джон Р.К.', '{{BUYER_SIGN_LINE}}'),
]
for old, new in buyer_sig_old:
    xml = xml.replace(old, new)

files['word/document.xml'] = xml.encode('utf-8')
with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as zout:
    for name, data in files.items():
        zout.writestr(name, data)
print('Created', dst)

# --- KP template from Гор.Больница ---
kp_src = SRC / 'Гор.Больница (1).docx'
kp_dst = OUT / 'kp.docx'
shutil.copy2(kp_src, kp_dst)
with zipfile.ZipFile(kp_dst, 'r') as zin:
    files = {name: zin.read(name) for name in zin.namelist()}
xml = files['word/document.xml'].decode('utf-8')
# Keep only KP portion - find from start to before contract or second table
# For now patch key fields in KP section
kp_patches = [
    ('№ 241', '№ {{CONTRACT_NO}}'),
    ('От «3» ноября 2025г', 'От «{{DAY}}» {{MONTH}} {{YEAR}}г'),
    (
        'ОсОО «Токмокское учебно-производственном предприятии Кыргызского общества слепых и глухих», расположенное в г. Токм',
        '{{KP_INTRO}}',
    ),
    ('Предлагаем заказать на нашем предприятии:', '{{KP_OFFER_LINE}}'),
]
for old, new in kp_patches:
    xml = xml.replace(old, new)
xml = re.sub(
    r'(<w:tr[^>]*>.*?Наименование продукта.*?</w:tr>)(.*?)(<w:tr[^>]*>.*?ИТОГО.*?</w:tr>)',
    r'\1{{TABLE_BODY}}\3',
    xml,
    count=1,
    flags=re.DOTALL,
)
files['word/document.xml'] = xml.encode('utf-8')
with zipfile.ZipFile(kp_dst, 'w', zipfile.ZIP_DEFLATED) as zout:
    for name, data in files.items():
        zout.writestr(name, data)
print('Created', kp_dst)

# --- Spec-only: copy contract and trim to spec section via placeholder markers ---
spec_dst = OUT / 'spec.docx'
shutil.copy2(OUT / 'contract.docx', spec_dst)
with zipfile.ZipFile(spec_dst, 'r') as zin:
    files = {name: zin.read(name) for name in zin.namelist()}
xml = files['word/document.xml'].decode('utf-8')
# Mark spec start
xml = xml.replace('Приложение №1', '{{SPEC_START}}Приложение №1', 1)
# We'll extract spec part in JS or keep full contract template for spec download with trimmed body
files['word/document.xml'] = xml.encode('utf-8')
with zipfile.ZipFile(spec_dst, 'w', zipfile.ZIP_DEFLATED) as zout:
    for name, data in files.items():
        zout.writestr(name, data)
print('Created', spec_dst)