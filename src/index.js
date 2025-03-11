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
        await sendWhatsAppText(phone, "¡Hola! Soy el asistente virtual de DigitalMatchGlobal. 🚀\n\n¿Qué tipo de ayuda necesitas?\n1️⃣ Automatizar procesos\n2️⃣ Obtener información sobre nuestros servicios\n3️⃣ Hablar con un representante");

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
