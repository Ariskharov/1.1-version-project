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
    'ОсОО «Токмокское учебно-производственном предприятии Кыргызского общества слепых и глухих», расположенное в г. Токмок, специализируется на пошиве спецодежды и изготовлении мягкого, твердого инвентаря. На предприятии трудится 41 человек, из них 25 человек лица с ограниченными возможностями здоровья по зрению, слуху и по другим категориям что составляет 60,90% от общего количества работников, на основании закона Кыргызской Республики №27 от 14 апреля 2022года «О государственных закупках» статья 17, часть 3 пункт 12 Предлагаем заказать на нашем предприятии:';

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

const wRPr = ({ bold = false, size = SIZE_BODY, szCs = null, font = FONT, omitSzCs = false } = {}) =>
    `<w:rPr>` +
    `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>` +
    (bold ? '<w:b/><w:bCs/>' : '') +
    `<w:sz w:val="${size}"/>` +
    (omitSzCs ? '' : `<w:szCs w:val="${szCs || size}"/>`) +
    `</w:rPr>`;

const wPPr = (opts = {}) => {
    const align = opts.align || 'both';
    let xml = '<w:pPr>';
    if (opts.style) xml += `<w:pStyle w:val="${opts.style}"/>`;
    if (opts.borderBottom) {
        xml += '<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="1" w:color="000000"/></w:pBdr>';
    }
    if (opts.rightTab || (opts.tabStops && opts.tabStops.length)) {
        xml += '<w:tabs>';
        if (opts.tabStops) {
            for (const stop of opts.tabStops) {
                const pos = typeof stop === 'number' ? stop : stop.pos;
                const val = typeof stop === 'number' ? 'left' : stop.val;
                xml += `<w:tab w:val="${val}" w:pos="${pos}"/>`;
            }
        }
        if (opts.rightTab) xml += `<w:tab w:val="right" w:pos="${opts.rightTabPos || CONTENT_W}"/>`;
        xml += '</w:tabs>';
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
    xml += wRPr({
        bold: opts.bold,
        size: opts.size || SIZE_BODY,
        szCs: opts.szCs,
        font: opts.font,
        omitSzCs: opts.omitSzCs,
    });
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
        omitSzCs: opts.omitSzCs,
    };
    return `<w:p>${wPPr({ ...opts, align })}${text === '' && !opts.keepRun ? '' : wRun(text, runOpts)}</w:p>`;
};

// Город у правого поля. В образце это длинный пробел после даты.
const wPTabs = (left, right, opts = {}) => {
    const runOpts = { bold: opts.bold, size: opts.size || SIZE_BODY };
    return `<w:p>${wPPr({ align: 'left', rightTab: true, bold: opts.bold, size: opts.size })}${wRun(left, runOpts)}${wTab()}${wRun(right, runOpts)}</w:p>`;
};

// Левый текст и правый у поля. Без таблицы, чтобы Word не рисовал ячейки.
const wSideLine = (left, right, opts = {}) => {
    const size = opts.size || SIZE_BODY;
    const rightText = String(right ?? '');
    return (
        `<w:p>${wPPr({
            align: 'left',
            rightTab: !!rightText,
            rightTabPos: opts.tabPos,
            size,
        })}` +
        (left ? wRun(left, { bold: !!opts.leftBold, size }) : '') +
        (rightText ? `${wTab()}${wRun(rightText, { bold: !!opts.rightBold, size })}` : '') +
        `</w:p>`
    );
};

const CELL_BORDERS = ['top', 'left', 'bottom', 'right']
    .map((edge) => `<w:${edge} w:val="single" w:color="000000" w:sz="4" w:space="0"/>`)
    .join('');
const NO_CELL_BORDERS = ['top', 'left', 'bottom', 'right']
    .map((edge) => `<w:${edge} w:val="none" w:sz="0" w:space="0" w:color="auto"/>`)
    .join('');

const wTc = (innerXml, width, vAlign = 'top', borders = false) =>
    `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>` +
    `<w:tcBorders>${borders ? CELL_BORDERS : NO_CELL_BORDERS}</w:tcBorders>` +
    `<w:vAlign w:val="${vAlign}"/></w:tcPr>${innerXml}</w:tc>`;

const wTcP = (text, opts = {}, width = 1000) => {
    const align = opts.center ? 'center' : opts.right ? 'right' : 'left';
    const runOpts = {
        bold: opts.bold,
        size: opts.size || SIZE_BODY,
        font: opts.font || FONT,
        szCs: opts.szCs,
        omitSzCs: opts.omitSzCs,
    };
    const p =
        `<w:p><w:pPr><w:jc w:val="${align}"/>${wRPr(runOpts)}</w:pPr>` +
        (text === '' ? '' : wRun(text, runOpts)) +
        `</w:p>`;
    return wTc(p, width, opts.vAlign || 'center', opts.borders !== false);
};

// Ширина текста на A4 при полях договора: 11906 − 1701 − 850.
const CONTENT_W = 9355;
// Правая колонка реквизитов, как в образце: обычные табы, без ячеек.
const REQUISITE_TAB = 720;
const REQUISITE_COL = 5760;
const REQUISITE_STOPS = [];
for (let pos = REQUISITE_TAB; pos <= CONTENT_W; pos += REQUISITE_TAB) REQUISITE_STOPS.push(pos);
const CALIBRI = 'Calibri';
const SIZE_CALIBRI = 22;
// Сетка спецификации Биримдик: tblW 10080, таблица шире текстовой колонки.
const SPEC_W = 10080;
const SPEC_IND = 93;
const SPEC_GRID = [750, 4424, 1293, 916, 1121, 1576];
// КП на листе с равными полями, как бланк «Ак кудук».
const KP_MARGIN_X = 850;
const KP_CONTENT_W = 11906 - KP_MARGIN_X * 2;
const SPEC_HEADERS = ['№', 'Наименование продукции', 'Ед.измер.', 'ко.во', 'Цена  за единицу', 'сумма'];
const KP_HEADERS = ['№', 'Наименование продукта', 'Ед.измер.', 'Кол.', 'Цена с НДС за 1 ед.изд.', 'сумма'];
const NONE_BORDERS = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map((edge) => `<w:${edge} w:val="none" w:color="auto" w:sz="0" w:space="0"/>`)
    .join('');

const fitGrid = (target) => {
    const scaled = SPEC_GRID.map((width) => Math.round((width * target) / SPEC_W));
    scaled[1] += target - scaled.reduce((sum, width) => sum + width, 0);
    return scaled;
};

const specTableXml = (rows, total, mode = 'spec') => {
    const kp = mode === 'kp';
    const cols = kp ? fitGrid(KP_CONTENT_W) : SPEC_GRID;
    const headerAlign = kp
        ? ['center', 'center', 'center', 'center', 'center', 'center']
        : ['center', 'left', 'left', 'left', 'center', 'left'];
    const cell = (text, opts, index) => wTcP(text, {
        vAlign: kp ? 'center' : 'bottom',
        font: kp ? FONT : CALIBRI,
        size: kp ? SIZE_BODY : SIZE_CALIBRI,
        ...opts,
    }, cols[index]);

    const header = `<w:tr>` +
        (kp ? KP_HEADERS : SPEC_HEADERS).map((title, index) => cell(title, {
            center: headerAlign[index] === 'center',
            bold: true,
        }, index)).join('') +
        '</w:tr>';

    const body = rows.map((row) => (
        `<w:tr>` +
        cell(String(row.index), { center: true, font: FONT, size: SIZE_BODY }, 0) +
        cell(row.title, { font: FONT, size: SIZE_BODY, vAlign: kp ? 'center' : 'top' }, 1) +
        cell(row.unit, { center: true, font: FONT, size: SIZE_BODY }, 2) +
        cell(String(row.qty), { center: true, font: FONT, size: SIZE_BODY }, 3) +
        cell(String(row.price), { center: true, font: FONT, size: SIZE_BODY }, 4) +
        cell(String(row.sum), {
            center: !kp,
            right: kp,
            font: kp ? FONT : CALIBRI,
            size: kp ? SIZE_BODY : SIZE_CALIBRI,
        }, 5) +
        '</w:tr>'
    )).join('');

    const footer =
        `<w:tr><w:trPr><w:trHeight w:val="336" w:hRule="atLeast"/></w:trPr>` +
        cell('', { center: true }, 0) +
        cell('ИТОГО', { bold: false }, 1) +
        cell('', {}, 2) +
        cell('', {}, 3) +
        cell('', {}, 4) +
        cell(String(total), { right: true, bold: true, center: false }, 5) +
        '</w:tr>';

    return (
        `<w:tbl><w:tblPr>` +
        `<w:tblW w:w="${kp ? KP_CONTENT_W : SPEC_W}" w:type="dxa"/>` +
        (kp ? '' : `<w:tblInd w:w="${SPEC_IND}" w:type="dxa"/>`) +
        `<w:tblBorders>${NONE_BORDERS}</w:tblBorders>` +
        `<w:tblLayout w:type="fixed"/>` +
        `<w:tblCellMar>` +
        `<w:top w:w="0" w:type="dxa"/>` +
        `<w:left w:w="108" w:type="dxa"/>` +
        `<w:bottom w:w="0" w:type="dxa"/>` +
        `<w:right w:w="108" w:type="dxa"/>` +
        `</w:tblCellMar>` +
        `</w:tblPr>` +
        `<w:tblGrid>${cols.map((width) => `<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>` +
        header + body + footer +
        `</w:tbl>`
    );
};

const buildPreamble = (data) =>
    `${SUPPLIER.name}, именуемая в дальнейшем «Поставщик» в лице ${SUPPLIER.director}, действующего на основании ${SUPPLIER.basis}, с одной стороны ${data.buyerOrg},  в лице ${data.buyerRepTitle} ${data.buyerRepName} именуемый в дальнейшем «Покупатель» действующего на основании ${data.buyerBasis}, заключили настоящий договор согласно ${data.procurementBasis}`;

// Пункты с раздела 2 в образце идут стилем List Paragraph: интервал 1,15 и отступ после абзаца.
const wOffice = (text, opts = {}) => wP(text, {
    style: opts.plain ? undefined : '5',
    leftInd: opts.plain || opts.keepIndent ? undefined : 0,
    firstLine: opts.firstLine,
    center: opts.center,
    right: opts.right,
    bold: opts.bold,
    size: opts.size || SIZE_BODY,
    szCs: opts.szCs,
    omitSzCs: opts.omitSzCs,
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
        parts.push(wOffice('6.2 Предоплата на сырье 50 % от общей суммы заказа.', opts));
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

        const sectionMatch = text.match(/^(\d+)\./);
        const sectionNo = sectionMatch ? Number(sectionMatch[1]) : 0;
        // В Биримдик разделы 1 и 2 — обычный абзац. С 6-го заголовка отступ List Paragraph не сбрасывается.
        const plain = text.startsWith('1.') || text.startsWith('2. Цена');
        const keepIndent = item.type === 'sectionHeader' && [6, 7, 8, 9, 11, 12, 13].includes(sectionNo);
        pushOfficeClause(parts, text, {
            plain,
            keepIndent,
            bold: item.type === 'sectionHeader' || item.type === 'totalLine',
            center: item.type === 'sectionHeader',
            szCs: !plain && sectionNo >= 2 && sectionNo <= 6 ? 28 : undefined,
            omitSzCs: !plain && sectionNo >= 7,
        });
    });

    return parts.join('');
};

const requisitesRows = (data) => {
    const buyerBank = data.buyerBank ? `Банк:${data.buyerBank}` : '';
    const buyerInn = data.buyerInn ? `ИНН: ${data.buyerInn}` : '';
    const buyerBik = data.buyerBik ? `БИК: ${data.buyerBik}` : '';
    const buyerAccount = data.buyerAccount ? `р/сч ${data.buyerAccount}` : '';
    const buyerAddress = data.buyerAddress ? `Адрес: ${data.buyerAddress}` : '';
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

// Ширина Times New Roman 12 жирный, с запасом, чтобы правая колонка не залезла на левую.
const estimateRequisiteWidth = (text) => {
    let width = 0;
    for (const ch of String(text)) width += ch === ' ' ? 80 : 160;
    return width;
};

const wRequisiteLine = (left, right) => {
    const leftText = String(left ?? '');
    const rightText = String(right ?? '');
    const runOpts = { bold: true, size: SIZE_BODY };
    let tabs = '';
    if (rightText) {
        const width = estimateRequisiteWidth(leftText);
        let count = 0;
        for (const stop of REQUISITE_STOPS) {
            if (stop <= width) continue;
            count += 1;
            if (stop >= REQUISITE_COL) break;
        }
        tabs = wTab().repeat(Math.max(count, 1));
    }
    return (
        `<w:p>${wPPr({
            style: '5',
            align: 'both',
            leftInd: 0,
            bold: true,
            size: SIZE_BODY,
            tabStops: rightText ? REQUISITE_STOPS : undefined,
        })}` +
        (leftText ? wRun(leftText, runOpts) : '') +
        tabs +
        (rightText ? wRun(rightText, runOpts) : '') +
        `</w:p>`
    );
};

const requisitesBlock = (data, title) => [
    wP(title, { left: true, bold: true }),
    wP(''),
    requisitesRows(data).map((row) => wRequisiteLine(row.left, row.right)).join(''),
    wP(''),
].join('');

const signaturesXml = (data) =>
    requisitesBlock(data, '14. Юридические адреса, банковские реквизиты и подписи сторон:');

const LOGO_CX = 1266900;
const LOGO_CY = 822960;

const logoGraphic = () =>
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="officeLogo.png"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${LOGO_CX}" cy="${LOGO_CY}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
    `</a:graphicData></a:graphic>`;

// Логотип лежит поверх середины шапки и не создаёт ячейку.
const logoRun = () =>
    `<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" ` +
    `relativeHeight="251658240" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">` +
    `<wp:simplePos x="0" y="0"/>` +
    `<wp:positionH relativeFrom="column"><wp:align>center</wp:align></wp:positionH>` +
    `<wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>` +
    `<wp:extent cx="${LOGO_CX}" cy="${LOGO_CY}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:wrapNone/>` +
    `<wp:docPr id="1" name="Логотип"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    logoGraphic() +
    `</wp:anchor></w:drawing></w:r>`;

const HEAD_COL = Math.floor(KP_CONTENT_W / 3);
const HEAD_TABS = [
    { val: 'center', pos: Math.round(HEAD_COL / 2) },
    { val: 'center', pos: Math.round(KP_CONTENT_W / 2) },
    { val: 'center', pos: Math.round(KP_CONTENT_W - HEAD_COL / 2) },
];

const wHeadLine = (left, middle, right, opts = {}) => {
    const size = opts.size || 18;
    const runOpts = { bold: !!opts.bold, size };
    const run = (text) => (text ? wRun(text, runOpts) : '');
    return (
        `<w:p>${wPPr({
            align: 'left',
            tabStops: HEAD_TABS,
            size,
            bold: !!opts.bold,
            spacing: { before: 0, after: 0, line: 240 },
        })}` +
        `${opts.logo || ''}${wTab()}${run(left)}${wTab()}${run(middle)}${wTab()}${run(right)}` +
        `</w:p>`
    );
};

const wHeadRows = (leftLines, midLines, rightLines, opts = {}) => {
    const count = Math.max(leftLines.length, midLines.length, rightLines.length);
    let xml = '';
    for (let i = 0; i < count; i += 1) {
        xml += wHeadLine(leftLines[i] || '', midLines[i] || '', rightLines[i] || '', {
            ...opts,
            logo: i === 0 ? opts.logo : '',
        });
    }
    return xml;
};

const letterheadXml = (withLogo) => {
    const kgTitle = [
        '"КЫРГЫЗ АЗИЗДЕР ЖАНА',
        'ДУЛӨЙЛӨР КООМУНУН',
        'ТОКМОКТОГУ ҮЙРӨТҮҮ-',
        'ӨНДҮРҮШТҮК ИШКАНАСЫ"',
        'ЖООПКЕРЧИЛИГИ',
        'ЧЕКТЕЛГЕН КООМУ',
    ];
    const ruTitle = [
        'ОБЩЕСТВО С ОГРАНИЧЕННОЙ',
        'ОТВЕТСТВЕННОСТЬЮ',
        '"ТОКМОКСКОЕ УЧЕБНО-',
        'ПРОИЗВОДСТВЕННОЕ',
        'ПРЕДПРИЯТИЕ КЫРГЫЗСКОГО',
        'ОБЩЕСТВА СЛЕПЫХ И ГЛУХИХ"',
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
        'г. Токмок , ул. Манап бий, 292',
        'тел.0553 993-993',
        'тел. +996(3138) 3-05-29',
        'E-mail :kosikog@mail.ru',
        'Расчетный счет:1030420000031864',
        'АКБ «Кыргызстан» г. Токмок',
        'БИК 103004 ИНН 01509199210115',
    ];
    const addrEn = [
        'Kyrgyz Republic, Chuy Region,',
        'Tokmok City, Manap Biy Street, 292',
        'tel.:+996(553)993-993',
        'tel.: +996(3138) 3-05-29',
        'E-mail:kosikog@mail.ru',
        'C/A: 1030420000031864',
        '"Kyrgyzstan" JSCB, Tokmok',
        'BIC 103004 TIN 01509199210115',
    ];
    const english = { center: true, bold: true, size: 22, spacing: { after: 0, line: 240 } };
    return [
        wHeadRows(kgTitle, [], ruTitle, { bold: true, size: 18, logo: withLogo ? logoRun() : '' }),
        wP('LLP "TOKMOK TRAINING AND PRODUCTION ENTERPRISE OF THE KYRGYZ', english),
        wP('SOCIETY OF THE BLIND AND DEAF"', {
            ...english,
            borderBottom: true,
            spacing: { before: 0, after: 60, line: 240 },
        }),
        wHeadRows(addrKg, addrRu, addrEn, { size: 18 }),
        wP('', { borderBottom: true, spacing: { before: 40, after: 80, line: 120 } }),
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

const sanitizeDownloadName = (value) => {
    let cleaned = '';
    for (const ch of String(value)) {
        const code = ch.charCodeAt(0);
        cleaned += (code < 32 || '<>:"/\\|?*'.includes(ch)) ? ' ' : ch;
    }
    return cleaned.replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '').slice(0, 100);
};

const downloadName = (data, suffix) => {
    const org = String(data.buyerOrg || '').trim();
    const base = sanitizeDownloadName(org && org !== '—' ? org : '') || 'Организация';
    return suffix ? `${base} ${suffix}.docx` : `${base}.docx`;
};

const appendixHeadXml = (data) => [
    wOffice('Приложение №1', {
        right: true,
        size: 22,
        szCs: 22,
        firstLine: 0,
        spacing: { after: 0, line: 240 },
    }),
    wOffice(`К договору № ${data.contractNo} от “${data.day}” ${data.month} ${data.year}г.`, {
        right: true,
        bold: true,
        size: SIZE_TITLE,
        szCs: 28,
        firstLine: 708,
    }),
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
    wP('С Уважением', { left: true, bold: true }),
    wSideLine('директор ОсОО “Токмокское УПП КОС и КОГ”', SUPPLIER.sign, {
        leftBold: true,
        rightBold: true,
        tabPos: KP_CONTENT_W,
    }),
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
  <w:style w:type="table" w:default="1" w:styleId="3">
    <w:name w:val="Normal Table"/>
    <w:semiHidden/>
    <w:unhideWhenUsed/>
    <w:tblPr>
      <w:tblCellMar>
        <w:top w:w="0" w:type="dxa"/>
        <w:left w:w="108" w:type="dxa"/>
        <w:bottom w:w="0" w:type="dxa"/>
        <w:right w:w="108" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
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
    <w:rPr>
      <w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/>
      <w:sz w:val="22"/><w:szCs w:val="22"/>
    </w:rPr>
  </w:style>
</w:styles>`;

const SECT_PR_KP =
    `<w:sectPr>` +
    `<w:pgSz w:w="11906" w:h="16838"/>` +
    `<w:pgMar w:top="794" w:right="${KP_MARGIN_X}" w:bottom="794" w:left="${KP_MARGIN_X}" w:header="567" w:footer="567" w:gutter="0"/>` +
    `<w:cols w:space="708" w:num="1"/>` +
    `<w:docGrid w:linePitch="360" w:charSpace="0"/>` +
    `</w:sectPr>`;

const buildDocumentXml = (bodyXml, sectPr = SECT_PR) =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<w:body>${bodyXml}${sectPr}</w:body></w:document>`;

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

const saveDocx = async (bodyXml, filename, logoBuffer = null, sectPr = SECT_PR) => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', CONTENT_TYPES);
    zip.folder('_rels')?.file('.rels', RELS);
    zip.folder('word')?.file('document.xml', buildDocumentXml(bodyXml, sectPr));
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
        wP(`№${data.contractNo}`, { left: true }),
        wSideLine(`“ ${data.day}” ${data.month} ${data.year} года`, data.buyerOrg, {
            rightBold: true,
            tabPos: KP_CONTENT_W,
        }),
        wP('Коммерческое предложение', { center: true, bold: true, size: SIZE_TITLE }),
        wP(KP_INTRO),
        specTableXml(data.rows, data.total, 'kp'),
        wP(''),
        wP('Цена с учетом  всех налогов и доставки.', { left: true }),
        kpFooterXml(),
    ].join('');
    await saveDocx(body, downloadName(data, 'КП'), logo, SECT_PR_KP);
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