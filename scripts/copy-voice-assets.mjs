import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { mkdir, readdir, copyFile, rm } from 'node:fs/promises';
const require = createRequire(import.meta.url);
try {
  const vadRoot = dirname(require.resolve('@ricky0123/vad-web'));
  const vadRequire = createRequire(require.resolve('@ricky0123/vad-web'));
  const ortRoot = dirname(vadRequire.resolve('onnxruntime-web'));
  await rm('public/voice', { recursive: true, force:true });
  await mkdir('public/voice', { recursive: true });
  for (const folder of [vadRoot, ortRoot]) {
    for (const name of await readdir(folder)) {
      if (['silero_vad_v5.onnx','vad.worklet.bundle.min.js','ort-wasm-simd-threaded.wasm','ort-wasm-simd-threaded.mjs'].includes(name))
        await copyFile(join(folder, name), join('public/voice', name));
    }
  }
  const transformerRequire=createRequire(require.resolve('@huggingface/transformers'));
  const transformerOrt=dirname(transformerRequire.resolve('onnxruntime-web'));
  await mkdir('public/whisper',{recursive:true});
  for(const name of await readdir(transformerOrt)) if(/^ort-wasm-simd-threaded(\.jsep)?\.(wasm|mjs)$/.test(name)) await copyFile(join(transformerOrt,name),join('public/whisper',name));
  console.log('Voice assets ready.');
} catch (error) { console.error('Voice assets failed:', error); process.exitCode = 1; }
