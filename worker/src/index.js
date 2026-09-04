var ALLOWED_ORIGINS = ['https://rkn2.github.io'];
var WRITE_ACTIONS = { submit: true, submitPlacement: true, acceptAndPlace: true };

async function verifyTurnstile(token, ip, env) {
  var resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'secret=' + encodeURIComponent(env.TURNSTILE_SECRET) + '&response=' + encodeURIComponent(token) + '&remoteip=' + encodeURIComponent(ip),
  });
  var result = await resp.json();
  return result.success === true;
}

async function callAppsScript(params, env) {
  var target = new URL(env.APPS_SCRIPT_URL);
  Object.keys(params).forEach(function (k) {
    target.searchParams.set(k, params[k]);
  });
  target.searchParams.set('key', env.WRITE_KEY);
  var resp = await fetch(target.toString(), { redirect: 'follow' });
  return resp.json();
}

export default {
  async fetch(request, env) {
    var origin = request.headers.get('Origin') || '';
    var allowed = ALLOWED_ORIGINS.indexOf(origin) !== -1;
    var corsHeaders = {
      'Access-Control-Allow-Origin': allowed ? origin : '',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (!allowed) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    var url = new URL(request.url);
    var action = url.searchParams.get('action') || '';

    if (!WRITE_ACTIONS[action]) {
      return new Response(JSON.stringify({ error: 'only write actions are proxied' }), {
        status: 400,
        headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders),
      });
    }

    var token = url.searchParams.get('cf-turnstile-response') || '';
    if (!token) {
      return new Response(JSON.stringify({ error: 'missing turnstile token' }), {
        status: 403,
        headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders),
      });
    }

    var ip = request.headers.get('CF-Connecting-IP') || '';
    var valid = await verifyTurnstile(token, ip, env);
    if (!valid) {
      return new Response(JSON.stringify({ error: 'turnstile verification failed' }), {
        status: 403,
        headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders),
      });
    }

    var headers = Object.assign({ 'Content-Type': 'application/json' }, corsHeaders);

    if (action === 'acceptAndPlace') {
      var placementResult = await callAppsScript({
        action: 'submitPlacement',
        studentEmail: url.searchParams.get('studentEmail') || '',
        studentName: url.searchParams.get('studentName') || '',
        facultyName: url.searchParams.get('facultyName') || '',
        periodType: url.searchParams.get('periodType') || '',
        label1: url.searchParams.get('label1') || '',
        label2: url.searchParams.get('label2') || '',
        fund1: url.searchParams.get('fund1') || '',
        fund2: url.searchParams.get('fund2') || '',
      }, env);

      if (!placementResult.success) {
        return new Response(JSON.stringify(placementResult), { headers: headers });
      }

      var submitResult = await callAppsScript({
        action: 'submit',
        page: url.searchParams.get('page') || '',
        studentEmail: url.searchParams.get('studentEmail') || '',
        studentName: url.searchParams.get('studentName') || '',
        facultyName: url.searchParams.get('facultyName') || '',
        status: 'Accepted',
      }, env);

      return new Response(JSON.stringify(submitResult), { headers: headers });
    }

    var params = {};
    url.searchParams.forEach(function (v, k) {
      if (k !== 'cf-turnstile-response') params[k] = v;
    });
    var result = await callAppsScript(params, env);

    return new Response(JSON.stringify(result), { headers: headers });
  },
};
