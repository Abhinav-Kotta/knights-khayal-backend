const express = require('express');
const { Resend } = require('resend');
const Admin = require('./models/Admin');
const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const router = express.Router();

// Initialize Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

const resetTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Admin' },
  token: { type: String, required: true },
  createdAt: { type: Date, required: true, default: Date.now, expires: 3600 } // Token expires after 1 hour
});

const ResetToken = mongoose.models.ResetToken || mongoose.model('ResetToken', resetTokenSchema);

// Route to request password reset
router.post('/admin/reset-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    // Find admin by email
    const admin = await Admin.findOne({ email });
    
    if (!admin) {
      return res.status(200).json({ message: 'If your email is registered, you will receive reset instructions' });
    }
    
    await ResetToken.deleteMany({ userId: admin._id });
    
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hash = await bcrypt.hash(resetToken, 10);
    
    await new ResetToken({
      userId: admin._id,
      token: hash,
      createdAt: Date.now()
    }).save();
    
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/admin/reset-password/${admin._id}/${resetToken}`;
    
    const resetEmailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
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
              font-size: 24px;
              font-weight: 700;
            }
            .email-body {
              padding: 30px;
            }
            .greeting {
              font-size: 18px;
              margin-bottom: 20px;
            }
            .reset-button {
              display: block;
              width: 100%;
              max-width: 280px;
              margin: 30px auto;
              padding: 12px 24px;
              background-color: #7b68ee;
              color: white;
              text-align: center;
              text-decoration: none;
              border-radius: 5px;
              font-weight: 600;
              font-size: 16px;
            }
            .warning {
              background-color: #fff8e6;
              border-left: 4px solid #ff8c69;
              padding: 15px;
              margin: 20px 0;
              font-size: 14px;
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
              <h1>Reset Your Password</h1>
            </div>
            <div class="email-body">
              <p class="greeting">Hello ${admin.username},</p>
              
              <p>We received a request to reset your password for the Knights Khayal admin panel. Click the button below to set a new password:</p>
              
              <a href="${resetUrl}" class="reset-button">Reset Password</a>
              
              <p>If you didn't request a password reset, you can safely ignore this email. The link will expire in 1 hour.</p>
              
              <div class="warning">
                <p>For security reasons, please do not share this link with anyone.</p>
              </div>
            </div>
            <div class="email-footer">
              <p>© ${new Date().getFullYear()} Knights Khayal. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    console.log(`Sending password reset to: ${admin.email}`);

    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: admin.email,
      subject: 'Reset Your Knights Khayal Admin Password',
      html: resetEmailHtml
    });
    
    return res.status(200).json({
      message: 'Password reset email sent successfully'
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
});

// Route to reset password with token
router.post('/admin/reset-password/:userId/:token', async (req, res) => {
  try {
    const { userId, token } = req.params;
    const { password } = req.body;
    
    // Find the reset token
    const resetToken = await ResetToken.findOne({ userId });
    
    if (!resetToken) {
      return res.status(400).json({
        message: 'Invalid or expired reset token'
      });
    }
    
    // Verify token
    const isValid = await bcrypt.compare(token, resetToken.token);
    
    if (!isValid) {
      return res.status(400).json({
        message: 'Invalid or expired reset token'
      });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Update user's password
    await Admin.updateOne(
      { _id: userId },
      { $set: { password: hashedPassword } }
    );
    
    // Delete the reset token
    await ResetToken.deleteOne({ userId });
    
    return res.status(200).json({
      message: 'Password reset successful'
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
});

module.exports = router;