const imageUrls = [
  "https://files.catbox.moe/wdmwak.jpg",
  "https://files.catbox.moe/1vvl3c.jpg",
  "https://files.catbox.moe/azbrp4.jpg",
  "https://files.catbox.moe/zrezka.jpg",
  "https://files.catbox.moe/iemyvc.png"
];

function getRandomImageUrl() {
  const randomIndex = Math.floor(Math.random() * imageUrls.length);
  return imageUrls[randomIndex];
}

module.exports = { getRandomImageUrl };
