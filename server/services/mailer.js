import nodemailer from 'nodemailer';

// Configure transporter
// Expects:
// EMAIL_SERVICE (e.g. 'gmail', 'outlook', or generic SMTP)
// EMAIL_USER
// EMAIL_PASS
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

/**
 * Send a friend request notification email
 * @param {string} toEmail 
 * @param {string} requesterName 
 * @param {string} acceptLink (optional deep link or app link)
 */
export const sendFriendRequestEmail = async (toEmail, requesterName) => {
    if (!process.env.EMAIL_USER) {
        console.warn('[Mailer] No EMAIL_USER configured. Skipping email.');
        return;
    }

    const mailOptions = {
        from: `"MTG Forge" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: `New Friend Request from ${requesterName} ⚔️`,
        html: `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #4f46e5;">MTG Forge</h2>
        <p><strong>${requesterName}</strong> wants to be your friend on MTG Forge!</p>
        <p>Connect to share decks, view match history, and compete on the leaderboard.</p>
        <br/>
        <p>Log in to the app to accept or decline.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #888;">You are receiving this because you have an account on MTG Forge.</p>
      </div>
    `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`[Mailer] Friend request sent to ${toEmail}: ${info.messageId}`);
    } catch (error) {
        console.error('[Mailer] Error sending friend request email:', error);
    }
};
