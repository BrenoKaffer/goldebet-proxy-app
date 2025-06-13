const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const { Buffer } = require("buffer");
const https = require("https");

const app = express();
const port = process.env.PORT || 8080; // Usa porta dinâmica da App Platform (com fallback local)

// 🔁 Rota de teste
app.get("/ping", (req, res) => {
  res.send("✅ Servidor está rodando na DigitalOcean App Platform!");
});

// 🔁 Rota para mostrar IP público da App Platform
app.get("/my-ip", (req, res) => {
  https
    .get("https://api.ipify.org?format=json", (ipRes) => {
      let data = "";
      ipRes.on("data", (chunk) => (data += chunk));
      ipRes.on("end", () => {
        try {
          const ipInfo = JSON.parse(data);
          res.status(200).send(`🌐 IP público da App Platform: ${ipInfo.ip}`);
        } catch {
          res.status(500).send("Erro ao processar IP.");
        }
      });
    })
    .on("error", () => {
      res.status(500).send("Erro ao buscar IP externo.");
    });
});

// 🔁 Proxy reverso para goldebet.bet.br
const webProxy = createProxyMiddleware({
  target: "https://www.paddle.com",
  changeOrigin: true,
  secure: true,
  ws: true,
  selfHandleResponse: true,
  timeout: 10000,
  proxyTimeout: 10000,

  onProxyRes: async (proxyRes, req, res) => {
    let body = Buffer.from([]);
    const timeoutId = setTimeout(() => {
      if (!res.headersSent) {
        res.writeHead(504, { "Content-Type": "text/html" });
        res.end(
          `<h1>⏳ Timeout</h1><p>Tempo limite excedido ao acessar o site de destino.</p>`
        );
      }
      proxyRes.destroy();
    }, 10000);

    proxyRes.on("data", (chunk) => {
      body = Buffer.concat([body, chunk]);
    });

    proxyRes.on("end", () => {
      clearTimeout(timeoutId);
      const contentType = proxyRes.headers["content-type"] || "";

      try {
        if (contentType.includes("text/html")) {
          let html = body.toString("utf8");
          html = html.replace(
            /<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi,
            ""
          );

          const headers = { ...proxyRes.headers };
          delete headers["x-frame-options"];
          delete headers["X-Frame-Options"];
          delete headers["content-security-policy"];
          delete headers["Content-Security-Policy"];
          headers["x-frame-options"] = "";
          headers["content-security-policy"] = "";
          headers["content-length"] = Buffer.byteLength(html);
          headers["content-type"] = contentType;

          res.writeHead(proxyRes.statusCode || 200, headers);
          res.end(html);
        } else {
          res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
          res.end(body);
        }
      } catch (err) {
        console.error("Erro processando resposta do proxy:", err.message);
        if (!res.headersSent) {
          res.writeHead(502, { "Content-Type": "text/html" });
          res.end(`<h1>❌ Erro interno no proxy</h1><p>${err.message}</p>`);
        }
      }
    });
  },

  onError: (err, req, res) => {
    console.error("Erro no proxy:", err.message);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end(`<h1>⚠️ Erro do proxy</h1><p>${err.message}</p>`);
    }
  },

  logLevel: "info",
});

app.use("/", webProxy);

// 🔁 Início do servidor
app.listen(port, "0.0.0.0", () => {
  console.log(`✅ Servidor rodando na porta ${port}`);
  console.log(`🔁 Acessando https://goldebet.bet.br via proxy`);
});
