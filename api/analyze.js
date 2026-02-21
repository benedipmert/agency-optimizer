const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  // Parse body manually if needed
  let bodyData = req.body;
  if (!bodyData || typeof bodyData === 'string') {
    try { bodyData = JSON.parse(bodyData || '{}'); } catch(e) { bodyData = {}; }
  }

  const { system, userMessage } = bodyData;
  if (!system || !userMessage) {
    return res.status(400).json({ error: 'Missing fields', received: Object.keys(bodyData || {}) });
  }

  const payload = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system: system,
    messages: [{ role: 'user', content: userMessage }]
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const request = https.request(options, (response) => {
      let data = '';
      response.on('data', chunk => { data += chunk; });
      response.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (response.statusCode !== 200) {
            res.status(response.statusCode).json({ error: parsed.error?.message || 'API error' });
          } else {
            const text = (parsed.content || []).map(c => c.text || '').join('');
            res.status(200).json({ text });
          }
        } catch(e) {
          res.status(500).json({ error: 'Parse error: ' + e.message });
        }
        resolve();
      });
    });

    request.on('error', (e) => {
      res.status(500).json({ error: e.message });
      resolve();
    });

    request.write(payload);
    request.end();
  });
};
