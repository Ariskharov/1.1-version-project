import React from 'react';
import './LoadingSpinner.scss';

const SIZES = { sm: 14, md: 18, lg: 28 };

const LoadingSpinner = ({ size = 'md', className = '', light = false }) => {
    const px = SIZES[size] || SIZES.md;
    const classes = [
        'ui-spinner',
        light ? 'ui-spinner--light' : '',
        className,
    ].filter(Boolean).join(' ');

    return (
        <span
            className={classes}
            style={{ width: px, height: px }}
            role="status"
            aria-label="Загрузка"
        />
    );
};

export const LoadingPage = ({ message = 'Загрузка...', dark = false }) => (
    <div className={`ui-loading-page${dark ? ' ui-loading-page--dark' : ''}`}>
        <LoadingSpinner size="lg" light={dark} />
        <p>{message}</p>
    </div>
);

export default LoadingSpinner;