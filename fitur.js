const config = require('./config'); // Impor konfigurasi
const axios = require('axios'); // Impor axios untuk mengambil gambar
const fs = require('fs'); // Impor fs untuk menyimpan dan memuat data dari file
const path = require('path'); // Impor path untuk mengelola path file
const { getRandomImageUrl } = require('./gambaranimegc'); // Impor getRandomImageUrl

function saveGroupInfo(groupId, data) {
  const dirPath = path.join(__dirname, 'notifgc');
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath);
  }
  const filePath = path.join(dirPath, `group_info_${groupId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function loadGroupInfo(groupId) {
  const filePath = path.join(__dirname, 'notifgc', `group_info_${groupId}.json`);
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath);
    return JSON.parse(data);
  }
  return { previousDesc: 'Tidak ada deskripsi sebelumnya', previousName: 'Tidak ada nama sebelumnya' };
}

// Fungsi untuk mengirim pesan selamat datang dan selamat tinggal
const sendWelcomeGoodbyeMessage = async (client, groupId, participant, type) => {
  try {
    const participantId = participant.split('@')[0];
    const groupMetadata = await client.groupMetadata(groupId);
    const memberCount = groupMetadata.participants.length;
    const adminCount = groupMetadata.participants.filter(p => p.admin).length;
    const groupOwner = groupMetadata.owner || groupMetadata.participants.find(p => p.admin === 'superadmin').id;
    const creationDate = new Date(groupMetadata.creation * 1000);
    const formattedCreationDate = creationDate.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let messageText = '';
    let imageUrl = '';

    if (type === 'add' && config.welcome) {
      messageText = `Selamat datang @${participantId} di grup kami! Semoga betah ya! 🎉`;
    } else if (type === 'remove' && config.goodbye) {
      messageText = `Selamat tinggal @${participantId}, semoga sukses di tempat yang baru! 🌟`;
    } else {
      return; // Jika fitur dinonaktifkan, keluar dari fungsi
    }

    imageUrl = getRandomImageUrl();

    const caption = `
────────────────────────────
${messageText}
────────────────────────────
Nama Grup: ${groupMetadata.subject} 📛
────────────────────────────
Jumlah Anggota: ${memberCount} 👥
────────────────────────────
Jumlah Admin: ${adminCount} 👮
────────────────────────────
Pembuat Grup: @${groupOwner.split('@')[0]} 👑
────────────────────────────
Grup Dibuat Pada: ${formattedCreationDate} 📅
────────────────────────────
Deskripsi Grup: ${groupMetadata.desc} 📝
────────────────────────────
    `;

    const { default: chalk } = await import('chalk'); // Impor chalk secara dinamis
    await client.sendMessage(groupId, { image: { url: imageUrl }, caption: caption, mentions: [participant, groupOwner] });
    console.log(chalk.green(`Sent ${type === 'add' ? 'welcome' : 'goodbye'} message to ${groupId}`));
  } catch (e) {
    if (e.message.includes('forbidden')) {
      console.error(`Bot tidak memiliki izin untuk mengirim pesan di grup ${groupId}`);
    } else {
      console.error(`Error sending ${type === 'add' ? 'welcome' : 'goodbye'} message:`, e);
      if (!config.continueOnError) throw e;
    }
  }
};

// Fungsi untuk merespon perubahan info grup
const handleGroupInfoChange = async (client, update) => {
  if (config.groupInfoChange) {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const { id, desc, subject, announce, restrict, author } = update;
        const groupMetadata = await client.groupMetadata(id);
        const groupOwner = groupMetadata.owner || groupMetadata.participants.find(p => p.admin === 'superadmin').id;
        const adminCount = groupMetadata.participants.filter(p => p.admin).length;
        const creationDate = new Date(groupMetadata.creation * 1000);
        const formattedCreationDate = creationDate.toLocaleDateString('id-ID', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        let changeType = '';
        if (desc) changeType = 'Deskripsi';
        if (subject) changeType = 'Nama Grup';
        if (announce !== undefined) changeType = 'Pengaturan Pengumuman';
        if (restrict !== undefined) changeType = 'Pengaturan Edit Info';

        const previousInfo = loadGroupInfo(id);

        const messageText = `Perubahan ${changeType} grup telah dilakukan oleh admin @${author.split('@')[0]}.`;
        const imageUrl = getRandomImageUrl();

        const caption = `
────────────────────────────
${messageText}
────────────────────────────
Nama Grup Saat Ini: ${groupMetadata.subject} 📛
Nama Grup Sebelumnya: ${previousInfo.previousName} 📛
────────────────────────────
Jumlah Anggota: ${groupMetadata.participants.length} 👥
────────────────────────────
Jumlah Admin: ${adminCount} 👮
────────────────────────────
Pembuat Grup: @${groupOwner.split('@')[0]} 👑
────────────────────────────
Deskripsi Grup Saat Ini: ${groupMetadata.desc} 📝
Deskripsi Grup Sebelumnya: ${previousInfo.previousDesc} 📝
────────────────────────────
Grup Dibuat Pada: ${formattedCreationDate} 📅
────────────────────────────
        `;

        const { default: chalk } = await import('chalk'); // Impor chalk secara dinamis
        await client.sendMessage(id, { image: { url: imageUrl }, caption: caption, mentions: [groupOwner, author] });

        console.log(chalk.green(`Sent group info change message to ${id}`));

        // Simpan informasi grup setelah perubahan
        saveGroupInfo(id, { previousDesc: groupMetadata.desc, previousName: groupMetadata.subject });

        break; // Keluar dari loop jika berhasil
      } catch (e) {
        attempt++;
        if (e.message.includes('Timed Out')) {
          console.error(`Attempt ${attempt} failed: Timed Out. Retrying...`);
        } else {
          console.error(`Error sending group info change message:`, e);
          if (!config.continueOnError) throw e;
          break; // Keluar dari loop jika bukan kesalahan timeout
        }
      }
    }
  }
};

// Fungsi untuk merespon perubahan status admin
const handleAdminStatusChange = async (client, update) => {
  if (config.adminStatusChangeNotification) {
    const { id, participants, action } = update;

    for (const participant of participants) {
      const participantId = participant.split('@')[0];
      const groupMetadata = await client.groupMetadata(id);
      const adminCount = groupMetadata.participants.filter(p => p.admin).length;
      const memberCount = groupMetadata.participants.length;
      const groupOwner = groupMetadata.owner || groupMetadata.participants.find(p => p.admin === 'superadmin').id;
      const creationDate = new Date(groupMetadata.creation * 1000);
      const formattedCreationDate = creationDate.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      let messageText = '';
      if (action === 'promote') {
        messageText = `Selamat @${participantId}, Anda telah diangkat menjadi admin oleh @${update.author.split('@')[0]}!`;
      } else if (action === 'demote') {
        messageText = `@${participantId} telah dicabut status adminnya oleh @${update.author.split('@')[0]}.`;
      } else {
        return; // Jika bukan aksi promote atau demote, keluar dari fungsi
      }

      const caption = `
────────────────────────────
${messageText}
────────────────────────────
Jumlah Admin Saat Ini: ${adminCount} 👮
────────────────────────────
Jumlah Anggota: ${memberCount} 👥
────────────────────────────
Grup Dibuat Pada: ${formattedCreationDate} 📅
────────────────────────────
Pembuat Grup: @${groupOwner.split('@')[0]} 👑
────────────────────────────
      `;

      try {
        const ppUrl = await client.profilePictureUrl(participant, 'image');
        const { default: chalk } = await import('chalk'); // Impor chalk secara dinamis
        await client.sendMessage(id, { image: { url: ppUrl }, caption: caption, mentions: [participant, update.author, groupOwner] });
        console.log(chalk.green(`Sent admin status change message to ${id}`));
      } catch (error) {
        if (error.message.includes('item-not-found')) {
          const randomImageUrl = getRandomImageUrl();
          const { default: chalk } = await import('chalk'); // Impor chalk secara dinamis
          await client.sendMessage(id, { image: { url: randomImageUrl }, caption: caption, mentions: [participant, update.author, groupOwner] });
          console.log(chalk.green(`Sent admin status change message to ${id} with random image`));
        } else {
          console.error('Error fetching profile picture:', error);
        }
      }
    }
  }
}

const warningCounts = loadWarningCounts(); // Menyimpan jumlah peringatan untuk setiap pengguna

function saveWarningCounts() {
  fs.writeFileSync('peringatan.json', JSON.stringify(warningCounts, null, 2));
}

function loadWarningCounts() {
  if (fs.existsSync('peringatan.json')) {
    const data = fs.readFileSync('peringatan.json');
    return JSON.parse(data);
  }
  return {};
}

function resetWarningCount(senderId) {
  if (warningCounts[senderId]) {
    delete warningCounts[senderId];
    saveWarningCounts();
  }
}

function resetAllWarningCounts() {
  for (const senderId in warningCounts) {
    delete warningCounts[senderId];
  }
  saveWarningCounts();
}

if (config.autoResetWarnings) {
  setInterval(resetAllWarningCounts, config.resetWarningInterval);
}

const warningMessagesGC = [
  (senderId) => `🚫 Peringatan pertama (1/5) @${senderId.split('@')[0]}! Mohon tidak mengirim link grup di sini. Terima kasih. 🙏`,
  (senderId) => `🚫 Peringatan kedua (2/5) @${senderId.split('@')[0]}! Link grup tidak diperbolehkan. Mohon kerjasamanya. 🙏`,
  (senderId) => `🚫 Peringatan ketiga (3/5) @${senderId.split('@')[0]}! Tolong hentikan mengirim link grup. Terima kasih atas pengertiannya. 🙏`,
  (senderId) => `🚫 Peringatan keempat (4/5) @${senderId.split('@')[0]}! Link grup dilarang di sini. Mohon dipatuhi. 🙏`,
  (senderId) => `🚫 Peringatan terakhir (5/5) @${senderId.split('@')[0]}! Anda akan dikeluarkan jika mengirim link lagi. Mohon pengertiannya. 🙏`
];

const warningMessagesChannel = [
  (senderId) => `🚫 Peringatan pertama (1/5) @${senderId.split('@')[0]}! Mohon tidak mengirim link channel di sini. Terima kasih. 🙏`,
  (senderId) => `🚫 Peringatan kedua (2/5) @${senderId.split('@')[0]}! Link channel tidak diperbolehkan. Mohon kerjasamanya. 🙏`,
  (senderId) => `🚫 Peringatan ketiga (3/5) @${senderId.split('@')[0]}! Tolong hentikan mengirim link channel. Terima kasih atas pengertiannya. 🙏`,
  (senderId) => `🚫 Peringatan keempat (4/5) @${senderId.split('@')[0]}! Link channel dilarang di sini. Mohon dipatuhi. 🙏`,
  (senderId) => `🚫 Peringatan terakhir (5/5) @${senderId.split('@')[0]}! Anda akan dikeluarkan jika mengirim link lagi. Mohon pengertiannya. 🙏`
];

// Fungsi untuk menghapus pesan yang mengandung link grup di grup
async function antilinkgc(client, m) {
  if (config.antilinkGC) {
    const linkRegex = /chat\.whatsapp\.com\/[^\s]+/g;
    const groupButtonRegex = /(Lihat group|Bergabung ke group)/i;
    const readmoreRegex = /(readmore|Baca selengkapnya)/i;
    const messageContent = m.message?.conversation || m.message?.extendedTextMessage?.text || m.message?.buttonsResponseMessage?.selectedButtonId || m.message?.listResponseMessage?.singleSelectReply?.selectedRowId || m.message?.templateButtonReplyMessage?.selectedId || '';

    if (m.key.remoteJid.endsWith('@g.us') && (linkRegex.test(messageContent) || groupButtonRegex.test(messageContent) || readmoreRegex.test(messageContent))) {
      try {
        const senderId = m.key.participant || m.key.remoteJid;
        const groupMetadata = await client.groupMetadata(m.key.remoteJid);
        const isAdmin = groupMetadata.participants.some(p => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin'));

        if (isAdmin) {
          await client.sendMessage(m.key.remoteJid, { 
            text: `🚫 Kamu admin di grup ini, tenang saja @${senderId.split('@')[0]}. Link grup tidak akan dihapus oleh bot. 😎`, 
            mentions: [senderId], 
            quoted: m 
          });
        } else {
          if (!warningCounts[senderId]) {
            warningCounts[senderId] = 0;
          }
          warningCounts[senderId]++;
          saveWarningCounts();

          if (warningCounts[senderId] > 5) {
            if (config.autoKick) {
              const imageUrl = getRandomImageUrl();
              await client.sendMessage(m.key.remoteJid, { 
                text: `🚫 @${senderId.split('@')[0]} telah dikeluarkan dari grup karena mengirim link grup lebih dari 5 kali. Mohon untuk tidak mengirim link grup di sini. Terima kasih. 🙏`, 
                mentions: [senderId], 
                quoted: m 
              });
              console.log(`🗑️ @${senderId.split('@')[0]} telah dikeluarkan dari grup ${m.key.remoteJid} karena mengirim link grup lebih dari 5 kali.`);
              await client.sendMessage(m.key.remoteJid, { delete: m.key });
              console.log(`🗑️ Pesan yang mengandung Link Group dari @${senderId.split('@')[0]} telah dihapus di grup ${m.key.remoteJid}.`);
              await client.groupParticipantsUpdate(m.key.remoteJid, [senderId], 'remove');
            } else {
              const imageUrl = getRandomImageUrl();
              await client.sendMessage(m.key.remoteJid, { 
                text: `🚫 Waduh, fitur auto kick dimatikan oleh bot. @${senderId.split('@')[0]} tidak dikeluarkan dari grup meskipun mengirim link grup lebih dari 5 kali. Mohon untuk tidak mengirim link grup di sini. Terima kasih. 🙏`, 
                mentions: [senderId], 
                quoted: m 
              });
              console.log(`🗑️ Fitur auto kick dimatikan oleh bot. @${senderId.split('@')[0]} tidak dikeluarkan dari grup ${m.key.remoteJid} meskipun mengirim link grup lebih dari 5 kali.`);
              await client.sendMessage(m.key.remoteJid, { delete: m.key });
              console.log(`🗑️ Pesan yang mengandung Link Group dari @${senderId.split('@')[0]} telah dihapus di grup ${m.key.remoteJid}.`);
            }
          } else {
            const warningMessage = warningMessagesGC[warningCounts[senderId] - 1](senderId);
            await client.sendMessage(m.key.remoteJid, { 
              text: warningMessage, 
              mentions: [senderId], 
              quoted: m 
            });
            await client.sendMessage(m.key.remoteJid, { delete: m.key });
            console.log(`🗑️ Pesan yang mengandung Link Group dari @${senderId.split('@')[0]} telah dihapus di grup ${m.key.remoteJid}. Peringatan ${warningCounts[senderId]}/5.`);
          }
        }
      } catch (error) {
        console.error('⚠️ Terjadi kesalahan saat menghapus pesan yang mengandung Link Group:', error);
      }
    }
  }
}

// Fungsi untuk menghapus pesan yang mengandung link channel di grup
async function antilinkchannel(client, m) {
  if (config.antilinkChannel) {
    const linkRegex = /whatsapp\.com\/channel\/[^\s]+/g;
    const messageContent = m.message?.conversation || m.message?.extendedTextMessage?.text || m.message?.buttonsResponseMessage?.selectedButtonId || m.message?.listResponseMessage?.singleSelectReply?.selectedRowId || m.message?.templateButtonReplyMessage?.selectedId || '';

    if (m.key.remoteJid.endsWith('@g.us') && linkRegex.test(messageContent)) {
      try {
        const senderId = m.key.participant || m.key.remoteJid;
        const groupMetadata = await client.groupMetadata(m.key.remoteJid);
        const isAdmin = groupMetadata.participants.some(p => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin'));

        if (isAdmin) {
          await client.sendMessage(m.key.remoteJid, { 
            text: `🚫 Kamu admin di grup ini, tenang saja @${senderId.split('@')[0]}. Link channel tidak akan dihapus oleh bot. 😎`, 
            mentions: [senderId], 
            quoted: m 
          });
        } else {
          if (!warningCounts[senderId]) {
            warningCounts[senderId] = 0;
          }
          warningCounts[senderId]++;
          saveWarningCounts();

          if (warningCounts[senderId] > 5) {
            if (config.autoKick) {
              const imageUrl = getRandomImageUrl();
              await client.sendMessage(m.key.remoteJid, { 
                text: `🚫 @${senderId.split('@')[0]} telah dikeluarkan dari grup karena mengirim link channel lebih dari 5 kali. Mohon untuk tidak mengirim link channel di sini. Terima kasih. 🙏`, 
                mentions: [senderId], 
                quoted: m 
              });
              console.log(`🗑️ @${senderId.split('@')[0]} telah dikeluarkan dari grup ${m.key.remoteJid} karena mengirim link channel lebih dari 5 kali.`);
              await client.sendMessage(m.key.remoteJid, { delete: m.key });
              console.log(`🗑️ Pesan yang mengandung Link Channel dari @${senderId.split('@')[0]} telah dihapus di grup ${m.key.remoteJid}.`);
              await client.groupParticipantsUpdate(m.key.remoteJid, [senderId], 'remove');
            } else {
              const imageUrl = getRandomImageUrl();
              await client.sendMessage(m.key.remoteJid, { 
                text: `🚫 Waduh, fitur auto kick dimatikan oleh bot. @${senderId.split('@')[0]} tidak dikeluarkan dari grup meskipun mengirim link channel lebih dari 5 kali. Mohon untuk tidak mengirim link channel di sini. Terima kasih. 🙏`, 
                mentions: [senderId], 
                quoted: m 
              });
              console.log(`🗑️ Fitur auto kick dimatikan oleh bot. @${senderId.split('@')[0]} tidak dikeluarkan dari grup ${m.key.remoteJid} meskipun mengirim link channel lebih dari 5 kali.`);
              await client.sendMessage(m.key.remoteJid, { delete: m.key });
              console.log(`🗑️ Pesan yang mengandung Link Channel dari @${senderId.split('@')[0]} telah dihapus di grup ${m.key.remoteJid}.`);
            }
          } else {
            const warningMessage = warningMessagesChannel[warningCounts[senderId] - 1](senderId);
            await client.sendMessage(m.key.remoteJid, { 
              text: warningMessage, 
              mentions: [senderId], 
              quoted: m 
            });
            await client.sendMessage(m.key.remoteJid, { delete: m.key });
            console.log(`🗑️ Pesan yang mengandung Link Channel dari @${senderId.split('@')[0]} telah dihapus di grup ${m.key.remoteJid}. Peringatan ${warningCounts[senderId]}/5.`);
          }
        }
      } catch (error) {
        console.error('⚠️ Terjadi kesalahan saat menghapus pesan yang mengandung Link Channel:', error);
      }
    }
  }
}

// Fungsi untuk mereset peringatan ketika seseorang keluar dan masuk lagi ke grup
async function handleParticipantUpdate(client, update) {
  const { id, participants, action } = update;
  if (action === 'remove' || action === 'add') {
    for (const participant of participants) {
      resetWarningCount(participant);
    }
  }
}

module.exports = { 
  sendWelcomeGoodbyeMessage, 
  handleGroupInfoChange, 
  handleAdminStatusChange,
  antilinkgc, 
  antilinkchannel, 
  handleParticipantUpdate, 
  resetAllWarningCounts 
};
