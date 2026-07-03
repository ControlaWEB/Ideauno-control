import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { LOGO_BASE64 } from './email-assets';

const NAVY = '#213a55';
const GOLD = '#d1b78a';
const GREEN = '#355e5b';
const LOGO_CID = 'logo-idea-uno';
const LOGO_RAW_BASE64 = LOGO_BASE64.split(',')[1];

function wrapBranded(title: string, bodyHtml: string): string {
  return `
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
  <div style="background: ${NAVY}; padding: 28px 24px; text-align: center;">
    <img src="cid:${LOGO_CID}" alt="Idea Uno Bienes Raíces" style="height: 38px; width: auto;" />
  </div>
  <div style="height: 4px; background: linear-gradient(90deg, ${GOLD}, ${GREEN});"></div>
  <div style="padding: 30px 32px;">
    <h2 style="margin: 0 0 16px; font-size: 17px; color: ${NAVY};">${title}</h2>
    <div style="font-size: 14px; line-height: 1.6; color: #374151;">
      ${bodyHtml}
    </div>
  </div>
  <div style="background: #f3f4f6; padding: 16px 32px; text-align: center; font-size: 11px; color: #6b7280;">
    Idea Uno Control — Sistema de administración inmobiliaria<br/>
    Este es un correo automático, no responder.
  </div>
</div>`;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend = new Resend(process.env.RESEND_API_KEY);
  private readonly from =
    process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';

  async send(to: string[], subject: string, bodyHtml: string) {
    if (to.length === 0) return;
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.from,
        to,
        subject,
        html: wrapBranded(subject, bodyHtml),
        attachments: [
          {
            filename: 'logo.png',
            content: Buffer.from(LOGO_RAW_BASE64, 'base64'),
            contentId: LOGO_CID,
            contentType: 'image/png',
          },
        ],
      });
      if (error) {
        this.logger.error(
          `Resend rechazó el correo "${subject}" a ${to.join(', ')}: ${JSON.stringify(error)}`,
        );
      } else {
        this.logger.log(
          `Correo "${subject}" enviado a ${to.join(', ')} (id ${data?.id})`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Fallo al enviar correo "${subject}" a ${to.join(', ')}`,
        err as Error,
      );
    }
  }
}
