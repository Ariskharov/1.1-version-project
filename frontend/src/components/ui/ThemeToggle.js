import React from 'react';
import { useCatalogTheme } from '../../context/CatalogThemeContext';
import './ThemeToggle.scss';

const ThemeToggle = ({ className = '' }) => {
    const { resolvedTheme, toggleTheme, themeButtonLabel } = useCatalogTheme();

    return (
        <button
            type="button"
            className={`theme-toggle ${className}`.trim()}
            onClick={toggleTheme}
            title={themeButtonLabel}
            aria-label={themeButtonLabel}
        >
            <span className="theme-toggle__icon" aria-hidden="true">
                {resolvedTheme === 'dark' ? (
                    <svg viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                ) : (
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M20 14.5A7.5 7.5 0 0 1 9.5 4 6 6 0 1 0 20 14.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    </svg>
                )}
            </span>
            <span className="theme-toggle__text">
                {resolvedTheme === 'dark' ? 'Светлая' : 'Тёмная'}
            </span>
        </button>
    );
};

export default ThemeToggle;
