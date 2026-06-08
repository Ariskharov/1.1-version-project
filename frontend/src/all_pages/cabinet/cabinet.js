import React, { useContext, useMemo, useState, useEffect } from 'react';
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
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useModal } from '../../ModalContext';

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
  const { currentUser, workSessions } = useContext(CustomContext);
  const { showAlert } = useModal();

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
  const weeklyChartData = useMemo(() => {
    if (!currentUser) return { labels: [], datasets: [] };

    const daysOfWeek = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const today = new Date();
    const labels = [];
    const data = [];
    const dateStrings = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = format(date, 'yyyy-MM-dd');

      const weekdayIndex = date.getDay();
      labels.push(daysOfWeek[weekdayIndex]);
      dateStrings.push(dateStr);

      const daySessions = workSessions.filter(
        s => s.userId === currentUser.id && s.date === dateStr
      );

      const minutes = daySessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
      data.push(Math.round((minutes / 60) * 10) / 10);
    }

    const maxValue = Math.max(12, ...data);

    return {
      labels,
      datasets: [{
        label: 'Отработано часов',
        data,
        backgroundColor: '#0F74C7',
        borderRadius: 6,
        barThickness: 28,
      }],
      maxValue
    };
  }, [workSessions, currentUser]);

  const weeklyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
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
          callback: (value) => `${value} ч`
        },
        grid: { color: '#f1f5f9' }
      },
      x: {
        grid: { display: false }
      }
    }
  };

  // ==================== ТЕКУЩАЯ АКТИВНАЯ СМЕНА ====================
  const currentActiveShift = useMemo(() => {
    if (!currentUser) return null;
    return workSessions
      .filter(s => s.userId === currentUser.id && isShiftActive(s))
      .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  }, [workSessions, currentUser]);

  // ==================== ЭКСПОРТ В PDF ====================
  const exportToPDF = () => {
    if (!currentUser || filteredShifts.length === 0) {
      showAlert('Нет данных для экспорта', 'error');
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
    return <div className="cabinet-loading">Загрузка...</div>;
  }

  const isAdmin = currentUser.role === 'admin';

  // ==================== РЕНДЕР ====================
  return (
    <div className="cabinet">
      {/* ===== ШАПКА ===== */}
      <div className="cabinet-header">
        <div>
          <h1>Личный кабинет</h1>
          <p className="subtitle">Учёт рабочего времени</p>
        </div>
        <div className="user-badge">
          <span>{currentUser.fullName}</span>
          {currentUser.position && <small>{currentUser.position}</small>}
        </div>
      </div>

      {/* ===== СТАТУС + КАРТОЧКА СОТРУДНИКА ===== */}
      <div className="status-section">
        <div className={`status-card ${currentActiveShift ? 'active' : 'inactive'}`}>
          <div className="status-indicator" />
          <div>
            <div className="status-title">
              {currentActiveShift ? 'Сейчас на смене' : 'Не на смене'}
            </div>
            {currentActiveShift && (
              <div className="status-detail">
                Начало: {formatDate(currentActiveShift.date)} в {formatTime(currentActiveShift.startTime)}
              </div>
            )}
          </div>
        </div>

        <div className="employee-card">
          <div className="employee-info">
            <div className="name">{currentUser.fullName}</div>
            {currentUser.position && <div className="position">{currentUser.position}</div>}
            {currentUser.badgeId && <div className="badge">Табельный №{currentUser.badgeId}</div>}
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
          <h3>Активность за последние 7 дней</h3>
          <span className="chart-hint">Независимо от фильтров выше</span>
        </div>
        <div className="chart-wrapper">
          <Bar data={weeklyChartData} options={weeklyChartOptions} />
        </div>
      </div>

      {/* ===== ФИЛЬТРЫ (САМОЕ ВАЖНОЕ) ===== */}
      <div className="filters-section">
        <div className="filters-header">
          <h3>Фильтры</h3>
          <button className="export-btn" onClick={exportToPDF} disabled={filteredShifts.length === 0}>
            ⬇ Экспортировать в PDF
          </button>
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