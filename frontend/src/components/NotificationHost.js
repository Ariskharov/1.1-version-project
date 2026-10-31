import { useContext, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomContext } from '../Context';
import { filterActiveAnnouncements } from '../utils/announcements';
import {
    deliverAnnouncementAlerts,
    markAnnouncementsSeen,
    rememberPushTag,
    wasPushJustShown,
} from '../utils/pushNotifications';

// Слушает push на любой странице и показывает тост, даже если системный баннер спрятан.
export default function NotificationHost() {
    const { showToast, announcements, dataLoaded } = useContext(CustomContext);
    const navigate = useNavigate();
    const readyRef = useRef(false);

    useEffect(() => {
        if (!('serviceWorker' in navigator)) return undefined;
        const onMessage = (event) => {
            const data = event.data || {};
            if (data.type === 'push') {
                if (!wasPushJustShown(data.tag)) {
                    rememberPushTag(data.tag);
                    const text = [data.title, data.body].filter(Boolean).join(' — ');
                    if (text) showToast('info', text);
                }
            }
            if (data.type === 'notification-click' && typeof data.url === 'string' && data.url.startsWith('/')) {
                navigate(data.url);
            }
        };
        navigator.serviceWorker.addEventListener('message', onMessage);
        return () => navigator.serviceWorker.removeEventListener('message', onMessage);
    }, [showToast, navigate]);

    useEffect(() => {
        if (!dataLoaded) return;
        const active = filterActiveAnnouncements(announcements);
        if (!readyRef.current) {
            markAnnouncementsSeen(active);
            readyRef.current = true;
            return;
        }
        const notes = deliverAnnouncementAlerts(active);
        if (!notes.length) return;
        const text = notes.map((note) => note.text).join(' · ').slice(0, 240);
        if (text) showToast('info', text);
    }, [announcements, dataLoaded, showToast]);

    return null;
}
