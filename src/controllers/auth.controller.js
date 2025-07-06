// src/controllers/auth.controller.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/usuario.model');
const Cliente = require('../models/cliente.model');
const JWT_SECRET = process.env.JWT_SECRET;

exports.register = async (req, res) => {
  try {
    const { email, password, nombreCliente, numeroWhatsapp } = req.body;

    const cliente = await Cliente.create({
      nombre_comercial: nombreCliente,
      numeroWhatsapp
    });

    const password_hash = await bcrypt.hash(password, 10);

    const usuario = await Usuario.create({
      email,
      password_hash,
      cliente_id: cliente._id
    });

    const token = jwt.sign({ userId: usuario._id, cliente_id: cliente._id }, JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Error al registrar', error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const usuario = await Usuario.findOne({ email });
    if (!usuario) return res.status(400).json({ message: 'Usuario no encontrado' });

    const match = await bcrypt.compare(password, usuario.password_hash);
    if (!match) return res.status(400).json({ message: 'Contraseña incorrecta' });

    const token = jwt.sign({ userId: usuario._id, cliente_id: usuario.cliente_id }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Error al iniciar sesión', error: err.message });
  }
};