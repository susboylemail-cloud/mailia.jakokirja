#!/usr/bin/env node
import { io } from 'socket.io-client';

const [,, baseUrl = 'http://localhost:3000', username = 'admin', password = 'admin123'] = process.argv;

const login = async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) throw new Error(`Login failed: ${await res.text()}`);
  return res.json();
};

(async () => {
  try {
    const { accessToken } = await login();
    const socket = io(baseUrl, { auth: { token: accessToken } });

    socket.on('connect', () => {
      console.log('WS connected as', username);
    });

    socket.on('route:updated', (data) => {
      // Print only the key fields we care about
      const view = {
        routeId: data.routeId,
        action: data.action,
        circuitId: data.circuitId,
        status: data.status,
        startTime: data.startTime,
        endTime: data.endTime,
        timestamp: data.timestamp,
        updatedBy: data.updatedBy
      };
      console.log('route:updated', JSON.stringify(view));
    });

    socket.on('connect_error', (err) => {
      console.error('WS connect_error', err?.message || err);
    });

    socket.on('error', (err) => {
      console.error('WS error', err);
    });
    socket.on('disconnect', (reason) => {
      console.error('WS disconnected:', reason);
    });

    // Keep the process alive indefinitely
    await new Promise(() => {});
  } catch (e) {
    console.error('ws-watch failed:', e.message);
    process.exit(1);
  }
})();
