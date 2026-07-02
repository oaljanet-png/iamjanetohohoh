exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { name, email, totalScore, level, tracks } = data;
  if (!email || !email.includes('@')) {
    return { statusCode: 400, body: 'Invalid email' };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const notifyEmail = process.env.NOTIFY_EMAIL;

  const trackRows = (tracks || [])
    .map(t => `<tr><td style="padding:6px 0;">${t.name}</td><td style="padding:6px 0;text-align:right;">${t.rating} (${t.score}/${t.maxPossible})</td></tr>`)
    .join('');

  const resultHtml = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <p>Hi ${name || 'there'},</p>
      <p>Here's your Retail AI Readiness result:</p>
      <h2 style="margin:18px 0 4px;">${level?.label || ''}</h2>
      <p>${level?.summary || ''}</p>
      <p style="font-size:24px;font-weight:bold;">${totalScore} / 60</p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;">${trackRows}</table>
    </div>
  `;

  const sendEmail = (to, subject, html) =>
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromEmail, to, subject, html }),
    });

  const sends = [sendEmail(email, 'Your Retail AI Readiness Result', resultHtml)];
  if (notifyEmail) {
    sends.push(
      sendEmail(
        notifyEmail,
        `New quiz lead: ${name || 'Unknown'}`,
        `<p>${name || 'Someone'} (${email}) just completed the AI Readiness Quiz.</p><p>Score: ${totalScore}/60 — ${level?.label || ''}</p>`
      )
    );
  }

  const results = await Promise.all(sends.map(p => p.then(r => r.ok).catch(() => false)));

  if (results.includes(false)) {
    return { statusCode: 502, body: JSON.stringify({ ok: false }) };
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
