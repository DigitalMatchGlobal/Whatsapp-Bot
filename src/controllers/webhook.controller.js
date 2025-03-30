// Archivo: src/controllers/webhook.controller.js
const { predefinedResponses, areaMap } = require("../helpers/constants");
const { sendWhatsAppText } = require("../services/whatsapp.service");
const { guardarConsulta } = require("../services/mongo.service");
const { writeToSheet } = require("../services/sheets.service");

const userState = {};

const handleWebhookGet = (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "digitalmatch";
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("🔍 Verificando Webhook...");
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verificado correctamente.");
    return res.status(200).send(challenge);
  } else {
    console.log("❌ Verificación fallida. Token incorrecto.");
    return res.sendStatus(403);
  }
};

const handleWebhookPost = async (req, res) => {
  try {
    const body = req.body;
    if (!body.entry || !body.entry[0].changes[0].value.messages) return res.sendStatus(200);

    const messageData = body.entry[0].changes[0].value.messages[0];
    const phone = messageData.from;
    const text = messageData.text.body.trim().toLowerCase();
    const name = body.entry[0].changes[0].value.contacts?.[0]?.profile.name || "Desconocido";

    console.log(`📩 Mensaje recibido de ${name} (${phone}): ${text}`);

    let contexto = "";
    let estado = userState[phone] || "inicio";

    if (text === "salir") {
      delete userState[phone];
      await sendWhatsAppText(phone, "🔄 Conversación reiniciada.\n\n¡Hola! Soy el asistente virtual de DigitalMatchGlobal. 🚀\n\n¿Qué tipo de ayuda necesitas?\n1️⃣ Automatizar procesos\n2️⃣ Información sobre servicios\n3️⃣ Contactar con un asesor");
      contexto = "Conversación reiniciada";
      estado = "menu_principal";
      await guardarConsulta(phone, text, contexto, estado);
      await writeToSheet(phone, name, text, contexto, estado);
      return res.sendStatus(200);
    }

    if (predefinedResponses[text]) {
      await sendWhatsAppText(phone, predefinedResponses[text]);
      return res.sendStatus(200);
    }

    switch (estado) {
      case "inicio":
        userState[phone] = "menu_principal";
        contexto = "Inicio";
        estado = "menu_principal";
        await sendWhatsAppText(phone, "¡Hola! Soy el asistente virtual de DigitalMatchGlobal. 🚀\n\n¿Qué tipo de ayuda necesitas?\n1️⃣ Automatizar procesos\n2️⃣ Información sobre servicios\n3️⃣ Contactar con un asesor");
        break;
      case "menu_principal":
        if (text === "1") {
          userState[phone] = "esperando_area";
          estado = "esperando_area";
          contexto = "Automatización";
          await sendWhatsAppText(phone, "¿En qué área necesitas automatizar?\n1️⃣ Ventas\n2️⃣ Marketing\n3️⃣ Finanzas\n4️⃣ Operaciones\n5️⃣ Atención al cliente\n6️⃣ Otros");
        } else if (text === "2") {
          userState[phone] = "info_servicios";
          estado = "info_servicios";
          contexto = "Servicios";
          await sendWhatsAppText(phone, "Ofrecemos soluciones en ventas, marketing, finanzas y más. Visita: https://digitalmatchglobal.com");
        } else if (text === "3") {
          userState[phone] = "esperando_contacto";
          estado = "esperando_contacto";
          contexto = "Contacto";
          await sendWhatsAppText(phone, "¿Cómo prefieres que te contactemos?\n1️⃣ Videollamada\n2️⃣ WhatsApp\n3️⃣ Email");
        } else {
          await sendWhatsAppText(phone, "Selecciona 1, 2 o 3. Escribe 'Salir' para reiniciar.");
        }
        break;

      default:
        await sendWhatsAppText(phone, "No entendí tu mensaje. Escribe 'Hola' para comenzar.");
        break;
    }

    await guardarConsulta(phone, text, contexto, estado);
    await writeToSheet(phone, name, text, contexto, estado);
    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Error en webhook:", err);
    res.sendStatus(500);
  }
};

module.exports = {
  handleWebhookPost,
  handleWebhookGet
};
