export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { record } = req.body;

    if (!record || !record.email) {
      return res.status(400).json({ error: 'Invalid payload: missing user email' });
    }

    const userEmail = record.email;
    const userName = record.full_name || 'Valued Volunteer';

    const apiKey = process.env.BREVO_API_KEY;
    const templateId = Number(process.env.BREVO_TEMPLATE_ID);

    if (!apiKey || !templateId) {
      return res.status(500).json({ error: 'Server configuration error: Missing Brevo environment variables' });
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        to: [{ email: userEmail, name: userName }],
        templateId: templateId,
        params: {
          FIRST_NAME: userName,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Brevo API Error:', errorData);
      return res.status(500).json({ error: 'Failed to send email via Brevo', details: errorData });
    }

    const data = await response.json();
    return res.status(200).json({ success: true, message: 'Approval email sent successfully', data });

  } catch (err) {
    console.error('Internal Server Error:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
}