// src/routes/cliente.routes.js
const express = require('express');
const router = express.Router();
const { obtenerClienteActual } = require('../controllers/cliente.controller');
const { verificarJWT } = require('../middlewares/jwt');

router.get('/me', verificarJWT, obtenerClienteActual);

module.exports = router;
