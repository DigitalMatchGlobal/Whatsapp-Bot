require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const mongoose = require("mongoose");
const { GoogleSpreadsheet } = require("google-spreadsheet");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "digitalmatch";
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const MONGO_URI = process.env.MONGO_URI;
const GOOGLE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID;

// ✅ Cargar credenciales de Google Sheets correctamente
let GOOGLE_SHEETS_CREDENTIALS;
try {
    if (!process.env.GOOGLE_SHEETS_CREDENTIALS_PATH) {
        throw new Error("GOOGLE_SHEETS_CREDENTIALS_PATH no está definido en las variables de entorno.");
    }
    GOOGLE_SHEETS_CREDENTIALS = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS_PATH);
    console.log("✅ Credenciales de Google Sheets cargadas correctamente");
} catch (error) {
    console.error("❌ Error al cargar las credenciales de Google Sheets:", error.message);
    process.exit(1);
}

// ✅ Conectar a MongoDB Atlas
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("✅ Conectado a MongoDB Atlas"))
    .catch(err => console.error("❌ Error al conectar a MongoDB:", err));

// ✅ Definir modelo de consultas
const ConsultaSchema = new mongoose.Schema({
    usuario: String,
    mensaje: String,
    fecha: { type: Date, default: Date.now }
});
const Consulta = mongoose.model("Consulta", ConsultaSchema);

const userState = {};
const faqResponses = {
    "precio": "Los precios dependen del tipo de automatización que necesites. Más info: https://digitalmatchglobal.com/reuniones",
    "soporte": "Sí, ofrecemos soporte técnico. Detalles: https://digitalmatchglobal.com/soporte",
    "países": "Trabajamos en Latinoamérica y España. Contacto: info@digitalmatchglobal.com"
};

// ✅ Webhook de verificación
app.get("/webhook", (req, res) => {
    if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === VERIFY_TOKEN) {
        return res.status(200).send(req.query["hub.challenge"]);
    }
    return res.sendStatus(403);
});

// ✅ Webhook para mensajes entrantes
app.post("/webhook", async (req, res) => {
    try {
        const body = req.body;
        if (body.object && body.entry) {
            const message = body.entry[0].changes[0].value.messages[0];
            const phoneNumber = message.from;
            const messageText = message.text?.body.trim().toLowerCase() || "";

            console.log(`📩 Mensaje recibido de ${phoneNumber}: ${messageText}`);
            await guardarConsulta(phoneNumber, messageText);

            if (faqResponses[messageText]) {
                await sendWhatsAppText(phoneNumber, faqResponses[messageText]);
                return res.sendStatus(200);
            }

            if (messageText === "hola") {
                userState[phoneNumber] = "inicio";
                await sendWhatsAppText(phoneNumber, "¡Hola! Soy el asistente virtual de DigitalMatchGlobal. 🚀\n\n¿Qué tipo de ayuda necesitas?\n1️⃣ Automatizar procesos\n2️⃣ Obtener información\n3️⃣ Hablar con un representante");
                return res.sendStatus(200);
            }
        }
        res.sendStatus(200);
    } catch (error) {
        console.error("❌ Error al procesar mensaje:", error);
        res.sendStatus(500);
    }
});

// ✅ Guardar en MongoDB
async function guardarConsulta(usuario, mensaje) {
    try {
        await new Consulta({ usuario, mensaje }).save();
        console.log("✅ Consulta guardada en MongoDB");
    } catch (err) {
        console.error("❌ Error al guardar consulta:", err);
    }
}

// ✅ Guardar en Google Sheets
async function saveToGoogleSheets(phone, message) {
    try {
        const doc = new GoogleSpreadsheet(GOOGLE_SHEETS_ID);
        await doc.useServiceAccountAuth(GOOGLE_SHEETS_CREDENTIALS);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];

        await sheet.addRow({ 
            Telefono: phone, 
            Mensaje: message, 
            Fecha: new Date().toLocaleString() 
        });

        console.log("✅ Consulta guardada en Google Sheets");
    } catch (error) {
        console.error("❌ Error al guardar en Google Sheets:", error);
    }
}

// ✅ Enviar mensaje a WhatsApp
async function sendWhatsAppText(to, text) {
    await axios.post(`https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`, {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: { body: text.trim() },
    }, {
        headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    });
    console.log(`✅ Mensaje enviado a ${to}`);
}

app.listen(PORT, () => console.log(`✅ Servidor corriendo en http://localhost:${PORT}`));
