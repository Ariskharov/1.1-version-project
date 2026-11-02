const express = require('express');
const {
    getCollection,
    getCollectionItem,
    createCollectionItem,
    updateCollectionItem,
    deleteCollectionItem
} = require('../controllers/collectionController');
const pool = require('../database/pg');
const { authenticate } = require('../middleware/auth');
const { canWriteCollection } = require('../utils/roles');

const router = express.Router();

// Supported collections
const allowedCollections = ['product', 'users', 'workSessions', 'order', 'announcements'];

// Middleware to validate collection
const validateCollection = (req, res, next) => {
    const collection = req.params.collection;
    if (!allowedCollections.includes(collection)) {
        return res.status(404).json({ error: 'Collection not found' });
    }
    next();
};

const publicRead = new Set(['product', 'announcements']);

const guardRead = (req, res, next) => {
    if (publicRead.has(req.params.collection)) return next();
    return authenticate(req, res, next);
};

const sameId = (left, right) => {
    const a = String(left ?? '');
    const b = String(right ?? '');
    return a !== '' && a === b;
};

// Сотрудник отмечает только свою смену. Чужое время правят администратор и IT.
const guardOwnSession = async (req, res, next) => {
    const role = String(req.userRole || '').toLowerCase();
    if (role === 'admin' || role === 'it') return next();
    const self = req.userId;
    if (req.method === 'POST') {
        if (!sameId(req.body?.userId, self)) {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }
        return next();
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Некорректный id' });
    try {
        const found = await pool.query('SELECT "userId" FROM "workSessions" WHERE id = $1', [id]);
        if (!found.rows.length) return res.status(404).json({ error: 'Смена не найдена' });
        if (!sameId(found.rows[0].userId, self)) {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }
        if (req.body && req.body.userId != null && !sameId(req.body.userId, self)) {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }
        return next();
    } catch (err) {
        console.error('session guard', err.message);
        return res.status(500).json({ error: 'Server error' });
    }
};

const guardWrite = (req, res, next) => {
    const collection = req.params.collection;
    authenticate(req, res, () => {
        if (!canWriteCollection(req.userRole, collection)) {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }
        if (collection === 'workSessions') return guardOwnSession(req, res, next);
        return next();
    });
};

router.get('/:collection', validateCollection, guardRead, getCollection);
router.get('/:collection/:id', validateCollection, guardRead, getCollectionItem);
router.post('/:collection', validateCollection, guardWrite, createCollectionItem);
router.put('/:collection/:id', validateCollection, guardWrite, updateCollectionItem);
router.patch('/:collection/:id', validateCollection, guardWrite, updateCollectionItem);
router.delete('/:collection/:id', validateCollection, guardWrite, deleteCollectionItem);

module.exports = router;
