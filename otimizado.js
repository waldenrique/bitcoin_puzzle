// Importação de módulos necessários
const fs = require('fs');
const path = require('path');
const cluster = require('cluster');
const CoinKey = require('coinkey'); // Certifique-se de ter essa biblioteca instalada

// Definição de parâmetros principais
const numCPUs = 32; // Número de trabalhadores
const min = 0x80000n; // Limite inferior do intervalo total
const max = 0xfffffn; // Limite superior do intervalo total
const range = (max - min) / BigInt(numCPUs); // Tamanho do intervalo para cada trabalhador
const wallets = ['1HsMJxNiV7TLxmoF6uJNkydxPFDog4NQum']; // Lista de endereços de carteira a serem encontrados
const logFilePath = path.resolve(__dirname, 'progress-log.json'); // Caminho do arquivo de log de progresso
const foundKeysPath = path.resolve(__dirname, 'found-keys.txt'); // Caminho do arquivo de chaves encontradas

// Estratégias de processamento
const strategies = ['sequential', 'reverse', 'random'];

// Função para salvar o progresso no arquivo de log
function saveProgress(progressData) {
    fs.writeFileSync(logFilePath, JSON.stringify(progressData));
}

// Função para ler o progresso do arquivo de log
function readProgress() {
    if (fs.existsSync(logFilePath)) {
        return JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
    } else {
        let newProgressData = {};
        for (let i = 0; i < numCPUs; i++) {
            let workerMin = min + BigInt(i) * range;
            let workerMax = (i === numCPUs - 1 ? max : workerMin + range - 1n);
            newProgressData[i] = {
                workerMin: workerMin.toString(),
                workerMax: workerMax.toString(),
                lastProcessed: workerMin.toString(),
                strategy: strategies[Math.floor(Math.random() * strategies.length)] // Atribui estratégia aleatória a cada trabalhador
            };
        }
        saveProgress(newProgressData);
        return newProgressData;
    }
}

// Função para salvar a chave encontrada no arquivo
function saveFoundKey(keyData) {
    fs.appendFileSync(foundKeysPath, keyData + '\n');
}

// Função para gerar o endereço público a partir da chave privada
function generatePublic(privateKey) {
    const ck = new CoinKey(Buffer.from(privateKey, 'hex'));
    ck.compressed = true;
    return ck.publicAddress;
}

// Se o processo é o mestre
if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);
    let progressData = readProgress();

    // Criação de trabalhadores
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork({
            WORKER_MIN: progressData[i].workerMin,
            WORKER_MAX: progressData[i].workerMax,
            WORKER_INDEX: i.toString(),
            WORKER_STRATEGY: progressData[i].strategy
        });
    }

    // Evento de saída dos trabalhadores
    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} ended with code ${code}`);
    });
} else {
    // Código executado pelos trabalhadores
    const workerIndex = parseInt(process.env.WORKER_INDEX);
    const strategy = process.env.WORKER_STRATEGY;
    let progressData = readProgress();
    let workerMin = BigInt(progressData[workerIndex].workerMin);
    let workerMax = BigInt(progressData[workerIndex].workerMax);
    let key;

    // Inicializa a chave com base na estratégia
    if (strategy === 'reverse') {
        key = BigInt(progressData[workerIndex].lastProcessed) || workerMax;
    } else {
        key = BigInt(progressData[workerIndex].lastProcessed) || workerMin;
    }

    // Loop de processamento de chaves
    while ((strategy === 'sequential' && key <= workerMax) ||
           (strategy === 'reverse' && key >= workerMin) ||
           (strategy === 'random')) {

        let pkey = key.toString(16).padStart(64, '0');

        // Verifica se o endereço público gerado é um dos endereços procurados
        if (wallets.includes(generatePublic(pkey))) {
            console.log(`Wallet found by worker ${process.pid}. Private key: ${pkey}`);
            saveFoundKey(`Private Key: ${pkey}, Address: ${generatePublic(pkey)}`);
            break;
        }

        // Incrementa ou decrementa a chave com base na estratégia
        if (strategy === 'sequential') {
            key += 1n;
        } else if (strategy === 'reverse') {
            key -= 1n;
        } else if (strategy === 'random') {
            key = workerMin + BigInt(Math.floor(Math.random() * Number(workerMax - workerMin + 1n)));
        }

        // Atualiza o progresso
        progressData[workerIndex].lastProcessed = key.toString();

        // Salva o progresso periodicamente
        if (key % 1000n === 0n) {
            console.log(`Worker ${process.pid} processed ${key - workerMin} keys, currently at ${pkey}`);
            saveProgress(progressData);
        }
    }

    // Finaliza o processamento do trabalhador
    console.log(`Worker ${process.pid} completed processing.`);
    saveProgress(progressData);
    process.exit(0);
}
