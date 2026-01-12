import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

const PROD_URL = 'https://mtg-forge.com';

export const emailService = {
    /**
     * Sends an invitation email to join a Pod or be a Social Friend
     * @param {string} toEmail 
     * @param {Object} inviter { username, email }
     * @param {string} type 'pod' or 'friend'
     */
    async sendInvitation(toEmail, inviter, type = 'pod') {
        if (!process.env.RESEND_API_KEY) {
            console.warn('[EmailService] No RESEND_API_KEY found. Logging email content instead:');
            console.log(`To: ${toEmail}\nFrom: ${inviter.username}\nSubject: You've been invited to join MTG Forge!`);
            return { success: true, mocked: true };
        }

        const isPod = type === 'pod';
        const subject = isPod
            ? `${inviter.username} invited you to join their Pod on MTG Forge!`
            : `${inviter.username} wants to connect with you on MTG Forge!`;

        const inviteText = isPod
            ? `has summoned you to their Pod`
            : `wants to connect with you`;

        const autoJoinText = isPod
            ? `Sign up with this email to automatically link your library to ${inviter.username}'s Pod.`
            : `Sign up with this email to automatically connect with ${inviter.username}.`;

        try {
            const { data, error } = await resend.emails.send({
                from: 'MTG Forge <invitations@referals.mtg-forge.com>',
                to: [toEmail],
                subject: subject,
                html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #030712; color: #f3f4f6; margin: 0; padding: 0; }
                        .wrapper { width: 100%; table-layout: fixed; background-color: #030712; padding-bottom: 40px; }
                        .container { max-width: 800px; margin: 0 auto; background: #0f172a; border-radius: 0 0 24px 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8); border: 1px solid #1e293b; }
                        .hero { 
                            width: 100%;
                            line-height: 0;
                            background-color: #0f172a;
                        }
                        .hero-img {
                            width: 100%;
                            height: auto;
                            display: block;
                        }
                        .content { padding: 60px 40px; text-align: center; }
                        .greeting { font-size: 24px; color: white; font-weight: 700; margin-bottom: 24px; }
                        .description { font-size: 18px; line-height: 1.6; color: #94a3b8; margin-bottom: 40px; }
                        
                        .features { display: table; width: 100%; border-collapse: separate; border-spacing: 20px 0; margin: 40px 0; }
                        .feature-item { display: table-cell; width: 33.33%; background: #1e293b; padding: 24px; border-radius: 16px; border: 1px solid #334155; vertical-align: top; }
                        .feature-item h3 { color: #818cf8; margin-top: 0; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; }
                        .feature-item p { font-size: 14px; color: #94a3b8; margin-bottom: 0; }

                        .inviter-bar { 
                            background: rgba(79, 70, 229, 0.1); 
                            border: 1px solid rgba(79, 70, 229, 0.3); 
                            padding: 15px; 
                            border-radius: 12px; 
                            margin-bottom: 40px; 
                            display: inline-block;
                            color: #f3f4f6;
                            font-weight: 500;
                        }
                        .inviter-name { color: #a5b4fc; font-weight: 900; }

                        .cta-button { 
                            display: inline-block; 
                            padding: 20px 48px; 
                            background: #4f46e5; 
                            color: #ffffff !important; 
                            text-decoration: none; 
                            font-weight: 800; 
                            font-size: 18px;
                            border-radius: 14px; 
                            box-shadow: 0 10px 20px -5px rgba(79, 70, 229, 0.6);
                        }
                        .footer { padding: 40px; text-align: center; color: #475569; font-size: 12px; }
                        .auto-join { font-size: 13px; color: #64748b; margin-top: 40px; font-style: italic; }
                        
                        @media screen and (max-width: 600px) {
                            .feature-item { display: block; width: auto; margin-bottom: 20px; }
                        }
                    </style>
                </head>
                <body>
                    <div class="wrapper">
                        <div class="container">
                            <div class="hero">
                                <img src="${PROD_URL}/MTG-Forge_Logo_Background.png" alt="MTG Forge" class="hero-img">
                            </div>
                            <div class="content">
                                <div class="inviter-bar">
                                    🛡️ <span class="inviter-name">${inviter.username}</span> ${inviteText}
                                </div>

                                <div class="greeting">Adventure Awaits, Planeswalker.</div>
                                
                                <p class="description">
                                    Join the next generation of Magic: The Gathering intelligence, designed for those who brew to win.
                                </p>

                                <div class="features">
                                    <div class="feature-item">
                                        <h3>AI Strategy</h3>
                                        <p>Analyze your decks with advanced intelligence to find the perfect curve.</p>
                                    </div>
                                    <div class="feature-item">
                                        <h3>Community</h3>
                                        <p>Connect with local players and see what's brewing in your meta.</p>
                                    </div>
                                    <div class="feature-item">
                                        <h3>Real-Time</h3>
                                        <p>Keep your library synced with live market pricing and meta shifts.</p>
                                    </div>
                                </div>
                                
                                <a href="${PROD_URL}" class="cta-button">ENTER THE FORGE</a>
                                
                                <p class="auto-join">
                                    ${autoJoinText}
                                </p>
                            </div>
                            <div class="footer">
                                &copy; 2026 MTG Forge &bull; Built for the Community &bull; <a href="${PROD_URL}" style="color: #64748b;">Visit Site</a>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
                `
            });

            if (error) {
                console.error('[EmailService] Resend error:', error);
                throw error;
            }

            return { success: true, data };
        } catch (err) {
            console.error('[EmailService] Failed to send invitation:', err);
            throw err;
        }
    }
};
