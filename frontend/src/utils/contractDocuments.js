import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { amountToWordsRu, numberToWordsRu } from './numberToWordsRu';
import { CONTRACT_BODY_TEMPLATE } from './contractBodyTemplate';
import officeLogoUrl from './officeLogo.png';

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
    phone: '(0553) 993-993',
    bank: 'Банк «М Банк»',
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
    'ОсОО «Токмокское учебно-производственном предприятии Кыргызского общества слепых и глухих», расположенное в г. Токмок, специализируется на пошиве спецодежды и изготовлении мягкого, твердого инвентаря. На предприятии трудится 41 человек, из них 25 человек лица с ограниченными возможностями здоровья по зрению, слуху и по другим категориям что составляет 60,90% от общего количества работников, на основании закона Кыргызской Республики №27 от 14 апреля 2022 года «О государственных закупках» статья 17, часть 3, пункт 12.';

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
    const raw = String(order.contract_date || '').trim();
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    let date;
    if (iso) {
        date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    } else if (raw) {
        date = new Date(raw);
    } else {
        date = new Date();
    }
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

const wRPr = ({ bold = false, size = SIZE_BODY, szCs = null, font = FONT } = {}) =>
    `<w:rPr>` +
    `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>` +
    (bold ? '<w:b/><w:bCs/>' : '') +
    `<w:sz w:val="${size}"/><w:szCs w:val="${szCs || size}"/>` +
    `</w:rPr>`;

const wPPr = (opts = {}) => {
    const align = opts.align || 'both';
    let xml = '<w:pPr>';
    if (opts.style) xml += `<w:pStyle w:val="${opts.style}"/>`;
    if (opts.borderBottom) {
        xml += '<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="1" w:color="000000"/></w:pBdr>';
    }
    if (opts.rightTab) {
        xml += `<w:tabs><w:tab w:val="right" w:pos="${CONTENT_W}"/></w:tabs>`;
    }
    if (opts.spacing) {
        xml += `<w:spacing w:before="${opts.spacing.before || 0}" w:after="${opts.spacing.after}" w:line="${opts.spacing.line}" w:lineRule="auto"/>`;
    }
    if (opts.leftInd != null || opts.firstLine != null) {
        xml += '<w:ind';
        if (opts.leftInd != null) xml += ` w:left="${opts.leftInd}"`;
        if (opts.firstLine != null) xml += ` w:firstLine="${opts.firstLine}"`;
        xml += '/>';
    }
    xml += `<w:jc w:val="${align}"/>`;
    xml += wRPr({ bold: opts.bold, size: opts.size || SIZE_BODY, szCs: opts.szCs, font: opts.font });
    xml += '</w:pPr>';
    return xml;
};

const wRun = (text, opts = {}) =>
    `<w:r>${wRPr(opts)}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;

const wTab = () => '<w:r><w:tab/></w:r>';

const wP = (text, opts = {}) => {
    const align = opts.center ? 'center' : opts.right ? 'right' : opts.left ? 'left' : 'both';
    const runOpts = {
        bold: opts.bold,
        size: opts.size || SIZE_BODY,
        szCs: opts.szCs,
        font: opts.font,
    };
    return `<w:p>${wPPr({ ...opts, align })}${text === '' && !opts.keepRun ? '' : wRun(text, runOpts)}</w:p>`;
};

// Город у правого поля. В образце это длинный пробел после даты.
const wPTabs = (left, right, opts = {}) => {
    const runOpts = { bold: opts.bold, size: opts.size || SIZE_BODY };
    return `<w:p>${wPPr({ align: 'left', rightTab: true, bold: opts.bold, size: opts.size })}${wRun(left, runOpts)}${wTab()}${wRun(right, runOpts)}</w:p>`;
};

const CELL_BORDERS = ['top', 'left', 'bottom', 'right']
    .map((edge) => `<w:${edge} w:val="single" w:color="000000" w:sz="4" w:space="0"/>`)
    .join('');

const wTc = (innerXml, width, vAlign = 'top', borders = false) =>
    `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>` +
    (borders ? `<w:tcBorders>${CELL_BORDERS}</w:tcBorders>` : '') +
    `<w:vAlign w:val="${vAlign}"/></w:tcPr>${innerXml}</w:tc>`;

const wTcP = (text, opts = {}, width = 1000) => {
    const align = opts.center ? 'center' : opts.right ? 'right' : 'left';
    const size = opts.size || SIZE_BODY;
    const p =
        `<w:p><w:pPr><w:jc w:val="${align}"/>${wRPr({ bold: opts.bold, size })}</w:pPr>` +
        `${wRun(text, { bold: opts.bold, size })}</w:p>`;
    return wTc(p, width, opts.vAlign || 'center', opts.borders !== false);
};

const wTcEmpty = (width) => wTc('<w:p><w:pPr><w:jc w:val="center"/></w:pPr></w:p>', width, 'center', true);

// Ширина текста на A4 при полях образца: 11906 − 1701 − 850.
const CONTENT_W = 9355;
const COL_PAIR = [4600, 4755];
// Доли колонок как в спецификации Биримдик, сжатые в ширину страницы.
const COLS = [695, 4125, 1127, 849, 1097, 1462];
const SPEC_HEADERS = ['№', 'Наименование продукции', 'Ед.измер.', 'ко.во', 'Цена за единицу', 'сумма'];
const KP_HEADERS = ['№', 'Наименование продукта', 'Ед.измер.', 'Кол.', 'Цена с НДС за 1 ед.изд.', 'сумма'];

const specTableXml = (rows, total, headers = SPEC_HEADERS) => {
    const header = `<w:tr>` +
        headers.map((title, i) => wTcP(title, { center: true, bold: true }, COLS[i])).join('') +
        '</w:tr>';

    const body = rows.map((row) =>
        `<w:tr>` +
        wTcP(String(row.index), { center: true }, COLS[0]) +
        wTcP(row.title, { left: true, bold: true }, COLS[1]) +
        wTcP(row.unit, { center: true }, COLS[2]) +
        wTcP(String(row.qty), { center: true }, COLS[3]) +
        wTcP(String(row.price), { center: true }, COLS[4]) +
        wTcP(String(row.sum), { center: true }, COLS[5]) +
        '</w:tr>'
    ).join('');

    const footer =
        `<w:tr>` +
        wTcEmpty(COLS[0]) +
        wTcP('ИТОГО', { left: true, bold: true }, COLS[1]) +
        wTcEmpty(COLS[2]) +
        wTcEmpty(COLS[3]) +
        wTcEmpty(COLS[4]) +
        wTcP(String(total), { center: true, bold: true }, COLS[5]) +
        '</w:tr>';

    return (
        `<w:tbl><w:tblPr>` +
        `<w:tblW w:w="${CONTENT_W}" w:type="dxa"/>` +
        `<w:tblBorders>` +
        `<w:top w:val="single" w:color="auto" w:sz="4" w:space="0"/>` +
        `<w:left w:val="single" w:color="auto" w:sz="4" w:space="0"/>` +
        `<w:bottom w:val="single" w:color="auto" w:sz="4" w:space="0"/>` +
        `<w:right w:val="single" w:color="auto" w:sz="4" w:space="0"/>` +
        `<w:insideH w:val="single" w:color="auto" w:sz="4" w:space="0"/>` +
        `<w:insideV w:val="single" w:color="auto" w:sz="4" w:space="0"/>` +
        `</w:tblBorders>` +
        `<w:tblLayout w:type="fixed"/>` +
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

// Пункты с раздела 2 в образце идут стилем List Paragraph: интервал 1,15 и отступ после абзаца.
const wOffice = (text, opts = {}) => wP(text, {
    style: opts.plain ? undefined : '5',
    leftInd: opts.plain ? undefined : 0,
    firstLine: opts.firstLine,
    center: opts.center,
    right: opts.right,
    bold: opts.bold,
    size: opts.size || SIZE_BODY,
    szCs: opts.plain ? undefined : (opts.szCs || 28),
    spacing: opts.spacing,
});

const pushOfficeClause = (parts, text, opts) => {
    const invoiceAt = text.indexOf(' -Счет');
    if (invoiceAt > 0) {
        parts.push(wOffice(text.slice(0, invoiceAt).trim(), opts));
        parts.push(wOffice(text.slice(invoiceAt).trim(), opts));
        return;
    }
    parts.push(wOffice(text, opts));
    if (text.startsWith('6.1.')) {
        parts.push(wOffice('6.2. Предоплата на сырье 50 % от общей суммы заказа.', opts));
    }
};

const buildContractBodyXml = (data) => {
    const parts = [];

    parts.push(wP(`Д О Г О В О Р №${data.contractNo}`, { center: true, bold: true, size: SIZE_TITLE }));
    parts.push(
        wPTabs(
            ` «${data.day}» ${data.month} ${data.year} года`,
            `г.${data.city}`,
            { bold: true }
        )
    );
    parts.push(wP('', { center: true }));
    parts.push(wP(buildPreamble(data), { bold: true, firstLine: 720 }));

    CONTRACT_BODY_TEMPLATE.forEach((item) => {
        if (['title', 'dateCity', 'preamble'].includes(item.type)) return;

        let text = String(item.text || '').trim();
        if (item.type === 'totalLine') {
            text = `2.2. Общая сумма договора составляет  ${data.total} (${data.totalWords}) сом, с учетом всех налогов и платежей.`;
        }
        if (item.type === 'deliveryLine') {
            text = `5.1. «Поставщик» обязуется поставить продукцию в течении ${data.deliveryDays} (${data.deliveryDaysWords}) рабочих дней с момента подписания настоящего договора на склад «Покупателя».`;
        }

        const plain = text.startsWith('1.');
        pushOfficeClause(parts, text, {
            plain,
            bold: item.type === 'sectionHeader' || item.type === 'totalLine',
            center: item.type === 'sectionHeader',
        });
    });

    return parts.join('');
};

const NIL_EDGES = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map((edge) => `<w:${edge} w:val="nil"/>`)
    .join('');

const wPairCell = (text, width, opts = {}) => {
    const lines = Array.isArray(text) ? text : [text ?? ''];
    const paras = lines.map((line) => wP(line, {
        left: !opts.alignRight,
        right: !!opts.alignRight,
        bold: opts.bold,
        size: opts.size,
        style: '5',
        leftInd: 0,
        spacing: { after: 0, line: 240 },
    })).join('');
    return (
        `<w:tc><w:tcPr>` +
        `<w:tcW w:w="${width}" w:type="dxa"/>` +
        `<w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders>` +
        `<w:vAlign w:val="${opts.vAlign || 'top'}"/>` +
        `</w:tcPr>${paras}</w:tc>`
    );
};

// Две колонки без рамок. Табы в образце выравнивают стороны вручную,
// а фиксированные позиции 3600+360 сдвигают правую колонку на длинных строках.
const wPairTable = (rows) => {
    const body = rows.map((row) => (
        `<w:tr>` +
        wPairCell(row.left, COL_PAIR[0], { bold: row.bold, vAlign: row.vAlign, size: row.size }) +
        wPairCell(row.right, COL_PAIR[1], {
            bold: row.bold,
            vAlign: row.vAlign,
            size: row.size,
            alignRight: row.alignRight,
        }) +
        `</w:tr>`
    )).join('');
    return (
        `<w:tbl><w:tblPr>` +
        `<w:tblW w:w="${CONTENT_W}" w:type="dxa"/>` +
        `<w:tblInd w:w="0" w:type="dxa"/>` +
        `<w:tblBorders>${NIL_EDGES}</w:tblBorders>` +
        `<w:tblLayout w:type="fixed"/>` +
        `<w:tblCellMar>` +
        `<w:top w:w="20" w:type="dxa"/>` +
        `<w:left w:w="0" w:type="dxa"/>` +
        `<w:bottom w:w="20" w:type="dxa"/>` +
        `<w:right w:w="160" w:type="dxa"/>` +
        `</w:tblCellMar>` +
        `</w:tblPr>` +
        `<w:tblGrid><w:gridCol w:w="${COL_PAIR[0]}"/><w:gridCol w:w="${COL_PAIR[1]}"/></w:tblGrid>` +
        body +
        `</w:tbl>`
    );
};

const requisitesRows = (data) => {
    const buyerBank = data.buyerBank ? `Банк:${data.buyerBank}` : '';
    const buyerInn = data.buyerInn ? `ИНН: ${data.buyerInn}` : '';
    const buyerBik = data.buyerBik ? `БИК: ${data.buyerBik}` : '';
    const buyerAccount = data.buyerAccount ? `р/сч ${data.buyerAccount}` : '';
    const buyerAddress = data.buyerAddress ? `Адрес: ${data.buyerAddress}` : 'Адрес:';
    const buyerPhone = data.buyerPhone || '';
    const line = '_______________';

    return [
        { left: '«Поставщик»', right: '«Покупатель»', bold: true },
        { left: SUPPLIER.name, right: data.buyerOrg, bold: true },
        { left: `ИНН ${SUPPLIER.inn}`, right: '', bold: true },
        { left: `ГНИ ${SUPPLIER.gni}`, right: buyerInn, bold: true },
        { left: SUPPLIER.bank, right: buyerBank, bold: true },
        { left: `БИК ${SUPPLIER.bik}`, right: buyerBik, bold: true },
        { left: `р/с ${SUPPLIER.account}`, right: buyerAccount, bold: true },
        { left: `Адрес: ${SUPPLIER.address}`, right: buyerAddress, bold: true },
        { left: SUPPLIER.phone, right: buyerPhone, bold: true },
        { left: '', right: '' },
        { left: `${SUPPLIER.sign}  ${line}`, right: `${data.buyerSign}  ${line}`, bold: true },
    ];
};

const requisitesBlock = (data, title) => [
    wP(title, { left: true, bold: true }),
    wP(''),
    wPairTable(requisitesRows(data)),
    wP(''),
].join('');

const signaturesXml = (data) =>
    requisitesBlock(data, '14. Юридические адреса, банковские реквизиты и подписи сторон:');

const LOGO_CX = 1266900;
const LOGO_CY = 822960;

const logoDrawing = () =>
    `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${LOGO_CX}" cy="${LOGO_CY}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="1" name="Логотип"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="officeLogo.png"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${LOGO_CX}" cy="${LOGO_CY}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
    `</a:graphicData></a:graphic></wp:inline></w:drawing>`;

const plainTable = (widths, rowsXml) =>
    `<w:tbl><w:tblPr><w:tblW w:w="${CONTENT_W}" w:type="dxa"/>` +
    `<w:tblBorders>${NIL_EDGES}</w:tblBorders><w:tblLayout w:type="fixed"/>` +
    `</w:tblPr><w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>` +
    `${rowsXml}</w:tbl>`;

const linesCell = (lines, width, opts) =>
    wTc(lines.map((line) => wP(line, opts)).join(''), width, 'center');

const letterheadXml = (withLogo) => {
    const col = [3118, 3119, 3118];
    const titleOpts = { center: true, bold: true, size: 18 };
    const addrOpts = { center: true, size: 16 };
    const kgTitle = [
        '«КЫРГЫЗ АЗИЗДЕР ЖАНА',
        'ДУЛӨЙЛӨР КООМУНУН',
        'ТОКМОКТОГУ ҮЙРӨТҮҮ-',
        'ӨНДҮРҮШТҮК ИШКАНАСЫ»',
        'ЖООПКЕРЧИЛИГИ',
        'ЧЕКТЕЛГЕН КООМУ',
    ];
    const ruTitle = [
        'ОБЩЕСТВО С ОГРАНИЧЕННОЙ',
        'ОТВЕТСТВЕННОСТЬЮ',
        '«ТОКМОКСКОЕ УЧЕБНО-',
        'ПРОИЗВОДСТВЕННОЕ',
        'ПРЕДПРИЯТИЕ КЫРГЫЗСКОГО',
        'ОБЩЕСТВА СЛЕПЫХ И ГЛУХИХ»',
    ];
    const addrKg = [
        '722209, Кыргыз Республикасы',
        'Токмок шаары, Манап бий көчөсү, 292',
        'тел.: +996(553) 993-993',
        'тел.: +996(3138) 3-05-29',
        'E-mail: kosikog@mail.ru',
        'Эсеп. сч.: 1030420000031864',
        'АКБ «Кыргызстан» Токмок ш.',
        'БИК 103004 ИНН 01509199210115',
    ];
    const addrRu = [
        '722209, Кыргызская Республика',
        'г. Токмок, ул. Манап бий, 292',
        'тел. 0553 993-993',
        'тел. +996(3138) 3-05-29',
        'E-mail: kosikog@mail.ru',
        'Расчетный счет: 1030420000031864',
        'АКБ «Кыргызстан» г. Токмок',
        'БИК 103004 ИНН 01509199210115',
    ];
    const addrEn = [
        'Kyrgyz Republic, Chuy Region,',
        'Tokmok City, Manap Biy Street, 292',
        'tel.: +996(553) 993-993',
        'tel.: +996(3138) 3-05-29',
        'E-mail: kosikog@mail.ru',
        'C/A: 1030420000031864',
        '«Kyrgyzstan» JSCB, Tokmok',
        'BIC 103004 TIN 01509199210115',
    ];
    const logoCell = withLogo
        ? wTc(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r>${logoDrawing()}</w:r></w:p>`, col[1], 'center')
        : wTc(wP(''), col[1], 'center');
    const top = `<w:tr>${linesCell(kgTitle, col[0], titleOpts)}${logoCell}${linesCell(ruTitle, col[2], titleOpts)}</w:tr>`;
    const addr = `<w:tr>${linesCell(addrKg, col[0], addrOpts)}${linesCell(addrRu, col[1], addrOpts)}${linesCell(addrEn, col[2], addrOpts)}</w:tr>`;
    const rule = wP('', { borderBottom: true, spacing: { before: 40, after: 80, line: 120 } });
    return [
        plainTable(col, top),
        wP('LLP «TOKMOK TRAINING AND PRODUCTION ENTERPRISE OF THE KYRGYZ SOCIETY OF THE BLIND AND DEAF»', { center: true, bold: true, size: 18 }),
        rule,
        plainTable(col, addr),
        rule,
    ].join('');
};

const loadOfficeLogo = async () => {
    try {
        const response = await fetch(officeLogoUrl);
        if (!response.ok) return null;
        return await response.arrayBuffer();
    } catch {
        return null;
    }
};

const downloadName = (data, suffix) => {
    const org = String(data.buyerOrg || '').trim();
    const base = (org && org !== '—' ? org : 'Организация')
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[. ]+$/g, '')
        .slice(0, 100) || 'Организация';
    return suffix ? `${base} ${suffix}.docx` : `${base}.docx`;
};

const appendixHeadXml = (data) => [
    wOffice('Приложение №1', { right: true, spacing: { after: 0, line: 240 } }),
    wOffice(`К договору № ${data.contractNo} от “${data.day}” ${data.month} ${data.year}г.`, { right: true, spacing: { after: 0, line: 240 } }),
    wP('С П Е Ц И Ф И К А Ц И Я № 1', {
        style: '5',
        leftInd: 0,
        firstLine: 426,
        center: true,
        bold: true,
        size: SIZE_TITLE,
        szCs: 28,
    }),
].join('');

const kpFooterXml = () => [
    wP(''),
    wPairTable([
        {
            left: ['С Уважением', 'директор ОсОО «Токмокское УПП КОС и КОГ»'],
            right: SUPPLIER.sign,
            bold: true,
            vAlign: 'center',
            alignRight: true,
        },
    ]),
].join('');

const SECT_PR =
    `<w:sectPr>` +
    `<w:pgSz w:w="11906" w:h="16838"/>` +
    `<w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/>` +
    `<w:cols w:space="708" w:num="1"/>` +
    `<w:docGrid w:linePitch="360" w:charSpace="0"/>` +
    `</w:sectPr>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:eastAsia="${FONT}" w:cs="${FONT}"/>
        <w:sz w:val="24"/><w:szCs w:val="24"/>
        <w:lang w:val="ru-RU" w:eastAsia="ru-RU"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="1">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:eastAsia="${FONT}" w:cs="${FONT}"/>
      <w:sz w:val="24"/><w:szCs w:val="24"/>
      <w:lang w:val="ru-RU"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="5">
    <w:name w:val="List Paragraph"/>
    <w:basedOn w:val="1"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:after="200" w:line="276" w:lineRule="auto"/>
      <w:ind w:left="720"/>
      <w:contextualSpacing/>
    </w:pPr>
  </w:style>
</w:styles>`;

const buildDocumentXml = (bodyXml) =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<w:body>${bodyXml}${SECT_PR}</w:body></w:document>`;

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
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

const saveDocx = async (bodyXml, filename, logoBuffer = null) => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', CONTENT_TYPES);
    zip.folder('_rels')?.file('.rels', RELS);
    zip.folder('word')?.file('document.xml', buildDocumentXml(bodyXml));
    zip.folder('word')?.file('styles.xml', STYLES_XML);
    const rels = logoBuffer
        ? DOCUMENT_RELS.replace(
            '</Relationships>',
            '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/officeLogo.png"/></Relationships>'
        )
        : DOCUMENT_RELS;
    zip.folder('word')?.folder('_rels')?.file('document.xml.rels', rels);
    if (logoBuffer) zip.folder('word')?.folder('media')?.file('officeLogo.png', logoBuffer);
    const blob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    saveAs(blob, filename);
};

const buildSignaturesOnly = (data) =>
    requisitesBlock(data, 'Юридические адреса, банковские реквизиты и подписи сторон:');

export const downloadCommercialProposal = async (order, orderTotal) => {
    const data = buildOrderDocData(order, orderTotal);
    const logo = await loadOfficeLogo();
    const body = [
        letterheadXml(!!logo),
        wP(''),
        wPairTable([{
            left: [`№ ${data.contractNo}`, `«${data.day}» ${data.month} ${data.year} года`],
            right: data.buyerOrg,
            bold: true,
            vAlign: 'center',
            alignRight: true,
        }]),
        wP('Коммерческое предложение', { center: true, bold: true, size: SIZE_TITLE }),
        wP(KP_INTRO),
        wP('Предлагаем заказать на нашем предприятии:'),
        specTableXml(data.rows, data.total, KP_HEADERS),
        wP(''),
        wP('Цена с учетом всех налогов и доставки.', { left: true }),
        kpFooterXml(),
    ].join('');
    await saveDocx(body, downloadName(data, 'КП'), logo);
};

export const downloadSpecification = async (order, orderTotal) => {
    const data = buildOrderDocData(order, orderTotal);
    const body = [
        appendixHeadXml(data),
        specTableXml(data.rows, data.total),
        buildSignaturesOnly(data),
    ].join('');
    await saveDocx(body, downloadName(data, 'спецификация'));
};

export const downloadFullContract = async (order, orderTotal) => {
    const data = buildOrderDocData(order, orderTotal);
    const body = [
        buildContractBodyXml(data),
        signaturesXml(data),
        appendixHeadXml(data),
        specTableXml(data.rows, data.total),
        buildSignaturesOnly(data),
    ].join('');
    await saveDocx(body, downloadName(data));
};