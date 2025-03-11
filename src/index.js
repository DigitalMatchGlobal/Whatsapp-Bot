const express = require("express");
const bodyParser = require("body-parser");
const { google } = require("googleapis");
const { WebhookClient } = require("dialogflow-fulfillment");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());

const SHEETS_ID = process.env.GOOGLE_SHEETS_ID;
const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);

// Autenticación con Google Sheets
const auth = new google.auth.GoogleAuth({
  credentials: credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

// Función para agregar una fila a Google Sheets
async function writeToSheet(phone, message) {
  const date = new Date().toISOString();
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEETS_ID,
      range: "Sheet1!A:C",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      resource: { values: [[phone, message, date]] },
    });
    console.log("✅ Datos escritos en Google Sheets");
  } catch (error) {
    console.error("❌ Error escribiendo en Sheets:", error);
  }
}

// Webhook de WhatsApp
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;
    console.log("📩 Webhook recibido:", JSON.stringify(body, null, 2));

    if (!body.entry || !body.entry[0].changes[0].value.messages) {
      console.log("⚠️ Webhook sin mensajes. Ignorado.");
      return res.sendStatus(200);
    }

    const message = body.entry[0].changes[0].value.messages[0];
    const phone = message.from;
    const text = message.text.body;

    console.log(`📩 Mensaje recibido de ${phone}: ${text}`);

    // Guardar en Google Sheets
    await writeToSheet(phone, text);

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Error procesando webhook:", error);
    res.sendStatus(500);
  }
});

app.listen(3000, () => {
  console.log("✅ Servidor corriendo en http://localhost:3000");
});
