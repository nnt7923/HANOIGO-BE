import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter?: Transporter;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');

    if (!host) {
      return;
    }

    const port = Number(this.configService.get<string>('SMTP_PORT', '587'));
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async sendOtp(input: {
    to: string;
    code: string;
    subject: string;
    purposeText: string;
  }) {
    const from = this.configService.get<string>(
      'SMTP_FROM',
      'HanoiGo <no-reply@hanoigo.local>',
    );
    const allowOtpLogging =
      this.configService.get<string>('SMTP_ALLOW_OTP_LOGGING') === 'true';

    if (!this.transporter && allowOtpLogging) {
      this.logger.warn(
        `SMTP is not configured. OTP for ${input.to}: ${input.code}`,
      );
      return;
    }

    if (!this.transporter) {
      throw new ServiceUnavailableException('SMTP is not configured');
    }

    await this.transporter.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: `Your HanoiGo ${input.purposeText} code is ${input.code}. This code expires in 10 minutes.`,
      html: `<p>Your HanoiGo ${input.purposeText} code is <strong>${input.code}</strong>.</p><p>This code expires in 10 minutes.</p>`,
    });
  }
}
