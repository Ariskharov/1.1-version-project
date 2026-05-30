import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import './order.scss';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const Order = () => {
    const { id } = useParams();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expanded, setExpanded] = useState(null);

    useEffect(() => {
        fetch(`${API_BASE}/order/${id}`)
            .then(res => res.json())
            .then(data => {
                const loaded = data.order?.[0] || data;

                loaded.product_order = (loaded.product_order || []).map(item => {
                    if (!item.calculatedDetails?.length) {
                        const nums = item.userInputs || {};
                        const details = (item.details || []).map(d => {
                            if (d.if_condition && !nums[d.if_condition]) return null;
                            try {
                                const w = nums[d.formula_width] || 0;
                                const h = d.formula_height ? nums[d.formula_height] : null;
                                const cnt = nums[d.count_formula] || 1;
                                const size = h ? `${Math.round(w)} × ${Math.round(h)} мм` : `${Math.round(w)} мм`;
                                return { key: d.key, label: d.label, size, count: Math.round(cnt) };
                            } catch {
                                return { key: d.key, label: d.label, size: 'Ошибка', count: 0 };
                            }
                        }).filter(Boolean);
                        return { ...item, calculatedDetails: details };
                    }
                    return item;
                });

                const subtotal = loaded.product_order.reduce((s, p) => {
                    return s + Number(p.price || 0) * (Number(p.userInputs?.coll || 1) || 1);
                }, 0);

                setOrder({ ...loaded, subtotal, total: subtotal });
                setLoading(false);
            })
            .catch(err => {
                setError('Не удалось загрузить заказ');
                setLoading(false);
            });
    }, [id]);

    const exportSpec = () => {
        if (!order) return;
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text(`Спецификация №${order.id}`, 105, 20, { align: 'center' });

        doc.setFontSize(12);
        doc.text(`Дата: ${new Date().toLocaleDateString('ru-RU')}`, 105, 30, { align: 'center' });

        const table = order.product_order.map((p, i) => [
            i + 1,
            p.title,
            p.userInputs?.coll || 1,
            Number(p.price).toLocaleString(),
            (Number(p.price) * (p.userInputs?.coll || 1)).toLocaleString()
        ]);

        doc.autoTable({
            head: [['№', 'Позиция', 'Кол-во', 'Цена', 'Сумма']],
            body: table,
            startY: 45,
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246] },
            styles: { fontSize: 10, cellPadding: 4 }
        });

        const y = doc.lastAutoTable.finalY + 20;
        doc.setFontSize(14);
        doc.text(`ИТОГО: ${order.total?.toLocaleString() || 0} сом`, 105, y, { align: 'center' });

        doc.save(`spec_${order.id}.pdf`);
    };

    const exportContract = () => {
        if (!order) return;
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text(`Договор №${order.id}`, 105, 20, { align: 'center' });
        // Добавь текст договора, если нужно
        doc.setFontSize(12);
        doc.text(`Сумма: ${order.total?.toLocaleString() || 0} сом`, 20, 60);
        doc.save(`contract_${order.id}.pdf`);
    };

    if (loading) return <div className="loading">Загрузка...</div>;
    if (error) return <div className="error">{error}</div>;
    if (!order) return <div className="empty">Заказ не найден</div>;

    return (
        <div className="order-page">
            <header className="order-header">
                <h1>Заказ №{order.id}</h1>
                <div className="status-badge">{order.status || 'Оформлен'}</div> 
            </header>

            <div className="order-info">
                <div className="client-block">
                    <h3>Клиент</h3>
                    <p><strong>{order.name_client || '—'}</strong></p>
                    {order.name_compony && <p>{order.name_compony}</p>}
                    <p>Адрес: {order.address || '—'}</p>
                    {order.order_note && <p className="note">Примечание: {order.order_note}</p>}
                </div>

                <div className="total-block">
                    <h3>Итого</h3>
                    <div className="total-line">
                        <span>Сумма товаров</span>
                        <strong>{order.subtotal?.toLocaleString() || 0} сом</strong>
                    </div>
                    <div className="total-line grand">
                        <span>К оплате</span>
                        <strong>{order.total?.toLocaleString() || 0} сом</strong>
                    </div>
                </div>
            </div>

            <section className="items-section">
                <h2>Позиции ({order.product_order?.length || 0})</h2>

                <div className="items-grid">
                    {order.product_order?.map(item => (
                        <div key={item.id} className="item-card">
                            <div className="item-photo">
                                <img
                                    src={item.img?.startsWith('http') ? item.img : `/utilse/${item.img?.split('/').pop()}`}
                                    alt={item.title}
                                    onError={e => (e.target.src = '/utilse/placeholder.jpg')}
                                />
                            </div>

                            <div className="item-body">
                                <h3>{item.title}</h3>
                                {item.description && <p className="desc">{item.description}</p>}

                                <div className="item-price-row">
                                    <span>{Number(item.price).toLocaleString()} сом × {item.userInputs?.coll || 1}</span>
                                    <strong className="item-total">
                                        {(Number(item.price) * (item.userInputs?.coll || 1)).toLocaleString()} сом
                                    </strong>
                                </div>

                                <button
                                    className="details-btn"
                                    onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                                >
                                    {expanded === item.id ? 'Скрыть детали' : 'Деталировка'}
                                </button>

                                {expanded === item.id && item.calculatedDetails?.length > 0 && (
                                    <table className="details-table">
                                        <thead>
                                        <tr>
                                            <th>Деталь</th>
                                            <th>Размер</th>
                                            <th>Кол-во</th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {item.calculatedDetails.map(d => (
                                            <tr key={d.key}>
                                                <td>{d.label}</td>
                                                <td>{d.size}</td>
                                                <td>{d.count}</td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <footer className="order-footer">
                <button className="btn btn-spec" onClick={exportSpec}>Спецификация PDF</button>
                <button className="btn btn-contract" onClick={exportContract}>Договор PDF</button>
            </footer>
        </div>
    );
};

export default Order;