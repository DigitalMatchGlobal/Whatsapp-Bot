// src/controllers/auth.controller.js

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { enviarVerificacion } = require('../services/email.service');

const Usuario = require('../models/usuario.model');
const Cliente = require('../models/cliente.model');
const JWT_SECRET = process.env.JWT_SECRET;

// POST /register
exports.register = async (req, res) => {
  try {
    const { email, emailConfirmado, password, nombre, pais } = req.body;

    if (email !== emailConfirmado) {
      return res.status(400).json({ message: 'Los emails no coinciden' });
    }

    const existente = await Usuario.findOne({ email });
    if (existente) return res.status(400).json({ message: 'Ya existe un usuario con ese email' });

    const cliente = await Cliente.create({
      nombre_comercial: nombre,
      pais
    });

    const password_hash = await bcrypt.hash(password, 10);
    const token_verificacion = crypto.randomBytes(32).toString('hex');

    const usuario = await Usuario.create({
      email,
      password_hash,
      cliente_id: cliente._id,
      verificado: false,
      token_verificacion
    });

    await enviarVerificacion(email, token_verificacion);

    res.status(201).json({ message: 'Registro exitoso. Revisá tu correo para verificar tu cuenta.' });
  } catch (err) {
    res.status(500).json({ message: 'Error al registrar', error: err.message });
  }
};

// POST /login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const usuario = await Usuario.findOne({ email });
    if (!usuario) return res.status(400).json({ message: 'Usuario no encontrado' });

    const coincide = await bcrypt.compare(password, usuario.password_hash);
    if (!coincide) return res.status(400).json({ message: 'Contraseña incorrecta' });

    if (!usuario.verificado) {
      return res.status(403).json({ message: 'Cuenta no verificada. Revisa tu correo.' });
    }

    const token = jwt.sign(
      { userId: usuario._id, cliente_id: usuario.cliente_id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Error al iniciar sesión', error: err.message });
  }
};

// GET /verificar/:token
exports.verificarEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const usuario = await Usuario.findOne({ token_verificacion: token });

    if (!usuario) return res.status(400).json({ message: 'Token inválido o expirado' });

    usuario.verificado = true;
    usuario.token_verificacion = undefined;
    await usuario.save();

    res.json({ message: 'Cuenta verificada correctamente. Ya podés iniciar sesión.' });
  } catch (err) {
    res.status(500).json({ message: 'Error al verificar', error: err.message });
  }
};
