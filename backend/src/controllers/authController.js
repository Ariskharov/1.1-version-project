const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');

const register = (req, res) => {
    const { email, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);

    db.read();
    db.data.users = db.data.users || [];
    const newUser = { id: (db.data.users.length || 0) + 1, email, password: hashedPassword };

    db.data.users.push(newUser);
    db.write();

    res.json(newUser);
};

const login = (req, res) => {
    const { email, password } = req.body;

    db.read();
    const user = db.data.users?.find(u => u.email === email);

    if (user && bcrypt.compareSync(password, user.password)) {
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '1h' });
        res.json({ token });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
};

module.exports = { register, login };
