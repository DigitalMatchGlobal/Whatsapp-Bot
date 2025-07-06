// src/models/consulta.model.js
const mongoose = require('mongoose');

const consultaSchema = new mongoose.Schema({
  usuario: String,
  mensaje: String,
  contexto: String,
  estado: String,
  fecha: { type: Date, default: Date.now },
  cliente_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente' }
});

module.exports = mongoose.model('Consulta', consultaSchema);