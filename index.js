// index.js
'use strict';

const express = require('express');
const db = require('./models');
const { CONFIG } = require('./config/config.js');

const app = express();
app.use(express.json());

// Simple API routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to MySQL-ClickHouse sync test application.' });
});

// User routes
app.get('/api/users', async (req, res) => {
  try {
    const users = await db.users.findAll();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const user = await db.users.create(req.body);
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Product routes
app.get('/api/products', async (req, res) => {
  try {
    const products = await db.products.findAll();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const product = await db.products.create(req.body);
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

// Initialize database and start server
const PORT = CONFIG.PORT;

db.syncDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}.`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
  });