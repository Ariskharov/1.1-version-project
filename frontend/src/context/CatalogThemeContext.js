import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import logoForLightTheme from '../Layout/img_layout/лого_темное.jpg';
import logoForDarkTheme from '../Layout/img_layout/logo-light-ui.jpg';

const THEME_KEY = 'catalog-theme-preference';
const FAVICON_RELS = ['icon', 'apple-touch-icon'];

const setFavicons = (href, type) => {
    FAVICON_RELS.forEach((rel) => {
        let node = document.querySelector(`link[rel="${rel}"]`);
        if (!node) {
            node = document.createElement('link');
            node.rel = rel;
            document.head.appendChild(node);
        }
        node.type = type;
        node.href = href;
    });
};

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

    useEffect(() => {
        const href = resolvedTheme === 'dark' ? logoForDarkTheme : logoForLightTheme;
        setFavicons(href, 'image/jpeg');
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
