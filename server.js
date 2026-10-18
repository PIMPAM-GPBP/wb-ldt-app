// Custom server entry point for Posit Connect's Node.js content type.
//
// Connect's rsconnect-python auto-detects the entry point by looking for
// (1) package.json "main", (2) scripts.start matching "node <file>", or
// (3) a root file named app.js/index.js/server.js/main.js. Next.js's own
// "next start" CLI doesn't fit any of those patterns, so this file exists
// purely to give Connect something it recognizes: a plain file that starts
// an HTTP server and listens on process.env.PORT.
//
// This assumes `next build` has already produced a `.next` production
// build before this file runs (see the postinstall step in package.json).

const { createServer } = require('http');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const port = process.env.PORT || 3000;

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(port, () => {
    console.log(`> Ready on port ${port}`);
  });
});