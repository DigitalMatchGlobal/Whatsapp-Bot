// src/models/usuario.model.js
const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  cliente_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
  rol: { type: String, default: 'user' },
  activo: { type: Boolean, default: true },
  verificado: { type: Boolean, default: false },
  token_verificacion: { type: String },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Usuario', usuarioSchema);