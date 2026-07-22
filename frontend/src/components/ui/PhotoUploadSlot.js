import React, { useId } from 'react';
import './PhotoUploadSlot.scss';

/**
 * Только вёрстка под загрузку фото.
 * Логику upload/delete друг подключает сюда:
 *  - убрать disabled у input (если стоит)
 *  - onChange → FormData + POST /upload
 *  - показать previewUrl из ответа { path: "/utilse/..." }
 *  - onRemove → DELETE /upload
 *
 * НЕ трогает backend и редактор мебели.
 */
export default function PhotoUploadSlot({
    label = 'Фото',
    hint = 'Функция загрузки будет подключена',
    /** 'card' | 'avatar' | 'banner' */
    variant = 'card',
    /** URL превью (пока можно не передавать) */
    previewUrl = '',
    className = '',
    /** id для input — должен быть уникален на странице */
    inputId,
    /** ref на <input type="file"> — удобно другу */
    inputRef = null,
    disabled = true,
    onFileChange,
    onRemove,
}) {
    const autoId = useId();
    const id = inputId || `photo-slot-${autoId}`;
    const hasPreview = Boolean(previewUrl);

    const openPicker = () => {
        if (disabled && !onFileChange) return;
        const el = document.getElementById(id);
        el?.click();
    };

    const handleChange = (e) => {
        if (typeof onFileChange === 'function') {
            onFileChange(e);
            return;
        }
        // Заглушка: сбрасываем выбор, чтобы не казалось что файл «прикрепился»
        e.target.value = '';
    };

    const handleRemove = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof onRemove === 'function') onRemove(e);
    };

    return (
        <div
            className={[
                'photo-slot',
                `photo-slot--${variant}`,
                hasPreview ? 'photo-slot--has-preview' : '',
                disabled && !onFileChange ? 'photo-slot--disabled' : '',
                className,
            ]
                .filter(Boolean)
                .join(' ')}
            data-photo-slot
            data-photo-upload-wired={onFileChange ? 'true' : 'false'}
        >
            {label ? (
                <div className="photo-slot__label" id={`${id}-label`}>
                    {label}
                </div>
            ) : null}

            <div
                className="photo-slot__zone"
                role="button"
                tabIndex={0}
                aria-labelledby={label ? `${id}-label` : undefined}
                aria-label={label || 'Загрузить фото'}
                onClick={openPicker}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openPicker();
                    }
                }}
            >
                {hasPreview ? (
                    <>
                        <img className="photo-slot__img" src={previewUrl} alt="" />
                        <button
                            type="button"
                            className="photo-slot__remove"
                            onClick={handleRemove}
                            aria-label="Удалить фото"
                            title={onRemove ? 'Удалить фото' : 'Удаление — после подключения API'}
                            disabled={!onRemove}
                        >
                            ×
                        </button>
                    </>
                ) : (
                    <div className="photo-slot__empty">
                        <span className="photo-slot__icon" aria-hidden="true">
                            {variant === 'avatar' ? '👤' : '📷'}
                        </span>
                        <span className="photo-slot__cta">
                            {variant === 'avatar' ? 'Загрузить аватар' : 'Загрузить фото'}
                        </span>
                        {hint ? <span className="photo-slot__hint">{hint}</span> : null}
                        {!onFileChange ? (
                            <span className="photo-slot__badge">Скоро</span>
                        ) : null}
                    </div>
                )}

                {/* Друг: onChange + убрать disabled */}
                <input
                    ref={inputRef}
                    id={id}
                    type="file"
                    accept="image/*"
                    className="photo-slot__input"
                    disabled={disabled && !onFileChange}
                    onChange={handleChange}
                    tabIndex={-1}
                    aria-hidden="true"
                />
            </div>
        </div>
    );
}
