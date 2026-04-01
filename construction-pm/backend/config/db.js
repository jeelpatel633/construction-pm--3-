const mysql = require('mysql2/promise');

const isProduction = process.env.NODE_ENV === 'production';

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'construction_pm',

    // ✅ Only enable SSL in production
    ...(isProduction && {
        ssl: {
            minVersion: 'TLSv1.2',
            rejectUnauthorized: true
        }
    }),

    waitForConnections: true,
    connectionLimit: 10,
    timezone: '+05:30',
});

module.exports = pool;