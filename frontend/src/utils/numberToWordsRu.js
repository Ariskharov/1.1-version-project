const ones = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const onesF = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];

const triadToWords = (num, feminine) => {
    let n = num;
    const parts = [];
    if (n >= 100) {
        parts.push(hundreds[Math.floor(n / 100)]);
        n %= 100;
    }
    if (n >= 20) {
        parts.push(tens[Math.floor(n / 10)]);
        n %= 10;
    } else if (n >= 10) {
        parts.push(teens[n - 10]);
        n = 0;
    }
    if (n > 0) parts.push((feminine ? onesF : ones)[n]);
    return parts.filter(Boolean).join(' ');
};

const pluralForm = (n, [one, few, many]) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
};

export const numberToWordsRu = (value) => {
    const num = Math.round(Number(value) || 0);
    if (num === 0) return 'ноль';

    const parts = [];
    const millions = Math.floor(num / 1_000_000);
    const thousands = Math.floor((num % 1_000_000) / 1000);
    const rest = num % 1000;

    if (millions) {
        const w = triadToWords(millions, false);
        parts.push(`${w} ${pluralForm(millions, ['миллион', 'миллиона', 'миллионов'])}`);
    }
    if (thousands) {
        const w = triadToWords(thousands, true);
        parts.push(`${w} ${pluralForm(thousands, ['тысяча', 'тысячи', 'тысяч'])}`);
    }
    if (rest) {
        parts.push(triadToWords(rest, false));
    }

    return parts.join(' ').replace(/\s+/g, ' ').trim();
};

export const amountToWordsRu = (value) => {
    const words = numberToWordsRu(value);
    return words ? words.charAt(0).toUpperCase() + words.slice(1) : '';
};