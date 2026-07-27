const nodemailer = require('nodemailer');

/**
 * Returns a usable transport config for nodemailer.createTransport().
 *
 * Mirrors the same helper in Backend/admin/src/messages/Mailer.js.
 * SMTP_URL must be a real SMTP connection URL (e.g.
 * "smtps://user:pass@smtp.example.com:465"). Passing an empty or placeholder
 * value made createTransport() throw at require-time ("Cannot create property
 * 'mailer' on string ''"), which took the entire cronjobs service down — and
 * with it the nightly screenshot-retention job, which has nothing to do with
 * email. Fall back to nodemailer's jsonTransport so scheduled jobs still run;
 * sendMail() then serialises the message instead of delivering it.
 */
function resolveTransportConfig() {
    const url = process.env.SMTP_URL;
    const isValidSmtpUrl =
        typeof url === 'string' &&
        /^smtps?:\/\//i.test(url.trim());

    if (isValidSmtpUrl) return url.trim();

    console.warn(
        '[Mailer] SMTP_URL is missing or invalid (' +
        (url ? `"${url}"` : 'undefined') +
        '). Falling back to a no-op JSON transport — emails will NOT be sent, ' +
        'but all other cron jobs (including screenshot retention) continue to run.'
    );
    return { jsonTransport: true };
}

let transport, nodemailerMock;
if (process.env.NODE_ENV === 'test') {
    nodemailerMock = require('nodemailer-mock');
    transport = nodemailerMock.createTransport(resolveTransportConfig());
} else {
    transport = nodemailer.createTransport(resolveTransportConfig());
}

class Mailer {
    /**
     * Connect to SMTP server
     *
     * @returns {Promise}
     */
    static async verify() {
        return transport.verify()
            .then(() => {
                console.log('Server is ready to take our messages!!!');
            }).catch((error) => {
                console.error(error);
            });
    }

    /**
     * Send mail
     *
     * @param {object} params https://nodemailer.com/message/
     * @returns {Promise}
     */
    static async sendMail(params) {
        return transport.sendMail(params);
    }

    static isIdle() {
        return transport.isIdle();
    }

    static close() {
        return transport.close();
    }
}


if (process.env.NODE_ENV === 'test') {
    class Mock {
        static reset() {
            return nodemailerMock.mock.reset();
        }

        static messages() {
            return nodemailerMock.mock.getSentMail();
        }

        static lastMessage() {
            const mails = [...this.messages()];
            return mails.pop();
        }

        static shouldFailOnce() {
            return nodemailerMock.mock.setShouldFailOnce();
        }

        static shouldFail(shouldFail) {
            return nodemailerMock.mock.setShouldFail(shouldFail);
        }
    }

    Mailer.Mock = Mock;
}

module.exports.Mailer = Mailer;
