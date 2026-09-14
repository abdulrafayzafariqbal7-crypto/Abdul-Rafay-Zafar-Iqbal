const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const framesDir = path.join(publicDir, 'frames');
const apiDir = path.join(publicDir, 'api');

if (!fs.existsSync(apiDir)) {
  fs.mkdirSync(apiDir, { recursive: true });
}

let frameFiles = [];
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

if (frameFiles.length === 0) {
  for (let i = 1; i <= 240; i++) {
    frameFiles.push(`ezgif-frame-${String(i).padStart(3, '0')}.jpg`);
  }
}

const manifest = {
  totalFrames: frameFiles.length,
  frameDirectory: 'frames',
  frames: frameFiles
};

const outputPath = path.join(apiDir, 'frames.json');
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf-8');
console.log(`Successfully generated ${outputPath} with ${frameFiles.length} frames.`);
