// Archivo: src/routes/consulta.routes.js
const express = require("express");
const router = express.Router();
const { getConsultas, limpiarConsultas } = require("../controllers/consulta.controller");
const { verificarAPIKey } = require("../middlewares/auth");

router.get("/", verificarAPIKey, getConsultas);
router.delete("/limpiar", verificarAPIKey, limpiarConsultas);

module.exports = router;