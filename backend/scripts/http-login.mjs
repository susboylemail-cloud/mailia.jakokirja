#!/usr/bin/env node
const [,, baseUrl = 'http://localhost:3000', username = 'admin', password = 'admin123'] = process.argv;
(async () => {
  try {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const text = await res.text();
    console.log(text);
    if (!res.ok) process.exit(1);
  } catch (e) {
    console.error('Login request failed:', e.message);
    process.exit(2);
  }
})();
