import React, { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import axios from 'axios';
import { CustomContext } from '../../Context';
import './scan.scss';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const Scan = () => {
    const navigate = useNavigate();
    const { currentUser, logout } = useContext(CustomContext);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [badgeInput, setBadgeInput] = useState('');
    const [status, setStatus] = useState(null); // { type: 'success' | 'error' | 'loading', message: string }
    
    const scannerRef = useRef(null);
    const processing = useRef(false);

    // Live digital clock updating every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Camera QR scanner activation
    useEffect(() => {
        let html5QrCode;
        
        // Wait for element to be in DOM
        const startScanner = async () => {
            try {
                html5QrCode = new Html5Qrcode("reader");
                scannerRef.current = html5QrCode;

                await html5QrCode.start(
                    { facingMode: "environment" },
                    {
                        fps: 10,
                        qrbox: { width: 260, height: 260 }
                    },
                    (decodedText) => {
                        // Scan Success
                        handleCheckin(decodedText);
                    },
                    (errorMessage) => {
                        // Scanning... ignore parsing warnings
                    }
                );
            } catch (err) {
                console.warn("Не удалось запустить камеру автоматически: ", err);
            }
        };

        // Delay slightly to ensure DOM element is ready
        const delayStart = setTimeout(startScanner, 100);

        return () => {
            clearTimeout(delayStart);
            if (html5QrCode && html5QrCode.isScanning) {
                html5QrCode.stop().catch(err => console.error("Ошибка остановки сканера:", err));
            }
        };
    }, []);

    const formatDuration = (minutes) => {
        if (minutes == null) return '—';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours} ч ${mins} мин`;
    };

    const handleCheckin = async (badgeId) => {
        if (!badgeId || badgeId.trim() === '') return;
        if (processing.current) return;
        processing.current = true;

        setStatus({ type: 'loading', message: 'Идентификация сотрудника...' });

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_BASE}/api/qr-checkin`, { badgeId: badgeId.trim() }, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (res.data.success) {
                const data = res.data;
                if (data.action === 'start') {
                    setStatus({
                        type: 'success',
                        message: `Добрый день, ${data.fullName}! Смена начата в ${data.startTime}`
                    });
                } else {
                    const durationStr = formatDuration(data.durationMinutes);
                    setStatus({
                        type: 'success',
                        message: `До свидания, ${data.fullName}! Смена завершена. Отработано: ${durationStr}`
                    });
                }
            } else {
                setStatus({
                    type: 'error',
                    message: res.data.message || 'Ошибка отметки'
                });
            }
        } catch (err) {
            console.error('Checkin error:', err);
            const errMsg = err.response?.data?.error || 'Ошибка связи с сервером. Повторите попытку.';
            setStatus({
                type: 'error',
                message: errMsg
            });
        }

        // Reset display after 4 seconds
        setTimeout(() => {
            setStatus(null);
            setBadgeInput('');
            processing.current = false;
        }, 4000);
    };

    const handleManualSubmit = (e) => {
        e.preventDefault();
        handleCheckin(badgeInput);
    };

    const handleGoBack = () => {
        if (currentUser?.role === 'admin') {
            navigate('/admin');
        } else {
            logout();
            navigate('/signin');
        }
    };

    // Format current date Russian style
    const formatDate = (date) => {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('ru-RU', options);
    };

    const formatTime = (date) => {
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    return (
        <div className="kiosk-scan">
            {/* Header controls for kiosk */}
            <div className="kiosk-scan__nav">
                <button onClick={handleGoBack} className="btn-back">
                    {currentUser?.role === 'admin' ? '← Назад в панель' : 'Выйти из режима сканера'}
                </button>
                <div className="kiosk-scan__operator">
                    Оператор: <strong>{currentUser?.fullName || 'Система'}</strong>
                </div>
            </div>

            <div className="kiosk-scan__content">
                {/* Time & Date display */}
                <div className="kiosk-scan__clock-section">
                    <div className="kiosk-scan__time">{formatTime(currentTime)}</div>
                    <div className="kiosk-scan__date">{formatDate(currentTime)}</div>
                    <h1>Отметить приход / уход</h1>
                </div>

                {/* Main Action Block: QR scanning or Status result */}
                <div className="kiosk-scan__main-panel">
                    {status ? (
                        <div className={`kiosk-scan__result kiosk-scan__result--${status.type}`}>
                            {status.type === 'loading' && (
                                <div className="kiosk-scan__loader">
                                    <div className="spinner"></div>
                                    <p>{status.message}</p>
                                </div>
                            )}
                            {status.type === 'success' && (
                                <div className="kiosk-scan__feedback">
                                    <div className="icon">✅</div>
                                    <p className="message">{status.message}</p>
                                </div>
                            )}
                            {status.type === 'error' && (
                                <div className="kiosk-scan__feedback">
                                    <div className="icon">❌</div>
                                    <p className="message">{status.message}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="kiosk-scan__scanner-box">
                            <div className="kiosk-scan__scanner-frame">
                                <div id="reader"></div>
                                <div className="scanner-overlay">
                                    <div className="scanner-laser"></div>
                                </div>
                            </div>
                            <p className="kiosk-scan__instruction">Поместите QR-код бейджа в область камеры</p>
                        </div>
                    )}
                </div>

                {/* Backup manual entry */}
                {!status && (
                    <div className="kiosk-scan__manual">
                        <form onSubmit={handleManualSubmit}>
                            <input
                                type="text"
                                placeholder="Введите ID бейджа вручную"
                                value={badgeInput}
                                onChange={(e) => setBadgeInput(e.target.value)}
                                disabled={processing.current}
                            />
                            <button type="submit" disabled={processing.current || !badgeInput.trim()}>
                                Отметиться
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Scan;
