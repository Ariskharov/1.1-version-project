import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

const getFocusableElements = (container) => (
    Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el) => el.getAttribute('aria-hidden') !== 'true' && !el.closest('[inert]'),
    )
);

const BG_MARK = 'data-a11y-bg-hidden';

/**
 * Прячет фон от AT, не трогая ветку, где лежит диалог.
 * Если диалог внутри #main-content — aria-hidden на main ставить нельзя
 * (фокус уйдёт в потомка → warning в Chrome).
 */
function hideBackgroundAround(dialog) {
    const hidden = [];

    const hideEl = (el) => {
        if (!el || el === dialog || el.contains(dialog)) return;
        if (el.getAttribute(BG_MARK) === '1') return;
        el.setAttribute('aria-hidden', 'true');
        el.setAttribute(BG_MARK, '1');
        // inert — boolean DOM property; не ставим пустую строку
        try {
            el.inert = true;
        } catch {
            /* older browsers */
        }
        hidden.push(el);
    };

    const header = document.querySelector('.header');
    hideEl(header);

    const main = document.getElementById('main-content');
    if (main && !main.contains(dialog)) {
        hideEl(main);
    } else if (main && main.contains(dialog)) {
        // прячем только «соседей» по пути от dialog → main
        let node = dialog;
        while (node && node !== main) {
            const parent = node.parentElement;
            if (!parent) break;
            const currentNode = node;
            Array.from(parent.children).forEach((sibling) => {
                if (sibling !== currentNode) hideEl(sibling);
            });
            node = parent;
        }
    }

    // skip-link и прочее вне main/header
    document.querySelectorAll('body > *').forEach((node) => {
        if (node === header || node === main) return;
        if (node.contains?.(dialog)) return;
        if (node.id === 'root') {
            // CRA: #root > layout; не трогаем весь root
            return;
        }
        hideEl(node);
    });

    return hidden;
}

function restoreBackground(hidden) {
    hidden.forEach((el) => {
        if (el.getAttribute(BG_MARK) === '1') {
            el.removeAttribute('aria-hidden');
            el.removeAttribute(BG_MARK);
            try {
                el.inert = false;
            } catch {
                /* ignore */
            }
        }
    });
}

/**
 * Управление фокусом, Escape и скрытием фона для скринридеров.
 * Не меняет визуальные стили.
 */
export function useDialogA11y(isOpen, onClose, dialogRef, options = {}) {
    const {
        trapFocus = true,
        hideBackground = true,
        closeOnEscape = true,
    } = options;

    const previousFocusRef = useRef(null);
    const hiddenBgRef = useRef([]);

    useEffect(() => {
        if (!isOpen || !dialogRef?.current) return undefined;

        previousFocusRef.current = document.activeElement;

        const dialog = dialogRef.current;

        if (hideBackground) {
            hiddenBgRef.current = hideBackgroundAround(dialog);
        }

        const focusables = getFocusableElements(dialog);
        const initial =
            focusables.find((el) => el.getAttribute('aria-label') === 'Закрыть') ||
            focusables[0];

        // фокус после того, как aria-hidden снят с предков диалога
        requestAnimationFrame(() => {
            (initial || dialog).focus?.();
        });

        const onKeyDown = (e) => {
            if (closeOnEscape && e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
                return;
            }

            if (!trapFocus || e.key !== 'Tab') return;

            const items = getFocusableElements(dialog);
            if (items.length === 0) {
                e.preventDefault();
                return;
            }

            const first = items[0];
            const last = items[items.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === first || !dialog.contains(document.activeElement)) {
                    e.preventDefault();
                    last.focus();
                }
            } else if (document.activeElement === last || !dialog.contains(document.activeElement)) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', onKeyDown, true);

        return () => {
            document.removeEventListener('keydown', onKeyDown, true);
            if (hideBackground) {
                restoreBackground(hiddenBgRef.current);
                hiddenBgRef.current = [];
            }
            const prev = previousFocusRef.current;
            if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
                requestAnimationFrame(() => prev.focus());
            }
        };
    }, [isOpen, onClose, dialogRef, trapFocus, hideBackground, closeOnEscape]);
}
