require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const mongoose = require("mongoose");
const { google } = require("googleapis");
const fs = require("fs");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "digitalmatch";
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const MONGO_URI = process.env.MONGO_URI;
const API_KEY = process.env.API_KEY || "supersecreta";
const SHEETS_ID = process.env.GOOGLE_SHEETS_ID;
const CREDENTIALS_PATH = process.env.GOOGLE_SHEETS_CREDENTIALS_FILE || "/etc/secrets/GOOGLE_SHEETS_CREDENTIALS_FILE";
const userState = {}; // Estado de conversación por usuario


const responseMap = {
    "1": "1️⃣ Automatizar Procesos",
    "2": "2️⃣ Información sobre servicios",
    "3": "3️⃣ Hablar con un representante"
};

const automationTypeMap = {
    "1": "🚀 CRM para ventas",
    "2": "📊 Gestión de clientes",
    "3": "📈 Análisis de datos"
};

const areaMap = {
    "1": "1️⃣ Ventas",
    "2": "2️⃣ Marketing",
    "3": "3️⃣ Finanzas",
    "4": "4️⃣ Operaciones",
    "5": "5️⃣ Atención al cliente"
};

const automationDetails = {
    "1": {
        "1": "🚀 CRM para ventas",
        "2": "📊 Gestión de clientes",
        "3": "📈 Análisis de datos"
    },
    "2": {
        "1": "📢 Campañas automatizadas",
        "2": "📩 Email marketing",
        "3": "📊 Análisis de clientes"
    },
    "3": {
        "1": "💰 Control de gastos",
        "2": "📈 Análisis financiero",
        "3": "💳 Facturación automática"
    },
    "4": {
        "1": "🏭 Optimización de producción",
        "2": "📦 Logística automatizada",
        "3": "🔧 Mantenimiento predictivo"
    },
    "5": {
        "1": "🤖 Chatbots de soporte",
        "2": "📞 Automatización de llamadas",
        "3": "📊 Análisis de feedback"
    }
};

const predefinedResponses = {
    "precio": "💰 Los precios dependen del tipo de automatización que necesites. Más info: https://digitalmatchglobal.com/reuniones",
    "soporte": "🛠️ Sí, ofrecemos soporte técnico. Detalles aquí: https://digitalmatchglobal.com/soporte",
    "países": "🌎 Trabajamos en EEUU y Latinoamérica. Contacto: info@digitalmatchglobal.com",
    "duración": "⏳ El tiempo de implementación depende del proceso a automatizar. Contáctanos para más detalles.",
    "integraciones": "🔗 Nuestras soluciones pueden integrarse con diversas plataformas. Más info: https://digitalmatchglobal.com/integraciones",
    "seguridad": "🔒 La seguridad de los datos es nuestra prioridad. Implementamos encriptación y protocolos avanzados."
};



// ✅ Conectar a MongoDB Atlas
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Conectado a MongoDB Atlas"))
    .catch(err => {
        console.error("❌ Error al conectar a MongoDB:", err);
        process.exit(1);
    });

// ✅ Modelo de consultas
const ConsultaSchema = new mongoose.Schema({
    usuario: String,
    mensaje: String,
    contexto: String,
    estado: String,
    fecha: { type: Date, default: Date.now }
});
const Consulta = mongoose.model("Consulta", ConsultaSchema);

// 📌 Guardar consulta en MongoDB
async function guardarConsulta(usuario, mensaje, contexto, estado) {
    try {
        if (estado === "Seguimiento en Proceso") {
            const consultaPrevia = await Consulta.findOne({ usuario }).sort({ fecha: -1 }); // Busca la última consulta
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


// 📌 Verificar credenciales de Google Sheets
if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error("❌ Error: No se encontró el archivo de credenciales en:", CREDENTIALS_PATH);
    process.exit(1);
}
const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
const sheets = google.sheets({ version: "v4", auth });
const SHEET_NAME = "ListadoConsultas";

// 📌 Obtener datos de la hoja
async function getSheetData() {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEETS_ID,
            range: `${SHEET_NAME}!A:G`,
        });
        return response.data.values || [];
    } catch (error) {
        console.error("❌ Error obteniendo datos de Google Sheets:", error);
        return [];
    }
}

// 📌 Guardar en Google Sheets agrupando mensajes
async function writeToSheet(phone, name, message, contexto, estado) {
    const now = new Date();
    const montevideoTime = now.toLocaleString("es-UY", { timeZone: "America/Montevideo" });
    const [date, time] = montevideoTime.split(", ");

    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: SHEETS_ID,
            range: `${SHEET_NAME}!A:J`,  // Asegurar que hay suficiente espacio en la hoja
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            requestBody: { 
                values: [[phone, name, date, message, contexto, estado, time, time, 1]] // Nueva fila por cada mensaje
            }
        });
        console.log("✅ Nuevo mensaje registrado en Google Sheets con contexto y estado");
    } catch (error) {
        console.error("❌ Error escribiendo en Sheets:", error);
    }
}


// ✅ Enviar mensaje de WhatsApp
async function sendWhatsAppText(to, text) {
    const data = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: text.trim() }
    };
    await axios.post(
        `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`,
        data,
        { headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" } }
    );
    console.log(`✅ Mensaje enviado a ${to}`);
}

// ✅ Webhook de WhatsApp con flujo conversacional
app.post("/webhook", async (req, res) => {
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
            delete userState[phone]; // Se borra su estado actual
            await sendWhatsAppText(phone, "🔄 Conversación reiniciada. \n\n¡Hola! Soy el asistente virtual de DigitalMatchGlobal. 🚀\n\n¿Qué tipo de ayuda necesitas? Responde con el número de la opción:\n\n1️⃣ Automatizar procesos\n2️⃣ Información sobre servicios\n3️⃣ Contactar con un asesor (WhatsApp, Correo o Videollamada)\n\nEscribe 'Salir' para reiniciar en cualquier momento.");
            contexto = "Conversación reiniciada";
            estado = "menu_principal"; 
            
            await guardarConsulta(phone, text, contexto, estado);
            await writeToSheet(phone, name, text, contexto, estado);
            return res.sendStatus(200); // Finaliza aquí para evitar que continúe procesando
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
            
                if (text.toLowerCase() === "salir") {
                    delete userState[phone]; // Resetear el flujo
                    await sendWhatsAppText(phone, "Has salido del flujo de automatización. Para empezar de nuevo, escribe 'Hola'.");
                } else if (text.toLowerCase() === "hola") {
                    userState[phone] = "menu_principal";
                    await sendWhatsAppText(phone, "¡Hola de nuevo! Soy el asistente virtual de DigitalMatchGlobal. 🚀\n\n¿Qué tipo de ayuda necesitas? Responde con el número de la opción:\n\n1️⃣ Automatizar procesos\n2️⃣ Información sobre servicios\n3️⃣ Contactar con un asesor (WhatsApp, Correo o Videollamada)\n\nEscribe 'Salir' para reiniciar en cualquier momento.");
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
    } catch (error) {
        console.error("❌ Error al procesar el mensaje:", error);
        res.sendStatus(500);
    }
});


// ✅ Middleware para verificar la API Key en endpoints protegidos
const verificarAPIKey = (req, res, next) => {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey || apiKey !== API_KEY) {
        return res.status(403).json({ success: false, message: "Acceso denegado. API Key incorrecta." });
    }
    next();
};

// ✅ Middleware para loggear solicitudes
app.use((req, res, next) => {
    console.log(`📢 [${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// ✅ Webhook de verificación
app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        return res.status(200).send(challenge);
    } else {
        return res.sendStatus(403);
    }
});


// ✅ Endpoint para obtener consultas almacenadas con paginación y seguridad
app.get("/consultas", verificarAPIKey, async (req, res) => {
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
});

// ✅ Endpoint para eliminar consultas antiguas (mayores a X días)
app.delete("/consultas/limpiar", verificarAPIKey, async (req, res) => {
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
});


// ✅ Iniciar el servidor
app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
