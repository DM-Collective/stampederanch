// Vercel serverless function (Node.js runtime, CommonJS -- no package.json
// in this static site, so no "type": "module" is set; module.exports is the
// safe default format).
//
// Receives a JSON POST from any of the site's inquiry/signup forms and
// relays it to info@stampederanch.ca via Resend, using the RESEND_KEY
// environment variable already set in the Vercel project (production only).
//
// Sends FROM onboarding@resend.dev (Resend's own shared sending address,
// which works without any domain verification) rather than an
// @stampederanch.ca address, since we don't know whether that domain has
// been verified in Resend yet. The submitter's own email is set as
// reply_to, so replying to the notification email goes straight back to
// them regardless of the from address. If stampederanch.ca is (or becomes)
// a verified Resend domain, swap FROM_ADDRESS below for a branded address.
//
// Expected request body: { formType: string, fields: { ...form fields }, pageUrl?: string }

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const TO_ADDRESS = 'info@stampederanch.ca';
const FROM_ADDRESS = 'The Stampede Ranch Website <onboarding@resend.dev>';

const FORM_LABELS = {
  contact: 'General Inquiry',
  venues: 'Availability Request',
  weddings: 'Wedding Inquiry',
  newsletter: 'Newsletter Signup',
};

// Human-readable labels for known field names, so the email body reads
// naturally instead of showing raw form field names. Any field not listed
// here still gets included, title-cased from its name.
const FIELD_LABELS = {
  name: 'Name',
  name1: 'Your name',
  name2: "Partner's name",
  email: 'Email',
  phone: 'Phone',
  reason: 'What they need help with',
  message: 'Message',
  experience: 'Type of experience',
  date: 'Preferred date',
  alternate: 'Alternative date / flexibility',
  type: 'Event type',
  guests: 'Approximate guests',
  notes: 'Notes',
  flexibility: 'Date flexibility',
  package: 'Interested in',
  vision: 'Vision for the day',
  terms: 'Agreed to booking terms',
};

function titleCase(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isValidEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildSubject(formType, fields) {
  const label = FORM_LABELS[formType] || 'Website Inquiry';
  if (formType === 'weddings' && fields.name1) {
    return `${label}: ${fields.name1}${fields.name2 ? ' & ' + fields.name2 : ''}`;
  }
  if (formType === 'newsletter' && fields.email) {
    return `${label}: ${fields.email}`;
  }
  if (fields.name) {
    return `${label}: ${fields.name}`;
  }
  return `${label} from stampederanch.ca`;
}

function buildBody(formType, fields, pageUrl) {
  const rows = Object.keys(fields)
    .filter((key) => fields[key] !== undefined && fields[key] !== null && String(fields[key]).trim() !== '')
    .map((key) => {
      const label = FIELD_LABELS[key] || titleCase(key);
      return { label, value: String(fields[key]).trim() };
    });

  const text =
    `${FORM_LABELS[formType] || 'Website Inquiry'} (${pageUrl || 'stampederanch.ca'})\n\n` +
    rows.map((r) => `${r.label}: ${r.value}`).join('\n');

  const html =
    `<div style="font-family:sans-serif;font-size:15px;color:#211d18;">` +
    `<p style="margin:0 0 16px;color:#8f4523;font-weight:600;">${escapeHtml(FORM_LABELS[formType] || 'Website Inquiry')}` +
    (pageUrl ? ` &middot; <span style="color:#666;font-weight:400;">${escapeHtml(pageUrl)}</span>` : '') +
    `</p>` +
    `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:560px;">` +
    rows
      .map(
        (r) =>
          `<tr><td style="padding:6px 12px 6px 0;color:#666;vertical-align:top;white-space:nowrap;">${escapeHtml(r.label)}</td>` +
          `<td style="padding:6px 0;">${escapeHtml(r.value).replace(/\n/g, '<br>')}</td></tr>`
      )
      .join('') +
    `</table></div>`;

  return { text, html };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (err) {
      res.status(400).json({ ok: false, error: 'Invalid JSON' });
      return;
    }
  }
  if (!body || typeof body !== 'object') {
    res.status(400).json({ ok: false, error: 'Missing request body' });
    return;
  }

  const formType = typeof body.formType === 'string' ? body.formType : 'contact';
  const fields = body.fields && typeof body.fields === 'object' ? body.fields : {};
  const pageUrl = typeof body.pageUrl === 'string' ? body.pageUrl : '';

  // Minimal server-side validation, mirroring what the form's own HTML5
  // validation already requires, since a request could bypass the browser.
  const submitterEmail = fields.email;
  if (!isValidEmail(submitterEmail)) {
    res.status(400).json({ ok: false, error: 'A valid email address is required.' });
    return;
  }

  const apiKey = process.env.RESEND_KEY;
  if (!apiKey) {
    console.error('RESEND_KEY is not set in this environment.');
    res.status(500).json({ ok: false, error: 'Email is not configured on the server.' });
    return;
  }

  const subject = buildSubject(formType, fields);
  const { text, html } = buildBody(formType, fields, pageUrl);

  try {
    const resendRes = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [TO_ADDRESS],
        reply_to: submitterEmail,
        subject,
        text,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error('Resend API error:', resendRes.status, errBody);
      res.status(502).json({ ok: false, error: 'The email could not be sent. Please try again.' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Unexpected error sending email:', err);
    res.status(500).json({ ok: false, error: 'The email could not be sent. Please try again.' });
  }
};
