/**
 * Simple structured logger utility to replace generic console.log
 * This provides consistent formatting and timestamps for logs.
 */
const logger = {
  info: (message, meta = {}) => {
    console.log(JSON.stringify({
      level: 'INFO',
      timestamp: new Date().toISOString(),
      message,
      ...meta
    }));
  },
  
  error: (message, error = null, meta = {}) => {
    const errorLog = {
      level: 'ERROR',
      timestamp: new Date().toISOString(),
      message,
      ...meta
    };
    
    if (error) {
      errorLog.errorName = error.name;
      errorLog.errorMessage = error.message;
      if (process.env.NODE_ENV !== 'production') {
        errorLog.stack = error.stack;
      }
    }
    
    console.error(JSON.stringify(errorLog));
  },
  
  warn: (message, meta = {}) => {
    console.warn(JSON.stringify({
      level: 'WARN',
      timestamp: new Date().toISOString(),
      message,
      ...meta
    }));
  }
};

export default logger;
