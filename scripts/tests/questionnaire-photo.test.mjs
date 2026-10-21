// The questionnaire photo screen: load /superhuman/index.html in jsdom and
// drive the picker.
//
// What is being protected here is the shrink. The forms worker is on
// Cloudflare's free plan, which allows 10ms of CPU per request, and it
// decodes and hashes every uploaded byte before Notion is called. Sending
// an original phone photo blows that budget, the request fails, and the
// member loses the whole questionnaire rather than just the photo. So the
// page must never send the file it was given.
//
// jsdom has no canvas, so createImageBitmap and toBlob are stubbed and the
// assertions are on how the page calls them: the size it draws at, the type
// and quality it asks for, and what it does when any of it fails.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const site = (rel) => fileURLToPath(new URL('../../' + rel, import.meta.url));
const HTML = fs.readFileSync(site('superhuman/index.html'), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Boots the page and replaces the two things jsdom cannot do for real.
// `bitmap` is the source the page will be handed; `blobSize` is what the
// stubbed encoder claims it produced.
function boot({ bitmap = { width: 3000, height: 2000 }, blobSize = 148 * 1024,
                noBitmap = false, failBitmap = false, failBlob = false } = {}) {
  const vc = new VirtualConsole();           // swallow jsdom's "not implemented" noise
  const dom = new JSDOM(HTML, {
    url: 'https://timerich.ai/superhuman/', runScripts: 'dangerously',
    pretendToBeVisual: true, virtualConsole: vc,
  });
  const w = dom.window;
  w.scrollTo = () => {};

  const calls = { bitmap: [], toBlob: [], canvas: [] };

  if (noBitmap) {
    delete w.createImageBitmap;
  } else {
    w.createImageBitmap = (file, opts) => {
      calls.bitmap.push({ name: file && file.name, opts });
      if (failBitmap) return Promise.reject(new Error('cannot decode'));
      return Promise.resolve({ width: bitmap.width, height: bitmap.height, close() { calls.closed = true; } });
    };
  }

  // The canvas records the size it was asked to draw at. drawImage is a
  // no-op: what matters is the geometry, not the pixels.
  w.HTMLCanvasElement.prototype.getContext = function () { return { drawImage() {} }; };
  w.HTMLCanvasElement.prototype.toBlob = function (cb, type, quality) {
    calls.toBlob.push({ type, quality });
    calls.canvas.push({ width: this.width, height: this.height });
    if (failBlob) return cb(null);
    // A Blob the page can read: FileReader is real in jsdom, so the data
    // URL it produces is a real one.
    cb(new w.Blob([new Uint8Array(blobSize)], { type: 'image/jpeg' }));
  };

  return { w, calls };
}

// A stand-in for a picked file. jsdom has File, so this is a real one.
const pick = (w, { name = 'portrait.jpg', type = 'image/jpeg', size = 4 * 1024 * 1024 } = {}) => {
  const file = new w.File([''], name, { type });
  // A 4MB File of real bytes is pointless here; the page only reads .size.
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

const shrink = (w, file) => new Promise((resolve) => w.qShrinkPhoto(file, resolve));

console.log('\nThe photo is shrunk before it is sent');
{
  const { w, calls } = boot();
  const out = await shrink(w, pick(w));

  check('the file is decoded with its EXIF orientation applied',
    calls.bitmap.length === 1 && calls.bitmap[0].opts &&
    calls.bitmap[0].opts.imageOrientation === 'from-image', calls.bitmap);
  check('and the decoded bitmap is released once it is drawn', calls.closed === true);

  check('it is re-encoded as JPEG at 0.85',
    calls.toBlob.length === 1 && calls.toBlob[0].type === 'image/jpeg' &&
    calls.toBlob[0].quality === 0.85, calls.toBlob);

  // 3000x2000 scaled so the longest side is 800: 800x533.
  const drawn = calls.canvas[0];
  check('the longest side is brought down to 800', drawn.width === 800, drawn);
  check('and the shape of the photo is kept', drawn.height === 533, drawn);
  check('neither side is over 800', Math.max(drawn.width, drawn.height) <= 800, drawn);

  check('what comes back is the re-encoded JPEG, not the original',
    out && out.type === 'image/jpeg' && out.size === 148 * 1024, out && { type: out.type, size: out.size });
  check('and it is a data URL the preview can show',
    out && /^data:image\/jpeg;base64,/.test(out.dataUrl), out && out.dataUrl.slice(0, 32));
}

console.log('\nA portrait photo, and one already small enough');
{
  // Taller than it is wide: the 800 has to land on the height.
  const { w, calls } = boot({ bitmap: { width: 1200, height: 1600 } });
  await shrink(w, pick(w));
  check('a portrait photo is capped on its height', calls.canvas[0].height === 800, calls.canvas[0]);
  check('and its width scaled to match', calls.canvas[0].width === 600, calls.canvas[0]);
}
{
  const { w, calls } = boot({ bitmap: { width: 400, height: 300 } });
  await shrink(w, pick(w, { size: 90 * 1024 }));
  check('a photo already under 800 is never blown up',
    calls.canvas[0].width === 400 && calls.canvas[0].height === 300, calls.canvas[0]);
}

console.log('\nWhen the browser cannot do it');
{
  const { w } = boot({ failBitmap: true });
  check('a file that will not decode comes back as nothing', (await shrink(w, pick(w))) === null);
}
{
  const { w } = boot({ failBlob: true });
  check('an encoder that produces nothing comes back as nothing', (await shrink(w, pick(w))) === null);
}
{
  // An older browser with no createImageBitmap: the <img> path. jsdom never
  // loads the object URL, so this only proves the page does not throw and
  // does not silently hand back the original.
  const { w, calls } = boot({ noBitmap: true });
  w.URL.createObjectURL = () => 'blob:stub';
  w.URL.revokeObjectURL = () => {};
  let settled = false;
  w.qShrinkPhoto(pick(w), () => { settled = true; });
  await sleep(50);
  check('the fallback path is taken without calling createImageBitmap', calls.bitmap.length === 0);
  check('and nothing is sent before the image has loaded', settled === false);
}

console.log('\nThe picker on the screen');
{
  // The real field, built by the page, driven through its change handler.
  const { w, calls } = boot();
  const spec = w.Q_SPEC.find((s) => s.key === 'photo_link');
  check('the photo screen is still its own type', spec && spec.type === 'photo', spec && spec.type);

  const field = w.qBuildPhotoField(spec);
  w.document.body.appendChild(field);
  const input = field.querySelector('.q-photo-input');

  check('the picker offers the three types the worker can store',
    input.accept === 'image/jpeg,image/png,image/webp', input.accept);

  const choose = async (file) => {
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new w.Event('change'));
    await sleep(50);
  };

  // A 4MB photo: allowed in, and what is held is the shrunk version.
  await choose(pick(w, { size: 4 * 1024 * 1024 }));
  check('a 4MB photo is accepted', w.qPhoto !== null);
  check('and what is held for sending is the shrunk JPEG',
    w.qPhoto && w.qPhoto.size === 148 * 1024 && w.qPhoto.type === 'image/jpeg',
    w.qPhoto && { size: w.qPhoto.size, type: w.qPhoto.type });
  check('the preview shows the shrunk image',
    field.querySelector('.q-photo-img').src === w.qPhoto.dataUrl);
  check('and says the size that will actually be sent',
    /148KB/.test(field.querySelector('.q-photo-meta').textContent),
    field.querySelector('.q-photo-meta').textContent);

  // Over 5MB is still refused on the original, before anything is decoded.
  const before = calls.toBlob.length;
  await choose(pick(w, { size: 6 * 1024 * 1024 }));
  check('a file over 5MB is still refused up front', w.qPhoto === null);
  check('without being decoded at all', calls.toBlob.length === before, calls.toBlob.length);
  check('with the message the brief sets',
    w.document.getElementById('qError').textContent === 'Please choose a JPG, PNG or WebP under 5MB.',
    w.document.getElementById('qError').textContent);

  // The wrong type, whatever its size.
  await choose(pick(w, { name: 'shot.heic', type: 'image/heic', size: 2 * 1024 * 1024 }));
  check('a HEIC is refused on its type', w.qPhoto === null);
  check('and told the same thing',
    w.document.getElementById('qError').textContent === 'Please choose a JPG, PNG or WebP under 5MB.');
}

console.log('\nA LinkedIn link pasted the way people paste it');
{
  const { w } = boot();
  for (const [given, want] of [
    ['www.linkedin.com/in/x', 'https://www.linkedin.com/in/x'],
    ['linkedin.com/company/acme', 'https://linkedin.com/company/acme'],
    ['http://linkedin.com/in/x?trk=1', 'https://linkedin.com/in/x'],
    ['https://www.linkedin.com/in/x?isSelfProfile=true', 'https://www.linkedin.com/in/x'],
  ]) {
    check('the page accepts ' + given, w.qLinkedInUrl(given) === want, w.qLinkedInUrl(given));
  }
  for (const bad of ['www.linkedin/in/x', 'notlinkedin.com/in/x', 'www.linkedin.com/feed/', '']) {
    check('and still refuses ' + (bad || '(empty)'), w.qLinkedInUrl(bad) === null, w.qLinkedInUrl(bad));
  }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
