const fs = require('fs');
const path = require('path');
const cluster = require('cluster');
const CoinKey = require('coinkey');
const crypto = require('crypto');

const numCPUs = 16;
const min = BigInt('0x20000000000000000');
const max = BigInt('0x3ffffffffffffffff');
const range = (max - min) / BigInt(numCPUs);
const wallets = ['13zb1hQbWVsc2S7ZTZnP2G4undNNpdh5so'];
const logFilePath = path.resolve(__dirname, 'progress-log.json');
const foundKeysPath = path.resolve(__dirname, 'found-keys.txt');

function generateRandomBigInt(min, max) {
    const range = max - min;
    const bytes = Math.ceil(range.toString(2).length / 8);
    let randomNumber;
    do {
        randomNumber = BigInt('0x' + crypto.randomBytes(bytes).toString('hex'));
    } while (randomNumber > range);
    return randomNumber + min;
}

function saveProgress(progressData) {
    fs.writeFileSync(logFilePath, JSON.stringify(progressData));
}

function readProgress() {
    if (fs.existsSync(logFilePath)) {
        return JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
    } else {
        let newProgressData = {};
        for (let i = 0; i < numCPUs; i++) {
            let workerMin = min + BigInt(i) * range;
            let workerMax = (i === numCPUs - 1 ? max : workerMin + range - 1n);
            let randomStart = generateRandomBigInt(workerMin, workerMax);

            newProgressData[i] = {
                workerMin: workerMin.toString(),
                workerMax: workerMax.toString(),
                lastProcessed: randomStart.toString()
            };
        }
        saveProgress(newProgressData);
        return newProgressData;
    }
}

function saveFoundKey(keyData) {
    fs.appendFileSync(foundKeysPath, keyData + '\n');
}

function generatePublic(privateKey) {
    const ck = new CoinKey(Buffer.from(privateKey, 'hex'));
    ck.compressed = true;
    return ck.publicAddress;
}

if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);
    let progressData = readProgress();

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork({
            WORKER_MIN: progressData[i].workerMin,
            WORKER_MAX: progressData[i].workerMax,
            WORKER_INDEX: i.toString()
        });
    }

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

        if (wallets.includes(generatePublic(pkey))) {
            console.log(`Wallet found by worker ${process.pid}. Private key: ${pkey}`);
            saveFoundKey(`Private Key: ${pkey}, Address: ${generatePublic(pkey)}`);
            break;
        }

        key += 1n;
        progressData[workerIndex].lastProcessed = key.toString();
        saveProgress(progressData);

        if (key % 1000n === 0n) {
            console.log(`Worker ${process.pid} processed ${key - BigInt(progressData[workerIndex].workerMin)} keys, currently at ${pkey}`);
        }
    }

    console.log(`Worker ${process.pid} completed processing.`);
    saveProgress(progressData);
    process.exit(0);
}