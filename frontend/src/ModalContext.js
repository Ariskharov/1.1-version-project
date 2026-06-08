import React, { createContext, useContext, useState, useCallback } from 'react';
import './modal.css';

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

    // Показать уведомление (исчезает само)
    const showAlert = useCallback((message, type = 'info') => {
        setAlert({ message, type });
        setTimeout(() => setAlert(null), 4000);
    }, []);

    // Показать окно подтверждения (возвращает Promise<boolean>)
    const showConfirm = useCallback((message) => {
        return new Promise((resolve) => {
            setConfirm({ message, resolve });
        });
    }, []);

    const handleConfirmYes = () => {
        if (confirm?.resolve) confirm.resolve(true);
        setConfirm(null);
    };

    const handleConfirmNo = () => {
        if (confirm?.resolve) confirm.resolve(false);
        setConfirm(null);
    };

    return (
        <ModalContext.Provider value={{ showAlert, showConfirm }}>
            {children}

            {/* ====== Уведомление ====== */}
            {alert && (
                <div className={`mg-alert mg-alert--${alert.type}`}>
                    <span className="mg-alert__icon">
                        {alert.type === 'success' && '✅'}
                        {alert.type === 'error'   && '❌'}
                        {alert.type === 'info'    && 'ℹ️'}
                    </span>
                    <span className="mg-alert__text">{alert.message}</span>
                    <button className="mg-alert__close" onClick={() => setAlert(null)}>✕</button>
                </div>
            )}

            {/* ====== Диалог подтверждения ====== */}
            {confirm && (
                <div className="mg-overlay" onClick={handleConfirmNo}>
                    <div className="mg-dialog" onClick={e => e.stopPropagation()}>
                        <p className="mg-dialog__message">{confirm.message}</p>
                        <div className="mg-dialog__actions">
                            <button className="mg-btn mg-btn--cancel" onClick={handleConfirmNo}>
                                Отмена
                            </button>
                            <button className="mg-btn mg-btn--confirm" onClick={handleConfirmYes}>
                                Да
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ModalContext.Provider>
    );
};
