// Archivo: src/services/mongo.service.js
const Consulta = require("../models/consulta.model");

async function guardarConsulta(usuario, mensaje, contexto, estado) {
  try {
    if (estado === "Seguimiento en Proceso") {
      const consultaPrevia = await Consulta.findOne({ usuario }).sort({ fecha: -1 });// Busca la última consulta
      if (consultaPrevia) {
        contexto = `Seguimiento de consulta previa: ${consultaPrevia.mensaje}`;
      }
    }
    const nuevaConsulta = new Consulta({ usuario, mensaje, contexto, estado });
    await nuevaConsulta.save();
    console.log("✅ Consulta guardada en MongoDB con contexto y estado");
  } catch (err) {
    console.error("❌ Error al guardar consulta:", err);
  }
}

module.exports = {
  guardarConsulta
};