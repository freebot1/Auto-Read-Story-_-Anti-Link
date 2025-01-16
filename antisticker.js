const config = require('./config'); // Impor konfigurasi
const { getRandomImageUrl } = require('./gambaranimegc'); // Impor getRandomImageUrl

async function antisticker(client, m) {
  if (config.antisticker) {
    const messageType = Object.keys(m.message)[0];
    if (messageType === 'stickerMessage' && m.key.remoteJid.endsWith('@g.us')) {
      try {
        const senderId = m.key.participant || m.key.remoteJid;
        const groupMetadata = await client.groupMetadata(m.key.remoteJid);
        const isAdmin = groupMetadata.participants.some(p => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin'));

        if (isAdmin) {
          const imageUrl = getRandomImageUrl();
          await client.sendMessage(m.key.remoteJid, { 
            image: { url: imageUrl },
            caption: `🚫 @${senderId.split('@')[0]}, Anda adalah admin di grup ini, jadi stiker Anda tidak akan dihapus. Terima kasih telah mematuhi aturan grup. 🙏`, 
            mentions: [senderId], 
            quoted: m 
          });
        } else {
          const imageUrl = getRandomImageUrl();
          await client.sendMessage(m.key.remoteJid, { 
            image: { url: imageUrl },
            caption: `🚫 @${senderId.split('@')[0]}, mengirim stiker tidak diperbolehkan di grup ini. Stiker akan dihapus. 🙏`, 
            mentions: [senderId], 
            quoted: m 
          });
          await client.sendMessage(m.key.remoteJid, { delete: m.key });
          console.log(`🗑️ Stiker dari @${senderId.split('@')[0]} telah dihapus di grup ${m.key.remoteJid}.`);
        }
      } catch (error) {
        console.error('⚠️ Terjadi kesalahan saat menghapus stiker:', error);
      }
    }
  }
}

module.exports = { antisticker };
