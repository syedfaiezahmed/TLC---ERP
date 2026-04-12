import fs from 'fs';
import path from 'path';

const logDir = path.join(process.cwd(), 'logs');
const logFile = path.join(logDir, 'app.log');

// Ensure log directory exists in development
if (process.env.NODE_ENV !== 'production') {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

const logger = {
  info: (message, meta = {}) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [INFO]: ${message} ${JSON.stringify(meta)}\n`;
    
    if (process.env.NODE_ENV !== 'production') {
      try {
        fs.appendFileSync(logFile, logEntry);
      } catch (err) {
        console.error('Failed to write to log file:', err);
      }
    }
    console.log(message, meta);
  },

  error: (message, error = {}) => {
    const timestamp = new Date().toISOString();
    const errorStack = error.stack ? `\n${error.stack}` : '';
    const logEntry = `[${timestamp}] [ERROR]: ${message} ${JSON.stringify(error)}${errorStack}\n`;

    if (process.env.NODE_ENV !== 'production') {
      try {
        fs.appendFileSync(logFile, logEntry);
      } catch (err) {
        console.error('Failed to write to log file:', err);
      }
    }
    console.error(message, error);
  },

  warn: (message, meta = {}) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [WARN]: ${message} ${JSON.stringify(meta)}\n`;

    if (process.env.NODE_ENV !== 'production') {
      try {
        fs.appendFileSync(logFile, logEntry);
      } catch (err) {
        console.error('Failed to write to log file:', err);
      }
    }
    console.warn(message, meta);
  }
};

export default logger;
