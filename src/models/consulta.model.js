// Archivo: src/models/consulta.model.js
const mongoose = require("mongoose");

const ConsultaSchema = new mongoose.Schema({
  usuario: String,
  mensaje: String,
  contexto: String,
  estado: String,
  fecha: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Consulta", ConsultaSchema);