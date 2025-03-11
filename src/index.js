const express = require("express");
const bodyParser = require("body-parser");
const { google } = require("googleapis");
const fs = require("fs");

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const SHEETS_ID = process.env.GOOGLE_SHEETS_ID;
const CREDENTIALS_PATH = process.env.GOOGLE_SHEETS_CREDENTIALS_FILE || "/etc/secrets/GOOGLE_SHEETS_CREDENTIALS_FILE";

// 📌 Verificar que el archivo de credenciales existe
if (!fs.existsSync(CREDENTIALS_PATH)) {
  console.error("❌ Error: No se encontró el archivo de credenciales en:", CREDENTIALS_PATH);
  process.exit(1);
} else {
  console.log("✅ Archivo de credenciales encontrado en:", CREDENTIALS_PATH);
}

// 📌 Leer credenciales desde el archivo JSON
const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));

// ✅ Autenticación con Google Sheets API
const auth = new google.auth.GoogleAuth({
  credentials: credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

const SHEET_NAME = "ListadoConsultas"; // 📌 Nombre correcto de la hoja

// 📌 Función para agregar una fila a Google Sheets
async function writeToSheet(phone, message) {
  const date = new Date().toISOString();
  const range = `${SHEET_NAME}!A:C`; // 📌 Asegurar el rango correcto

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEETS_ID,
      range: range,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[phone, message, date]] },
    });
    console.log("✅ Datos escritos en Google Sheets");
  } catch (error) {
    console.error("❌ Error escribiendo en Sheets:", error);
  }
}

// ✅ Webhook para recibir mensajes de WhatsApp
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

    // ✅ Guardar en Google Sheets
    await writeToSheet(phone, text);

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Error procesando webhook:", error);
    res.sendStatus(500);
  }
});

// ✅ Iniciar el servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
