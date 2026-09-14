const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const framesDir = path.join(process.cwd(), 'public', 'frames');
  let frameFiles = [];

  try {
    if (fs.existsSync(framesDir)) {
      frameFiles = fs.readdirSync(framesDir)
        .filter(f => /\.(jpe?g|png|webp)$/i.test(f))
        .sort((a, b) => {
          const matchA = a.match(/\d+/);
          const matchB = b.match(/\d+/);
          const numA = matchA ? parseInt(matchA[0], 10) : 0;
          const numB = matchB ? parseInt(matchB[0], 10) : 0;
          return numA - numB;
        });
    }
  } catch (err) {
    console.error('Error scanning frames directory:', err);
  }

  if (frameFiles.length === 0) {
    for (let i = 1; i <= 240; i++) {
      frameFiles.push(`ezgif-frame-${String(i).padStart(3, '0')}.jpg`);
    }
  }

  return res.status(200).json({
    totalFrames: frameFiles.length,
    frameDirectory: 'frames',
    frames: frameFiles
  });
};
