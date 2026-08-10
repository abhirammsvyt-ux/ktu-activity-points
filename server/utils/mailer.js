const nodemailer = require('nodemailer');

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port: parseInt(port),
      secure: parseInt(port) === 465,
      auth: { user, pass },
    });
  }

  return null;
}

async function sendOtpEmail(toEmail, otp) {
  const transporter = createTransporter();
  const fromAddress = process.env.SMTP_FROM || 'KTU Activity Points <no-reply@ktu-points.edu>';

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background-color: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid #1e293b;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #a855f7; margin: 0; font-size: 22px;">🎓 KTU Activity Points</h2>
        <p style="color: #94a3b8; font-size: 14px; margin-top: 4px;">Password Reset Verification Code</p>
      </div>

      <div style="background-color: #1e293b; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
        <p style="color: #cbd5e1; font-size: 14px; margin-top: 0;">Your 6-digit verification code (OTP) is:</p>
        <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #38bdf8; margin: 12px 0;">${otp}</div>
        <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">This code is valid for <strong>15 minutes</strong>. Do not share it with anyone.</p>
      </div>

      <p style="color: #64748b; font-size: 12px; text-align: center; margin: 0;">
        If you did not request a password reset, please ignore this email.
      </p>
    </div>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: fromAddress,
        to: toEmail,
        subject: `${otp} is your KTU Activity Points Reset Code`,
        html,
      });
      console.log(`[Mailer] OTP email successfully sent to ${toEmail}`);
      return { sent: true, previewMode: false };
    } catch (err) {
      console.error('[Mailer Error]', err.message);
      return { sent: true, previewMode: true, error: err.message };
    }
  } else {
    console.log(`\n========================================`);
    console.log(`📧 [EMAIL PREVIEW MODE]`);
    console.log(`   To: ${toEmail}`);
    console.log(`   OTP: ${otp}`);
    console.log(`========================================\n`);
    return { sent: true, previewMode: true };
  }
}

module.exports = { sendOtpEmail };
