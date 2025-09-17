// Vercel Serverless proxy to forward all /api/* requests to the backend
// This avoids browser mixed-content and CORS issues in production.

export default async function handler(req, res) {
  try {
    const targetBase = 'http://13.213.63.82';
    // Preserve the original path and query (starts with /api/...)
    const targetUrl = targetBase + req.url;

    // Clone headers and adjust Host
    const headers = { ...req.headers };
    delete headers['accept-encoding'];
    headers['host'] = '13.213.63.82';

    const method = req.method || 'GET';
    const isBodyless = method === 'GET' || method === 'HEAD';

    // Use Node 18+ fetch to forward the request
    const response = await fetch(targetUrl, {
      method,
      headers,
      body: isBodyless ? undefined : req,
      // Keep timeouts to platform defaults; avoid following redirects implicitly
      redirect: 'manual',
    });

    // Copy status and headers
    res.status(response.status);
    response.headers.forEach((value, key) => {
      // Avoid overriding forbidden headers
      if (key.toLowerCase() === 'transfer-encoding') return;
      res.setHeader(key, value);
    });

    // Stream/body passthrough
    const buf = Buffer.from(await response.arrayBuffer());
    res.end(buf);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: 'Bad Gateway', message });
  }
}

