#!/usr/bin/env node
const [,, baseUrl = 'http://localhost:3000', username = 'admin', password = 'admin123', routeId] = process.argv;
if (!routeId) { console.error('Usage: node complete-route.mjs <baseUrl> <username> <password> <routeId>'); process.exit(1); }

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

    const compRes = await fetch(`${baseUrl}/api/routes/${routeId}/complete`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const text = await compRes.text();
    console.log(text);
    if (!compRes.ok) process.exit(2);
  } catch (e) {
    console.error('Complete route request failed:', e.message);
    process.exit(3);
  }
})();
