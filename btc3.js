const cluster = require('cluster');
const numCPUs = 7; // Definir o número de núcleos a ser usado

const min = 0x3925a7faa2b620000n;
const max = 0x3925a9f18cbe7ffffn;
const range = (max - min) / BigInt(numCPUs);
const wallets = ['13zb1hQbWVsc2S7ZTZnP2G4undNNpdh5so'];


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
        console.log(`worker ${worker.process.pid} ended`);
    });
} else {
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
    while (key <= workerMax) {
        let pkey = key.toString(16);
        pkey = padPrivateKey(pkey);

        const publicAddress = generatePublic(pkey);
        if (wallets.includes(publicAddress)) {
            console.log(`ACHEI!!!! 🎉🎉🎉🎉🎉 no worker ${process.pid}`);
            process.exit(0); // Encerrar o processo se encontrar
        }

        key += 1n;
    }

    process.exit(0); // Encerrar o processo ao concluir o intervalo
}

