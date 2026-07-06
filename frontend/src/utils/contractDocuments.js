import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { amountToWordsRu, numberToWordsRu } from './numberToWordsRu';
import { CONTRACT_BODY_TEMPLATE } from './contractBodyTemplate';

const FONT = 'Times New Roman';
const SIZE_BODY = 24;
const SIZE_TITLE = 28;

const SUPPLIER = {
    name: 'ОсОО «Токмокское УПП КОС и КОГ»',
    director: 'директора Турбатова Саламата Адылбековича',
    basis: 'Устава',
    inn: '01509199210115',
    gni: '058',
    address: 'г. Токмок ул. Слободская 292',
    phone: '(03138) 3-04-91, 3-05-29',
    bank: 'Банк Кыргызстан',
    bik: '103004',
    account: '1030420000031864',
    sign: 'Турбатов С.А.',
};

const MONTHS_RU = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

const DEFAULT_PROCUREMENT =
    'закона Кыргызской Республики №27 от 14 апреля 2022 года «О государственных закупках» статья 17, часть 3, пункт 12. Методом из одного источника.';

const KP_INTRO =
    'ОсОО «Токмокское учебно-производственном предприятии Кыргызского общества слепых и глухих», расположенное в г. Токмок, специализируется на пошиве спецодежды и изготовлении мягкого, твердого инвентаря. На предприятии трудится 47 человек, из них 28 человек лица с ограниченными возможностями здоровья по зрению, слуху и по другим категориям что составляет 60% от общего количества работников.';

const escapeXml = (value) =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

const getLineTotal = (item) =>
    Number(item.price || 0) * (Number(item.quantity || item.userInputs?.coll || 1) || 1);

const getQty = (item) => Number(item.quantity || item.userInputs?.coll || 1) || 1;

const formatProductTitle = (item) => {
    const dims = [];
    const u = item.userInputs || {};
    if (u.shirina) dims.push(u.shirina);
    if (u.visota) dims.push(u.visota);
    if (u.glubina) dims.push(u.glubina);
    const dimStr = dims.length ? ` ${dims.join('х')}` : '';
    return `${item.title || 'Позиция'}${dimStr}`;
};

const parseContractDate = (order) => {
    const raw = order.contract_date;
    const date = raw ? new Date(raw) : new Date();
    if (Number.isNaN(date.getTime())) {
        return { day: '—', month: '—', year: new Date().getFullYear() };
    }
    return {
        day: String(date.getDate()),
        month: MONTHS_RU[date.getMonth()],
        year: date.getFullYear(),
    };
};

const wordsLower = (value) => {
    const w = numberToWordsRu(value);
    return w ? w.toLowerCase() : '';
};

export const buildOrderDocData = (order, orderTotal) => {
    const { day, month, year } = parseContractDate(order);
    const positions = order.product_order || [];
    const total = Math.round(orderTotal || positions.reduce((s, p) => s + getLineTotal(p), 0));
    const deliveryDays = String(order.delivery_days || '30').trim() || '30';
    const deliveryNum = Number(deliveryDays) || 30;

    return {
        contractNo: order.contract_no || String(order.id || ''),
        day,
        month,
        year,
        city: order.contract_city || 'Токмок',
        buyerOrg: order.name_compony || '—',
        buyerRepTitle: order.buyer_rep_title || 'директора',
        buyerRepName: order.buyer_rep_name || order.name_client || '—',
        buyerBasis: order.buyer_basis || 'Устава',
        buyerInn: order.buyer_inn || '',
        buyerAddress: order.address || '',
        buyerPhone: order.phone || '',
        buyerBank: order.buyer_bank || '',
        buyerBik: order.buyer_bik || '',
        buyerAccount: order.buyer_account || '',
        buyerSign: order.buyer_sign || order.buyer_rep_name || order.name_client || '____________',
        procurementBasis: order.procurement_basis || DEFAULT_PROCUREMENT,
        deliveryDays,
        deliveryDaysWords: wordsLower(deliveryNum),
        total,
        totalWords: amountToWordsRu(total).toLowerCase(),
        rows: positions.map((item, index) => ({
            index: index + 1,
            title: formatProductTitle(item),
            unit: 'шт',
            qty: getQty(item),
            price: Math.round(Number(item.price || 0)),
            sum: Math.round(getLineTotal(item)),
        })),
    };
};

const wRPr = ({ bold = false, size = SIZE_BODY, font = FONT } = {}) =>
    `<w:rPr>` +
    `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>` +
    (bold ? '<w:b/><w:bCs/>' : '') +
    `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>` +
    `</w:rPr>`;

const wPPr = ({ align = 'both', tabs = 0, indent = null } = {}) => {
    let xml = '<w:pPr>';
    if (tabs > 0) {
        xml += '<w:tabs>';
        for (let i = 0; i < tabs; i += 1) {
            xml += `<w:tab w:val="left" w:pos="${3600 + i * 360}"/>`;
        }
        xml += '</w:tabs>';
    }
    if (indent) {
        xml += `<w:ind w:left="${indent.left}" w:hanging="${indent.hanging}"/>`;
    }
    xml += `<w:jc w:val="${align}"/>`;
    xml += wRPr();
    xml += '</w:pPr>';
    return xml;
};

const wRun = (text, opts = {}) =>
    `<w:r>${wRPr(opts)}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;

const wTab = () => '<w:r><w:tab/></w:r>';

const wP = (text, opts = {}) => {
    const align = opts.center ? 'center' : opts.right ? 'right' : opts.left ? 'left' : 'both';
    const runOpts = { bold: opts.bold, size: opts.size || SIZE_BODY };
    return `<w:p>${wPPr({ align, tabs: opts.tabs || 0, indent: opts.indent })}${wRun(text, runOpts)}</w:p>`;
};

const wPTabs = (left, right, opts = {}) => {
    const align = opts.center ? 'center' : 'both';
    const runOpts = { bold: opts.bold, size: opts.size || SIZE_BODY };
    const tabs = opts.tabCount || 5;
    let runs = wRun(left, runOpts);
    for (let i = 0; i < tabs; i += 1) runs += wTab();
    runs += wRun(right, runOpts);
    return `<w:p>${wPPr({ align, tabs })}${runs}</w:p>`;
};

const wTc = (innerXml, width) =>
    `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>${innerXml}</w:tc>`;

const wTcP = (text, opts = {}, width = 1000) => {
    const align = opts.center ? 'center' : opts.left ? 'left' : opts.right ? 'right' : 'left';
    const p =
        `<w:p><w:pPr><w:jc w:val="${align}"/>${wRPr({ bold: opts.bold, size: SIZE_BODY })}</w:pPr>` +
        `${wRun(text, { bold: opts.bold, size: SIZE_BODY })}</w:p>`;
    return wTc(p, width);
};

const wTcEmpty = (width) => wTc('<w:p><w:pPr><w:jc w:val="center"/></w:pPr></w:p>', width);

const COLS = [541, 4284, 1948, 916, 1293, 1293];

const specTableXml = (rows, total) => {
    const header = `<w:tr><w:trPr><w:trHeight w:val="831" w:hRule="atLeast"/></w:trPr>` +
        [
            ['№', { center: true, bold: true }],
            ['Наименование продукта', { center: true, bold: true }],
            ['Ед.измер.', { center: true, bold: true }],
            ['Кол.', { center: true, bold: true }],
            ['Цена с НДС за 1 ед.изд.', { center: true, bold: true }],
            ['сумма', { center: true, bold: true }],
        ].map(([t, o], i) => wTcP(t, o, COLS[i])).join('') +
        '</w:tr>';

    const body = rows.map((row) =>
        `<w:tr><w:trPr><w:trHeight w:val="454" w:hRule="atLeast"/></w:trPr>` +
        wTcP(String(row.index), { center: true }, COLS[0]) +
        wTcP(row.title, { left: true, bold: true }, COLS[1]) +
        wTcP(row.unit, { center: true }, COLS[2]) +
        wTcP(String(row.qty), { center: true }, COLS[3]) +
        wTcP(String(row.price), { center: true }, COLS[4]) +
        wTcP(String(row.sum), { center: true }, COLS[5]) +
        '</w:tr>'
    ).join('');

    const footer =
        `<w:tr><w:trPr><w:trHeight w:val="367" w:hRule="atLeast"/></w:trPr>` +
        wTcEmpty(COLS[0]) +
        wTcP('ИТОГО', { left: true }, COLS[1]) +
        wTcEmpty(COLS[2]) +
        wTcEmpty(COLS[3]) +
        wTcEmpty(COLS[4]) +
        wTcP(String(total), { center: true, bold: true }, COLS[5]) +
        '</w:tr>';

    return (
        `<w:tbl><w:tblPr>` +
        `<w:tblW w:w="10275" w:type="dxa"/>` +
        `<w:tblBorders>` +
        `<w:top w:val="single" w:color="auto" w:sz="4" w:space="0"/>` +
        `<w:left w:val="single" w:color="auto" w:sz="4" w:space="0"/>` +
        `<w:bottom w:val="single" w:color="auto" w:sz="4" w:space="0"/>` +
        `<w:right w:val="single" w:color="auto" w:sz="4" w:space="0"/>` +
        `<w:insideH w:val="single" w:color="auto" w:sz="4" w:space="0"/>` +
        `<w:insideV w:val="single" w:color="auto" w:sz="4" w:space="0"/>` +
        `</w:tblBorders>` +
        `<w:tblLayout w:type="autofit"/>` +
        `</w:tblPr>` +
        `<w:tblGrid>` +
        COLS.map((w) => `<w:gridCol w:w="${w}"/>`).join('') +
        `</w:tblGrid>` +
        header + body + footer +
        `</w:tbl>`
    );
};

const buildPreamble = (data) =>
    `${SUPPLIER.name}, именуемая в дальнейшем «Поставщик» в лице ${SUPPLIER.director}, действующего на основании ${SUPPLIER.basis}, с одной стороны ${data.buyerOrg},  в лице ${data.buyerRepTitle} ${data.buyerRepName} именуемый в дальнейшем «Покупатель» действующего на основании ${data.buyerBasis}, заключили настоящий договор согласно ${data.procurementBasis}`;

const buildContractBodyXml = (data) => {
    const parts = [];

    parts.push(wP(`Д О Г О В О Р №${data.contractNo}`, { center: true, bold: true, size: SIZE_TITLE }));
    parts.push(
        wPTabs(
            `«${data.day}»  ${data.month} ${data.year} года`,
            `г.${data.city}`,
            { bold: true, tabCount: 5 }
        )
    );
    parts.push(wP(buildPreamble(data), { bold: true }));

    CONTRACT_BODY_TEMPLATE.forEach((item) => {
        if (['title', 'dateCity', 'preamble'].includes(item.type)) return;

        let text = item.text;
        if (item.type === 'totalLine') {
            text = `2.2. Общая сумма договора составляет  ${data.total} (${data.totalWords}) сом, с учетом всех налогов и платежей.`;
        }
        if (item.type === 'deliveryLine') {
            text = `5.1. «Поставщик» обязуется поставить продукцию в течении ${data.deliveryDays} (${data.deliveryDaysWords}) рабочих дней с момента подписания настоящего договора на склад «Покупателя».`;
        }

        if (item.type === 'sectionHeader') {
            parts.push(wP(text, { center: true, bold: true }));
        } else if (item.type === 'totalLine') {
            parts.push(wP(text, { bold: true }));
        } else {
            parts.push(wP(text));
        }
    });

    return parts.join('');
};

const signaturesXml = (data) => {
    const buyerBank = data.buyerBank ? `Банк:${data.buyerBank}` : '';
    const buyerInn = data.buyerInn ? `ИНН: ${data.buyerInn}` : '';
    const buyerBik = data.buyerBik ? `БИК: ${data.buyerBik}` : '';
    const buyerAccount = data.buyerAccount ? `р/сч ${data.buyerAccount}` : '';
    const buyerAddress = data.buyerAddress ? `Адрес: ${data.buyerAddress}` : 'Адрес:';
    const buyerPhone = data.buyerPhone || '';

    return [
        wP('14. Юридические адреса, банковские реквизиты и подписи сторон:', { bold: true }),
        wP(''),
        wPTabs('«Поставщик»', '«Покупатель»', { bold: true }),
        wPTabs(SUPPLIER.name, data.buyerOrg, { bold: true }),
        wPTabs(`ИНН ${SUPPLIER.inn}`, '', { bold: true }),
        wPTabs(`ГНИ ${SUPPLIER.gni}`, buyerInn, { bold: true }),
        wPTabs(SUPPLIER.bank, buyerBank, { bold: true }),
        wPTabs(`БИК ${SUPPLIER.bik}`, buyerBik, { bold: true }),
        wPTabs(`р/с ${SUPPLIER.account}`, buyerAccount, { bold: true }),
        wPTabs(`Адрес: ${SUPPLIER.address}`, buyerAddress, { bold: true }),
        wPTabs(SUPPLIER.phone, buyerPhone, { bold: true }),
        wPTabs(`${SUPPLIER.sign}                        _________________`, `${data.buyerSign}_________________`, { bold: true }),
    ].join('');
};

const letterheadXml = () => [
    wP('   КЫРГЫЗ АЗИЗДЕР ЖАНА ДYЛӨЙЛӨР КООМУНУН "ТОКМОКТОГУ ҮЙРӨТҮҮ-', { center: true, size: 21 }),
    wP('ӨНДҮРҮШТҮК ИШКАНАСЫ"', { center: true, size: 21 }),
    wP('ЖООПКЕРЧИЛИГИ ЧЕКТЕЛГЕН', { center: true, size: 21 }),
    wP('КООМУ', { center: true, size: 21 }),
    wP('  ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "ТОКМОКСКОЕ УЧЕБНО-ПРОИЗВОДСТВЕННОЕ ПРЕДПРИЯТИЕ КЫРГЫЗСКОГО ОБЩЕСТВА СЛЕПЫХ И ГЛУХИХ"', { center: true, size: 21 }),
    wP('              722209, Кыргыз Республикасы', { center: true, size: 21 }),
    wP('             Токмок шаары, Слободский көчөсү, 292', { center: true, size: 21 }),
    wP('           тел./факс: (+9963138) 3-04-91', { center: true, size: 21 }),
    wP('          тел.: (+9963138) 3-05-29', { center: true, size: 21 }),
    wP('          Эсеп. сч.: 1030420000031864', { center: true, size: 21 }),
    wP('         АКБ «Кыргызстан»  Токмок ш.', { center: true, size: 21 }),
    wP('         БИК 103004 ИНН 01509199210115', { center: true, size: 21 }),
    wP('              722209, Кыргызская Республика', { center: true, size: 21 }),
    wP('             г. Токмок , ул. Слободская, 292', { center: true, size: 21 }),
    wP('           тел./факс: (+9963138)  3-04-91', { center: true, size: 21 }),
    wP('           тел. (+9963138)  3-05-29', { center: true, size: 21 }),
    wP('           Расчетный счет:1030420000031864', { center: true, size: 21 }),
    wP('           АКБ «Кыргызстан»  г. Токмок', { center: true, size: 21 }),
    wP('           БИК 103004 ИНН 01509199210115', { center: true, size: 21 }),
].join('');

const kpFooterXml = () => [
    wP('  С уважением,'),
    wPTabs('Директор ОсОО “Токмокское УПП КОС и КОГ”', SUPPLIER.sign, { tabCount: 4 }),
].join('');

const SECT_PR =
    `<w:sectPr>` +
    `<w:pgSz w:w="11906" w:h="16838"/>` +
    `<w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/>` +
    `<w:cols w:space="708" w:num="1"/>` +
    `</w:sectPr>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/>
        <w:sz w:val="${SIZE_BODY}"/>
        <w:szCs w:val="${SIZE_BODY}"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault/>
  </w:docDefaults>
</w:styles>`;

const buildDocumentXml = (bodyXml) =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body>${bodyXml}${SECT_PR}</w:body></w:document>`;

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOCUMENT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const saveDocx = async (bodyXml, filename) => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', CONTENT_TYPES);
    zip.folder('_rels')?.file('.rels', RELS);
    zip.folder('word')?.file('document.xml', buildDocumentXml(bodyXml));
    zip.folder('word')?.file('styles.xml', STYLES_XML);
    zip.folder('word')?.folder('_rels')?.file('document.xml.rels', DOCUMENT_RELS);
    const blob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    saveAs(blob, filename);
};

const buildSignaturesOnly = (data) => {
    const buyerBank = data.buyerBank ? `Банк:${data.buyerBank}` : '';
    const buyerInn = data.buyerInn ? `ИНН: ${data.buyerInn}` : '';
    const buyerBik = data.buyerBik ? `БИК: ${data.buyerBik}` : '';
    const buyerAccount = data.buyerAccount ? `р/сч ${data.buyerAccount}` : '';
    const buyerAddress = data.buyerAddress ? `Адрес: ${data.buyerAddress}` : 'Адрес:';
    const buyerPhone = data.buyerPhone || '';

    return [
        wP('Юридические адреса, банковские реквизиты и подписи сторон:', { bold: true }),
        wP(''),
        wPTabs('«Поставщик»', '«Покупатель»', { bold: true }),
        wPTabs(SUPPLIER.name, data.buyerOrg, { bold: true }),
        wPTabs(`ИНН ${SUPPLIER.inn}`, '', { bold: true }),
        wPTabs(`ГНИ ${SUPPLIER.gni}`, buyerInn, { bold: true }),
        wPTabs(SUPPLIER.bank, buyerBank, { bold: true }),
        wPTabs(`БИК ${SUPPLIER.bik}`, buyerBik, { bold: true }),
        wPTabs(`р/с ${SUPPLIER.account}`, buyerAccount, { bold: true }),
        wPTabs(`Адрес: ${SUPPLIER.address}`, buyerAddress, { bold: true }),
        wPTabs(SUPPLIER.phone, buyerPhone, { bold: true }),
        wPTabs(`${SUPPLIER.sign}                        _________________`, `${data.buyerSign}_________________`, { bold: true }),
    ].join('');
};

export const downloadCommercialProposal = async (order, orderTotal) => {
    const data = buildOrderDocData(order, orderTotal);
    const body = [
        letterheadXml(),
        wP(`№ ${data.contractNo}`, { right: true }),
        wP(`От «${data.day}» ${data.month} ${data.year}г`, { right: true }),
        wP('Коммерческое предложение', { center: true, bold: true, size: SIZE_TITLE }),
        wP(`     ${KP_INTRO}`),
        wP(`Предлагаем поставку продукции для: ${data.buyerOrg}.`),
        specTableXml(data.rows, data.total),
        kpFooterXml(),
    ].join('');
    await saveDocx(body, `KP_${data.contractNo}.docx`);
};

export const downloadSpecification = async (order, orderTotal) => {
    const data = buildOrderDocData(order, orderTotal);
    const body = [
        wP('Приложение №1', { right: true }),
        wP(`К договору № ${data.contractNo} от “${data.day}” ${data.month} ${data.year}г.`, { right: true }),
        wP('С П Е Ц И Ф И К А Ц И Я № 1', { center: true, bold: true, size: SIZE_TITLE }),
        specTableXml(data.rows, data.total),
        buildSignaturesOnly(data),
    ].join('');
    await saveDocx(body, `Spec_${data.contractNo}.docx`);
};

export const downloadFullContract = async (order, orderTotal) => {
    const data = buildOrderDocData(order, orderTotal);
    const body = [
        buildContractBodyXml(data),
        signaturesXml(data),
        wP('Приложение №1', { right: true }),
        wP(`К договору № ${data.contractNo} от “${data.day}” ${data.month} ${data.year}г.`, { right: true }),
        wP('С П Е Ц И Ф И К А Ц И Я № 1', { center: true, bold: true, size: SIZE_TITLE }),
        specTableXml(data.rows, data.total),
        buildSignaturesOnly(data),
    ].join('');
    await saveDocx(body, `Dogovor_${data.contractNo}.docx`);
};