// app.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

// --- NOVAS DEPENDÊNCIAS PARA O PROXY RESIDENCIAL ---
// Usaremos 'https-proxy-agent' para configurar o agente de proxy HTTP/HTTPS
// e 'url' para parsear a URL do proxy.
// Você precisará instalar 'https-proxy-agent' e 'url' (url já é nativo do Node.js, mas vou incluir a importação).
const { HttpsProxyAgent } = require('https-proxy-agent');
const url = require('url');
// --- FIM DAS NOVAS DEPENDÊNCIAS ---

const app = express();
const port = process.env.PORT || 8080;

// --- CONFIGURAÇÕES DO SEU PROXY RESIDENCIAL ---
// É ALTAMENTE RECOMENDÁVEL usar variáveis de ambiente para estas credenciais
// na DigitalOcean App Platform. Vamos configurá-las lá depois.
const PROXY_HOST = process.env.PROXY_HOST || 'res.proxy-sale.com';
const PROXY_PORT = process.env.PROXY_PORT || '10000';
const PROXY_USERNAME = process.env.PROXY_USERNAME || 'e659ad216930464b';
const PROXY_PASSWORD = process.env.PROXY_PASSWORD || 'RNW78Fm5';

// Crie a URL completa do seu proxy residencial com autenticação
const proxyUrl = `http://${PROXY_USERNAME}:${PROXY_PASSWORD}@${PROXY_HOST}:${PROXY_PORT}`;
const agent = new HttpsProxyAgent(proxyUrl);
// --- FIM DAS CONFIGURAÇÕES DO PROXY RESIDENCIAL ---

// Configuração do proxy reverso para goldebet.bet.br
const goldebetProxy = createProxyMiddleware({
    target: 'https://goldebet.bet.br', // Este é o site que queremos acessar
    changeOrigin: true, // Importante para que o site de destino responda corretamente
    secure: true, // Garante que a conexão com o site de destino seja segura (HTTPS)
    ws: true, // Habilita suporte a WebSockets, se o site de destino usar (ex: para chat ao vivo, jogos)

    // --- ADICIONE ESTA LINHA PARA USAR O PROXY RESIDENCIAL ---
    agent: agent, // O agente que fará as requisições através do seu proxy residencial
    // --- FIM DA ADIÇÃO ---

    // Esta função é CRÍTICA para iframes!
    // Ela intercepta os cabeçalhos de resposta do site de destino
    onProxyRes: function (proxyRes, req, res) {
        // Remove o cabeçalho 'X-Frame-Options', que impede o uso de iframes
        delete proxyRes.headers['x-frame-options'];
        delete proxyRes.headers['X-Frame-Options'];

        // Opcional: Se o site ainda não aparecer, pode ser o 'Content-Security-Policy'.
        // Remover ou modificar ele pode ser necessário, mas use com CUIDADO,
        // pois afeta a segurança do site original.
        // delete proxyRes.headers['content-security-policy'];
        // delete proxyRes.headers['Content-Security-Policy'];
    },
    logLevel: 'info', // Mostra informações sobre o que o proxy está fazendo no log
});

// Diz ao nosso programa para usar o proxy para todas as requisições que ele receber
app.use('/', goldebetProxy);

// Inicia o nosso programa para que ele comece a "escutar" por requisições
app.listen(port, () => {
    console.log(`Proxy server rodando na porta ${port}`);
    console.log(`Acessando goldebet.bet.br via proxy residencial: ${PROXY_HOST}:${PROXY_PORT}`);
    console.log(`Acesse o site através da URL do seu aplicativo na DigitalOcean App Platform.`);
});
