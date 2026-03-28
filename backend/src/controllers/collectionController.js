const db = require('../database/db');

const getCollection = (req, res) => {
    db.read();
    const collection = req.params.collection;
    res.json(db.data[collection] || []);
};

const getCollectionItem = (req, res) => {
    db.read();
    const collection = req.params.collection;
    const item = (db.data[collection] || []).find(i => i.id === Number(req.params.id));
    res.json(item || {});
};

const createCollectionItem = (req, res) => {
    db.read();
    const collection = req.params.collection;
    db.data[collection] = db.data[collection] || [];
    
    const newItem = { ...req.body, id: (db.data[collection].length || 0) + 1 };
    db.data[collection].push(newItem);
    db.write();
    
    res.json(newItem);
};

const updateCollectionItem = (req, res) => {
    db.read();
    const collection = req.params.collection;
    
    if (!db.data[collection]) {
        return res.status(404).json({ error: 'Коллекция не найдена' });
    }

    const index = db.data[collection].findIndex(i => i.id === Number(req.params.id));
    if (index !== -1) {
        db.data[collection][index] = { ...db.data[collection][index], ...req.body };
        db.write();
        res.json(db.data[collection][index]);
    } else {
        res.status(404).json({ error: 'Не найдено' });
    }
};

const deleteCollectionItem = (req, res) => {
    db.read();
    const collection = req.params.collection;
    
    if (db.data[collection]) {
        db.data[collection] = db.data[collection].filter(i => i.id !== Number(req.params.id));
        db.write();
    }
    res.json({ success: true });
};

module.exports = {
    getCollection,
    getCollectionItem,
    createCollectionItem,
    updateCollectionItem,
    deleteCollectionItem
};
