# 🤖 WhatsApp Bot con Node.js, MongoDB, Google Sheets y Render

Este bot permite gestionar conversaciones de WhatsApp usando la **API de WhatsApp Cloud**, almacena datos en **MongoDB Atlas**, registra interacciones en **Google Sheets**, y está listo para ser desplegado en **Render**.

---

## 🧱 Estructura del Proyecto

```
/src
├── controllers/         # Lógica de endpoints
├── routes/              # Rutas Express
├── models/              # Esquemas de Mongoose
├── services/            # Lógica de negocio (Mongo, Sheets, WhatsApp)
├── middlewares/         # Autenticación, logs
├── helpers/             # Constantes globales
└── index.js             # Entrypoint
```

---

## 🚀 Cómo desplegar en Render

### 1. Subir repositorio a GitHub

Asegúrate de tener todos los archivos (incluido `.env.example`) subidos a un repositorio GitHub.

### 2. Crear servicio en Render
- Ve a [https://dashboard.render.com](https://dashboard.render.com)
- Crea un nuevo servicio **Web Service**
- Conecta con tu repositorio
- En configuración:
  - **Environment**: `Node`
  - **Build Command**: *(dejar vacío si no compila)*
  - **Start Command**: `node src/index.js`

### 3. Variables de entorno
Agrega todas las variables necesarias desde `.env`:


### 4. Archivo de credenciales de Google
- Render no permite archivos secretos directamente.
- Puedes hacer lo siguiente:
  - Codifica el JSON con `base64`
  - Luego en `index.js`, decodifica antes de iniciar:

```js
fs.writeFileSync("credentials.json", Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, "base64"));
```

- Y cambia la env var a:

```env
GOOGLE_CREDENTIALS_BASE64=eyJ0eXAiOiJK...  <-- base64
```

---

## 📲 Webhooks

### Verificación:
- GET `/webhook?hub.verify_token=...`

### Recepción:
- POST `/webhook` desde Facebook Cloud API

---

## 🔐 Endpoints Protegidos

Requieren cabecera `x-api-key`:

### GET `/consultas?page=1&limit=10`

### DELETE `/consultas/limpiar?dias=30`


## 📄 Licencia
MIT - DigitalMatchGlobal

---

## 👨‍💻 Autor
**@DigitalMatch** · [digitalmatchglobal.com](https://digitalmatchglobal.com)

