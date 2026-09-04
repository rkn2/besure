var ALLOWED_ORIGINS = ['https://rkn2.github.io'];
var WRITE_ACTIONS = { submit: true, submitPlacement: true };

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

    var target = new URL(env.APPS_SCRIPT_URL);
    url.searchParams.forEach(function (v, k) {
      if (k !== 'key') target.searchParams.set(k, v);
    });
    target.searchParams.set('key', env.WRITE_KEY);

    var resp = await fetch(target.toString(), { redirect: 'follow' });
    var body = await resp.text();

    return new Response(body, {
      headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders),
    });
  },
};
