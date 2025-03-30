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
  console.log("🔹 Modo:", mode);
  console.log("🔹 Token recibido:", token);
  console.log("🔹 Challenge recibido:", challenge);
  
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

    // ✅ Verificar si el usuario quiere salir y reiniciar la conversación
    if (text === "salir") {
      delete userState[phone];
      await sendWhatsAppText(phone, "🔄 Conversación reiniciada. \n\n¡Hola! Soy el asistente virtual de DigitalMatchGlobal. 🚀\n\n¿Qué tipo de ayuda necesitas? Responde con el número de la opción:\n\n1️⃣ Automatizar procesos\n2️⃣ Información sobre servicios\n3️⃣ Contactar con un asesor (WhatsApp, Correo o Videollamada)\n\nEscribe 'Salir' para reiniciar en cualquier momento.");
      contexto = "Conversación reiniciada";
      estado = "menu_principal";
      await guardarConsulta(phone, text, contexto, estado);
      await writeToSheet(phone, name, text, contexto, estado);
      return res.sendStatus(200);// Finaliza aquí para evitar que continúe procesando
    }

    // Respuestas predefinidas
    if (predefinedResponses[text]) {
      await sendWhatsAppText(phone, predefinedResponses[text]);
      return res.sendStatus(200);
    }

    switch (estado) {
        default:
            if (text.toLowerCase() === "salir") {
                delete userState[phone]; // Resetear el flujo
                await sendWhatsAppText(phone, "Has salido del flujo de automatización. Para empezar de nuevo, escribe 'Hola'.");
        
            } else if (text.toLowerCase() === "hola") {
                userState[phone] = "menu_principal";
                await sendWhatsAppText(phone, "¡Hola de nuevo! Soy el asistente virtual de DigitalMatchGlobal. 🚀\n\n"
                    + "¿Qué tipo de ayuda necesitas? Responde con el número de la opción:\n\n"
                    + "1️⃣ Automatizar procesos\n2️⃣ Información sobre servicios\n3️⃣ Contactar con un asesor (WhatsApp, Correo o Videollamada)\n\n"
                    + "Escribe 'Salir' para reiniciar en cualquier momento.");
            
            } else if (["ok", "okay", "gracias", "bien", "entendido"].includes(text.toLowerCase())) {
                // Si el usuario está dentro de un flujo, simplemente confirmamos
                if (userState[phone]) {
                    await sendWhatsAppText(phone, "¡Entendido! 😊 Si necesitas más ayuda, dime cómo puedo asistirte.");
                } else {
                    await sendWhatsAppText(phone, "Para comenzar nuevamente, escribe 'Hola'.");
                }
        
            } else if (userState[phone]) {
                await sendWhatsAppText(phone, "No entendí tu mensaje. Por favor, selecciona una opción válida o escribe 'Salir' para volver al menú principal.");
            
            } else {
                await sendWhatsAppText(phone, "No entendí tu mensaje. Para comenzar nuevamente, escribe 'Hola'.");
            }
            break;
        
        case "inicio":
            await sendWhatsAppText(phone, "¡Hola! Soy el asistente virtual de DigitalMatchGlobal. 🚀\n\n¿Qué tipo de ayuda necesitas? Responde con el número de la opción:\n\n1️⃣ Automatizar procesos\n2️⃣ Información sobre servicios\n3️⃣ Contactar con un asesor (WhatsApp, Correo o Videollamada)\n\nEscribe 'Salir' para reiniciar en cualquier momento.");
            userState[phone] = "menu_principal";
            contexto = "Inicio de Conversación";
            estado = "menu_principal";
            break;

        case "menu_principal":
            if (text === "1") {
                userState[phone] = "esperando_area";
                await sendWhatsAppText(phone, "¡Genial! ¿En qué área necesitas automatizar?\n1️⃣ Ventas\n2️⃣ Marketing\n3️⃣ Finanzas\n4️⃣ Operaciones\n5️⃣ Atención al cliente\n6️⃣ Otros");
                contexto = "Selección de Automatización";
                estado = "esperando_area";

            } else if (text === "2") {
                await sendWhatsAppText(phone, "Ofrecemos soluciones de automatización en diferentes áreas como ventas, marketing, finanzas y atención al cliente. Para más detalles, visita nuestro sitio web: https://digitalmatchglobal.com");
                // 🚀 En lugar de borrar el estado, dejamos al usuario en "info_servicios" para evitar reinicio
                userState[phone] = "info_servicios";
                contexto = "Información de servicios";
                estado = "info_servicios";

            } else if (text === "3") {  // Contactar con un asesor
                userState[phone] = "esperando_contacto";
                await sendWhatsAppText(phone, "¿Cómo prefieres ser contactado?\n"
                    + "1️⃣ Agendar una videollamada 📅\n"
                    + "2️⃣ Que un asesor te escriba por WhatsApp 📲\n"
                    + "3️⃣ Que un asesor te envíe un email 📧");
                contexto = "Elección de Contacto";
                estado = "esperando_contacto";

            } else if (["ok", "okay", "gracias", "bien", "entendido"].includes(text.toLowerCase())) {
                // ✅ No reiniciamos el flujo, solo confirmamos que puede seguir preguntando
                await sendWhatsAppText(phone, "¡Genial! 😊 Si necesitas más información, dime en qué puedo ayudarte.");

            } else {
                await sendWhatsAppText(phone, "Por favor, selecciona una opción válida (1, 2 o 3). Escribe 'Salir' para reiniciar.");
            }
            break;

        case "esperando_contacto":
                if (text === "1") {
                    await sendWhatsAppText(phone, "📅 Puedes agendar una consulta directamente en este enlace:\n"
                        + "🔗 https://calendly.com/digitalmatch-global/30min?month=2025-03\n\n"
                        + "¡Espero tu reserva! 😊");
                    delete userState[phone];
                    contexto = "Videollamada Programada";
                    estado = "Videollamada Confirmada";
                } else if (text === "2") {
                    await sendWhatsAppText(phone, "Un asesor se pondrá en contacto contigo pronto por WhatsApp. 📲");
                    delete userState[phone];
                    contexto = "Contacto por WhatsApp";
                    estado = "Esperando Respuesta del Asesor";
                } else if (text === "3") {
                    userState[phone] = "esperando_email";
                    await sendWhatsAppText(phone, "Por favor, envíame tu email para que podamos contactarte.");
                    contexto = "Solicitud de contacto por email";
                    estado = "esperando_email";
                } else {
                    await sendWhatsAppText(phone, "Por favor, selecciona una opción válida (1, 2 o 3).");
                }
                break;
            
        case "esperando_area":
            if (["1", "2", "3", "4", "5"].includes(text)) {
                userState[phone] = "esperando_tipo_automatizacion";
                await sendWhatsAppText(phone, "¡Perfecto! ¿Qué problema o tarea específica te gustaría automatizar?\n1️⃣ CRM\n2️⃣ Gestión de clientes\n3️⃣ Análisis de datos\n4️⃣ Otros");
                contexto = areaMap[text];
                estado = "esperando_tipo_automatizacion";
            } else if (text === "6") {  // "Otros"
                userState[phone] = "esperando_area_otro";
                await sendWhatsAppText(phone, "Por favor, describe en qué área necesitas automatización:");
                contexto = "Área de Automatización Personalizada";
                estado = "esperando_area_otro";
            } else {
                await sendWhatsAppText(phone, "Por favor, selecciona un número válido entre 1 y 6.");
            }
            break;

        case "esperando_area_otro":
            userState[phone] = "esperando_tipo_automatizacion";
            await sendWhatsAppText(phone, "¡Gracias! Ahora dime qué tipo de automatización necesitas:\n1️⃣ CRM\n2️⃣ Gestión de clientes\n3️⃣ Análisis de datos\n4️⃣ Otros");
            contexto = `Área de automatización personalizada: ${text}`;
            estado = "esperando_tipo_automatizacion";
            break;

        case "esperando_tipo_automatizacion":
            if (["1", "2", "3"].includes(text)) {
                await sendWhatsAppText(phone, "¡Gracias! Un asesor se pondrá en contacto contigo pronto.");
                delete userState[phone];
                contexto = `Automatización seleccionada: ${text}`;
                estado = "Automatización Confirmada";
            }  else if (text === "4") { // "Otros"
                userState[phone] = "esperando_tipo_otro";
                await sendWhatsAppText(phone, "Por favor, describe qué tipo de automatización necesitas:");
                contexto = "Tipo de Automatización Personalizada";
                estado = "esperando_tipo_otro";
            } else {
                await sendWhatsAppText(phone, "Por favor, selecciona un número válido entre 1 y 4.");
                }
            break;

        case "esperando_email":
            if (text.includes("@")) {
                await sendWhatsAppText(phone, "¡Gracias! Nos pondremos en contacto contigo pronto.");
                delete userState[phone];
                contexto = "Email Recibido";
                estado = "Email Confirmado";
            } else {
                await sendWhatsAppText(phone, "Por favor, ingresa un email válido.");
            }
            break;

        case "esperando_tipo_otro":
            await sendWhatsAppText(phone, "¡Gracias! Un asesor se pondrá en contacto contigo pronto.");
            delete userState[phone];
            contexto = `Automatización personalizada: ${text}`;
            estado = "Automatización Confirmada";
            break;

        case "esperando_presupuesto":
            await sendWhatsAppText(phone, `¡Gracias! Vamos a analizar tu requerimiento para enviarte un presupuesto detallado.`);
            delete userState[phone];
            contexto = "Solicitud de Presupuesto";
            estado = "Presupuesto Enviado";
            break;

        case "esperando_seguimiento":
            await sendWhatsAppText(phone, "Estamos revisando tu consulta. Pronto recibirás una actualización.");
            delete userState[phone];
            contexto = "Solicitud de Seguimiento";
            estado = "Seguimiento en Proceso";
            break;
    
        case "info_servicios":
            if (["ok", "okay", "gracias", "bien", "entendido"].includes(text.toLowerCase())) {
                await sendWhatsAppText(phone, "¡Entendido! 😊 Si necesitas más información, dime en qué puedo ayudarte.");
            } else {
                // Si el usuario pregunta otra cosa, lo redirigimos al menú principal
                userState[phone] = "menu_principal";
                await sendWhatsAppText(phone, "No entendí tu mensaje. Si necesitas más información, dime en qué puedo ayudarte o escribe 'Hola' para reiniciar.");
            }
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
