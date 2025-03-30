// Archivo: src/middlewares/logger.js
function logger(req, res, next) {
    console.log(`📢 [${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  }
  
  module.exports = {
    logger
  };