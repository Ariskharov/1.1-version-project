import React, { useState } from 'react';
import { filterOrganizations } from '../../utils/orderConvenience';
import './OrganizationSuggest.scss';

const OrganizationSuggest = ({
    value,
    onChange,
    onPick,
    cards,
    className = '',
    placeholder,
    id,
}) => {
    const [open, setOpen] = useState(false);
    const matches = open ? filterOrganizations(cards, value) : [];

    return (
        <div className="org-suggest">
            <input
                id={id}
                className={className}
                value={value || ''}
                placeholder={placeholder}
                autoComplete="off"
                onChange={(event) => {
                    onChange(event.target.value);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
            />
            {matches.length > 0 && (
                <ul className="org-suggest__list" role="listbox">
                    {matches.map((card) => (
                        <li key={`${card.sourceId}-${card.label}`}>
                            <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                    onPick(card);
                                    setOpen(false);
                                }}
                            >
                                <strong>{card.label}</strong>
                                <span>из заказа №{card.sourceId}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default OrganizationSuggest;
