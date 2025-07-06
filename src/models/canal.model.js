// src\models\canal.model.js

const mongoose = require('mongoose');

const canalSchema = new mongoose.Schema({
  cliente_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
  tipo: { type: String, required: true }, // 'whatsapp'
  numero_o_id: { type: String, required: true },
  token_acceso: { type: String, default: '' },
  estado: { type: String, default: 'activo' },
  configuracion: {
    flujo_guiado: Boolean,
    flujo_mixto: Boolean,
    ia_activada: Boolean
  },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Canal', canalSchema);
