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

            if (message.type === "text") {
                // 📩 Si el mensaje es texto normal
                const messageText = message.text.body.trim();
                console.log(`📩 Mensaje recibido de ${phoneNumber}: ${messageText}`);

                await sendWhatsAppButtons(phoneNumber, "¿Te gustaría recibir más información o automatizar procesos?");
            } else if (message.type === "interactive" && message.interactive.type === "button_reply") {
                // 🎯 Si el usuario presionó un botón
                const selectedOption = message.interactive.button_reply.id;
                console.log(`✅ Opción seleccionada por ${phoneNumber}: ${selectedOption}`);

                if (selectedOption === "option_1") {
                    await sendWhatsAppText(phoneNumber, "🚀 Genial, podemos ayudarte a automatizar procesos. ¿En qué área trabajas?");
                } else if (selectedOption === "option_2") {
                    await sendWhatsAppText(phoneNumber, "ℹ️ ¡Claro! Te cuento más sobre nuestras soluciones de automatización.");
                }
            }
        }

        res.sendStatus(200);
    } catch (error) {
        console.error("❌ Error al procesar el mensaje:", error.message);
        res.sendStatus(500);
    }
});

// ✅ Función para enviar mensajes de texto (Soluciona el problema en WhatsApp Web)
async function sendWhatsAppText(to, text) {
    const cleanText = text.trim();
    const data = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: { body: cleanText },
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
        console.log(`✅ Mensaje enviado a ${to}: ${cleanText}`);
    } catch (error) {
        console.error("❌ Error al enviar mensaje:", error.response?.data || error.message);
    }
}

// ✅ Función para enviar botones interactivos
async function sendWhatsAppButtons(to, text) {
    const data = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "interactive",
        interactive: {
            type: "button",
            body: { text: text.trim() },
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
        console.log(`✅ Botones enviados a ${to}`);
    } catch (error) {
        console.error("❌ Error al enviar botones:", error.response?.data || error.message);
    }
}

// ✅ Iniciar el servidor
app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
