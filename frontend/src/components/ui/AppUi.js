import React, { useRef } from 'react';
import './AppUi.scss';
import { useDialogA11y } from '../../hooks/useDialogA11y';

const AppUi = ({ toast, confirmDialog, onConfirm, onCancel }) => {
    const confirmRef = useRef(null);

    useDialogA11y(Boolean(confirmDialog), onCancel, confirmRef);

    return (
        <>
            {toast && (
                <div className={`app-ui-toast app-ui-toast--${toast.type}`} role="alert" aria-live="assertive">
                    <span>{toast.message}</span>
                </div>
            )}

            {confirmDialog && (
                <div className="app-ui-overlay" onClick={onCancel} role="presentation">
                    <div
                        ref={confirmRef}
                        className="app-ui-confirm"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="app-ui-confirm-msg"
                        tabIndex={-1}
                    >
                        <p id="app-ui-confirm-msg">{confirmDialog.message}</p>
                        <div className="app-ui-confirm__actions">
                            <button type="button" className="app-ui-confirm__btn" onClick={onCancel}>
                                {confirmDialog.cancelLabel}
                            </button>
                            <button
                                type="button"
                                className={`app-ui-confirm__btn${confirmDialog.danger ? ' app-ui-confirm__btn--danger' : ' app-ui-confirm__btn--primary'}`}
                                onClick={onConfirm}
                            >
                                {confirmDialog.confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AppUi;