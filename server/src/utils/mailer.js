let nodemailer = null;

try {
  nodemailer = require("nodemailer");
} catch (error) {
  nodemailer = null;
}

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function hasResendConfig() {
  return Boolean(process.env.RESEND_API_KEY);
}

function createTransporter() {
  if (!nodemailer) {
    throw new Error("Nodemailer is not installed. Run npm --prefix server install.");
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function sendWithResend({ from, to, subject, text, html }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
      html
    })
  });

  if (!response.ok) {
    let message = "Could not send password reset email.";
    try {
      const payload = await response.json();
      message = payload.message || payload.error || message;
    } catch (error) {
      message = `${message} Resend returned ${response.status}.`;
    }
    throw new Error(message);
  }
}

async function sendPasswordResetEmail({ to, name, resetLink }) {
  const from = process.env.RESEND_FROM || process.env.MAIL_FROM || "WiselySplit <no-reply@wiselysplit.local>";
  const subject = "Reset your WiselySplit password";
  const text = [
    `Hi ${name || "there"},`,
    "",
    "Use this link to reset your WiselySplit password. It expires in 15 minutes:",
    resetLink,
    "",
    "If you did not request this, you can ignore this email."
  ].join("\n");
  const html = `
    <p>Hi ${name || "there"},</p>
    <p>Use this link to reset your WiselySplit password. It expires in 15 minutes:</p>
    <p><a href="${resetLink}">Reset password</a></p>
    <p>If you did not request this, you can ignore this email.</p>
  `;

  if (hasResendConfig()) {
    await sendWithResend({ from, to, subject, text, html });
    return;
  }

  if (!hasSmtpConfig()) {
    console.log(`[password-reset] Reset link for ${to}: ${resetLink}`);
    return;
  }

  const transporter = createTransporter();
  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html
  });
}

module.exports = { sendPasswordResetEmail };
