import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const adb = process.env.ADB || '/opt/homebrew/share/android-commandlinetools/platform-tools/adb';
const serial = process.env.ANDROID_SERIAL || 'emulator-5554';
const run = (...args) => execFileSync(adb, ['-s', serial, ...args], { encoding: 'utf8' });
const bounds = new Set();
for (let sample = 0; sample < 20; sample++) {
  const xml = run('exec-out', 'uiautomator', 'dump', '/dev/tty');
  const node = xml.match(/<node\b[^>]*>/g)?.find(node => node.includes('text="十余年项目开发经验'));
  assert.ok(node, 'Open About at the top before running this check');
  bounds.add(node.match(/bounds="([^"]+)"/)[1]);
  assert.equal(bounds.size, 1, `Biography moved during greeting playback: ${[...bounds]}`);
  await new Promise(resolve => setTimeout(resolve, 700));
}
console.log(`PASS: biography bounds unchanged across 20 samples: ${[...bounds]}`);
