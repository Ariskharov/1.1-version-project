const express = require('express');
const {
    getCollection,
    getCollectionItem,
    createCollectionItem,
    updateCollectionItem,
    deleteCollectionItem
} = require('../controllers/collectionController');

const router = express.Router();

// Supported collections
const allowedCollections = ['product', 'users', 'workSessions', 'order'];

// Middleware to validate collection
const validateCollection = (req, res, next) => {
    const collection = req.params.collection;
    if (!allowedCollections.includes(collection)) {
        return res.status(404).json({ error: 'Collection not found' });
    }
    next();
};

router.get('/:collection', validateCollection, getCollection);
router.get('/:collection/:id', validateCollection, getCollectionItem);
router.post('/:collection', validateCollection, createCollectionItem);
router.put('/:collection/:id', validateCollection, updateCollectionItem);
router.patch('/:collection/:id', validateCollection, updateCollectionItem);
router.delete('/:collection/:id', validateCollection, deleteCollectionItem);

module.exports = router;
