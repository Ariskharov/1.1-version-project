import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { draftHasWork, readOrderDraft } from '../../utils/orderConvenience';
import './DraftBanner.scss';

const DraftBanner = () => {
    const [draft, setDraft] = useState(null);

    useEffect(() => {
        setDraft(readOrderDraft());
    }, []);

    if (!draftHasWork(draft)) return null;

    const count = draft.order.positions?.length || 0;
    const who = draft.order.name_compony || draft.order.name_client || 'клиент ещё не указан';

    return (
        <div className="draft-banner" role="status">
            <p>
                Есть незавершённый заказ — {who}
                {count > 0 ? `, ${count} поз.` : ''}
            </p>
            <Link to="/placing_an_order">Продолжить</Link>
        </div>
    );
};

export default DraftBanner;
