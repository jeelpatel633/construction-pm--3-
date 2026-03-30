// config/db.js  — ONLY CHANGE IS THE ssl LINE
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 4000,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'test',
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }, // ← only new line
    waitForConnections: true,
    connectionLimit: 10,
    timezone: '+05:30', // IST for your dates
});

module.exports = pool;