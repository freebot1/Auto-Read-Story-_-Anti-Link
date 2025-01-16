const config = require('./config'); // Impor konfigurasi

// Fungsi autoTyping
async function autoTyping(client, m) {
  if (config.autoTyping) {
    // Tangani kondisi undefined tanpa menampilkan pesan di log console
    if (m.key.id && m.key.remoteJid) {
      await client.sendPresenceUpdate('composing', m.key.remoteJid); // Kirim status typing
      setTimeout(async () => {
        await client.sendPresenceUpdate('paused', m.key.remoteJid); // Hentikan status typing setelah durasi yang ditentukan
      }, config.typingDuration);
    }
  }
}

// Fungsi autoRecord
async function autoRecord(client, m) {
  if (config.autoRecord) {
    // Tangani kondisi undefined tanpa menampilkan pesan di log console
    if (m.key.id && m.key.remoteJid) {
      await client.sendPresenceUpdate('recording', m.key.remoteJid); // Kirim status recording
      setTimeout(async () => {
        await client.sendPresenceUpdate('paused', m.key.remoteJid); // Hentikan status recording setelah durasi yang ditentukan
      }, config.recordDuration);
    }
  }
}

// Fungsi sendReadReceipt
async function sendReadReceipt(client, m) {
  if (config.sendReadReceipt) {
    // Tangani kondisi undefined tanpa menampilkan pesan di log console
    if (m.key.id && m.key.remoteJid) {
      await client.readMessages([{ remoteJid: m.key.remoteJid, id: m.key.id, participant: m.key.participant }]);
    }
  }
}

module.exports = { autoTyping, autoRecord, sendReadReceipt };
