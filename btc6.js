const nodemailer = require('nodemailer');

// Configurar o transporte do e-mail
let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
     
    }
});

const cluster = require('cluster');
const numCPUs = 7; // Definir o número de núcleos a ser usado

const min = 0x100n;
const max = 0x1ffn;
const range = (max - min) / BigInt(numCPUs);
const wallets = ['1CQFwcjw1dwhtkVWBttNLDtqL7ivBonGPV'];

if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);

    // Inicia os workers
    for (let i = 0; i < numCPUs; i++) {
        const workerMin = min + BigInt(i) * range;
        const workerMax = i === numCPUs - 1 ? max : workerMin + range - 1n;

        cluster.fork({
            WORKER_MIN: workerMin.toString(),
            WORKER_MAX: workerMax.toString()
        });
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} ended`);
    });
} else {
    
    function sendEmail(foundKey, publicAddress) {
        let mailOptions = {
            from: 'lojaprojetosp@gmail.com',
            to: 'lojaprojetosp@gmail.com',
            subject: 'Chave Privada Encontrada!',
            text: `Uma chave privada correspondente foi encontrada! Chave Privada: ${foundKey}, Endereço: ${publicAddress}`
        };
    
        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
                console.log('Erro ao enviar e-mail:', error);
            } else {
                console.log('E-mail enviado: ' + info.response);
            }
        });
    }
   
    const workerMin = BigInt(process.env.WORKER_MIN);
    const workerMax = BigInt(process.env.WORKER_MAX);

    function generatePublic(privateKey) {
        const CoinKey = require('coinkey');
        const ck = new CoinKey(Buffer.from(privateKey, 'hex'));
        ck.compressed = true;
        return ck.publicAddress;
    }

    function padPrivateKey(pkey) {
        while (pkey.length < 64) {
            pkey = '0' + pkey;
        }
        return pkey;
    }

    let key = workerMin;
    let counter = 0;
    while (key <= workerMax) {
        let pkey = key.toString(16);
        pkey = padPrivateKey(pkey);

        const publicAddress = generatePublic(pkey);
        if (wallets.includes(publicAddress)) {
            console.log(`Carteira encontrada no worker ${process.pid}. Chave privada: ${pkey}`);
            sendEmail(pkey, publicAddress);  // Enviar e-mail
            process.exit(0); // Encerrar o processo se encontrar
        }

        key += 1n;
        counter++;
        if (counter % 1000 === 0) {  // Ajuste conforme necessário para mais ou menos frequência
            console.log(`Worker ${process.pid} processed ${counter} keys, currently at ${pkey}`);
        }
    }

    console.log(`Worker ${process.pid} completed processing.`);
    process.exit(0); // Encerrar o processo ao concluir o inte
