let evaluateFn = null;

// mathjs нужен только в момент расчёта. Отдельный кусок качается параллельно
// с каталогом и не входит в первую сборку страницы.
export const evaluateReady = import('mathjs').then((mod) => {
    evaluateFn = mod.evaluate;
    return evaluateFn;
});

// Глушим отказ, пока никто не ждёт расчёт. Повторный await всё равно получит ошибку.
evaluateReady.catch(() => {
    /* ошибку покажет тот, кто вызвал расчёт */
});

export function evaluateFormula(expression, scope) {
    if (!evaluateFn) {
        throw new Error('Модуль расчёта ещё загружается');
    }
    return evaluateFn(expression, scope);
}
