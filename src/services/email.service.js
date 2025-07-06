const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD
  }
});

exports.enviarVerificacion = async (destino, token) => {
  const link = `http://localhost:3001/verificar/${token}`;
  const mailOptions = {
    from: `"DigitalMatch" <${process.env.SMTP_EMAIL}>`,
    to: destino,
    subject: 'Verificá tu cuenta',
    html: `
      <p>¡Gracias por registrarte!</p>
      <p>Para verificar tu cuenta, hacé clic en el siguiente enlace:</p>
      <a href="${link}">${link}</a>
      <p>Si no solicitaste este registro, ignorá este mensaje.</p>
    `
  };

  await transporter.sendMail(mailOptions);
};
