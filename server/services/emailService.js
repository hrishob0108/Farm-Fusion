import axios from 'axios';
import nodemailer from 'nodemailer';
import { Registration } from '../models/Registration.js';

// Initialize Nodemailer fallback transporter with Gmail SMTP
const createSmtpTransporter = () => {
  const mailId = process.env.MAIL_ID || 'codingblocks@klu.ac.in';
  const rawPass = process.env.APP_PASSWORD || '';
  const cleanPass = rawPass.replace(/\s+/g, '');

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: mailId,
      pass: cleanPass
    }
  });
};

/**
 * Sends a single email trying AWS_URL first, falling back to Nodemailer SMTP
 */
export const sendEmail = async ({ to, subject, html, text }) => {
  const awsUrl = process.env.AWS_URL;
  const mailId = process.env.MAIL_ID || 'codingblocks@klu.ac.in';
  const appPassword = process.env.APP_PASSWORD || '';
  const recipients = Array.isArray(to) ? to.join(', ') : to;

  let awsSuccess = false;

  // 1. Try sending via AWS_URL API Endpoint
  if (awsUrl) {
    try {
      console.log(`[EmailService] Attempting to send via AWS_URL to: ${recipients}`);
      
      const payload = {
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text: text || 'FarmFusion Notification',
        mail_id: mailId,
        app_password: appPassword,
        email: mailId,
        user: mailId,
        pass: appPassword.replace(/\s+/g, '')
      };

      const response = await axios.post(awsUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      if (response.status >= 200 && response.status < 300 && !response.data?.error) {
        console.log(`[EmailService] ✅ Email sent successfully via AWS_URL to ${recipients}`);
        awsSuccess = true;
        return { success: true, provider: 'AWS_URL', data: response.data };
      } else {
        console.warn(`[EmailService] ⚠️ AWS_URL response non-ok:`, response.data);
      }
    } catch (awsErr) {
      console.warn(`[EmailService] ⚠️ AWS_URL error (${awsErr.message}). Switching to Nodemailer SMTP fallback...`);
    }
  }

  // 2. Fallback to Nodemailer SMTP
  try {
    console.log(`[EmailService] Attempting to send via Nodemailer SMTP to: ${recipients}`);
    const transporter = createSmtpTransporter();
    
    const mailOptions = {
      from: `"FarmFusion AI Team" <${mailId}>`,
      to: recipients,
      subject,
      html,
      text: text || 'FarmFusion Registration Verification Notification'
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] ✅ Email sent successfully via Nodemailer SMTP to ${recipients} (MessageId: ${info.messageId})`);
    return { success: true, provider: 'SMTP', messageId: info.messageId };
  } catch (smtpErr) {
    console.error(`[EmailService] ❌ SMTP Error sending email to ${recipients}:`, smtpErr.message);
    return { success: false, error: smtpErr.message };
  }
};

/**
 * Builds clean HTML template for Verification Confirmation
 */
const buildVerificationEmailHtml = (registration) => {
  const { teamName, leader, members = [], transactionId } = registration;

  const teamList = [leader, ...members];
  const membersRows = teamList.map((m, idx) => `
    <tr style="border-bottom: 1px solid #2d3748;">
      <td style="padding: 10px 14px; font-weight: 600; color: #10b981;">${idx === 0 ? '👑 Leader' : `Member ${idx + 1}`}</td>
      <td style="padding: 10px 14px; color: #e2e8f0;">${m.name}</td>
      <td style="padding: 10px 14px; color: #a0aec0; font-family: monospace;">${m.regNo}</td>
      <td style="padding: 10px 14px; color: #a0aec0;">${m.branch || 'N/A'} / ${m.section || 'N/A'}</td>
      <td style="padding: 10px 14px; color: #a0aec0;">${m.residenceType || 'N/A'}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Registration Verified - FarmFusion</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 40px 10px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" style="max-width: 650px; background-color: #1e293b; border-radius: 16px; overflow: hidden; border: 1px solid #334155; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
              
              <!-- Header Banner -->
              <tr>
                <td style="background: linear-gradient(135deg, #059669 0%, #10b981 50%, #047857 100%); padding: 32px 24px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">🌱 FarmFusion AI</h1>
                  <p style="margin: 6px 0 0 0; color: #d1fae5; font-size: 16px; font-weight: 500;">National Level Smart Agriculture Hackathon</p>
                </td>
              </tr>

              <!-- Status Badge & Greeting -->
              <tr>
                <td style="padding: 32px 32px 16px 32px; text-align: center;">
                  <div style="display: inline-block; background-color: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; border-radius: 9999px; padding: 8px 20px; margin-bottom: 16px;">
                    <span style="color: #34d399; font-weight: 700; font-size: 15px; text-transform: uppercase; letter-spacing: 1px;">✅ Registration Verified & Approved</span>
                  </div>
                  <h2 style="margin: 12px 0 8px 0; color: #f8fafc; font-size: 24px; font-weight: 700;">Congratulations, Team "${teamName}"!</h2>
                  <p style="margin: 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
                    Your payment and registration details have been verified by the FarmFusion administration team. You are officially confirmed for the hackathon!
                  </p>
                </td>
              </tr>

              <!-- Details Card -->
              <tr>
                <td style="padding: 16px 32px;">
                  <div style="background-color: #0f172a; border-radius: 12px; padding: 20px; border: 1px solid #334155;">
                    <table role="presentation" width="100%" style="font-size: 14px;">
                      <tr>
                        <td style="padding: 6px 0; color: #94a3b8;">Team Name:</td>
                        <td style="padding: 6px 0; color: #f8fafc; font-weight: 700; text-align: right;">${teamName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #94a3b8;">Team Leader:</td>
                        <td style="padding: 6px 0; color: #f8fafc; font-weight: 600; text-align: right;">${leader.name} (${leader.regNo})</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #94a3b8;">Transaction ID:</td>
                        <td style="padding: 6px 0; color: #34d399; font-family: monospace; font-weight: 700; text-align: right;">${transactionId}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #94a3b8;">Status:</td>
                        <td style="padding: 6px 0; color: #10b981; font-weight: 700; text-align: right;">VERIFIED & CONFIRMED</td>
                      </tr>
                    </table>
                  </div>
                </td>
              </tr>

              <!-- Team Mates Table -->
              <tr>
                <td style="padding: 16px 32px;">
                  <h3 style="margin: 0 0 12px 0; color: #f8fafc; font-size: 17px; font-weight: 700;">👥 Registered Team Mates</h3>
                  <div style="overflow-x: auto; background-color: #0f172a; border-radius: 12px; border: 1px solid #334155;">
                    <table width="100%" cellspacing="0" cellpadding="0" style="font-size: 13px; text-align: left; border-collapse: collapse;">
                      <thead>
                        <tr style="background-color: #1e293b; border-bottom: 1px solid #334155;">
                          <th style="padding: 10px 14px; color: #94a3b8;">Role</th>
                          <th style="padding: 10px 14px; color: #94a3b8;">Name</th>
                          <th style="padding: 10px 14px; color: #94a3b8;">Reg No</th>
                          <th style="padding: 10px 14px; color: #94a3b8;">Branch/Sec</th>
                          <th style="padding: 10px 14px; color: #94a3b8;">Residence</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${membersRows}
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>

              <!-- Event Instructions -->
              <tr>
                <td style="padding: 16px 32px 32px 32px;">
                  <div style="background-color: rgba(59, 130, 246, 0.1); border-left: 4px solid #3b82f6; border-radius: 6px; padding: 16px;">
                    <h4 style="margin: 0 0 6px 0; color: #60a5fa; font-size: 15px; font-weight: 700;">📌 Important Instructions:</h4>
                    <ul style="margin: 0; padding-left: 20px; color: #cbd5e1; font-size: 13px; line-height: 1.6;">
                      <li>Keep your Registration Number and Student ID card handy during venue check-in.</li>
                      <li>Bring your laptops, chargers, and development hardware.</li>
                      <li>Check the official FarmFusion portal for schedule updates and track details.</li>
                    </ul>
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #0f172a; padding: 24px 32px; text-align: center; border-top: 1px solid #334155; color: #64748b; font-size: 13px;">
                  <p style="margin: 0 0 6px 0; font-weight: 600; color: #94a3b8;">Coding Blocks KL Student Chapter & FarmFusion Organizers</p>
                  <p style="margin: 0; font-size: 12px;">Need help? Contact us at <a href="mailto:codingblocks@klu.ac.in" style="color: #10b981; text-decoration: none;">codingblocks@klu.ac.in</a></p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

/**
 * Builds clean HTML template for Rejection / Resubmit Notification
 */
const buildStatusNotificationHtml = (registration, status, reason) => {
  const { teamName, leader, transactionId } = registration;
  const isResubmit = status === 'Resubmit Requested';
  const titleText = isResubmit ? 'Payment Resubmission Required' : 'Registration Status Update';

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: sans-serif; color: #f8fafc;">
      <table role="presentation" width="100%" style="background-color: #0f172a; padding: 40px 10px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" style="max-width: 600px; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 32px;">
              <h2 style="color: #ef4444; margin-top: 0;">🌱 FarmFusion AI - ${titleText}</h2>
              <p style="color: #cbd5e1;">Dear <strong>${leader.name}</strong> & Team <strong>"${teamName}"</strong>,</p>
              <p style="color: #cbd5e1;">Your registration status for FarmFusion has been updated to: <strong style="color: #f87171;">${status}</strong>.</p>
              
              <div style="background-color: #0f172a; border-left: 4px solid #ef4444; padding: 16px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #f8fafc; font-size: 14px;"><strong>Reason / Action Required:</strong></p>
                <p style="margin: 6px 0 0 0; color: #cbd5e1; font-size: 14px;">${reason || 'Please check your transaction ID and re-upload a clear payment screenshot on the website portal.'}</p>
              </div>

              <p style="color: #94a3b8; font-size: 13px;">Transaction ID: <span style="font-family: monospace;">${transactionId}</span></p>
              <p style="color: #94a3b8; font-size: 13px;">If you have any questions, please contact <a href="mailto:codingblocks@klu.ac.in" style="color: #10b981;">codingblocks@klu.ac.in</a>.</p>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

/**
 * Sends verification email to Team Leader AND all Team Members
 */
export const sendTeamVerificationEmail = async (registrationId) => {
  try {
    const registration = typeof registrationId === 'object' && registrationId._id
      ? registrationId
      : await Registration.findById(registrationId);

    if (!registration) {
      console.error(`[EmailService] Registration not found for ID: ${registrationId}`);
      return { success: false, error: 'Registration record not found' };
    }

    const recipients = [];

    // Collect leader email
    if (registration.leader) {
      const leaderEmail = registration.leader.email || (registration.leader.regNo ? `${registration.leader.regNo.trim()}@klu.ac.in` : null);
      if (leaderEmail) recipients.push(leaderEmail.trim().toLowerCase());
    }

    // Collect team members emails
    if (Array.isArray(registration.members)) {
      registration.members.forEach(m => {
        const memberEmail = m.email || (m.regNo ? `${m.regNo.trim()}@klu.ac.in` : null);
        if (memberEmail) recipients.push(memberEmail.trim().toLowerCase());
      });
    }

    // Deduplicate emails
    const uniqueRecipients = [...new Set(recipients)];

    if (uniqueRecipients.length === 0) {
      console.warn(`[EmailService] No valid recipient emails found for team: ${registration.teamName}`);
      return { success: false, error: 'No valid recipient email addresses found' };
    }

    console.log(`[EmailService] Dispatched verification email to Team "${registration.teamName}" (${uniqueRecipients.length} recipients: ${uniqueRecipients.join(', ')})`);

    const subject = `🎉 Registration Verified - Welcome Team ${registration.teamName} to FarmFusion AI Hackathon!`;
    const html = buildVerificationEmailHtml(registration);

    const sendResult = await sendEmail({
      to: uniqueRecipients,
      subject,
      html,
      text: `Congratulations Team ${registration.teamName}! Your registration for FarmFusion AI Hackathon is verified and confirmed.`
    });

    if (sendResult.success) {
      // Update registration document in MongoDB
      await Registration.findByIdAndUpdate(registration._id, {
        emailSent: true,
        emailSentAt: new Date()
      });
    }

    return sendResult;
  } catch (error) {
    console.error(`[EmailService] Error in sendTeamVerificationEmail:`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Sends generic status update email (Verified, Rejected, Resubmit)
 */
export const sendPaymentStatusEmail = async (registrationRecord, status, reason = '') => {
  if (status === 'Verified') {
    return await sendTeamVerificationEmail(registrationRecord);
  }

  try {
    const registration = registrationRecord;
    const recipients = [];

    if (registration.leader) {
      const leaderEmail = registration.leader.email || (registration.leader.regNo ? `${registration.leader.regNo.trim()}@klu.ac.in` : null);
      if (leaderEmail) recipients.push(leaderEmail.trim().toLowerCase());
    }

    if (Array.isArray(registration.members)) {
      registration.members.forEach(m => {
        const memberEmail = m.email || (m.regNo ? `${m.regNo.trim()}@klu.ac.in` : null);
        if (memberEmail) recipients.push(memberEmail.trim().toLowerCase());
      });
    }

    const uniqueRecipients = [...new Set(recipients)];
    if (uniqueRecipients.length === 0) return { success: false, error: 'No recipients' };

    const subject = `⚠️ FarmFusion Registration Status Update: ${status} - Team ${registration.teamName}`;
    const html = buildStatusNotificationHtml(registration, status, reason);

    return await sendEmail({
      to: uniqueRecipients,
      subject,
      html,
      text: `Status update for Team ${registration.teamName}: ${status}. ${reason}`
    });
  } catch (err) {
    console.error(`[EmailService] Error sending status email:`, err.message);
    return { success: false, error: err.message };
  }
};
