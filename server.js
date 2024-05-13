const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const bodyParser = require('body-parser');
const cluster = require('cluster');
const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(express.static('public')); // Serve arquivos estáticos da pasta 'public'
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.post('/start', (req, res) => {
    const numCPUs = parseInt(req.body.numCPUs) || require('os').cpus().length; // Define o número de CPUs com base no input do usuário ou usa todos disponíveis
    const min = BigInt(req.body.min); // Chave mínima do input do usuário
    const max = BigInt(req.body.max); // Chave máxima do input do usuário
    const wallets = req.body.wallets.split(','); // Lista de endereços de carteiras

    if (cluster.isMaster) {
        console.log('Configuração do mestre completa. Servidor rodando em http://localhost:3000');
        server.listen(3000);

        for (let i = 0; i < numCPUs; i++) {
            const range = (max - min) / BigInt(numCPUs);
            const workerMin = min + BigInt(i) * range;
            const workerMax = i === numCPUs - 1 ? max : workerMin + range - 1n;

            cluster.fork({
                WORKER_MIN: workerMin.toString(),
                WORKER_MAX: workerMax.toString()
            });
        }

        cluster.on('exit', (worker, code, signal) => {
            io.emit('worker_status', { pid: worker.process.pid, status: 'parou' });
        });

        res.send('Trabalhadores iniciados');
    }
});

server.listen(3000, () => console.log('Servidor escutando na porta 3000'));
 