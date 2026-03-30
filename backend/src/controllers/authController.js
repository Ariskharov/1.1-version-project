const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../database/pg');

const register = async (req, res) => {
    try {
        const { email, password } = req.body;
        const hashedPassword = bcrypt.hashSync(password, 10);
        
        const insertRes = await pool.query(
            `INSERT INTO "users" (email, password) VALUES ($1, $2) RETURNING *`,
            [email, hashedPassword]
        );
        const newUser = insertRes.rows[0];

        res.json(newUser);
    } catch (err) {
        console.error('register error', err);
        res.status(500).json({ error: 'Server error' });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body; // 'email' here is actually the login/identity field from frontend

        // Search for user by email, login, or fullName
        const result = await pool.query(
            `SELECT * FROM "users" WHERE "email" = $1 OR "login" = $1 OR "fullName" = $1`, 
            [email]
        );
        const userRow = result.rows[0];

        if (userRow && bcrypt.compareSync(password, userRow.password)) {
            const token = jwt.sign(
                { id: userRow.id }, 
                process.env.JWT_SECRET || 'your-secret-key', 
                { expiresIn: '1h' }
            );
            res.json({ token });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        console.error('login error', err);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = { register, login };
