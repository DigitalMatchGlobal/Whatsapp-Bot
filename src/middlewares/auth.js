// Archivo: src/middlewares/auth.js
const API_KEY = process.env.API_KEY || "supersecreta";

function verificarAPIKey(req, res, next) {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== API_KEY) {
    return res.status(403).json({ success: false, message: "Acceso denegado. API Key incorrecta." });
  }
  next();
}

module.exports = {
  verificarAPIKey
};