// Vercel serverless function (Node.js runtime, CommonJS -- no package.json
// in this static site, so no "type": "module" is set; module.exports is the
// safe default format).
//
// Receives a JSON POST from any of the site's inquiry/signup forms and
// relays it to info@stampederanch.ca via Resend, using the RESEND_KEY
// environment variable already set in the Vercel project (production only).
//
// Sends FROM inquiries.stampederanch.ca, a verified Resend sending domain.
// The submitter's own email is set as reply_to, so replying to the
// notification email goes straight back to them.
//
// 2026-09-22: added anti-spam/anti-bot protection. Every submission must
// now pass, IN THIS ORDER, before an email is ever sent:
//   1. basic method/shape/size checks
//   2. honeypot check (silent fake-success if tripped -- never tell a
//      bot it was caught)
//   3. timing check (silent fake-success if the form was submitted
//      implausibly fast -- see MIN_SUBMIT_MS below)
//   4. input validation (required fields, email format, field types,
//      lengths)
//   5. Cloudflare Turnstile server-side verification (the ONLY check
//      that returns a visible, honest error to the caller, since a
//      genuine visitor can legitimately fail/expire a challenge and
//      deserves to know so they can retry)
// Only after all of that does the function call Resend. A failed
// Turnstile check, in particular, must never result in an email being
// sent -- verified by the fact that the Resend call happens strictly
// after, and only after, verifyTurnstile() resolves truthy.
//
// Expected request body:
// { formType, fields, pageUrl?, turnstileToken, website?, submittedAt? }
//   - turnstileToken: the Turnstile response token (from the hidden
//     cf-turnstile-response input Turnstile injects into each form)
//   - website: honeypot field value; must be empty
//   - submittedAt: client timestamp (ms) of when the form was wired up,
//     used only for the timing check, never stored or emailed

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const TURNSTILE_VERIFY_ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TO_ADDRESS = 'info@stampederanch.ca';
const FROM_ADDRESS = 'The Stampede Ranch <noreply@inquiries.stampederanch.ca>';

// Below this, a submission is treated as automated and silently dropped
// (fake success, no email sent). Deliberately low: real visitors using a
// password manager or that arrive with fields already filled can still
// submit within a second or two of the form appearing; this is only
// catching near-instant, no-human-involved script submissions.
const MIN_SUBMIT_MS = 1200;

// Defense in depth against pathological/garbage payloads, independent of
// per-field validation below.
const MAX_BODY_BYTES = 20000;
const MAX_FIELD_LENGTH = 5000;
const MAX_FIELD_COUNT = 30;

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
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Strips characters that have no business in a one-line email subject
// (newlines especially -- defense in depth against header-style
// injection even though the Resend API takes subject as a plain JSON
// string, not a raw SMTP header line).
function singleLine(str) {
  return String(str).replace(/[\r\n]+/g, ' ').trim();
}

function isValidEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function jsonResponse(res, status, body) {
  res.status(status).json(body);
}

function buildSubject(formType, fields) {
  const label = FORM_LABELS[formType] || 'Website Inquiry';
  if (formType === 'weddings' && fields.name1) {
    return singleLine(`${label}: ${fields.name1}${fields.name2 ? ' & ' + fields.name2 : ''}`);
  }
  if (formType === 'newsletter' && fields.email) {
    return singleLine(`${label}: ${fields.email}`);
  }
  if (fields.name) {
    return singleLine(`${label}: ${fields.name}`);
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

// Every value in `fields` must be a primitive short-enough string. Any
// object/array (e.g. someone POSTing nested JSON instead of a form value)
// or oversized string is rejected outright rather than silently
// stringified into the email.
function validateFields(fields) {
  const keys = Object.keys(fields);
  if (keys.length > MAX_FIELD_COUNT) {
    return 'Too many fields submitted.';
  }
  for (const key of keys) {
    const value = fields[key];
    if (value !== undefined && value !== null && typeof value !== 'string' && typeof value !== 'number') {
      return 'Unexpected field type submitted.';
    }
    if (String(value).length > MAX_FIELD_LENGTH) {
      return 'One of the submitted fields is too long.';
    }
  }
  return null;
}

function getClientIp(req) {
  // Vercel's edge network sets x-forwarded-for itself based on the real
  // TCP connection; it is not something an arbitrary client can spoof by
  // sending its own copy of the header (Vercel overwrites/prepends the
  // real value). Still take only the first hop, defensively.
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) {
    return xff.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || '';
}

async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error('TURNSTILE_SECRET_KEY is not set in this environment.');
    return { ok: false, reason: 'not_configured' };
  }
  if (!token || typeof token !== 'string') {
    return { ok: false, reason: 'missing_token' };
  }

  try {
    const params = new URLSearchParams();
    params.append('secret', secret);
    params.append('response', token);
    if (ip) params.append('remoteip', ip);

    const verifyRes = await fetch(TURNSTILE_VERIFY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await verifyRes.json().catch(() => ({}));
    if (!verifyRes.ok || !data.success) {
      console.error('Turnstile verification failed:', data['error-codes'] || data);
      return { ok: false, reason: 'rejected' };
    }
    return { ok: true };
  } catch (err) {
    console.error('Turnstile verification request errored:', err);
    return { ok: false, reason: 'request_failed' };
  }
}

module.exports = async (req, res) => {
  // ---- 1. method + shape/size checks -------------------------------
  if (req.method !== 'POST') {
    jsonResponse(res, 405, { ok: false, code: 'method_not_allowed', error: 'Method not allowed.' });
    return;
  }

  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength > MAX_BODY_BYTES) {
    jsonResponse(res, 413, { ok: false, code: 'payload_too_large', error: 'Request too large.' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    if (body.length > MAX_BODY_BYTES) {
      jsonResponse(res, 413, { ok: false, code: 'payload_too_large', error: 'Request too large.' });
      return;
    }
    try {
      body = JSON.parse(body);
    } catch (err) {
      jsonResponse(res, 400, { ok: false, code: 'invalid_json', error: 'Invalid request.' });
      return;
    }
  }
  if (!body || typeof body !== 'object') {
    jsonResponse(res, 400, { ok: false, code: 'invalid_body', error: 'Invalid request.' });
    return;
  }

  const formType = typeof body.formType === 'string' ? body.formType : 'contact';
  const fields = body.fields && typeof body.fields === 'object' && !Array.isArray(body.fields) ? body.fields : {};
  const pageUrl = typeof body.pageUrl === 'string' ? body.pageUrl.slice(0, 500) : '';
  const turnstileToken = typeof body.turnstileToken === 'string' ? body.turnstileToken : '';
  const honeypot = typeof body.website === 'string' ? body.website : '';
  const submittedAt = Number(body.submittedAt);

  // ---- 2. honeypot ---------------------------------------------------
  // A real visitor never sees or fills this field (aria-hidden, off-screen,
  // out of tab order). Anything in it means a bot filled every field it
  // could find. Respond exactly as if it succeeded -- no signal to the bot
  // that it was caught, and nothing is sent.
  if (honeypot.trim() !== '') {
    jsonResponse(res, 200, { ok: true });
    return;
  }

  // ---- 3. timing -------------------------------------------------------
  // Supplemental only, and deliberately lenient (see MIN_SUBMIT_MS above).
  // Same silent-success handling as the honeypot: a real user should never
  // be able to trip this, so there is no legitimate case to explain an
  // error to.
  if (submittedAt && Number.isFinite(submittedAt)) {
    const elapsed = Date.now() - submittedAt;
    if (elapsed >= 0 && elapsed < MIN_SUBMIT_MS) {
      jsonResponse(res, 200, { ok: true });
      return;
    }
  }

  // ---- 4. input validation -------------------------------------------
  const fieldError = validateFields(fields);
  if (fieldError) {
    jsonResponse(res, 400, { ok: false, code: 'invalid_input', error: fieldError });
    return;
  }
  const submitterEmail = fields.email;
  if (!isValidEmail(submitterEmail)) {
    jsonResponse(res, 400, { ok: false, code: 'invalid_input', error: 'A valid email address is required.' });
    return;
  }

  // ---- 5. Turnstile (the only check that can visibly fail to a real
  // visitor, and the last gate before anything is sent) -----------------
  const clientIp = getClientIp(req);
  const turnstileResult = await verifyTurnstile(turnstileToken, clientIp);
  if (!turnstileResult.ok) {
    jsonResponse(res, 400, { ok: false, code: 'verification_failed', error: "We couldn't verify your submission. Please try again." });
    return;
  }

  // ---- send ------------------------------------------------------------
  const apiKey = process.env.RESEND_KEY;
  if (!apiKey) {
    console.error('RESEND_KEY is not set in this environment.');
    jsonResponse(res, 500, { ok: false, code: 'not_configured', error: 'Email is not configured on the server.' });
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
      jsonResponse(res, 502, { ok: false, code: 'send_failed', error: 'The email could not be sent. Please try again.' });
      return;
    }

    jsonResponse(res, 200, { ok: true });
  } catch (err) {
    console.error('Unexpected error sending email:', err);
    jsonResponse(res, 500, { ok: false, code: 'send_failed', error: 'The email could not be sent. Please try again.' });
  }
};
