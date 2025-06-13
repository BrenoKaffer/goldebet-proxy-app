// app.js
const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const app = express();

// A DigitalOcean App Platform nos dirá qual porta usar através de uma variável de ambiente.
// Se não for definida, usaremos 8080 por padrão.
const port = process.env.PORT || 8080;

// Configuração do proxy reverso para goldebet.bet.br
const goldebetProxy = createProxyMiddleware({
  target: "https://goldebet.bet.br", // Este é o site que queremos acessar
  changeOrigin: true, // Importante para que o site de destino responda corretamente
  secure: true, // Garante que a conexão com o site de destino seja segura (HTTPS)
  ws: true, // Habilita suporte a WebSockets, se o site de destino usar (ex: para chat ao vivo, jogos)

  // Esta função é CRÍTICA para iframes!
  // Ela intercepta os cabeçalhos de resposta do site de destino
  onProxyRes: function (proxyRes, req, res) {
    // Remove o cabeçalho 'X-Frame-Options', que impede o uso de iframes
    delete proxyRes.headers["x-frame-options"];
    delete proxyRes.headers["X-Frame-Options"];

    // Opcional: Se o site ainda não aparecer, pode ser o 'Content-Security-Policy'.
    // Remover ou modificar ele pode ser necessário, mas use com CUIDADO,
    // pois afeta a segurança do site original.
    // delete proxyRes.headers['content-security-policy'];
    // delete proxyRes.headers['Content-Security-Policy'];
  },
  logLevel: "info", // Mostra informações sobre o que o proxy está fazendo no log
});

// Diz ao nosso programa para usar o proxy para todas as requisições que ele receber
app.use("/", goldebetProxy);

// Inicia o nosso programa para que ele comece a "escutar" por requisições
app.listen(port, () => {
  console.log(`Proxy server rodando na porta ${port}`);
  console.log(
    `Acesse o site através da URL do seu aplicativo na DigitalOcean App Platform.`
  );
});
