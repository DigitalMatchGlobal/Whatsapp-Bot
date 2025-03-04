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

// ✅ Ruta para verificar el webhook en Meta Developer
app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("✅ Webhook verificado correctamente!");
        return res.status(200).send(challenge);
    } else {
        console.error("❌ Error en la verificación del webhook.");
        return res.sendStatus(403);
    }
});

// ✅ Ruta para recibir mensajes de WhatsApp
app.post("/webhook", async (req, res) => {
    try {
        const body = req.body;

        if (body.object && body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
            const message = body.entry[0].changes[0].value.messages[0];
            const phoneNumber = message.from;
            const messageText = message.text?.body || "";

            console.log(`📩 Mensaje recibido de ${phoneNumber}: ${messageText}`);

            // ✅ Respuesta automática al usuario
            await sendWhatsAppMessage(phoneNumber, "👋 ¡Hola! Soy el bot de DigitalMatchGlobal. ¿En qué puedo ayudarte?");
        }

        res.sendStatus(200);
    } catch (error) {
        console.error("❌ Error al procesar el mensaje:", error.message);
        res.sendStatus(500);
    }
});

// ✅ Función para enviar mensajes de WhatsApp
async function sendWhatsAppMessage(to, text) {
    const data = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "interactive",
        interactive: {
            type: "button",
            body: { text: text },
            action: {
                buttons: [
                    {
                        type: "reply",
                        reply: {
                            id: "option_1",
                            title: "🚀 Automatizar"
                        }
                    },
                    {
                        type: "reply",
                        reply: {
                            id: "option_2",
                            title: "ℹ️ Más info"
                        }
                    }
                ]
            }
        }
    };

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
        console.log(`✅ Mensaje con botones enviado a ${to}`);
    } catch (error) {
        console.error("❌ Error al enviar mensaje con botones:", error.response?.data || error.message);
    }
}


// ✅ Iniciar el servidor
app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
