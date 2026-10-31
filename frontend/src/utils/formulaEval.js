let evaluateFn = null;
let readyPromise = null;

// mathjs не качается вместе со страницей: только когда открывают расчёт.
const loadEvaluate = () => {
    if (readyPromise) return readyPromise;
    const promise = import('mathjs').then((mod) => {
        evaluateFn = mod.evaluate;
        return evaluateFn;
    });
    readyPromise = promise;
    // Сбой сети не должен застревать навсегда: следующий расчёт пробует снова.
    promise.catch(() => {
        if (readyPromise === promise) readyPromise = null;
    });
    return promise;
};

export const preloadFormulaEngine = () => loadEvaluate();

export const evaluateReady = {
    then(onFulfilled, onRejected) {
        return loadEvaluate().then(onFulfilled, onRejected);
    },
    catch(onRejected) {
        return loadEvaluate().catch(onRejected);
    },
};

export function evaluateFormula(expression, scope) {
    if (!evaluateFn) {
        throw new Error('Модуль расчёта ещё загружается');
    }
    return evaluateFn(expression, scope);
}
