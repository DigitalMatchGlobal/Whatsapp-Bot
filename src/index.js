const express = require("express");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");
const bodyParser = require("body-parser");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());

// Configuración de Google Sheets
const GOOGLE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID;
const GOOGLE_SHEETS_CREDENTIALS = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);

const doc = new GoogleSpreadsheet(GOOGLE_SHEETS_ID);

async function saveToGoogleSheets(phone, message) {
    try {
        console.log("📝 Intentando guardar en Google Sheets...");
        const auth = new JWT({
            email: GOOGLE_SHEETS_CREDENTIALS.client_email,
            key: GOOGLE_SHEETS_CREDENTIALS.private_key,
            scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });
        
        await doc.useServiceAccountAuth(auth);
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

// Endpoint para el webhook de WhatsApp
app.post("/webhook", async (req, res) => {
    try {
        const body = req.body;

        if (!body.object || !body.entry) {
            return res.sendStatus(400);
        }

        for (let entry of body.entry) {
            for (let change of entry.changes) {
                if (change.value.messages) {
                    const message = change.value.messages[0];
                    const phoneNumber = message.from;
                    const messageText = message.text?.body.trim() || "";

                    console.log(`📩 Mensaje recibido de ${phoneNumber}: ${messageText}`);

                    // Guardar en Google Sheets
                    await saveToGoogleSheets(phoneNumber, messageText);
                } else {
                    console.log("⚠️ Webhook recibido sin mensajes. Ignorando evento.");
                }
            }
        }

        res.sendStatus(200);
    } catch (error) {
        console.error("❌ Error al procesar mensaje:", error);
        res.sendStatus(500);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
