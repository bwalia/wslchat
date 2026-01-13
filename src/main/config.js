/**
 * Application Configuration
 * Loads environment variables and provides centralized config
 */

const path = require('path');

// Determine if we're running in a packaged app
// Check if running from .asar archive
const isPackaged = __dirname.includes('app.asar');

// In packaged app, always use production config
// In development, check NODE_ENV
const isProduction = isPackaged || process.env.NODE_ENV === 'production';

// Determine the correct path for .env files
const getEnvPath = () => {
  // IMPORTANT: In packaged app, always use .env.production
  // because .env is not included in the build
  const envFile = isPackaged ? '.env.production' : (isProduction ? '.env.production' : '.env');

  if (isPackaged) {
    // In packaged app, .env.production is in the app root (inside asar)
    // __dirname is something like /path/to/app.asar/src/main
    // We need to get to /path/to/app.asar/.env.production
    const appRoot = __dirname.replace(/[\/\\]src[\/\\]main$/, '');
    return path.join(appRoot, envFile);
  } else {
    // In development, go up from src/main to project root
    return path.join(__dirname, '../../', envFile);
  }
};

// Load environment variables
const envPath = getEnvPath();
const dotenvResult = require('dotenv').config({ path: envPath });

// Log if .env file was loaded (for debugging)
if (dotenvResult.error) {
  console.warn('[Config] Could not load .env file:', envPath);
  console.warn('[Config] Error:', dotenvResult.error.message);
} else {
  console.log('[Config] Loaded environment from:', envPath);
}

console.log('[Config] isPackaged:', isPackaged, 'isProduction:', isProduction);

const config = {
  // API Configuration
  apiUrl: process.env.API_URL || 'http://localhost:80',
  documentsApiUrl: process.env.DOCUMENTS_API_URL || 'http://localhost:4010',
  socketUrl: process.env.SOCKET_URL || 'http://localhost:80',

  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',

  // Timeouts
  apiTimeout: parseInt(process.env.API_TIMEOUT, 10) || 30000,
  socketTimeout: parseInt(process.env.SOCKET_TIMEOUT, 10) || 20000,
};

// Always log configuration for debugging
console.log('=== Application Configuration ===');
console.log('API_URL:', config.apiUrl);
console.log('DOCUMENTS_API_URL:', config.documentsApiUrl);
console.log('SOCKET_URL:', config.socketUrl);
console.log('NODE_ENV:', config.nodeEnv);
console.log('================================');

module.exports = config;
