// Archivo: src/index.js
// Archivo: src/index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const { logger } = require("./middlewares/logger");

const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(logger);

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ Conectado a MongoDB Atlas"))
  .catch(err => {
    console.error("❌ Error al conectar a MongoDB:", err);
    process.exit(1);
  });

const webhookRoutes = require("./routes/webhook.routes");
const consultaRoutes = require("./routes/consulta.routes");
const authRoutes = require("./routes/auth.routes");
const clienteRoutes = require("./routes/cliente.routes");
const whatsappRoutes = require("./routes/whatsapp.routes");

app.use("/webhook", webhookRoutes);
app.use("/consultas", consultaRoutes);
app.use(authRoutes);
app.use("/cliente", clienteRoutes);
app.use("/whatsapp", whatsappRoutes);

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
