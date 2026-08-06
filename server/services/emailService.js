import axios from 'axios';
import nodemailer from 'nodemailer';
import { Registration } from '../models/Registration.js';
import { Event } from '../models/Event.js';

// Cloudinary Hosted Logo CDN URLs
const CB_LOGO_URL = 'https://res.cloudinary.com/dsejnvcqs/image/upload/v1786004590/FarmFusion/assets/cb-logo.png';
const FARM_FUSION_LOGO_URL = 'https://res.cloudinary.com/dsejnvcqs/image/upload/v1786004592/FarmFusion/assets/farm-fusion-logo.png';

// Official WhatsApp Channel Links
const OFFICIAL_WHATSAPP_GROUP = 'https://chat.whatsapp.com/H28cGJd5EMn3FbZ3sjf4bc';
const OFFICIAL_WHATSAPP_COMMUNITY = 'https://chat.whatsapp.com/H28cGJd5EMn3FbZ3sjf4bc';

// Strict Email Address Validation Regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sanitizeEmail = (emailStr, regNoStr) => {
  if (emailStr && typeof emailStr === 'string') {
    const trimmed = emailStr.trim().toLowerCase();
    if (EMAIL_REGEX.test(trimmed)) return trimmed;
  }
  if (regNoStr && typeof regNoStr === 'string') {
    const cleanReg = regNoStr.trim().toLowerCase();
    if (cleanReg) {
      const formatted = `${cleanReg}@klu.ac.in`;
      if (EMAIL_REGEX.test(formatted)) return formatted;
    }
  }
  return null;
};

// Clean Inline SVG Icons for Email Templates
const SVG_ICONS = {
  check: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#34D399" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px; display: inline-block;"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  chat: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F3A24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px; display: inline-block;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>`,
  groupButton: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#FFFFFF" style="vertical-align: middle; margin-right: 8px; display: inline-block;"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"></path></svg>`,
  communityButton: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FAF7F2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px; display: inline-block;"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10z"></path></svg>`,
  leaderBadge: `<svg width="14" height="14" viewBox="0 0 24 24" fill="#D4A373" stroke="#0F3A24" stroke-width="1.5" style="vertical-align: middle; margin-right: 4px; display: inline-block;"><path d="M2 4l3 12h14l3-12-6 7-4-8-4 8-6-7z"></path></svg>`,
  users: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F3A24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px; display: inline-block;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
  pin: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F3A24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px; display: inline-block;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
  sprout: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#800E13" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px; display: inline-block;"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"></path><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"></path></svg>`
};

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

  // Clean and validate recipient list
  const recipientArray = (Array.isArray(to) ? to : [to])
    .map(e => (typeof e === 'string' ? e.trim().toLowerCase() : ''))
    .filter(e => EMAIL_REGEX.test(e));

  if (recipientArray.length === 0) {
    console.error(`[EmailService] Invalid recipient email list passed to sendEmail:`, to);
    return { success: false, error: 'No valid recipient email address specified' };
  }

  const recipientsStr = recipientArray.join(', ');
  const senderName = "Coding Blocks";
  const fromAddress = `"${senderName}" <${mailId}>`;

  let awsSuccess = false;

  // 1. Try sending via AWS_URL API Endpoint
  if (awsUrl) {
    try {
      console.log(`[EmailService] Attempting to send via AWS_URL to: ${recipientsStr}`);
      
      const senderConfig = {
        email: mailId,
        pass: appPassword,
        name: senderName,
        sender: senderName,
        from: fromAddress
      };

      const payload = {
        config: senderConfig,
        fromName: senderName,
        senderName: senderName,
        name: senderName,
        sender: senderName,
        from: fromAddress,
        to: recipientsStr,
        subject,
        text: text || 'FarmFusion Registration Notification',
        html
      };

      const response = await axios.post(awsUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 12000
      });

      if (response.status >= 200 && response.status < 300 && !response.data?.error) {
        console.log(`[EmailService] ✅ Email sent successfully via AWS_URL to ${recipientsStr}:`, response.data);
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
    console.log(`[EmailService] Attempting to send via Nodemailer SMTP to: ${recipientsStr}`);
    const transporter = createSmtpTransporter();
    
    const mailOptions = {
      from: fromAddress,
      to: recipientsStr,
      subject,
      html,
      text: text || 'FarmFusion Registration Notification',
      headers: {
        'X-Mailer': 'Coding Blocks Mailer v2.0',
        'Auto-Submitted': 'auto-generated'
      }
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] Email sent successfully via Nodemailer SMTP to ${recipientsStr} (MessageId: ${info.messageId})`);
    return { success: true, provider: 'SMTP', messageId: info.messageId };
  } catch (smtpErr) {
    console.error(`[EmailService] SMTP Error sending email to ${recipientsStr}:`, smtpErr.message);
    return { success: false, error: smtpErr.message };
  }
};

/**
 * Builds clean HTML template for Verification Confirmation with Calm Neutral Informational Tone
 */
export const buildVerificationEmailHtml = (registration, event) => {
  const { teamName, leader, members = [], transactionId } = registration;

  const groupLink = event?.whatsapp?.discussion || event?.whatsapp?.group || OFFICIAL_WHATSAPP_GROUP;
  const communityLink = event?.whatsapp?.group || OFFICIAL_WHATSAPP_COMMUNITY;

  const teamList = [leader, ...members];
  const membersRows = teamList.map((m, idx) => `
    <tr style="border-bottom: 1px solid #E6DFD5; background-color: ${idx % 2 === 0 ? '#FFFFFF' : '#FAF7F2'};">
      <td style="padding: 12px 16px; font-weight: 800; color: #0F3A24;">${idx === 0 ? `${SVG_ICONS.leaderBadge} Leader` : `Member ${idx + 1}`}</td>
      <td style="padding: 12px 16px; color: #0F3A24; font-weight: 700;">${m.name}</td>
      <td style="padding: 12px 16px; color: #7A4F23; font-family: monospace; font-weight: 700;">${m.regNo}</td>
      <td style="padding: 12px 16px; color: #475569;">${m.branch || 'N/A'} / ${m.section || 'N/A'}</td>
      <td style="padding: 12px 16px; color: #475569; font-weight: 600;">${m.residenceType || 'N/A'}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light">
      <meta name="supported-color-schemes" content="light">
      <title>Hackathon Update: Team ${teamName} Confirmation Details</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #FAF7F2; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F3A24; -webkit-text-size-adjust: 100%;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #FAF7F2; padding: 35px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 650px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; border: 1px solid #E6DFD5; box-shadow: 0 12px 35px rgba(15, 58, 36, 0.08);">
              
              <!-- Brand Header Banner with White Background & Black Circle for CB Logo -->
              <tr>
                <td style="background-color: #FFFFFF; padding: 24px 28px; text-align: center; border-bottom: 3px solid #E6DFD5;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td align="center">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                          <tr>
                            <!-- CB Logo with Black Round Circle Container -->
                            <td style="vertical-align: middle;">
                              <div style="display: inline-block; width: 48px; height: 48px; background-color: #000000; border-radius: 50%; overflow: hidden; text-align: center; border: 1px solid #000000;">
                                <img src="${CB_LOGO_URL}" alt="Coding Blocks Logo" width="48" height="48" style="width: 100%; height: 100%; object-fit: contain; display: block; border-radius: 50%;" />
                              </div>
                            </td>
                            <!-- Gold / Sand Vertical Divider -->
                            <td style="vertical-align: middle; padding: 0 16px;">
                              <div style="height: 34px; width: 2px; background-color: #D9CEBE;"></div>
                            </td>
                            <!-- Farm Fusion Logo (Natural Rectangular Shape) -->
                            <td style="vertical-align: middle;">
                              <img src="${FARM_FUSION_LOGO_URL}" alt="FarmFusion Logo" height="54" style="height: 54px; width: auto; display: block; border-radius: 0;" />
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Greeting & Calm Informational Text -->
              <tr>
                <td style="padding: 32px 32px 16px 32px; text-align: center;">
                  <div style="display: inline-block; background-color: #0F3A24; border: 1px solid #D4A373; border-radius: 9999px; padding: 8px 24px; margin-bottom: 16px; box-shadow: 0 4px 12px rgba(15, 58, 36, 0.15);">
                    <span style="color: #34D399; font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">${SVG_ICONS.check} Check-in Confirmation Verified</span>
                  </div>
                  <h2 style="margin: 12px 0 8px 0; color: #0F3A24; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Hello Team "${teamName}",</h2>
                  <p style="margin: 0; color: #475569; font-size: 15px; line-height: 1.6;">
                    Thank you for registering for the upcoming Coding Blocks KARE Student Chapter Hackathon FarmFusion. This email serves as your check-in confirmation.
                  </p>
                </td>
              </tr>

              <!-- Event Details Card -->
              <tr>
                <td style="padding: 16px 32px;">
                  <div style="background-color: #F4EFE6; border-radius: 14px; padding: 22px; border: 1px solid #D9CEBE;">
                    <h3 style="margin: 0 0 12px 0; color: #0F3A24; font-size: 16px; font-weight: 800;">Event Details:</h3>
                    <table role="presentation" width="100%" border="0" style="font-size: 14px;">
                      <tr>
                        <td style="padding: 6px 0; color: #7A4F23; font-weight: 700;">Team:</td>
                        <td style="padding: 6px 0; color: #0F3A24; font-weight: 800; text-align: right; font-size: 15px;">${teamName} (Leader: ${leader.name})</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #7A4F23; font-weight: 700;">Reference Number:</td>
                        <td style="padding: 6px 0; color: #0F3A24; font-family: monospace; font-weight: 800; text-align: right;">${transactionId}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #7A4F23; font-weight: 700;">Status:</td>
                        <td style="padding: 6px 0; color: #059669; font-weight: 800; text-align: right;">CONFIRMED</td>
                      </tr>
                    </table>
                  </div>
                </td>
              </tr>

              <!-- WhatsApp Community & Group CTA Buttons -->
              <tr>
                <td style="padding: 16px 32px; text-align: center;">
                  <div style="background-color: #FAF7F2; border: 2px solid #D4A373; border-radius: 16px; padding: 24px 20px; box-shadow: 0 4px 15px rgba(212, 163, 115, 0.15);">
                    <h3 style="margin: 0 0 6px 0; color: #0F3A24; font-size: 18px; font-weight: 900;">${SVG_ICONS.chat} Student Community Links</h3>
                    <p style="margin: 0 0 20px 0; color: #7A4F23; font-size: 13px; font-weight: 600; line-height: 1.5;">
                      To stay updated on room allocations, you can find the student community links on our official website or access them via the university student portal.
                    </p>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td align="center" style="padding: 6px 0;">
                          <a href="${groupLink}" target="_blank" style="display: inline-block; width: 85%; max-width: 320px; background-color: #25D366; color: #ffffff; text-decoration: none; font-weight: 800; font-size: 14px; padding: 14px 22px; border-radius: 12px; box-shadow: 0 4px 14px rgba(37, 211, 102, 0.35); text-align: center;">
                            ${SVG_ICONS.groupButton} Join WhatsApp Group
                          </a>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding: 6px 0;">
                          <a href="${communityLink}" target="_blank" style="display: inline-block; width: 85%; max-width: 320px; background-color: #0F3A24; color: #FAF7F2; text-decoration: none; font-weight: 800; font-size: 13px; padding: 12px 22px; border-radius: 12px; border: 1.5px solid #D4A373; text-align: center;">
                            ${SVG_ICONS.communityButton} Join WhatsApp Community
                          </a>
                        </td>
                      </tr>
                    </table>
                  </div>
                </td>
              </tr>

              <!-- Team Mates Table -->
              <tr>
                <td style="padding: 16px 32px;">
                  <h3 style="margin: 0 0 8px 0; color: #0F3A24; font-size: 17px; font-weight: 800;">${SVG_ICONS.users} Registered Teammates</h3>
                  <p style="margin: 0 0 14px 0; color: #475569; font-size: 13px; line-height: 1.5;">
                    Please review your listed teammates below to ensure spelling is correct for certificates.
                  </p>
                  <div style="overflow-x: auto; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E6DFD5;">
                    <table width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 13px; text-align: left; border-collapse: collapse;">
                      <thead>
                        <tr style="background-color: #0F3A24; color: #FFFFFF;">
                          <th style="padding: 12px 16px; color: #FFFFFF; font-weight: 800;">Role</th>
                          <th style="padding: 12px 16px; color: #FFFFFF; font-weight: 800;">Name</th>
                          <th style="padding: 12px 16px; color: #FFFFFF; font-weight: 800;">Reg No</th>
                          <th style="padding: 12px 16px; color: #FFFFFF; font-weight: 800;">Branch/Sec</th>
                          <th style="padding: 12px 16px; color: #FFFFFF; font-weight: 800;">Residence</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${membersRows}
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>

              <!-- Check-in Requirements -->
              <tr>
                <td style="padding: 16px 32px 32px 32px;">
                  <div style="background-color: #FAF7F2; border-left: 4px solid #0F3A24; border-radius: 8px; padding: 18px; border-top: 1px solid #E6DFD5; border-right: 1px solid #E6DFD5; border-bottom: 1px solid #E6DFD5;">
                    <h4 style="margin: 0 0 8px 0; color: #0F3A24; font-size: 15px; font-weight: 800;">${SVG_ICONS.pin} Check-in Requirements:</h4>
                    <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 13px; line-height: 1.6; font-weight: 500;">
                      <li>Please bring your student ID card, laptops, and chargers to the venue.</li>
                      <li>Maintain a proper, formal dress code throughout the event.</li>
                      <li>If you have any questions, reach out to the student chapter organizing team at <a href="mailto:codingblocks@klu.ac.in" style="color: #0F3A24; font-weight: 700;">codingblocks@klu.ac.in</a>.</li>
                    </ul>
                  </div>
                </td>
              </tr>

              <!-- Institutional Compliance Footer -->
              <tr>
                <td style="background-color: #0F3A24; padding: 32px 28px; text-align: center; border-top: 3px solid #D4A373; color: #FAF7F2;">
                  <p style="margin: 0 0 6px 0; font-weight: 800; color: #FFFFFF; font-size: 14px;">Coding Blocks KARE Student Chapter & FarmFusion Organizers</p>
                  <p style="margin: 0 0 12px 0; font-size: 12px; color: #D4A373;">Kalasalingam Academy of Research and Education, Anand Nagar, Krishnankoil, Tamil Nadu 626126</p>
                  <p style="margin: 0 0 12px 0; font-size: 11px; color: #94A3B8; line-height: 1.5;">You are receiving this automated transactional email because your team registered for the FarmFusion Hackathon. Contact: <a href="mailto:codingblocks@klu.ac.in" style="color: #34D399; font-weight: 700; text-decoration: underline;">codingblocks@klu.ac.in</a>.</p>
                  <p style="margin: 0; font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 1px;">Official Transactional Communication</p>
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
 * Builds clean HTML template for Rejection / Resubmit Notification with FarmFusion Theme & Logos
 */
const buildStatusNotificationHtml = (registration, status, reason, event) => {
  const { teamName, leader, transactionId } = registration;
  const isResubmit = status === 'Resubmit Requested';
  const titleText = isResubmit ? 'Resubmission Request' : 'Registration Update';

  const groupLink = event?.whatsapp?.discussion || event?.whatsapp?.group || OFFICIAL_WHATSAPP_GROUP;
  const communityLink = event?.whatsapp?.group || OFFICIAL_WHATSAPP_COMMUNITY;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light">
      <title>FarmFusion Registration Status Update</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #FAF7F2; font-family: sans-serif; color: #0F3A24;">
      <table role="presentation" width="100%" border="0" style="background-color: #FAF7F2; padding: 35px 10px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" border="0" style="max-width: 600px; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E6DFD5; padding: 0; overflow: hidden;">
              
              <!-- Banner Header with White Background & Black Circle for CB Logo -->
              <div style="background-color: #FFFFFF; padding: 20px; text-align: center; border-bottom: 3px solid #E6DFD5;">
                <table role="presentation" align="center" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="vertical-align: middle;">
                      <div style="display: inline-block; width: 44px; height: 44px; background-color: #000000; border-radius: 50%; overflow: hidden; text-align: center; border: 1px solid #000000;">
                        <img src="${CB_LOGO_URL}" alt="CB Logo" width="44" height="44" style="width: 100%; height: 100%; object-fit: contain; display: block; border-radius: 50%;" />
                      </div>
                    </td>
                    <td style="padding: 0 14px;"><div style="height: 30px; width: 2px; background-color: #D9CEBE;"></div></td>
                    <td style="vertical-align: middle;">
                      <img src="${FARM_FUSION_LOGO_URL}" alt="FarmFusion Logo" height="48" style="height: 48px; width: auto; display: block; border-radius: 0;" />
                    </td>
                  </tr>
                </table>
              </div>

              <div style="padding: 32px;">
                <h2 style="color: #800E13; margin-top: 0; font-weight: 800;">${SVG_ICONS.sprout} FarmFusion - ${titleText}</h2>
                <p style="color: #334155;">Hello <strong>${leader.name}</strong> & Team <strong>"${teamName}"</strong>,</p>
                <p style="color: #334155;">Your registration status for FarmFusion has been updated to: <strong style="color: #800E13;">${status}</strong>.</p>
                
                <div style="background-color: #FAF7F2; border-left: 4px solid #800E13; padding: 16px; margin: 20px 0; border-radius: 6px; border-top: 1px solid #E6DFD5; border-right: 1px solid #E6DFD5; border-bottom: 1px solid #E6DFD5;">
                  <p style="margin: 0; color: #800E13; font-size: 14px; font-weight: 800;">Action Required:</p>
                  <p style="margin: 6px 0 0 0; color: #334155; font-size: 14px; font-weight: 600;">${reason || 'Please check your transaction details and re-upload a clear screenshot on the website portal.'}</p>
                </div>

                <div style="text-align: center; margin: 24px 0;">
                  <a href="${groupLink}" target="_blank" style="display: inline-block; background-color: #25D366; color: #ffffff; text-decoration: none; font-weight: 800; font-size: 13px; padding: 11px 20px; border-radius: 10px; margin: 4px;">
                    ${SVG_ICONS.groupButton} Join WhatsApp Group
                  </a>
                  <a href="${communityLink}" target="_blank" style="display: inline-block; background-color: #0F3A24; color: #FAF7F2; text-decoration: none; font-weight: 800; font-size: 13px; padding: 11px 20px; border-radius: 10px; border: 1.5px solid #D4A373; margin: 4px;">
                    ${SVG_ICONS.communityButton} Join WhatsApp Community
                  </a>
                </div>

                <p style="color: #64748B; font-size: 13px;">Reference Number: <span style="font-family: monospace; font-weight: 700; color: #0F3A24;">${transactionId}</span></p>
                <p style="color: #64748B; font-size: 13px;">If you have any questions, reach out to the organizing team at <a href="mailto:codingblocks@klu.ac.in" style="color: #0F3A24; font-weight: 700;">codingblocks@klu.ac.in</a>.</p>
              </div>

              <!-- Footer -->
              <div style="background-color: #0F3A24; padding: 24px; text-align: center; border-top: 3px solid #D4A373; color: #FAF7F2;">
                <p style="margin: 0 0 4px 0; font-weight: 800; color: #FFFFFF; font-size: 13px;">Coding Blocks KARE Student Chapter & FarmFusion Organizers</p>
                <p style="margin: 0; font-size: 11px; color: #94A3B8;">Kalasalingam Academy of Research and Education, Anand Nagar, Krishnankoil, TN 626126</p>
              </div>

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

    const event = await Event.findOne().lean();

    const rawRecipients = [];

    // Collect leader email
    if (registration.leader) {
      const leaderMail = sanitizeEmail(registration.leader.email, registration.leader.regNo);
      if (leaderMail) rawRecipients.push(leaderMail);
    }

    // Collect team members emails
    if (Array.isArray(registration.members)) {
      registration.members.forEach(m => {
        const memberMail = sanitizeEmail(m.email, m.regNo);
        if (memberMail) rawRecipients.push(memberMail);
      });
    }

    // Deduplicate emails and filter strictly
    const uniqueRecipients = [...new Set(rawRecipients)].filter(e => EMAIL_REGEX.test(e));

    if (uniqueRecipients.length === 0) {
      console.warn(`[EmailService] No valid recipient emails found for team: ${registration.teamName}`);
      return { success: false, error: 'No valid recipient email addresses found' };
    }

    console.log(`[EmailService] Dispatched verification email to Team "${registration.teamName}" (${uniqueRecipients.length} valid recipients: ${uniqueRecipients.join(', ')})`);

    const subject = `Hackathon Update: Team ${registration.teamName} Confirmation Details`;
    const html = buildVerificationEmailHtml(registration, event);

    const groupLink = event?.whatsapp?.discussion || event?.whatsapp?.group || OFFICIAL_WHATSAPP_GROUP;
    const communityLink = event?.whatsapp?.group || OFFICIAL_WHATSAPP_COMMUNITY;

    const teamList = [registration.leader, ...(registration.members || [])].filter(Boolean);
    const membersText = teamList.map((m, i) => `${i + 1}. ${m.name} (${m.regNo || 'N/A'})`).join('\n');

    // Structured Calm Neutral Plain Text Fallback
    const text = `Subject: Hackathon Update: Team ${registration.teamName} Confirmation Details

Hello Team ${registration.teamName},

Thank you for registering for the upcoming Coding Blocks KARE Student Chapter Hackathon FarmFusion. This email serves as your check-in confirmation.

Event Details:
Team: ${registration.teamName} (Leader: ${registration.leader?.name || 'N/A'})
Reference Number: ${registration.transactionId}

Please review your listed teammates to ensure spelling is correct for certificates:
${membersText}

To stay updated on room allocations, you can find the student community links on our official website or access them via the university student portal:
- WhatsApp Group: ${groupLink}
- WhatsApp Community: ${communityLink}

Check-in Requirements: Please bring your student ID card, laptops, and chargers to the venue. Maintain a proper, formal dress code throughout the event. If you have any questions, reach out to the student chapter organizing team at codingblocks@klu.ac.in.`;

    const sendResult = await sendEmail({
      to: uniqueRecipients,
      subject,
      html,
      text
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
    const event = await Event.findOne().lean();
    const rawRecipients = [];

    if (registration.leader) {
      const leaderMail = sanitizeEmail(registration.leader.email, registration.leader.regNo);
      if (leaderMail) rawRecipients.push(leaderMail);
    }

    if (Array.isArray(registration.members)) {
      registration.members.forEach(m => {
        const memberMail = sanitizeEmail(m.email, m.regNo);
        if (memberMail) rawRecipients.push(memberMail);
      });
    }

    const uniqueRecipients = [...new Set(rawRecipients)].filter(e => EMAIL_REGEX.test(e));
    if (uniqueRecipients.length === 0) return { success: false, error: 'No recipients' };

    const subject = `Hackathon Update: Team ${registration.teamName} Registration Status`;
    const html = buildStatusNotificationHtml(registration, status, reason, event);
    const text = `Hello Team ${registration.teamName},\n\nYour registration status for FarmFusion Hackathon has been updated to: ${status}.\nDetails: ${reason}.\n\nContact: codingblocks@klu.ac.in`;

    return await sendEmail({
      to: uniqueRecipients,
      subject,
      html,
      text
    });
  } catch (err) {
    console.error(`[EmailService] Error sending status email:`, err.message);
    return { success: false, error: err.message };
  }
};
