// src/controllers/cliente.controller.js
const Cliente = require('../models/cliente.model');

exports.obtenerClienteActual = async (req, res) => {
  try {
    const cliente = await Cliente.findById(req.user.cliente_id);
    if (!cliente) return res.status(404).json({ message: 'Cliente no encontrado' });
    res.json(cliente);
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener cliente', error: err.message });
  }
};
