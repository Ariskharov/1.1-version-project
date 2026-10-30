const jwt = require('jsonwebtoken');

const pool = require('../database/pg');

const authenticate = async (req, res, next) => {
    const header = req.headers.authorization || req.headers.Authorization;
    const token = typeof header === 'string' ? header.split(' ')[1] : '';
    if (!token) return res.status(401).json({ error: 'No token provided' });

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    try {
        const result = await pool.query('SELECT role FROM "users" WHERE id = $1', [decoded.id]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }
        req.userId = decoded.id;
        req.userRole = result.rows[0].role;
        return next();
    } catch (err) {
        console.error('auth db error:', err.message);
        return res.status(500).json({ error: 'Server error' });
    }
};

const requireRole = (...roles) => (req, res, next) => {
    const role = String(req.userRole || '').toLowerCase();
    const allowed = roles.map((item) => String(item).toLowerCase());
    if (!allowed.includes(role)) {
        return res.status(403).json({ error: 'Недостаточно прав' });
    }
    return next();
};

module.exports = { authenticate, requireRole };
