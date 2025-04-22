const express = require('express');
const { Resend } = require('resend');
const router = express.Router();

const resend = new Resend(process.env.RESEND_API_KEY);

router.post('/send-email', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }
    
    const sanitizeHtml = (str) => {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
    
    const sanitizedName = sanitizeHtml(name);
    const sanitizedEmail = sanitizeHtml(email);
    const sanitizedSubject = sanitizeHtml(subject);
    const sanitizedMessage = sanitizeHtml(message);
    
    // NOTIFICATION EMAIL (to business owner)
    const notificationHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Contact Form Submission</title>
          <style>
            body {
              font-family: 'Helvetica', 'Arial', sans-serif;
              line-height: 1.6;
              color: #333333;
              background-color: #f9f8ff;
              margin: 0;
              padding: 0;
            }
            .email-container {
              max-width: 600px;
              margin: 0 auto;
              background-color: #ffffff;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 4px 20px rgba(123, 104, 238, 0.15);
            }
            .email-header {
              background: linear-gradient(135deg, #7b68ee 0%, #6a5acd 100%);
              color: white;
              padding: 20px;
              text-align: center;
            }
            .email-header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 700;
            }
            .email-body {
              padding: 30px;
            }
            .email-body h2 {
              color: #7b68ee;
              margin-top: 0;
              font-size: 20px;
              border-bottom: 2px solid #ff8c69;
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
            .contact-details {
              background-color: #f5f7fa;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 20px;
            }
            .contact-details p {
              margin: 10px 0;
            }
            .contact-details strong {
              color: #7b68ee;
            }
            .message-content {
              background-color: #f9f8ff;
              padding: 15px;
              border-radius: 8px;
              border-left: 4px solid #7b68ee;
            }
            .email-footer {
              background-color: #f0f0f0;
              padding: 20px;
              text-align: center;
              font-size: 14px;
              color: #666666;
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="email-header">
              <h1>New Contact Form Submission</h1>
            </div>
            <div class="email-body">
              <h2>Someone has sent you a message</h2>
              <div class="contact-details">
                <p><strong>Name:</strong> ${sanitizedName}</p>
                <p><strong>Email:</strong> ${sanitizedEmail}</p>
                <p><strong>Subject:</strong> ${sanitizedSubject}</p>
              </div>
              <h2>Message</h2>
              <div class="message-content">
                <p>${sanitizedMessage.replace(/\n/g, '<br/>')}</p>
              </div>
            </div>
            <div class="email-footer">
              <p>This message was sent from Knights Khayal.</p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    // CONFIRMATION EMAIL (to sender)
    const confirmationHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Thank you for contacting Knights Khayal</title>
          <style>
            body {
              font-family: 'Helvetica', 'Arial', sans-serif;
              line-height: 1.6;
              color: #333333;
              background-color: #f9f8ff;
              margin: 0;
              padding: 0;
            }
            .email-container {
              max-width: 600px;
              margin: 0 auto;
              background-color: #ffffff;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 4px 20px rgba(123, 104, 238, 0.15);
            }
            .email-header {
              background: linear-gradient(135deg, #7b68ee 0%, #6a5acd 100%);
              color: white;
              padding: 30px 20px;
              text-align: center;
            }
            .email-header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 700;
              font-family: 'Georgia', serif;
            }
            .email-header p {
              margin: 10px 0 0;
              font-style: italic;
              opacity: 0.9;
            }
            .email-body {
              padding: 30px;
            }
            .greeting {
              font-size: 18px;
              color: #7b68ee;
              margin-bottom: 20px;
            }
            .message-content {
              background-color: #f9f8ff;
              padding: 20px;
              border-radius: 8px;
              border-left: 4px solid #ff8c69;
              margin: 20px 0;
            }
            .message-content h3 {
              margin-top: 0;
              color: #7b68ee;
            }
            .signature {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eee;
            }
            .signature p {
              margin: 5px 0;
            }
            .social-links {
              margin-top: 20px;
              text-align: center;
            }
            .social-links a {
              display: inline-block;
              margin: 0 10px;
              color: #7b68ee;
              text-decoration: none;
            }
            .email-footer {
              background-color: #f0f0f0;
              padding: 20px;
              text-align: center;
              font-size: 14px;
              color: #666666;
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="email-header">
              <h1>Knights Khayal</h1>
              <p>Dreaming in melody...</p>
            </div>
            <div class="email-body">
              <p class="greeting">Dear ${sanitizedName},</p>
              
              <p>Thank you for reaching out to us! We have received your message and will get back to you as soon as possible.</p>
              
              <div class="message-content">
                <h3>Your Message</h3>
                <p><strong>Subject:</strong> ${sanitizedSubject}</p>
                <p>${sanitizedMessage.replace(/\n/g, '<br/>')}</p>
              </div>
              
              <p>We appreciate your interest in Knights Khayal and look forward to connecting with you.</p>
              
              <div class="signature">
                <p><strong>Best regards,</strong></p>
                <p>The Knights Khayal Team</p>
              </div>
              
              <div class="social-links">
                <a href="https://facebook.com">Facebook</a> | 
                <a href="https://instagram.com">Instagram</a> | 
                <a href="https://youtube.com">YouTube</a> | 
                <a href="https://spotify.com">Spotify</a>
              </div>
            </div>
            <div class="email-footer">
              <p>© ${new Date().getFullYear()} Knights Khayal. All rights reserved.</p>
              <p>Orlando, FL, USA</p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    const { data: notificationData, error: notificationError } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'abhinav.kotta@gmail.com',
      subject: `[Website Contact] ${sanitizedSubject}`,
      html: notificationHtml
    });
    
    if (notificationError) {
      console.error('Error sending notification email:', notificationError);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to send email notification' 
      });
    }
    
    // Confirmation email to the sender
    const { data: confirmationData, error: confirmationError } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Thank you for contacting Knights Khayal',
      html: confirmationHtml
    });
    
    if (confirmationError) {
      console.error('Error sending confirmation email:', confirmationError);
      return res.status(200).json({ 
        success: true, 
        warning: 'Notification sent, but confirmation email failed',
        data: notificationData
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Emails sent successfully',
      data: { notification: notificationData, confirmation: confirmationData }
    });
  } catch (error) {
    console.error('Server error in send-email endpoint:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

module.exports = router;