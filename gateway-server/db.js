// gateway-server/db.js

// Import the promise-based mysql2 library
const mysql = require('mysql2/promise');

// Establish a connection pool to the hardware database
const poolConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'upbs2024',
    password: process.env.DB_PASSWORD || 'upbs2024',
    database: process.env.DB_NAME || 'smsd',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Automatically enable SSL if connecting to an Aiven database or if DB_SSL is set
if (process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production' || (process.env.DB_HOST && process.env.DB_HOST.includes('aivencloud.com'))) {
    poolConfig.ssl = { rejectUnauthorized: false };
    console.log("[DB] SSL connection enabled for gateway database pool.");
}

const smsdPool = mysql.createPool(poolConfig);

// Export the pool for use across the application
module.exports = smsdPool;
