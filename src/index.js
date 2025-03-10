require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const mongoose = require("mongoose");

// ✅ Conectar a MongoDB Atlas con manejo de errores
const uri = process.env.MONGO_URI;
mongoose.connect(uri)
    .then(() => console.log("✅ Conectado a MongoDB Atlas"))
    .catch((err) => {
        console.error("❌ Error al conectar a MongoDB:", err);
        process.exit(1);
    });

// ✅ Definir modelo de consultas
const ConsultaSchema = new mongoose.Schema({
    usuario: String,
    mensaje: String,
    fecha: { type: Date, default: Date.now }
});
const Consulta = mongoose.model("Consulta", ConsultaSchema);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "digitalmatch";
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const API_KEY = process.env.API_KEY || "supersecreta"; // Clave de seguridad para acceder a los endpoints

const userState = {}; // Guarda el estado de la conversación de cada usuario

// ✅ Middleware para verificar la API Key en las solicitudes protegidas
const verificarAPIKey = (req, res, next) => {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey || apiKey !== API_KEY) {
        return res.status(403).json({ success: false, message: "Acceso denegado. API Key incorrecta." });
    }
    next();
};

// ✅ Middleware para loggear todas las solicitudes
app.use((req, res, next) => {
    console.log(`📢 [${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// ✅ Verificación del webhook
app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        return res.status(200).send(challenge);
    } else {
        return res.sendStatus(403);
    }
});

// ✅ Manejo de mensajes entrantes
app.post("/webhook", async (req, res) => {
    try {
        const body = req.body;
        if (body.object && body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
            const message = body.entry[0].changes[0].value.messages[0];
            const phoneNumber = message.from;
            const messageText = message.text?.body.trim().toLowerCase() || "";

            console.log(`📩 Mensaje recibido de ${phoneNumber}: ${messageText}`);

            // 📌 Guardar consulta en MongoDB
            await guardarConsulta(phoneNumber, messageText);

            await sendWhatsAppText(phoneNumber, "Tu mensaje ha sido recibido. ¡Gracias! 🚀");
        }
        res.sendStatus(200);
    } catch (error) {
        console.error("❌ Error al procesar el mensaje:", error);
        res.sendStatus(500);
    }
});

// ✅ Endpoint para obtener consultas almacenadas con paginación y seguridad
app.get("/consultas", verificarAPIKey, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const consultas = await Consulta.find()
            .sort({ fecha: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));
        res.json({ success: true, data: consultas });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error al obtener consultas" });
    }
});

// ✅ Endpoint para eliminar consultas antiguas (mayores a X días)
app.delete("/consultas/limpiar", verificarAPIKey, async (req, res) => {
    try {
        const { dias = 30 } = req.query;
        const limiteFecha = new Date();
        limiteFecha.setDate(limiteFecha.getDate() - dias);
        await Consulta.deleteMany({ fecha: { $lt: limiteFecha } });
        res.json({ success: true, message: `Consultas de más de ${dias} días eliminadas.` });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error al limpiar consultas" });
    }
});

// ✅ Función para guardar consulta en MongoDB
async function guardarConsulta(usuario, mensaje) {
    try {
        const nuevaConsulta = new Consulta({ usuario, mensaje });
        await nuevaConsulta.save();
        console.log("✅ Consulta guardada en MongoDB");
    } catch (err) {
        console.error("❌ Error al guardar consulta:", err);
    }
}

// ✅ Función para enviar mensajes de texto
async function sendWhatsAppText(to, text) {
    const data = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: { body: text.trim() },
    };
    await axios.post(
        `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`,
        data,
        {
            headers: {
                Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
            },
        }
    );
    console.log(`✅ Mensaje enviado a ${to}`);
}

// ✅ Iniciar el servidor
app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
