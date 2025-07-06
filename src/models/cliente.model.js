// src/models/cliente.model.js
const mongoose = require('mongoose');

const clienteSchema = new mongoose.Schema({
  nombre_comercial: { type: String, required: true },
  logoUrl: { type: String, default: '' },
  colorPrimario: { type: String, default: '#000000' },
  numeroWhatsapp: { type: String }, // ← ya no es required
  pais: { type: String, required: true }, // ← nuevo campo requerido
  estado: { type: String, default: 'activo' },
  fecha_activacion: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Cliente', clienteSchema);
