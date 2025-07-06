//src\controllers\whatsapp.controller.js

const Canal = require('../models/canal.model');

exports.misNumeros = async (req, res) => {
  try {
    const canal = await Canal.findOne({
      cliente_id: req.user.cliente_id,
      tipo: 'whatsapp'
    });

    if (!canal) return res.json({ canal: null });

    // Confirmamos los campos que llegan
    res.json({
      canal: {
        numero_o_id: canal.numero_o_id,
        created_at: canal.created_at
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener canal', error: err.message });
  }
};
