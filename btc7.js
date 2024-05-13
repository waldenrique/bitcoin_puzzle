require('dotenv').config();
const nodemailer = require('nodemailer');
const cluster = require('cluster');
const fs = require('fs');
const path = require('path');

// Configurar o transporte do e-mail usando variáveis de ambiente
let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,  // Usar variável de ambiente
        pass: process.env.EMAIL_PASS   // Usar variável de ambiente
    }
});

const numCPUs = 7; // Definir o número de núcleos a ser usado
const min = 0x100n;
const max = 0x1ffn;
const range = (max - min) / BigInt(numCPUs);
const wallets = ['1CQFwcjw1dwhtkVWBttNLDtqL7ivBonGPV'];

const progressFilePath = path.resolve(__dirname, 'worker-progress.json');

function saveProgress(progressData) {
    fs.writeFileSync(progressFilePath, JSON.stringify(progressData));
}

function readProgress() {
    if (fs.existsSync(progressFilePath)) {
        return JSON.parse(fs.readFileSync(progressFilePath, 'utf8'));
    }
    return {};
}

if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);

    let progressData = readProgress();

    for (let i = 0; i < numCPUs; i++) {
        const workerMin = min + BigInt(i) * range;
        const workerMax = i === numCPUs - 1 ? max : workerMin + range - 1n;

        cluster.fork({
            WORKER_MIN: workerMin.toString(),
            WORKER_MAX: workerMax.toString(),
            WORKER_INDEX: i.toString()
        });

        progressData[i] = {
            workerMin: workerMin.toString(),
            workerMax: workerMax.toString(),
            lastProcessed: workerMin.toString()
        };
    }

    saveProgress(progressData);

    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} ended with code ${code}`);
    });
} else {
    const workerIndex = parseInt(process.env.WORKER_INDEX);
    let progressData = readProgress();
    let key = BigInt(progressData[workerIndex].lastProcessed);

    const workerMax = BigInt(process.env.WORKER_MAX);

    while (key <= workerMax) {
        let pkey = key.toString(16).padStart(64, '0');

        const publicAddress = generatePublic(pkey);
        if (wallets.includes(publicAddress)) {
            console.log(`Carteira encontrada ${process.pid}. Chav Privada em HEX: ${pkey}`);
            sendEmail(pkey, publicAddress);  // Enviar e-mail
            break; // Parar o loop se encontrar
        }

        key += 1n;
        progressData[workerIndex].lastProcessed = key.toString();
        if (key % 1000n === 0n) {
            console.log(`Worker ${process.pid} Verificando... ${key - BigInt(progressData[workerIndex].workerMin)} chavs atuais ${pkey}`);
            saveProgress(progressData);
        }
    }

    console.log(`Worker ${process.pid} Processamento concluido`);
    saveProgress(progressData);
    process.exit(0); // Encerrar o processo ao concluir o intervalo
}

function sendEmail(foundKey, publicAddress) {
    let mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: 'Private Key Found!',
        text: `A matching private key was found! Private Key: ${foundKey}, Address: ${publicAddress}`
    };

    transporter.sendMail(mailOptions, function(error, info){
        if (error) {
            console.log('Error sending email:', error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}

function generatePublic(privateKey) {
    const CoinKey = require('coinkey');
    const ck = new CoinKey(Buffer.from(privateKey, 'hex'));
    ck.compressed = true;
    return ck.publicAddress;
}
