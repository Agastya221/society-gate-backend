import axios from 'axios';
import logger from '../utils/logger';

type ResidentInvite = {
  phone: string;
  email?: string | null;
  name?: string | null;
  societyName: string;
  appDownloadLink?: string | null;
};

export class InviteDeliveryService {
  async sendResidentInvite(invite: ResidentInvite) {
    const [sms, email] = await Promise.all([
      this.sendSms(invite),
      this.sendEmail(invite),
    ]);

    return { sms, email };
  }

  private async sendSms(invite: ResidentInvite) {
    const templateId = process.env.MSG91_RESIDENT_INVITE_TEMPLATE_ID;
    const authKey = process.env.MSG91_AUTH_KEY;

    if (!templateId || !authKey) {
      return { attempted: false, delivered: false, reason: 'MSG91 invite template is not configured' };
    }

    try {
      await axios.post(
        'https://control.msg91.com/api/v5/flow/',
        {
          template_id: templateId,
          short_url: '0',
          recipients: [
            {
              mobiles: `91${invite.phone}`,
              name: invite.name || 'Resident',
              society_name: invite.societyName,
              app_link: invite.appDownloadLink || '',
            },
          ],
        },
        {
          headers: {
            authkey: authKey,
            'Content-Type': 'application/json',
          },
          timeout: 10_000,
        },
      );

      return { attempted: true, delivered: true };
    } catch (error) {
      logger.error({ error, phone: invite.phone }, 'Resident invite SMS failed');
      return { attempted: true, delivered: false, reason: 'MSG91 request failed' };
    }
  }

  private async sendEmail(invite: ResidentInvite) {
    const webhookUrl = process.env.EMAIL_INVITE_WEBHOOK_URL;

    if (!webhookUrl || !invite.email) {
      return { attempted: false, delivered: false, reason: 'Email invite webhook or resident email is not configured' };
    }

    try {
      await axios.post(
        webhookUrl,
        {
          to: invite.email,
          template: 'resident_invite',
          data: {
            name: invite.name || 'Resident',
            societyName: invite.societyName,
            appDownloadLink: invite.appDownloadLink || '',
          },
        },
        { timeout: 10_000 },
      );

      return { attempted: true, delivered: true };
    } catch (error) {
      logger.error({ error, email: invite.email }, 'Resident invite email failed');
      return { attempted: true, delivered: false, reason: 'Email webhook request failed' };
    }
  }
}

export const inviteDeliveryService = new InviteDeliveryService();
