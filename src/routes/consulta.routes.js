// src/routes/consulta.routes.js
const express = require('express');
const router = express.Router();
const consultaController = require('../controllers/consulta.controller');
const { verificarJWT } = require('../middlewares/jwt');

router.get('/', verificarJWT, consultaController.obtenerConsultasPorCliente);
router.get('/kpis', verificarJWT, consultaController.obtenerKpis);
router.get('/recent', verificarJWT, consultaController.obtenerUltimasConsultas);

module.exports = router;