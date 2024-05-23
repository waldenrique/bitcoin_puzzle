const fs = require('fs');
const path = require('path');

const logFilePath = path.resolve(__dirname, 'progress-log.json');
const foundKeysPath = path.resolve(__dirname, 'found-keys.txt');

function resetProgress() {
    // Limpar o arquivo de log de progresso
    if (fs.existsSync(logFilePath)) {
        fs.unlinkSync(logFilePath);
        console.log('Progress log has been reset.');
    } else {
        console.log('No progress log file found to reset.');
    }

    // Opcional: Limpar o arquivo de chaves encontradas
    if (fs.existsSync(foundKeysPath)) {
        fs.unlinkSync(foundKeysPath);
        console.log('Found keys file has been reset.');
    } else {
        console.log('No found keys file found to reset.');
    }
}

resetProgress();
