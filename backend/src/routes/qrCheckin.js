const express = require('express');
const router = express.Router();
const pool = require('../database/pg');
const { authenticate } = require('../middleware/auth');
const { bishkekNow, closeShiftClock } = require('../utils/shiftTime');

router.post('/api/qr-checkin', authenticate, async (req, res) => {
    try {
        // 1. Verify role
        const role = String(req.userRole || '').toLowerCase();
        if (role !== 'scanner' && role !== 'admin') {
            return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }

        const { badgeId } = req.body;
        if (!badgeId) {
            return res.status(400).json({ error: 'badgeId is required' });
        }

        // 2. Find employee in users
        const employeeRes = await pool.query(
            'SELECT * FROM "users" WHERE "badgeId" = $1 AND "badgeId" IS NOT NULL AND "badgeId" != \'\'',
            [badgeId]
        );

        if (employeeRes.rows.length === 0) {
            return res.json({ success: false, message: 'Сотрудник не найден' });
        }

        const employee = employeeRes.rows[0];

        // 3. Время всегда по Бишкеку, даже если процесс на Vercel живёт в UTC
        const { date: todayDate, timeHM, timeHMS } = bishkekNow();

        // 4. Check for active work session for this employee
        const activeSessionRes = await pool.query(
            `SELECT * FROM "workSessions"
             WHERE "userId" = $1 AND ("endTime" IS NULL OR "endTime" = '')
             ORDER BY id DESC LIMIT 1`,
            [employee.id]
        );

        if (activeSessionRes.rows.length === 0) {
            // Start shift
            try {
                await pool.query(
                    `INSERT INTO "workSessions" ("userId", "date", "startTime", "endTime", "durationMinutes", "status", "source") 
                     VALUES ($1, $2, $3, NULL, NULL, 'active', 'qr') RETURNING *`,
                    [employee.id, todayDate, timeHMS]
                );
            } catch (insertErr) {
                if (!/source/i.test(insertErr.message || '')) throw insertErr;
                await pool.query(
                    `INSERT INTO "workSessions" ("userId", "date", "startTime", "endTime", "durationMinutes", "status") 
                     VALUES ($1, $2, $3, NULL, NULL, 'active') RETURNING *`,
                    [employee.id, todayDate, timeHMS]
                );
            }

            // Sync sequence to avoid serial issues
            try {
                await pool.query(`SELECT setval(pg_get_serial_sequence('"workSessions"', 'id'), (SELECT MAX(id) FROM "workSessions"))`);
            } catch (seqErr) {
                console.log('[DEBUG] Sequence sync skipped:', seqErr.message);
            }

            return res.json({
                success: true,
                action: 'start',
                fullName: employee.fullName,
                startTime: timeHM
            });
        } else {
            // End shift
            const activeSession = activeSessionRes.rows[0];
            
            const closed = closeShiftClock({
                startDate: activeSession.date,
                startTime: activeSession.startTime,
                endDate: todayDate,
                endTime: timeHMS,
            });
            if (!closed) {
                return res.status(500).json({ error: 'Invalid shift date or time format in DB' });
            }

            try {
                await pool.query(
                    `UPDATE "workSessions" 
                     SET "endTime" = $1, "endDate" = $2, "durationMinutes" = $3, "status" = 'completed', "source" = 'qr' 
                     WHERE id = $4`,
                    [timeHMS, closed.endDate, closed.durationMinutes, activeSession.id]
                );
            } catch (updateErr) {
                if (!/endDate|source/i.test(updateErr.message || '')) throw updateErr;
                await pool.query(
                    `UPDATE "workSessions" 
                     SET "endTime" = $1, "durationMinutes" = $2, "status" = 'completed' 
                     WHERE id = $3`,
                    [timeHMS, closed.durationMinutes, activeSession.id]
                );
            }

            return res.json({
                success: true,
                action: 'end',
                fullName: employee.fullName,
                startTime: String(activeSession.startTime || '').slice(0, 5),
                endTime: timeHM,
                durationMinutes: closed.durationMinutes
            });
        }
    } catch (err) {
        console.error('QR Check-in error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
