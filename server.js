require('dotenv').config(); // Loads your .env file
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Tells Node to serve your HTML website

// --- 1. Connect to MongoDB ---
mongoose.connect('mongodb+srv://rginsasis:rginsasis@rgincluster1.x8fst0r.mongodb.net/StockApp?retryWrites=true&w=majority')
  .then(() => console.log('✅ Connected to MongoDB!'))
  .catch(err => console.error('❌ Could not connect to MongoDB...', err));

// --- 2. Define the Database Schema & Model ---
// --- 2. Define the Database Schema & Model ---
const itemSchema = new mongoose.Schema({
    name: String,
    sku: String,
    qty: Number,
    price: Number,
    company: String // <--- Added Company
});

itemSchema.set('toJSON', {
    transform: (document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString();
        delete returnedObject._id;
        delete returnedObject.__v;
    }
});

const Item = mongoose.model('Item', itemSchema);

// --- History Database Schema ---
const historySchema = new mongoose.Schema({
    date: String,
    itemName: String,
    itemSku: String,
    qty: Number,
    company: String // <--- Added Company
});

// Map MongoDB's internal "_id" to "id"
historySchema.set('toJSON', {
    transform: (document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString();
        delete returnedObject._id;
        delete returnedObject.__v;
    }
});

const History = mongoose.model('History', historySchema);

// --- HISTORY API ENDPOINTS ---

// GET history (latest 100 records)
app.get('/api/history', async (req, res) => {
    // .sort({_id: -1}) fetches newest items first
    const history = await History.find({}).sort({_id: -1}).limit(100);
    res.json(history);
});

// POST a new history record
app.post('/api/history', async (req, res) => {
    const newRecord = new History(req.body);
    const savedRecord = await newRecord.save();
    res.status(201).json(savedRecord);
});

// DELETE all history (Clear History button)
app.delete('/api/history', async (req, res) => {
    await History.deleteMany({});
    res.json({ message: 'History cleared' });
});

// Trick to smoothly map MongoDB's internal "_id" to our frontend's "id"
itemSchema.set('toJSON', {
    transform: (document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString();
        delete returnedObject._id;
        delete returnedObject.__v;
    }
});

// --- 3. API ENDPOINTS ---

// GET all inventory from database
app.get('/api/inventory', async (req, res) => {
    const items = await Item.find({});
    res.json(items);
});

// POST (Add) a new item to database
app.post('/api/inventory', async (req, res) => {
    const newItem = new Item(req.body);
    const savedItem = await newItem.save();
    res.status(201).json(savedItem);
});

// DELETE an item from database
app.delete('/api/inventory/:id', async (req, res) => {
    await Item.findByIdAndDelete(req.params.id);
    res.json({ message: 'Item deleted' });
});

// PUT (Update) an item in database
app.put('/api/inventory/:id', async (req, res) => {
    const updatedItem = await Item.findByIdAndUpdate(
        req.params.id, 
        req.body, 
        { new: true } // Returns the newly updated document
    );
    res.json(updatedItem);
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});