// Archivo: src/index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const fs = require("fs");

const webhookRoutes = require("./routes/webhook.routes");
const consultaRoutes = require("./routes/consulta.routes");
const { connectSheets } = require("./services/sheets.service");
const { logger } = require("./middlewares/logger");

const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(logger);

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const CREDENTIALS_PATH = process.env.GOOGLE_SHEETS_CREDENTIALS_FILE;

if (!fs.existsSync(CREDENTIALS_PATH)) {
  console.error("❌ Archivo de credenciales de Sheets no encontrado en:", CREDENTIALS_PATH);
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ Conectado a MongoDB Atlas"))
  .catch(err => {
    console.error("❌ Error al conectar a MongoDB:", err);
    process.exit(1);
  });

connectSheets();

app.use("/webhook", webhookRoutes);
app.use("/consultas", consultaRoutes);

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
