import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const THEME_KEY = 'catalog-theme-preference';

const CatalogThemeContext = createContext(null);

const readUserTheme = () => {
    try {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved === 'light' || saved === 'dark') return saved;
    } catch {
        /* localStorage unavailable */
    }
    return null;
};

const getSystemTheme = () => (
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
);

export const CatalogThemeProvider = ({ children }) => {
    const [userTheme, setUserTheme] = useState(readUserTheme);
    const [systemTheme, setSystemTheme] = useState(getSystemTheme);

    const resolvedTheme = userTheme ?? systemTheme;

    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = (e) => setSystemTheme(e.matches ? 'dark' : 'light');
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute('data-catalog-theme', resolvedTheme);
    }, [resolvedTheme]);

    const toggleTheme = useCallback(() => {
        const next = resolvedTheme === 'dark' ? 'light' : 'dark';
        setUserTheme(next);
        try {
            localStorage.setItem(THEME_KEY, next);
        } catch {
            /* ignore */
        }
    }, [resolvedTheme]);

    const themeButtonLabel = resolvedTheme === 'dark'
        ? 'Включить светлую тему'
        : 'Включить тёмную тему';

    const value = useMemo(() => ({
        resolvedTheme,
        toggleTheme,
        themeButtonLabel,
    }), [resolvedTheme, toggleTheme, themeButtonLabel]);

    return (
        <CatalogThemeContext.Provider value={value}>
            {children}
        </CatalogThemeContext.Provider>
    );
};

export const useCatalogTheme = () => {
    const ctx = useContext(CatalogThemeContext);
    if (!ctx) {
        throw new Error('useCatalogTheme must be used within CatalogThemeProvider');
    }
    return ctx;
};
