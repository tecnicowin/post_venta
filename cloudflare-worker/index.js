const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

const LICENSE_PREFIX = 'PDV';

function generateId() {
  return crypto.randomUUID();
}

function hashKey(clave) {
  return [...new TextEncoder().encode(clave)]
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (path === '/validate' && request.method === 'POST') {
        return this.handleValidate(request, env);
      }

      if (path === '/generate' && request.method === 'POST') {
        return this.handleGenerate(request, env);
      }

      if (path === '/revoke' && request.method === 'POST') {
        return this.handleRevoke(request, env);
      }

      if (path === '/list' && request.method === 'GET') {
        return this.handleList(env);
      }

      if (path === '/stats' && request.method === 'GET') {
        return this.handleStats(env);
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: CORS_HEADERS
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: CORS_HEADERS
      });
    }
  },

  async handleValidate(request, env) {
    const { clave, deviceId } = await request.json();

    if (!clave || !deviceId) {
      return new Response(JSON.stringify({
        ok: false,
        mensaje: 'Faltan parámetros: clave, deviceId'
      }), { status: 400, headers: CORS_HEADERS });
    }

    const normalizedKey = clave.trim().toUpperCase();
    const parts = normalizedKey.split('-');

    if (parts.length !== 5 || parts[0] !== LICENSE_PREFIX) {
      return new Response(JSON.stringify({
        ok: false,
        mensaje: 'Formato de clave inválido'
      }), { headers: CORS_HEADERS });
    }

    const tipo = parts[1];
    if (!['VIP', 'PRO'].includes(tipo)) {
      return new Response(JSON.stringify({
        ok: false,
        mensaje: 'Tipo de licencia inválido'
      }), { headers: CORS_HEADERS });
    }

    const stored = await env.LICENSES_KV.get(normalizedKey, 'json');

    if (!stored) {
      return new Response(JSON.stringify({
        ok: false,
        mensaje: 'Licencia no encontrada'
      }), { headers: CORS_HEADERS });
    }

    if (stored.estado === 'revocada') {
      return new Response(JSON.stringify({
        ok: false,
        mensaje: 'Licencia revocada'
      }), { headers: CORS_HEADERS });
    }

    if (stored.dispositivos && stored.dispositivos.length > 0) {
      const alreadyBound = stored.dispositivos.includes(deviceId);
      if (!alreadyBound && stored.dispositivos.length >= (stored.maxDispositivos || 1)) {
        return new Response(JSON.stringify({
          ok: false,
          mensaje: 'Máximo de dispositivos alcanzado. Contacta al soporte.'
        }), { headers: CORS_HEADERS });
      }
      if (!alreadyBound) {
        stored.dispositivos.push(deviceId);
        await env.LICENSES_KV.put(normalizedKey, JSON.stringify(stored));
      }
    } else {
      stored.dispositivos = [deviceId];
      await env.LICENSES_KV.put(normalizedKey, JSON.stringify(stored));
    }

    let expira = null;
    if (tipo === 'PRO' && stored.expira) {
      const expiraTime = new Date(stored.expira).getTime();
      if (Date.now() > expiraTime) {
        return new Response(JSON.stringify({
          ok: false,
          mensaje: 'Licencia PRO expirada'
        }), { headers: CORS_HEADERS });
      }
      expira = stored.expira;
    }

    return new Response(JSON.stringify({
      ok: true,
      tipo,
      email: stored.email || '',
      expira,
      dispositivos: stored.maxDispositivos || 1,
      dispositivoId: deviceId,
      firma: stored.firma || ''
    }), { headers: CORS_HEADERS });
  },

  async handleGenerate(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${env.ADMIN_TOKEN}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: CORS_HEADERS
      });
    }

    const { tipo, email, expira, maxDispositivos } = await request.json();

    if (!tipo || !['VIP', 'PRO'].includes(tipo)) {
      return new Response(JSON.stringify({ error: 'Tipo inválido' }), {
        status: 400,
        headers: CORS_HEADERS
      });
    }

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const seg = () => Array.from({length:4}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
    const seq = Math.floor(Math.random()*9000+1000);
    const clave = `${LICENSE_PREFIX}-${tipo}-${seg()}-${seq}-${seg()}-${seg()}`;

    const license = {
      clave,
      tipo,
      email: email || '',
      expira: tipo === 'PRO' ? expira || null : null,
      maxDispositivos: maxDispositivos || (tipo === 'VIP' ? 1 : 3),
      dispositivos: [],
      estado: 'activa',
      fechaCreacion: new Date().toISOString(),
      firma: await this.generateFirma(clave, env)
    };

    await env.LICENSES_KV.put(clave, JSON.stringify(license));

    return new Response(JSON.stringify({
      ok: true,
      clave,
      tipo,
      email: license.email,
      expira: license.expira,
      maxDispositivos: license.maxDispositivos,
      firma: license.firma
    }), { headers: CORS_HEADERS });
  },

  async handleRevoke(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${env.ADMIN_TOKEN}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: CORS_HEADERS
      });
    }

    const { clave } = await request.json();
    if (!clave) {
      return new Response(JSON.stringify({ error: 'Falta clave' }), {
        status: 400,
        headers: CORS_HEADERS
      });
    }

    const stored = await env.LICENSES_KV.get(clave.toUpperCase(), 'json');
    if (!stored) {
      return new Response(JSON.stringify({ error: 'Licencia no encontrada' }), {
        status: 404,
        headers: CORS_HEADERS
      });
    }

    stored.estado = 'revocada';
    stored.fechaRevocacion = new Date().toISOString();
    await env.LICENSES_KV.put(clave.toUpperCase(), JSON.stringify(stored));

    return new Response(JSON.stringify({ ok: true, mensaje: 'Licencia revocada' }), {
      headers: CORS_HEADERS
    });
  },

  async handleList(env) {
    const keys = await env.LICENSES_KV.list();
    const licenses = [];

    for (const key of keys.keys) {
      const data = await env.LICENSES_KV.get(key.name, 'json');
      if (data) {
        licenses.push({
          clave: key.name,
          tipo: data.tipo,
          email: data.email,
          estado: data.estado,
          expira: data.expira,
          dispositivos: data.dispositivos ? data.dispositivos.length : 0,
          maxDispositivos: data.maxDispositivos,
          fechaCreacion: data.fechaCreacion
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, licenses }), {
      headers: CORS_HEADERS
    });
  },

  async handleStats(env) {
    const keys = await env.LICENSES_KV.list();
    let total = 0, vip = 0, pro = 0, activas = 0, revocadas = 0;

    for (const key of keys.keys) {
      const data = await env.LICENSES_KV.get(key.name, 'json');
      if (!data) continue;
      total++;
      if (data.tipo === 'VIP') vip++;
      if (data.tipo === 'PRO') pro++;
      if (data.estado === 'activa') activas++;
      if (data.estado === 'revocada') revocadas++;
    }

    return new Response(JSON.stringify({
      ok: true,
      stats: { total, vip, pro, activas, revocadas }
    }), { headers: CORS_HEADERS });
  },

  async generateFirma(clave, env) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(env.HMAC_SECRET || 'default-secret');
    const key = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(clave));
    return [...new Uint8Array(signature)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
};
