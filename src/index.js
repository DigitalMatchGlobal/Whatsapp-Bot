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

    const sheetData = await getSheetData();
    let userRow = -1;

    for (let i = 1; i < sheetData.length; i++) {
        if (sheetData[i][0] === phone && sheetData[i][2] === date) {
            userRow = i + 1;
            break;
        }
    }

    if (userRow !== -1) {
        const existingMessage = sheetData[userRow - 1][3] || "";
        const updatedMessage = existingMessage + "\n" + message;
        let messageCount = parseInt(sheetData[userRow - 1][8] || "1", 10) + 1;
        let firstMessageTime = sheetData[userRow - 1][6] || time;
        let lastMessageTime = time;

        try {
            await sheets.spreadsheets.values.update({
                spreadsheetId: SHEETS_ID,
                range: `${SHEET_NAME}!C${userRow}:I${userRow}`,  // Expansión de columnas para incluir todas
                valueInputOption: "RAW",
                requestBody: {
                    values: [[date, updatedMessage, contexto, estado, firstMessageTime, lastMessageTime, messageCount]]
                },
            });
            console.log(`✅ Mensaje agregado a la fila ${userRow}`);
        } catch (error) {
            console.error("❌ Error actualizando fila en Sheets:", error);
        }
    } else {
        try {
            await sheets.spreadsheets.values.append({
                spreadsheetId: SHEETS_ID,
                range: `${SHEET_NAME}!A:I`,  // Expansión del rango para acomodar las nuevas columnas
                valueInputOption: "RAW",
                insertDataOption: "INSERT_ROWS",
                requestBody: {
                    values: [[phone, name, date, message, contexto, estado, time, time, 1]]
                },
            });
            console.log("✅ Nuevo mensaje registrado en Google Sheets");
        } catch (error) {
            console.error("❌ Error escribiendo en Sheets:", error);
        }
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

        // Respuestas predefinidas
        if (predefinedResponses[text]) {
            await sendWhatsAppText(phone, predefinedResponses[text]);
            return res.sendStatus(200);
        }

        switch (estado) {
            case "inicio":
                await sendWhatsAppText(phone, "¡Hola! Soy tu asistente virtual. ¿Cómo puedo ayudarte?\n1️⃣ Automatizar procesos\n2️⃣ Información sobre servicios\n3️⃣ Hablar con un representante\nEscribe 'Salir' para reiniciar en cualquier momento.");
                userState[phone] = "menu_principal";
                contexto = "Inicio de Conversación";
                estado = "menu_principal";
                break;

            case "menu_principal":
                if (text === "1") {
                    userState[phone] = "esperando_area";
                    await sendWhatsAppText(phone, "¿En qué área necesitas automatizar?\n1️⃣ Ventas\n2️⃣ Marketing\n3️⃣ Finanzas\n4️⃣ Operaciones\n5️⃣ Atención al cliente");
                    contexto = "Selección de Automatización";
                    estado = "esperando_area";
                } else if (text === "2") {
                    await sendWhatsAppText(phone, "Visita nuestro sitio web: https://digitalmatchglobal.com");
                    delete userState[phone];
                } else if (text === "3") {
                    userState[phone] = "esperando_email";
                    await sendWhatsAppText(phone, "Por favor, envíame tu email para que podamos contactarte.");
                    contexto = "Solicitud de contacto con un representante";
                    estado = "esperando_email";
                } else {
                    await sendWhatsAppText(phone, "Por favor, selecciona una opción válida (1, 2 o 3). Escribe 'Salir' para reiniciar.");
                }
                break;

            case "esperando_area":
                if (["1", "2", "3", "4", "5"].includes(text)) {
                    userState[phone] = "esperando_tipo_automatizacion";
                    await sendWhatsAppText(phone, "¡Genial! Ahora dime qué tipo de automatización necesitas:\n1️⃣ CRM\n2️⃣ Gestión de clientes\n3️⃣ Análisis de datos");
                    contexto = areaMap[text];
                    estado = "esperando_tipo_automatizacion";
                } else {
                    await sendWhatsAppText(phone, "Por favor, selecciona un número válido entre 1 y 5.");
                }
                break;

            case "esperando_tipo_automatizacion":
                if (["1", "2", "3"].includes(text)) {
                    await sendWhatsAppText(phone, "¡Gracias! Un asesor se pondrá en contacto contigo pronto.");
                    delete userState[phone];
                    contexto = `Automatización seleccionada: ${text}`;
                    estado = "Automatización Confirmada";
                } else {
                    await sendWhatsAppText(phone, "Por favor, selecciona un número válido entre 1 y 3.");
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
        }

        await guardarConsulta(phone, text, contexto, estado);
        await writeToSheet(phone, name, text, contexto, estado);

        res.sendStatus(200);
    } catch (error) {
        console.error("❌ Error al procesar el mensaje:", error);
        res.sendStatus(500);
    }
});



// ✅ Iniciar el servidor
app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
