//src\routes\whatsapp.routes.js
 
const express = require('express');
const router = express.Router();
const { verificarJWT } = require('../middlewares/jwt');
const { misNumeros } = require('../controllers/whatsapp.controller');

router.get('/mis-numeros', verificarJWT, misNumeros);

module.exports = router;
