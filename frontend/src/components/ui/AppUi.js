import React from 'react';
import './AppUi.scss';

const AppUi = ({ toast, confirmDialog, onConfirm, onCancel }) => (
    <>
        {toast && (
            <div className={`app-ui-toast app-ui-toast--${toast.type}`} role="alert">
                <span>{toast.message}</span>
            </div>
        )}

        {confirmDialog && (
            <div className="app-ui-overlay" onClick={onCancel}>
                <div className="app-ui-confirm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                    <p>{confirmDialog.message}</p>
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

export default AppUi;