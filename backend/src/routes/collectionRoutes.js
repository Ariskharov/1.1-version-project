const express = require('express');
const {
    getCollection,
    getCollectionItem,
    createCollectionItem,
    updateCollectionItem,
    deleteCollectionItem
} = require('../controllers/collectionController');
const { authenticate, requireRole } = require('../middleware/auth');

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

const guardWrite = (req, res, next) => {
    const collection = req.params.collection;
    authenticate(req, res, () => {
        if (collection === 'workSessions') return next();
        return requireRole('admin')(req, res, next);
    });
};

router.get('/:collection', validateCollection, guardRead, getCollection);
router.get('/:collection/:id', validateCollection, guardRead, getCollectionItem);
router.post('/:collection', validateCollection, guardWrite, createCollectionItem);
router.put('/:collection/:id', validateCollection, guardWrite, updateCollectionItem);
router.patch('/:collection/:id', validateCollection, guardWrite, updateCollectionItem);
router.delete('/:collection/:id', validateCollection, guardWrite, deleteCollectionItem);

module.exports = router;
