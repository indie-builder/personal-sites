import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

// Regression: GIF transparency optimization erased the solid black hair around frame 70.
const asset = fileURLToPath(new URL('../app/src/main/res/raw/opening_character.gif', import.meta.url));
const frames = execFileSync('ffmpeg', ['-v', 'error', '-i', asset, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 50 * 1024 * 1024 });
const stride = 350 * 343 * 3;
assert.equal(frames.length / stride, 100, 'Expected the original 100 frames');
for (let frame = 0; frame < 100; frame++) {
  let dark = 0;
  for (let i = frame * stride; i < (frame + 1) * stride; i += 3) {
    if (frames[i] < 60 && frames[i + 1] < 60 && frames[i + 2] < 60) dark++;
  }
  assert.ok(dark > 1500, `Frame ${frame}: solid character lost (${dark} dark pixels)`);
  if (frame === 70) {
    let hair = 0;
    for (let y = 65; y < 120; y++) for (let x = 130; x < 230; x++) {
      const i = frame * stride + (y * 350 + x) * 3;
      if (frames[i] < 60 && frames[i + 1] < 60 && frames[i + 2] < 60) hair++;
    }
    assert.ok(hair > 2000, `Frame 70: hair fill disappeared (${hair} dark pixels)`);
  }
}
console.log('PASS: all 100 frames retain the solid character');
