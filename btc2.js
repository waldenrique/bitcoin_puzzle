const CoinKey = require('coinkey');

const min = 0x20000003710898810n; // Usar BigInt diretamente
const max = 0x200000037108a4b5fn; // Usar BigInt diretamente

const wallets = ['13zb1hQbWVsc2S7ZTZnP2G4undNNpdh5so'];

let key = BigInt(min);

function generatePublic(privateKey) {
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

while (key <= max) {
    let pkey = key.toString(16);
    pkey = padPrivateKey(pkey);

    const publicAddress = generatePublic(pkey);
    console.log(`Private Key: ${pkey}`);
    console.log(`Public Address: ${publicAddress}`);

    if (wallets.includes(publicAddress)) {
        console.log('ACHEI!!!! 🎉🎉🎉🎉🎉');
        break; // Sair do loop se encontrar
    }

    key += 1n; // Incrementar usando BigInt
}
