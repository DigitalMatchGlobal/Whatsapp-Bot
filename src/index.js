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

// 📌 Verificar credenciales de Google Sheets
if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error("❌ Error: No se encontró el archivo de credenciales en:", CREDENTIALS_PATH);
    process.exit(1);
}
const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
const sheets = google.sheets({ version: "v4", auth });
const SHEET_NAME = "ListadoConsultas";

// 📌 Middleware para verificar API Key
const verificarAPIKey = (req, res, next) => {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey || apiKey !== API_KEY) {
        return res.status(403).json({ success: false, message: "Acceso denegado. API Key incorrecta." });
    }
    next();
};

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

// 📌 Guardar en Google Sheets
async function writeToSheet(phone, name, message) {
    const now = new Date();
    const montevideoTime = new Intl.DateTimeFormat("es-UY", {
        timeZone: "America/Montevideo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    }).format(now);

    const formattedDateTime = montevideoTime.replace(",", "");
    const dateParts = formattedDateTime.split(" ");
    const today = dateParts[0];
    const currentTime = dateParts[1];

    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: SHEETS_ID,
            range: `${SHEET_NAME}!A:G`,
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            requestBody: { values: [[phone, name, today, message, currentTime, currentTime, 1]] }
        });
        console.log("✅ Consulta guardada en Google Sheets");
    } catch (error) {
        console.error("❌ Error escribiendo en Sheets:", error);
    }
}

// 📌 Webhook de WhatsApp
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

        if (text === "hola") {
            await sendWhatsAppText(phone, "¡Hola! Soy el asistente virtual de DigitalMatchGlobal. 🚀\n\n¿Qué tipo de ayuda necesitas?\n1️⃣ Automatizar procesos\n2️⃣ Información sobre nuestros servicios\n3️⃣ Hablar con un representante");
        } else {
            await sendWhatsAppText(phone, "No entendí tu respuesta. Escribe 'Hola' para comenzar.");
        }

        res.sendStatus(200);
    } catch (error) {
        console.error("❌ Error al procesar el mensaje:", error);
        res.sendStatus(500);
    }
});

// 📌 Endpoint para obtener consultas con paginación
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

// ✅ Iniciar el servidor
app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
