import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import './modal.css';
import { useDialogA11y } from './hooks/useDialogA11y';

export const ModalContext = createContext(null);

/**
 * useModal — хук для доступа к функциям показа модалок из любого компонента.
 * showAlert(message)  — информационная/ошибочная плашка в центре экрана.
 * showConfirm(message) — окно подтверждения, возвращает Promise<boolean>.
 */
export const useModal = () => {
    const ctx = useContext(ModalContext);
    if (!ctx) throw new Error('useModal must be used inside <ModalProvider>');
    return ctx;
};

export const ModalProvider = ({ children }) => {
    // ---- уведомление (alert) ----
    const [alert, setAlert] = useState(null); // { message, type: 'success'|'error'|'info' }

    // ---- диалог подтверждения ----
    const [confirm, setConfirm] = useState(null); // { message, resolve }
    const alertTimerRef = useRef(null);
    const confirmRef = useRef(null);
    const confirmDialogRef = useRef(null);
    confirmRef.current = confirm;

    // Показать уведомление (исчезает само). Новый тост сбрасывает таймер предыдущего.
    const showAlert = useCallback((message, type = 'info') => {
        if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
        setAlert({ message, type });
        alertTimerRef.current = setTimeout(() => setAlert(null), 4000);
    }, []);

    // Показать окно подтверждения (возвращает Promise<boolean>)
    const showConfirm = useCallback((message) => {
        return new Promise((resolve) => {
            setConfirm({ message, resolve });
        });
    }, []);

    const handleConfirmYes = useCallback(() => {
        confirmRef.current?.resolve?.(true);
        setConfirm(null);
    }, []);

    const handleConfirmNo = useCallback(() => {
        confirmRef.current?.resolve?.(false);
        setConfirm(null);
    }, []);

    useDialogA11y(Boolean(confirm), handleConfirmNo, confirmDialogRef);

    const modalApi = useMemo(() => ({ showAlert, showConfirm }), [showAlert, showConfirm]);
    const alertIsError = alert?.type === 'error';

    return (
        <ModalContext.Provider value={modalApi}>
            {children}

            {/* ====== Уведомление ====== */}
            {alert && (
                <div
                    className={`mg-alert mg-alert--${alert.type}`}
                    role={alertIsError ? 'alert' : 'status'}
                    aria-live={alertIsError ? 'assertive' : 'polite'}
                >
                    <span className="mg-alert__icon" aria-hidden="true">
                        {alert.type === 'success' && '✅'}
                        {alert.type === 'error'   && '❌'}
                        {alert.type === 'info'    && 'ℹ️'}
                    </span>
                    <span className="mg-alert__text">{alert.message}</span>
                    <button type="button" className="mg-alert__close" onClick={() => setAlert(null)} aria-label="Закрыть уведомление">
                        <span aria-hidden="true">✕</span>
                    </button>
                </div>
            )}

            {/* ====== Диалог подтверждения ====== */}
            {confirm && (
                <div className="mg-overlay" onClick={handleConfirmNo}>
                    <div
                        ref={confirmDialogRef}
                        className="mg-dialog"
                        onClick={e => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="mg-confirm-msg"
                        tabIndex={-1}
                    >
                        <p id="mg-confirm-msg" className="mg-dialog__message">{confirm.message}</p>
                        <div className="mg-dialog__actions">
                            <button type="button" className="mg-btn mg-btn--cancel" onClick={handleConfirmNo}>
                                Отмена
                            </button>
                            <button type="button" className="mg-btn mg-btn--confirm" onClick={handleConfirmYes}>
                                Да
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ModalContext.Provider>
    );
};
