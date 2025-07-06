// src/controllers/consulta.controller.js
const Consulta = require('../models/consulta.model');

exports.obtenerConsultasPorCliente = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const clienteId = req.user.cliente_id;

    const consultas = await Consulta.find({ cliente_id: clienteId })
      .sort({ fecha: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    res.json({ success: true, data: consultas });
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener consultas', error: err.message });
  }
};

exports.obtenerKpis = async (req, res) => {
  try {
    const clienteId = req.user.cliente_id;
    const total = await Consulta.distinct('usuario', { cliente_id: clienteId });
    const finalizadas = await Consulta.countDocuments({ cliente_id: clienteId, estado: 'finalizada' });
    const derivadas = await Consulta.countDocuments({ cliente_id: clienteId, estado: 'derivar' });

    res.json({ totalUnicos: total.length, finalizadas, derivadas });
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener KPIs', error: err.message });
  }
};

exports.obtenerUltimasConsultas = async (req, res) => {
  try {
    const clienteId = req.user.cliente_id;
    const consultas = await Consulta.find({ cliente_id: clienteId })
      .sort({ fecha: -1 })
      .limit(10);

    res.json({ consultas });
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener últimas consultas', error: err.message });
  }
};
