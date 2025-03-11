const express = require("express");
const bodyParser = require("body-parser");
const { google } = require("googleapis");
const fs = require("fs");

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const SHEETS_ID = process.env.GOOGLE_SHEETS_ID;
const CREDENTIALS_PATH = process.env.GOOGLE_SHEETS_CREDENTIALS_FILE || "/etc/secrets/GOOGLE_SHEETS_CREDENTIALS_FILE";

// 📌 Verificar si el archivo de credenciales existe
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

const SHEET_NAME = "ListadoConsultas"; // 📌 Nombre de la hoja correcta

// 📌 Función para obtener los datos de la hoja y buscar si hay mensajes previos del cliente en la misma fecha
async function getSheetData() {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEETS_ID,
      range: `${SHEET_NAME}!A:D`, // 📌 Leer todas las columnas hasta la D
    });
    return response.data.values || [];
  } catch (error) {
    console.error("❌ Error obteniendo datos de Google Sheets:", error);
    return [];
  }
}

// 📌 Función para escribir o actualizar datos en Google Sheets
async function writeToSheet(phone, message) {
  // ✅ Ajustar zona horaria a Montevideo (-3 UTC)
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

  const formattedDate = montevideoTime.replace(",", ""); // 🕒 Fecha y hora corregida
  const today = formattedDate.split(" ")[0]; // 📌 Extraer solo la fecha

  const sheetData = await getSheetData();

  // 📌 Buscar si el usuario ya tiene un registro en la hoja con la misma fecha
  let userRow = -1;
  for (let i = 1; i < sheetData.length; i++) {
    if (sheetData[i][0] === phone && sheetData[i][2].includes(today)) {
      userRow = i + 1; // Google Sheets usa índice basado en 1
      break;
    }
  }

  if (userRow !== -1) {
    // 📌 Si el usuario ya tiene mensajes hoy, actualizar su fila
    const existingMessage = sheetData[userRow - 1][1] || "";
    const updatedMessage = existingMessage + "\n" + message; // 📝 Agregar el nuevo mensaje debajo del anterior
    let messageCount = parseInt(sheetData[userRow - 1][3] || "1", 10) + 1; // 📌 Incrementar contador de mensajes

    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEETS_ID,
        range: `${SHEET_NAME}!B${userRow}:D${userRow}`,
        valueInputOption: "RAW",
        requestBody: { values: [[updatedMessage, formattedDate, messageCount]] },
      });
      console.log(`✅ Mensaje agregado a la fila ${userRow}`);
    } catch (error) {
      console.error("❌ Error actualizando fila en Sheets:", error);
    }
  } else {
    // 📌 Si el usuario no tiene mensajes hoy, crear una nueva fila
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEETS_ID,
        range: `${SHEET_NAME}!A:D`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [[phone, message, formattedDate, 1]] },
      });
      console.log("✅ Nuevo mensaje registrado en Google Sheets");
    } catch (error) {
      console.error("❌ Error escribiendo en Sheets:", error);
    }
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
