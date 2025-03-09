require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "digitalmatch";
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;

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

            if (messageText === "hola") {
                await sendWhatsAppText(phoneNumber, "¡Hola! Soy el asistente virtual de DigitalMatchGlobal. 🚀\n\n¿Qué tipo de ayuda necesitas? Responde con el número de la opción:\n\n1️⃣ Automatizar procesos\n2️⃣ Obtener información sobre nuestros servicios\n3️⃣ Hablar con un representante");
            } else if (messageText === "1") {
                await sendWhatsAppText(phoneNumber, "¡Genial! ¿En qué área necesitas automatizar?\n\n1️⃣ Ventas\n2️⃣ Marketing\n3️⃣ Finanzas\n4️⃣ Operaciones\n5️⃣ Atención al cliente");
            } else if (["1", "2", "3", "4", "5"].includes(messageText)) {
                const areas = {
                    "1": "Ventas",
                    "2": "Marketing",
                    "3": "Finanzas",
                    "4": "Operaciones",
                    "5": "Atención al cliente"
                };
                await sendWhatsAppText(phoneNumber, `¡Perfecto! ¿Qué problema o tarea específica te gustaría automatizar en ${areas[messageText]}? Puedes describirlo en pocas palabras.`);
            } else if (messageText === "2") {
                await sendWhatsAppText(phoneNumber, "Ofrecemos soluciones de automatización en diferentes áreas como ventas, marketing, finanzas y atención al cliente. Para más detalles, visita nuestro sitio web: https://digitalmatchglobal.com");
            } else if (messageText === "3") {
                await sendWhatsAppText(phoneNumber, "¡Entendido! En breve, un representante se pondrá en contacto contigo. Mientras tanto, ¿te gustaría recibir información sobre nuestros servicios en tu correo? Si es así, por favor dime tu dirección de email.");
            } else if (messageText.includes("@")) {
                await sendWhatsAppText(phoneNumber, `¡Gracias! Te enviaremos más información a ${messageText}. ✅`);
            } else {
                await sendWhatsAppText(phoneNumber, "No entendí tu respuesta. Por favor, responde con un número de opción (1, 2 o 3).");
            }
        }

        res.sendStatus(200);
    } catch (error) {
        console.error("❌ Error al procesar el mensaje:", error.message);
        res.sendStatus(500);
    }
});

// ✅ Función para enviar mensajes de texto
async function sendWhatsAppText(to, text) {
    const data = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: { body: text.trim() },
    };

    await sendWhatsAppRequest(data, to);
}

// ✅ Función genérica para hacer solicitudes a WhatsApp API
async function sendWhatsAppRequest(data, to) {
    try {
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
    } catch (error) {
        console.error("❌ Error al enviar mensaje:", error.response?.data || error.message);
    }
}

// ✅ Iniciar el servidor
app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
