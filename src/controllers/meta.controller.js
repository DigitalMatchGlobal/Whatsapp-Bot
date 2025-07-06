//src\controllers\meta.controller.js

const fetch = require("node-fetch");
const Canal = require("../models/canal.model");

const APP_ID = process.env.META_APP_ID;
const APP_SECRET = process.env.META_APP_SECRET;
const REDIRECT_URI = process.env.META_REDIRECT_URI;

const callbackOAuth = async (req, res) => {
  const { code, state: cliente_id } = req.query;

  if (!code || !cliente_id) {
    return res.status(400).send("❌ Faltan parámetros (code o state)");
  }

  try {
    // 1. Intercambiar code por access_token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${APP_ID}&redirect_uri=${REDIRECT_URI}&client_secret=${APP_SECRET}&code=${code}`
    );

    const tokenData = await tokenRes.json();
    const access_token = tokenData.access_token;

    if (!access_token) {
      return res.status(401).send("❌ No se pudo obtener access_token");
    }

    // 2. Obtener ID del usuario (asociado al negocio)
    const meRes = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name`, {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const profile = await meRes.json();
    const userId = profile.id;

    // 3. Obtener cuenta(s) de WhatsApp Business (WABA)
    const wabaRes = await fetch(
      `https://graph.facebook.com/v19.0/${userId}/owned_whatsapp_business_accounts`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    const wabas = await wabaRes.json();
    const waba = wabas.data?.[0];

    if (!waba?.id) return res.status(400).send("❌ No se encontró cuenta WABA");

    const waba_id = waba.id;

    // 4. Obtener números asociados a esa cuenta WABA
    const phonesRes = await fetch(
      `https://graph.facebook.com/v19.0/${waba_id}/phone_numbers`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    const phonesData = await phonesRes.json();
    const phone = phonesData.data?.[0];

    if (!phone?.id || !phone?.display_phone_number) {
      return res.status(400).send("❌ No se encontró ningún número en la cuenta WABA");
    }

    const phone_number_id = phone.id;
    const display_number = phone.display_phone_number;

    // 5. Guardar canal en DB
    await Canal.findOneAndUpdate(
      { cliente_id, tipo: "whatsapp" },
      {
        cliente_id,
        tipo: "whatsapp",
        numero_o_id: display_number,
        phone_number_id,
        token_acceso: access_token,
        estado: "activo"
      },
      { upsert: true, new: true }
    );

    // 6. Redirigir al dashboard del cliente
    return res.redirect(`http://localhost:3001/dashboard/whatsapp?ok=1`);
  } catch (err) {
    console.error("❌ Error en flujo OAuth:", err);
    return res.status(500).send("❌ Error inesperado en el flujo OAuth");
  }
};

module.exports = { callbackOAuth };
