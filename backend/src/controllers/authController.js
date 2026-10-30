const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../database/pg');

const register = async (req, res) => {
    res.status(403).json({ error: 'Регистрация закрыта. Пользователя создаёт администратор.' });
};

const passwordMatches = (plain, stored) => {
    if (!stored) return false;
    try {
        if (bcrypt.compareSync(plain, stored)) return true;
    } catch {
        // В базе может лежать старый пароль не в формате bcrypt.
    }
    return plain === stored;
};

const login = async (req, res) => {
    try {
        const identity = String(req.body?.email || '').trim();
        const plain = req.body?.password == null ? '' : String(req.body.password);
        if (!identity || !plain) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const result = await pool.query(
            `SELECT * FROM "users"
             WHERE lower(COALESCE("email", '')) = lower($1)
                OR lower(COALESCE("login", '')) = lower($1)
                OR lower(COALESCE("fullName", '')) = lower($1)`,
            [identity]
        );

        const userRow = result.rows.find((row) => passwordMatches(plain, row.password));

        if (!userRow) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: userRow.id },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );
        const { password: _password, ...userWithoutPassword } = userRow;
        res.json({ ...userWithoutPassword, token });
    } catch (err) {
        console.error('login error', err);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = { register, login };
