// Archivo: src/controllers/consulta.controller.js
const Consulta = require("../models/consulta.model");

const getConsultas = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const consultas = await Consulta.find()
      .sort({ fecha: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    res.json({ success: true, data: consultas });
  } catch (error) {
    console.error("❌ Error al obtener consultas:", error);
    res.status(500).json({ success: false, message: "Error al obtener las consultas" });
  }
};

const limpiarConsultas = async (req, res) => {
  try {
    const { dias = 30 } = req.query;
    const limiteFecha = new Date();
    limiteFecha.setDate(limiteFecha.getDate() - dias);
    await Consulta.deleteMany({ fecha: { $lt: limiteFecha } });
    res.json({ success: true, message: `Consultas de más de ${dias} días eliminadas.` });
  } catch (error) {
    console.error("❌ Error al limpiar consultas:", error);
    res.status(500).json({ success: false, message: "Error al limpiar consultas" });
  }
};

module.exports = {
  getConsultas,
  limpiarConsultas
};