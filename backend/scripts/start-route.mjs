#!/usr/bin/env node
const [,, baseUrl = 'http://localhost:3000', username = 'admin', password = 'admin123', circuitId = 'KP3', routeDate = new Date().toISOString().slice(0,10)] = process.argv;

(async () => {
  try {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!loginRes.ok) {
      console.error('Login failed:', await loginRes.text());
      process.exit(1);
    }
    const { accessToken } = await loginRes.json();

    const startRes = await fetch(`${baseUrl}/api/routes/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({ circuitId, routeDate })
    });
    const text = await startRes.text();
    console.log(text);
    if (!startRes.ok) process.exit(2);
  } catch (e) {
    console.error('Start route request failed:', e.message);
    process.exit(3);
  }
})();
