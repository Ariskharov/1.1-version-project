const express = require('express');
const router = express.Router();
const pool = require('../database/pg');
const { authenticate } = require('../middleware/auth');

router.post('/api/qr-checkin', authenticate, async (req, res) => {
    try {
        // 1. Verify role
        if (req.userRole !== 'scanner' && req.userRole !== 'admin') {
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

        // 3. Get current local date and time
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');

        const todayDate = `${year}-${month}-${day}`;
        const timeHM = `${hours}:${minutes}`;
        const timeHMS = `${hours}:${minutes}:${seconds}`;

        // 4. Check for active work session for this employee
        const activeSessionRes = await pool.query(
            'SELECT * FROM "workSessions" WHERE "userId" = $1 AND "status" = \'active\' ORDER BY id DESC LIMIT 1',
            [employee.id]
        );

        if (activeSessionRes.rows.length === 0) {
            // Start shift
            const insertRes = await pool.query(
                `INSERT INTO "workSessions" ("userId", "date", "startTime", "endTime", "durationMinutes", "status", "source") 
                 VALUES ($1, $2, $3, NULL, NULL, 'active', 'qr') RETURNING *`,
                [employee.id, todayDate, timeHMS]
            );

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
            
            // Calculate duration in minutes
            const startDateTime = new Date(`${activeSession.date}T${activeSession.startTime}`);
            let endDateTime = new Date(`${todayDate}T${timeHMS}`);
            
            if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
                return res.status(500).json({ error: 'Invalid shift date or time format in DB' });
            }

            // Adjust end date if the end time is before the start time (crossing midnight)
            if (endDateTime < startDateTime) {
                endDateTime.setDate(endDateTime.getDate() + 1);
            }

            const diffMs = endDateTime - startDateTime;
            const durationMinutes = Math.max(0, Math.round(diffMs / 1000 / 60));

            await pool.query(
                `UPDATE "workSessions" 
                 SET "endTime" = $1, "durationMinutes" = $2, "status" = 'completed', "source" = 'qr' 
                 WHERE id = $3`,
                [timeHMS, durationMinutes, activeSession.id]
            );

            return res.json({
                success: true,
                action: 'end',
                fullName: employee.fullName,
                startTime: activeSession.startTime.slice(0, 5),
                endTime: timeHM,
                durationMinutes
            });
        }
    } catch (err) {
        console.error('QR Check-in error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
