"""SMTP Email Service for sending real OTP and Password Reset emails.

Supports Gmail App Passwords, Resend, SendGrid, Amazon SES, or any standard SMTP provider.
Falls back to formatted terminal logging in development if SMTP is not yet configured.
"""

import smtplib
import logging
from email.message import EmailMessage
from app.core.config import settings

logger = logging.getLogger("ingrivo.smtp")


def send_email(to_email: str, subject: str, html_content: str, text_content: str | None = None) -> bool:
    """Send an HTML email using configured SMTP credentials."""
    if not settings.smtp_configured:
        logger.warning(
            "SMTP is not configured in .env. To send real emails, set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD."
        )
        return False

    msg = EmailMessage()
    from_addr = settings.SMTP_FROM_EMAIL or settings.SMTP_USER
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{from_addr}>"
    msg["To"] = to_email
    msg["Subject"] = subject

    if text_content:
        msg.set_content(text_content)
        msg.add_alternative(html_content, subtype="html")
    else:
        msg.set_content(html_content, subtype="html")

    try:
        if settings.SMTP_USE_SSL or settings.SMTP_PORT == 465:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)

        logger.info("Successfully sent email to %s (subject='%s')", to_email, subject)
        return True
    except Exception as exc:
        logger.error("Failed to send email to %s via SMTP: %s", to_email, exc)
        return False


def send_otp_email(to_email: str, otp_code: str, purpose: str = "login") -> bool:
    """Send a branded 6-digit OTP verification code."""
    purpose_title = "Login Verification" if purpose == "login" else "Password Reset Request"
    purpose_action = "log in to your Ingrivo account" if purpose == "login" else "reset your Ingrivo account password"

    html = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>{purpose_title}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #FBF8F2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1B2A22;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="500" style="max-width: 500px; background: #FFFFFF; border: 1px solid #E4DEC3; border-radius: 16px; padding: 36px 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
              <tr>
                <td align="center" style="padding-bottom: 24px;">
                  <div style="display: inline-block; background-color: #1E5B45; color: #FFFFFF; font-weight: 800; font-size: 20px; width: 44px; height: 44px; line-height: 44px; border-radius: 10px; text-align: center;">I</div>
                  <h1 style="margin: 12px 0 4px 0; font-size: 22px; color: #1E5B45; font-weight: 700;">Ingrivo</h1>
                  <p style="margin: 0; font-size: 13px; color: #64748B;">Food Intelligence & Product Transparency</p>
                </td>
              </tr>
              <tr>
                <td style="border-top: 1px solid #F1ECE1; padding-top: 24px;">
                  <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #1B2A22;">{purpose_title}</h2>
                  <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #4A5568;">
                    You recently requested to {purpose_action}. Use the 6-digit verification code below to proceed:
                  </p>
                  
                  <div style="background-color: #F2F8F5; border: 2px dashed #1E5B45; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0;">
                    <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1E5B45; font-family: monospace;">{otp_code}</span>
                  </div>

                  <p style="margin: 0 0 12px 0; font-size: 13px; color: #64748B;">
                    ⏱️ This code will expire in <strong>10 minutes</strong>.
                  </p>
                  <p style="margin: 0; font-size: 12px; color: #94A3B8; line-height: 1.5;">
                    If you did not request this verification code, please ignore this email or reach out to support.
                  </p>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-top: 32px; border-top: 1px solid #F1ECE1; margin-top: 32px;">
                  <p style="margin: 0; font-size: 11px; color: #94A3B8;">
                    Ingrivo • Know what you eat. Understand what you buy.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """

    plain = f"Your Ingrivo {purpose_title} code is: {otp_code}. Valid for 10 minutes."
    sent = send_email(to_email, f"Ingrivo: {otp_code} is your {purpose_title} code", html, plain)

    # Always log clearly in the console so developers and admins can test immediately
    print(f"\n{'='*55}")
    print(f" [INGRIVO OTP NOTIFICATION] ")
    print(f" To:       {to_email}")
    print(f" Purpose:  {purpose_title}")
    print(f" Code:     >>> {otp_code} <<< (valid for 10 min)")
    print(f" Sent via SMTP: {sent} (SMTP Configured: {settings.smtp_configured})")
    print(f"{'='*55}\n")

    return sent
