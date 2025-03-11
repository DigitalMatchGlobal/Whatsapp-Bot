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
    fecha: { type: Date, default: Date.now }
});
const Consulta = mongoose.model("Consulta", ConsultaSchema);

// 📌 Guardar consulta en MongoDB
async function guardarConsulta(usuario, mensaje) {
    try {
        const nuevaConsulta = new Consulta({ usuario, mensaje });
        await nuevaConsulta.save();
        console.log("✅ Consulta guardada en MongoDB");
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
async function writeToSheet(phone, name, message) {
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
        let messageCount = parseInt(sheetData[userRow - 1][6] || "1", 10) + 1;
        let firstMessageTime = sheetData[userRow - 1][4] || time;
        let lastMessageTime = time;

        try {
            await sheets.spreadsheets.values.update({
                spreadsheetId: SHEETS_ID,
                range: `${SHEET_NAME}!C${userRow}:G${userRow}`,
                valueInputOption: "RAW",
                requestBody: { values: [[date, updatedMessage, firstMessageTime, lastMessageTime, messageCount]] },
            });
            console.log(`✅ Mensaje agregado a la fila ${userRow}`);
        } catch (error) {
            console.error("❌ Error actualizando fila en Sheets:", error);
        }
    } else {
        try {
            await sheets.spreadsheets.values.append({
                spreadsheetId: SHEETS_ID,
                range: `${SHEET_NAME}!A:G`,
                valueInputOption: "RAW",
                insertDataOption: "INSERT_ROWS",
                requestBody: { values: [[phone, name, date, message, time, time, 1]] },
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
        await guardarConsulta(phone, text);
        await writeToSheet(phone, name, text);

        // 📌 Reiniciar conversación con "Salir" o "Hola" en cualquier momento
        if (text === "salir" || text === "hola") {
            delete userState[phone];
            await sendWhatsAppText(phone, "La conversación ha sido reiniciada. Escribe 'Hola' para comenzar de nuevo.");
            return res.sendStatus(200);
        }

        // 📌 Si el usuario no tiene un estado, inicia en "inicio"
        if (!userState[phone]) userState[phone] = "inicio";

        switch (userState[phone]) {
            case "inicio":
                await sendWhatsAppText(phone, "¡Hola! Soy tu asistente virtual. ¿Cómo puedo ayudarte?\n1️⃣ Automatizar procesos\n2️⃣ Información sobre servicios\n3️⃣ Hablar con un representante\nEscribe 'Salir' para reiniciar en cualquier momento.");
                userState[phone] = "menu_principal";
                break;

            case "menu_principal":
                if (text === "1") {
                    userState[phone] = "esperando_area";
                    await sendWhatsAppText(phone, "¿En qué área necesitas automatizar?\n1️⃣ Ventas\n2️⃣ Marketing\n3️⃣ Finanzas\n4️⃣ Operaciones\n5️⃣ Atención al cliente");
                } else if (text === "2") {
                    await sendWhatsAppText(phone, "Visita nuestro sitio web: https://digitalmatchglobal.com");
                    delete userState[phone]; // 🚀 Cierra la conversación
                } else if (text === "3") {
                    userState[phone] = "esperando_email";
                    await sendWhatsAppText(phone, "Por favor, envíame tu email para que podamos contactarte.");
                } else {
                    await sendWhatsAppText(phone, "Por favor, selecciona una opción válida (1, 2 o 3). Escribe 'Salir' para reiniciar.");
                }
                break;

            case "esperando_area":
                const areas = {
                    "1": "Ventas",
                    "2": "Marketing",
                    "3": "Finanzas",
                    "4": "Operaciones",
                    "5": "Atención al cliente"
                };
                if (areas[text]) {
                    userState[phone] = "esperando_descripcion";
                    await sendWhatsAppText(phone, `Perfecto, trabajamos en soluciones de automatización para ${areas[text]}.\nPor favor, describe en pocas palabras qué problema o proceso deseas automatizar.`);
                } else {
                    await sendWhatsAppText(phone, "Por favor, elige un área válida (1, 2, 3, 4 o 5). Escribe 'Salir' para reiniciar.");
                }
                break;

            case "esperando_descripcion":
                await sendWhatsAppText(phone, "¡Gracias! Registramos tu solicitud y en breve un representante te contactará para analizar la mejor solución para ti. ✅");
                delete userState[phone]; // 🚀 Finaliza la conversación
                break;

            case "esperando_email":
                if (text.includes("@")) {
                    await sendWhatsAppText(phone, `¡Gracias! Te enviaremos más información a ${text}. ✅`);
                    delete userState[phone]; // 🚀 Finaliza la conversación
                } else {
                    await sendWhatsAppText(phone, "Por favor, ingresa un email válido.");
                }
                break;

            default:
                await sendWhatsAppText(phone, "No entendí tu respuesta. Escribe 'Hola' para comenzar de nuevo.");
                delete userState[phone]; // 🚀 Resetea estado para evitar loops
                break;
        }

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
