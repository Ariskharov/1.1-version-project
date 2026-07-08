import React, { useContext, useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import './cabinet.scss';
import { CustomContext } from '../../Context';
import { LoadingPage } from '../../components/ui/LoadingSpinner';
import { useCatalogTheme } from '../../context/CatalogThemeContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format, subDays, startOfMonth, endOfMonth, subMonths, parseISO, differenceInMinutes } from 'date-fns';

// Регистрируем Chart.js один раз
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

const formatTime = (time) => (time ? time.slice(0, 5) : '—');
const formatDate = (dateStr) => dateStr.split('-').reverse().join('.');

const formatDuration = (minutes) => {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const rem = h % 24;
    return m === 0 ? `${d}д ${rem}ч` : `${d}д ${rem}ч ${m}м`;
  }
  return m === 0 ? `${h} ч` : `${h} ч ${m} м`;
};

const getShiftPeriod = (session) => {
  if (!session.endDate || session.endDate === session.date) {
    return formatDate(session.date);
  }
  return `${formatDate(session.date)} → ${formatDate(session.endDate)}`;
};

const isShiftActive = (session) => !session.endTime;

const getInitials = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const ROLE_LABELS = {
  user: 'Сотрудник',
  manager: 'Менеджер',
  admin: 'Администратор',
};

const getPeriodLabel = (preset, dateRange) => {
  const labels = {
    today: 'Сегодня',
    week: 'Эта неделя',
    month: 'Этот месяц',
    last_month: 'Прошлый месяц',
    '3_months': '3 месяца',
    all: 'За всё время',
    custom: 'Произвольный период',
  };
  if (preset === 'custom' && dateRange.from && dateRange.to) {
    return `${formatDate(dateRange.from)} — ${formatDate(dateRange.to)}`;
  }
  return labels[preset] || 'Период';
};

const getUserHoursInRange = (sessions, userId, from, to) => {
  const minutes = sessions
    .filter(s => s.userId === userId)
    .filter(s => {
      const start = s.date;
      const end = s.endDate || s.date;
      return end >= from && start <= to;
    })
    .reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  return Math.round((minutes / 60) * 10) / 10;
};

// ==================== ПРЕСЕТЫ ПЕРИОДОВ ====================

const PERIOD_PRESETS = [
  { key: 'today', label: 'Сегодня' },
  { key: 'week', label: 'Эта неделя' },
  { key: 'month', label: 'Этот месяц' },
  { key: 'last_month', label: 'Прошлый месяц' },
  { key: '3_months', label: '3 месяца' },
  { key: 'all', label: 'За всё время' },
  { key: 'custom', label: 'Произвольный' },
];

const PersonalCabinet = () => {
  const { currentUser, workSessions, showToast } = useContext(CustomContext);
  const { resolvedTheme } = useCatalogTheme();

  const [liveNow, setLiveNow] = useState(Date.now());

  const cabinetClassName = (extra = '') =>
    ['cabinet', `cabinet--theme-${resolvedTheme}`, extra].filter(Boolean).join(' ');

  // ==================== СОСТОЯНИЕ ФИЛЬТРОВ ====================
  const [activePreset, setActivePreset] = useState('month');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | active | closed
  const [durationFilter, setDurationFilter] = useState('all'); // all | short | normal | long | very_long
  const [sortBy, setSortBy] = useState('date_desc'); // date_desc | date_asc | duration_desc

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  // ==================== ПОЛУЧЕНИЕ ДИАПАЗОНА ДАТ ====================
  const dateRange = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (activePreset === 'custom' && customDateFrom && customDateTo) {
      return { from: customDateFrom, to: customDateTo };
    }

    let from, to;

    switch (activePreset) {
      case 'today':
        from = to = format(today, 'yyyy-MM-dd');
        break;
      case 'week':
        from = format(subDays(today, 6), 'yyyy-MM-dd');
        to = format(today, 'yyyy-MM-dd');
        break;
      case 'month':
        from = format(startOfMonth(today), 'yyyy-MM-dd');
        to = format(today, 'yyyy-MM-dd');
        break;
      case 'last_month': {
        const lastMonth = subMonths(today, 1);
        from = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
        to = format(endOfMonth(lastMonth), 'yyyy-MM-dd');
        break;
      }
      case '3_months':
        from = format(subMonths(today, 3), 'yyyy-MM-dd');
        to = format(today, 'yyyy-MM-dd');
        break;
      case 'all':
      default:
        from = '1970-01-01';
        to = format(today, 'yyyy-MM-dd');
        break;
    }

    return { from, to };
  }, [activePreset, customDateFrom, customDateTo]);

  // ==================== ФИЛЬТРАЦИЯ И СОРТИРОВКА СМЕН ====================
  const filteredShifts = useMemo(() => {
    if (!currentUser) return [];

    let result = workSessions.filter(s => s.userId === currentUser.id);

    // Фильтр по периоду
    result = result.filter(s => {
      const start = s.date;
      const end = s.endDate || s.date;
      return end >= dateRange.from && start <= dateRange.to;
    });

    // Фильтр по статусу
    if (statusFilter === 'active') {
      result = result.filter(isShiftActive);
    } else if (statusFilter === 'closed') {
      result = result.filter(s => !isShiftActive(s));
    }

    // Фильтр по длительности
    if (durationFilter !== 'all') {
      result = result.filter(s => {
        const min = s.durationMinutes || 0;
        const hours = min / 60;
        if (durationFilter === 'short') return hours < 8;
        if (durationFilter === 'normal') return hours >= 8 && hours < 12;
        if (durationFilter === 'long') return hours >= 12 && hours < 24;
        if (durationFilter === 'very_long') return hours >= 24;
        return true;
      });
    }

    // Сортировка
    result.sort((a, b) => {
      if (sortBy === 'date_desc') {
        return (b.endDate || b.date).localeCompare(a.endDate || a.date) || (b.startTime || '').localeCompare(a.startTime || '');
      }
      if (sortBy === 'date_asc') {
        return (a.endDate || a.date).localeCompare(b.endDate || b.date) || (a.startTime || '').localeCompare(b.startTime || '');
      }
      if (sortBy === 'duration_desc') {
        return (b.durationMinutes || 0) - (a.durationMinutes || 0);
      }
      return 0;
    });

    return result;
  }, [workSessions, currentUser, dateRange, statusFilter, durationFilter, sortBy]);

  // ==================== ПАГИНАЦИЯ ====================
  const totalPages = Math.ceil(filteredShifts.length / ITEMS_PER_PAGE) || 1;
  const paginatedShifts = filteredShifts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Сброс страницы при изменении фильтров
  useEffect(() => {
    setCurrentPage(1);
  }, [dateRange, statusFilter, durationFilter, sortBy]);

  // ==================== СТАТИСТИКА ====================
  const statistics = useMemo(() => {
    const shifts = filteredShifts;
    const totalMinutes = shifts.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

    const closedShifts = shifts.filter(s => !isShiftActive(s));
    const avgMinutes = closedShifts.length > 0 
      ? Math.round(totalMinutes / closedShifts.length) 
      : 0;

    const longest = shifts.reduce((max, s) => 
      (s.durationMinutes || 0) > (max.durationMinutes || 0) ? s : max, 
      { durationMinutes: 0 }
    );

    return {
      totalShifts: shifts.length,
      totalHours,
      avgDuration: formatDuration(avgMinutes),
      longestDuration: longest.durationMinutes ? formatDuration(longest.durationMinutes) : '—',
      activeCount: shifts.filter(isShiftActive).length,
    };
  }, [filteredShifts]);

  // ==================== ГРАФИК ЗА ПОСЛЕДНИЕ 7 ДНЕЙ ====================
  const chartGold = resolvedTheme === 'dark' ? '#d4af78' : '#b8954a';
  const chartGoldDim = resolvedTheme === 'dark' ? 'rgba(212, 175, 120, 0.35)' : 'rgba(184, 149, 74, 0.4)';
  const chartGrid = resolvedTheme === 'dark' ? 'rgba(212, 175, 120, 0.08)' : 'rgba(184, 149, 74, 0.12)';
  const chartText = resolvedTheme === 'dark' ? '#9a9188' : '#5a6372';

  const weeklyChartData = useMemo(() => {
    if (!currentUser) return { labels: [], datasets: [], totalHours: 0, daysWorked: 0, maxValue: 12 };

    const daysOfWeek = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const today = new Date();
    const labels = [];
    const data = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = format(date, 'yyyy-MM-dd');

      const weekdayIndex = date.getDay();
      labels.push(daysOfWeek[weekdayIndex]);

      const daySessions = workSessions.filter(
        s => s.userId === currentUser.id && s.date === dateStr
      );

      const minutes = daySessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
      data.push(Math.round((minutes / 60) * 10) / 10);
    }

    const maxValue = Math.max(12, ...data);
    const totalHours = Math.round(data.reduce((a, b) => a + b, 0) * 10) / 10;
    const daysWorked = data.filter(h => h > 0).length;

    return {
      labels,
      datasets: [{
        label: 'Отработано часов',
        data,
        backgroundColor: data.map(h => (h > 0 ? chartGold : chartGoldDim)),
        borderRadius: 6,
        barThickness: 28,
      }],
      maxValue,
      totalHours,
      daysWorked,
    };
  }, [workSessions, currentUser, chartGold, chartGoldDim]);

  const weeklyChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: resolvedTheme === 'dark' ? '#1e1b18' : '#ffffff',
        titleColor: resolvedTheme === 'dark' ? '#f5f0e8' : '#171a1f',
        bodyColor: resolvedTheme === 'dark' ? '#9a9188' : '#5a6372',
        borderColor: chartGold,
        borderWidth: 1,
        callbacks: {
          label: (context) => `${context.parsed.y} ч`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: weeklyChartData.maxValue || 12,
        ticks: {
          stepSize: Math.ceil((weeklyChartData.maxValue || 12) / 5),
          callback: (value) => `${value} ч`,
          color: chartText,
        },
        grid: { color: chartGrid }
      },
      x: {
        grid: { display: false },
        ticks: { color: chartText },
      }
    }
  }), [weeklyChartData.maxValue, resolvedTheme, chartGold, chartGrid, chartText]);

  // ==================== ТЕКУЩАЯ АКТИВНАЯ СМЕНА ====================
  const currentActiveShift = useMemo(() => {
    if (!currentUser) return null;
    return workSessions
      .filter(s => s.userId === currentUser.id && isShiftActive(s))
      .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  }, [workSessions, currentUser]);

  useEffect(() => {
    if (!currentActiveShift) return undefined;
    const timer = setInterval(() => setLiveNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, [currentActiveShift]);

  const activeShiftElapsed = useMemo(() => {
    if (!currentActiveShift) return null;
    try {
      const start = parseISO(`${currentActiveShift.date}T${currentActiveShift.startTime}`);
      if (isNaN(start.getTime())) return null;
      const minutes = Math.max(0, differenceInMinutes(new Date(liveNow), start));
      return formatDuration(minutes);
    } catch {
      return null;
    }
  }, [currentActiveShift, liveNow]);

  // ==================== ИНСАЙТЫ (новые) ====================
  const monthComparison = useMemo(() => {
    if (!currentUser) return { current: 0, previous: 0, diff: 0 };
    const today = new Date();
    const thisMonthFrom = format(startOfMonth(today), 'yyyy-MM-dd');
    const thisMonthTo = format(today, 'yyyy-MM-dd');
    const lastMonth = subMonths(today, 1);
    const prevFrom = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
    const prevTo = format(endOfMonth(lastMonth), 'yyyy-MM-dd');

    const current = getUserHoursInRange(workSessions, currentUser.id, thisMonthFrom, thisMonthTo);
    const previous = getUserHoursInRange(workSessions, currentUser.id, prevFrom, prevTo);
    const diff = Math.round((current - previous) * 10) / 10;

    return { current, previous, diff };
  }, [workSessions, currentUser]);

  // ==================== ЭКСПОРТ В PDF ====================
  const exportToPDF = () => {
    if (!currentUser || filteredShifts.length === 0) {
      showToast('info', 'Нет данных для экспорта');
      return;
    }

    const doc = new jsPDF();
    const periodLabel = PERIOD_PRESETS.find(p => p.key === activePreset)?.label || 'Выбранный период';

    // Заголовок
    doc.setFontSize(18);
    doc.text('Отчёт по рабочему времени', 105, 18, { align: 'center' });

    doc.setFontSize(12);
    doc.text(`Сотрудник: ${currentUser.fullName}`, 20, 30);
    doc.text(`Период: ${periodLabel}`, 20, 37);
    doc.text(`Сформировано: ${new Date().toLocaleDateString('ru-RU')}`, 20, 44);

    // Статистика
    doc.setFontSize(11);
    doc.text(`Всего смен: ${statistics.totalShifts}`, 20, 54);
    doc.text(`Отработано часов: ${statistics.totalHours}`, 20, 60);
    doc.text(`Средняя смена: ${statistics.avgDuration}`, 20, 66);

    // Таблица
    const tableData = filteredShifts.map((s, index) => [
      index + 1,
      getShiftPeriod(s),
      formatTime(s.startTime),
      s.endTime ? formatTime(s.endTime) : 'Активна',
      s.durationMinutes ? formatDuration(s.durationMinutes) : '—',
    ]);

    doc.autoTable({
      startY: 75,
      head: [['№', 'Дата / Период', 'Приход', 'Уход', 'Продолжительность']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 116, 199], textColor: 255, fontSize: 10 },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 45 },
        2: { cellWidth: 28 },
        3: { cellWidth: 28 },
        4: { cellWidth: 45 },
      },
    });

    const fileName = `otchet_${currentUser.fullName.replace(/\s+/g, '_')}_${dateRange.from}_${dateRange.to}.pdf`;
    doc.save(fileName);
  };

  // ==================== ЭКСПОРТ В CSV (новая функция) ====================
  const exportToCSV = () => {
    if (!currentUser || filteredShifts.length === 0) {
      showToast('info', 'Нет данных для экспорта');
      return;
    }

    const periodLabel = getPeriodLabel(activePreset, dateRange);
    const header = ['№', 'Дата / Период', 'Приход', 'Уход', 'Продолжительность', 'Статус'];
    const rows = filteredShifts.map((s, index) => [
      index + 1,
      getShiftPeriod(s),
      formatTime(s.startTime),
      s.endTime ? formatTime(s.endTime) : 'Активна',
      s.durationMinutes ? formatDuration(s.durationMinutes) : '—',
      isShiftActive(s) ? 'Активна' : 'Закрыта',
    ]);

    const escapeCell = (cell) => `"${String(cell).replace(/"/g, '""')}"`;
    const csvContent = [
      `Отчёт по рабочему времени — ${currentUser.fullName}`,
      `Период: ${periodLabel}`,
      `Сформировано: ${new Date().toLocaleDateString('ru-RU')}`,
      '',
      header.map(escapeCell).join(';'),
      ...rows.map(row => row.map(escapeCell).join(';')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `otchet_${currentUser.fullName.replace(/\s+/g, '_')}_${dateRange.from}_${dateRange.to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('success', 'CSV-файл скачан');
  };

  // ==================== СМЕНА ПРЕСЕТА ====================
  const handlePresetChange = (presetKey) => {
    setActivePreset(presetKey);
    if (presetKey !== 'custom') {
      setCustomDateFrom('');
      setCustomDateTo('');
    }
  };

  // ==================== ЗАЩИТА ====================
  if (!currentUser) {
    return <LoadingPage message="Загрузка личного кабинета..." />;
  }

  const isAdmin = currentUser.role === 'admin';

  const periodLabel = getPeriodLabel(activePreset, dateRange);

  // ==================== РЕНДЕР ====================
  return (
    <div className={cabinetClassName()}>
      <div className="cabinet-ambient" aria-hidden="true">
        <div className="cabinet-ambient__orb cabinet-ambient__orb--1" />
        <div className="cabinet-ambient__orb cabinet-ambient__orb--2" />
        <div className="cabinet-ambient__grain" />
      </div>

      {/* ===== ШАПКА ===== */}
      <div className="cabinet-header">
        <div className="cabinet-header__intro">
          <span className="cabinet-header__badge">Учёт рабочего времени</span>
          <h1>Личный кабинет</h1>
          <p className="subtitle">Статистика смен и отчёты</p>
        </div>
        <div className="user-badge">
          <div className="cabinet-avatar" aria-hidden="true">
            {getInitials(currentUser.fullName)}
          </div>
          <div>
            <span>{currentUser.fullName}</span>
            {currentUser.position && <small>{currentUser.position}</small>}
          </div>
        </div>
      </div>

      {/* ===== БЫСТРЫЕ ССЫЛКИ (новый блок) ===== */}
      <nav className="cabinet-quick-actions" aria-label="Быстрая навигация">
        <Link to="/" className="cabinet-quick-actions__link">Каталог</Link>
        <Link to="/view_orders" className="cabinet-quick-actions__link">Мои заказы</Link>
        {isAdmin && (
          <Link to="/edit_mebel" className="cabinet-quick-actions__link">Редактор мебели</Link>
        )}
      </nav>

      {/* ===== СТАТУС + КАРТОЧКА СОТРУДНИКА ===== */}
      <div className="status-section">
        <div className={`status-card ${currentActiveShift ? 'active' : 'inactive'}`}>
          <div className="status-indicator" />
          <div>
            <div className="status-title">
              {currentActiveShift ? 'Сейчас на смене' : 'Не на смене'}
            </div>
            {currentActiveShift && (
              <>
                <div className="status-detail">
                  Начало: {formatDate(currentActiveShift.date)} в {formatTime(currentActiveShift.startTime)}
                </div>
                {activeShiftElapsed && (
                  <span className="status-live">На смене: {activeShiftElapsed}</span>
                )}
              </>
            )}
          </div>
        </div>

        <div className="employee-card">
          <div className="cabinet-avatar" aria-hidden="true">
            {getInitials(currentUser.fullName)}
          </div>
          <div className="employee-info">
            <div className="name">{currentUser.fullName}</div>
            {currentUser.position && <div className="position">{currentUser.position}</div>}
            {currentUser.badgeId && <div className="badge">Табельный №{currentUser.badgeId}</div>}
            {currentUser.role && (
              <span className="role-badge">{ROLE_LABELS[currentUser.role] || currentUser.role}</span>
            )}
          </div>
        </div>
      </div>

      {/* ===== ИНСАЙТЫ (новый блок) ===== */}
      <div className="cabinet-insights">
        <div className="cabinet-insight">
          <span className="cabinet-insight__icon" aria-hidden="true">📅</span>
          <div className="cabinet-insight__body">
            <div className="cabinet-insight__value">{weeklyChartData.daysWorked} / 7</div>
            <div className="cabinet-insight__label">Рабочих дней за неделю</div>
          </div>
        </div>
        <div className="cabinet-insight">
          <span className="cabinet-insight__icon" aria-hidden="true">⏱</span>
          <div className="cabinet-insight__body">
            <div className="cabinet-insight__value">{weeklyChartData.totalHours} ч</div>
            <div className="cabinet-insight__label">Часов за 7 дней</div>
          </div>
        </div>
        <div className={`cabinet-insight ${monthComparison.diff >= 0 ? 'cabinet-insight--positive' : 'cabinet-insight--negative'}`}>
          <span className="cabinet-insight__icon" aria-hidden="true">{monthComparison.diff >= 0 ? '↑' : '↓'}</span>
          <div className="cabinet-insight__body">
            <div className="cabinet-insight__value">
              {monthComparison.diff > 0 ? '+' : ''}{monthComparison.diff} ч
            </div>
            <div className="cabinet-insight__label">К прошлому месяцу ({monthComparison.current} ч)</div>
          </div>
        </div>
      </div>

      {/* ===== СТАТИСТИКА ===== */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{statistics.totalHours}</div>
          <div className="stat-label">Отработано часов</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{statistics.totalShifts}</div>
          <div className="stat-label">Смен за период</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{statistics.avgDuration}</div>
          <div className="stat-label">Средняя смена</div>
        </div>
        <div className="stat-card highlight">
          <div className="stat-value">{statistics.longestDuration}</div>
          <div className="stat-label">Самая длинная смена</div>
        </div>
      </div>

      {/* ===== ГРАФИК ЗА ПОСЛЕДНИЕ 7 ДНЕЙ ===== */}
      <div className="weekly-chart-section">
        <div className="section-header">
          <div>
            <h3>Активность за последние 7 дней</h3>
            <span className="chart-hint">Независимо от фильтров ниже</span>
          </div>
          <div className="cabinet-chart-summary">
            <div className="cabinet-chart-summary__item">
              <span className="cabinet-chart-summary__value">{weeklyChartData.totalHours}</span>
              <span className="cabinet-chart-summary__label">часов всего</span>
            </div>
            <div className="cabinet-chart-summary__item">
              <span className="cabinet-chart-summary__value">{weeklyChartData.daysWorked}</span>
              <span className="cabinet-chart-summary__label">рабочих дней</span>
            </div>
          </div>
        </div>
        <div className="chart-wrapper">
          <Bar data={weeklyChartData} options={weeklyChartOptions} />
        </div>
      </div>

      {/* ===== ФИЛЬТРЫ (САМОЕ ВАЖНОЕ) ===== */}
      <div className="filters-section">
        <div className="filters-header">
          <div>
            <h3>Фильтры</h3>
            <span className="filters-period">{periodLabel}</span>
          </div>
          <div className="filters-export-group">
            <button className="export-btn" onClick={exportToPDF} disabled={filteredShifts.length === 0}>
              PDF
            </button>
            <button
              className="export-btn export-btn--secondary"
              onClick={exportToCSV}
              disabled={filteredShifts.length === 0}
            >
              CSV
            </button>
          </div>
        </div>

        {/* Пресеты периодов */}
        <div className="preset-chips">
          {PERIOD_PRESETS.map(preset => (
            <button
              key={preset.key}
              className={`preset-chip ${activePreset === preset.key ? 'active' : ''}`}
              onClick={() => handlePresetChange(preset.key)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Ручной выбор дат */}
        {activePreset === 'custom' && (
          <div className="custom-date-range">
            <div className="date-input-group">
              <label>С</label>
              <input
                type="date"
                value={customDateFrom}
                onChange={(e) => setCustomDateFrom(e.target.value)}
              />
            </div>
            <div className="date-input-group">
              <label>По</label>
              <input
                type="date"
                value={customDateTo}
                onChange={(e) => setCustomDateTo(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Дополнительные фильтры */}
        <div className="advanced-filters">
          <div className="filter-group">
            <label>Статус</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Все смены</option>
              <option value="closed">Только закрытые</option>
              <option value="active">Только активные</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Длительность</label>
            <select value={durationFilter} onChange={(e) => setDurationFilter(e.target.value)}>
              <option value="all">Любая</option>
              <option value="short">Менее 8 часов</option>
              <option value="normal">8–12 часов</option>
              <option value="long">12–24 часа</option>
              <option value="very_long">Более 24 часов</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Сортировка</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="date_desc">Сначала новые</option>
              <option value="date_asc">Сначала старые</option>
              <option value="duration_desc">Сначала длинные</option>
            </select>
          </div>
        </div>

        <div className="results-count">
          Найдено смен: <strong>{filteredShifts.length}</strong>
          {isAdmin && <span className="admin-hint"> (режим просмотра)</span>}
        </div>
      </div>

      {/* ===== ТАБЛИЦА СМЕН ===== */}
      <div className="shifts-table-wrapper">
        {paginatedShifts.length === 0 ? (
          <div className="empty-state">
            <p>Смены не найдены по выбранным фильтрам</p>
          </div>
        ) : (
          <>
            <table className="shifts-table">
              <thead>
                <tr>
                  <th>Период</th>
                  <th>Приход</th>
                  <th>Уход</th>
                  <th>Продолжительность</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {paginatedShifts.map(shift => (
                  <tr key={shift.id}>
                    <td>{getShiftPeriod(shift)}</td>
                    <td>{formatTime(shift.startTime)}</td>
                    <td>{shift.endTime ? formatTime(shift.endTime) : '—'}</td>
                    <td className="duration-cell">
                      {shift.durationMinutes ? formatDuration(shift.durationMinutes) : '—'}
                    </td>
                    <td>
                      {isShiftActive(shift) ? (
                        <span className="status-badge active">Активна</span>
                      ) : (
                        <span className="status-badge closed">Закрыта</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Пагинация */}
            {totalPages > 1 && (
              <div className="pagination">
                <button 
                  disabled={currentPage === 1} 
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  ← Назад
                </button>
                <span>Страница {currentPage} из {totalPages}</span>
                <button 
                  disabled={currentPage === totalPages} 
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  Вперёд →
                </button>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
};

export default PersonalCabinet;