/**
 * Application Configuration
 * Loads environment variables and provides centralized config
 */

const path = require('path');

// Load environment variables from project root .env file
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const config = {
  // API Configuration
  apiUrl: process.env.API_URL || 'http://localhost:80',
  socketUrl: process.env.SOCKET_URL || 'http://localhost:80',

  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',

  // Timeouts
  apiTimeout: parseInt(process.env.API_TIMEOUT, 10) || 30000,
  socketTimeout: parseInt(process.env.SOCKET_TIMEOUT, 10) || 20000,
};

// Log configuration in development
if (config.isDev) {
  console.log('=== Application Configuration ===');
  console.log('API_URL:', config.apiUrl);
  console.log('SOCKET_URL:', config.socketUrl);
  console.log('NODE_ENV:', config.nodeEnv);
  console.log('================================');
}

module.exports = config;
