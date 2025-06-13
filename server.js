// server.js
const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { Buffer } = require("buffer");
const https = require("https"); // Necessário para o endpoint /my-ip

const app = express();
const port = process.env.PORT || 8080; // ATENÇÃO: Com fallback para 8080 para facilitar teste local

// --- CONFIGURAÇÕES DO SEU PROXY RESIDENCIAL ---
const PROXY_HOST = process.env.PROXY_HOST;
const PROXY_PORT = process.env.PROXY_PORT;
const PROXY_USERNAME = process.env.PROXY_USERNAME;
const PROXY_PASSWORD = process.env.PROXY_PASSWORD;

// Logs para depuração das variáveis de ambiente do proxy
console.log("Variáveis de Ambiente Proxy:");
console.log("PROXY_HOST:", PROXY_HOST);
console.log("PROXY_PORT:", PROXY_PORT);
console.log(
  "PROXY_USERNAME (primeiros 4 chars):",
  PROXY_USERNAME ? PROXY_USERNAME.substring(0, 4) + "..." : "N/A"
);
console.log("PROXY_PASSWORD (presente):", !!PROXY_PASSWORD);

let proxyAgent = null;
let proxyUrl = null;

if (PROXY_HOST && PROXY_PORT && PROXY_USERNAME && PROXY_PASSWORD) {
  proxyUrl = `http://<span class="math-inline">\{PROXY\_USERNAME\}\:</span>{PROXY_PASSWORD}@<span class="math-inline">\{PROXY\_HOST\}\:</span>{PROXY_PORT}`;
  proxyAgent = new HttpsProxyAgent(proxyUrl);
  console.log(
    "Proxy URL construída (apenas hostname:port):",
    `<span class="math-inline">\{PROXY\_HOST\}\:</span>{PROXY_PORT}`
  );
} else {
  console.warn(
    "Aviso: Credenciais de proxy residencial incompletas. Não será usado proxy residencial."
  );
}

// Configuração do site de destino (Goldebet)
const targetSite = "https://goldebet.bet.br";

// Endpoint para retornar o IP de saída do App Platform
app.get("/my-ip", (req, res) => {
  https
    .get("https://api.ipify.org?format=json", (ipRes) => {
      let data = "";
      ipRes.on("data", (chunk) => {
        data += chunk;
      });
      ipRes.on("end", () => {
        try {
          const ipInfo = JSON.parse(data);
          res
            .status(200)
            .send(`O IP de saída do seu App Platform é: ${ipInfo.ip}`);
        } catch (e) {
          res.status(500).send("Não foi possível obter o IP de saída.");
        }
      });
    })
    .on("error", (e) => {
      res.status(500).send(`Erro ao tentar obter o IP: ${e.message}`);
    });
});

// Endpoint de teste básico para verificar se o servidor está ativo
app.get("/ping", (req, res) => {
  res.send("Servidor funcionando na App Platform ✅");
});

const webProxy = createProxyMiddleware({
  target: targetSite,
  changeOrigin: true, // Muda o cabeçalho 'Host' para o domínio de destino
  secure: true, // Garante que a conexão com o destino seja HTTPS (com verificação de certificado)
  ws: true, // Habilita suporte a WebSockets (se o site de destino usar)

  agent: proxyAgent, // Utiliza o agente de proxy residencial

  selfHandleResponse: true, // Ativa o modo de manipular a resposta manualmente

  timeout: 10000, // timeout total da requisição (10 segundos)
  proxyTimeout: 10000, // timeout da conexão com o proxy residencial (10 segundos)

  onProxyRes: async (proxyRes, req, res) => {
    let body = Buffer.from([]);

    const responseTimeout = setTimeout(() => {
      console.error("Proxy response timeout exceeded for:", req.url);
      if (!res.headersSent) {
        res.writeHead(504, { "Content-Type": "text/html" });
        res.end(
          "<h1>⚠️ Conteúdo bloqueado ou indisponível</h1><p>O site de destino não pôde ser carregado pelo proxy devido a um tempo limite da resposta.</p><p>Verifique os logs da aplicação na DigitalOcean para mais detalhes.</p>"
        );
      }
      proxyRes.destroy();
    }, 10000);

    proxyRes.on("data", (chunk) => {
      body = Buffer.concat([body, chunk]);
    });

    proxyRes.on("end", () => {
      clearTimeout(responseTimeout);

      try {
        const contentType = proxyRes.headers["content-type"] || "";

        if (contentType.includes("text/html")) {
          let html = body.toString("utf8");
          // Remove meta tags CSP do corpo do HTML
          html = html.replace(
            /<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi,
            ""
          );

          const headers = { ...proxyRes.headers };
          // Remove cabeçalhos X-Frame-Options e Content-Security-Policy
          delete headers["x-frame-options"];
          delete headers["X-Frame-Options"];

          delete headers["content-security-policy"];
          delete headers["Content-Security-Policy"];

          headers["content-length"] = Buffer.byteLength(html);
          headers["x-frame-options"] = "";
          headers["content-security-policy"] = "";
          headers["content-type"] = contentType;

          res.writeHead(proxyRes.statusCode || 200, headers);
          res.end(html);
        } else {
          res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
          res.end(body);
        }
      } catch (err) {
        console.error(
          "Erro processando resposta do proxy (onProxyRes end event):",
          err.message
        );
        if (!res.headersSent) {
          res.writeHead(502, { "Content-Type": "text/html" });
          res.end(
            "<h1>❌ Erro de processamento interno do proxy</h1><p>O proxy encontrou um erro ao tentar processar o conteúdo do site de destino.</p><p>Detalhes: " +
              err.message +
              "</p><p>Verifique os logs da aplicação na DigitalOcean para mais detalhes.</p>"
          );
        }
      }
    });
  },
  onError: (err, req, res) => {
    console.error("Erro no proxy (onError):", err.message);
    let errorMessage = "Erro interno no proxy. ";

    if (err.code === "ETIMEDOUT") {
      errorMessage += "A conexão com o site de destino expirou.";
    } else if (err.code === "ECONNREFUSED") {
      errorMessage += "A conexão com o site de destino foi recusada.";
    } else {
      errorMessage += err.message;
    }

    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end(
        "<h1>⚠️ Erro do Servidor do Proxy</h1><p>" +
          errorMessage +
          "</p><p>Verifique os logs da aplicação na DigitalOcean para mais detalhes.</p>"
      );
    }
  },
  logLevel: "info",
});

app.use("/", webProxy);

app.listen(port, "0.0.0.0", () => {
  console.log(`✅ Servidor rodando na porta ${port}`);
  console.log(`Acessando ${targetSite} via proxy residencial.`);
  console.log(
    `Acesse o site através da URL do seu aplicativo na DigitalOcean App Platform.`
  );
});
