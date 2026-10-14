import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
env.allowLocalModels=false;
if(env.backends.onnx.wasm) { env.backends.onnx.wasm.numThreads=1; env.backends.onnx.wasm.wasmPaths='/whisper/'; }
let transcriber: AutomaticSpeechRecognitionPipeline | null=null;
let backend='wasm';
const createTranscriber=pipeline as unknown as (task:'automatic-speech-recognition',model:string,options:{device:'webgpu'|'wasm';dtype:'q8'|{encoder_model:'fp32';decoder_model_merged:'q4'};progress_callback:(value:unknown)=>void})=>Promise<AutomaticSpeechRecognitionPipeline>;
async function initialize() {
  if(transcriber) return;
  const progress_callback=(p:unknown)=>self.postMessage({type:'progress',detail:p});
  if('gpu' in navigator) {
    // Whisper's encoder is sensitive to quantization on GPU. Keep it in fp32.
    try { transcriber=await createTranscriber('automatic-speech-recognition','onnx-community/whisper-base',{device:'webgpu',dtype:{encoder_model:'fp32',decoder_model_merged:'q4'},progress_callback}); backend='webgpu'; }
    catch { self.postMessage({type:'fallback'}); }
  }
  if(!transcriber) transcriber=await createTranscriber('automatic-speech-recognition','onnx-community/whisper-base',{device:'wasm',dtype:'q8',progress_callback});
}
self.onmessage=async(event:MessageEvent<{type:string;audio?:Float32Array;id?:number}>)=>{
  try {
    await initialize();
    if(event.data.type==='init') { self.postMessage({type:'ready',backend}); return; }
    if(event.data.type==='transcribe' && event.data.audio) {
      const started=performance.now();
      const output=await transcriber!(event.data.audio,{language:'chinese',task:'transcribe',return_timestamps:false,max_new_tokens:128});
      const item=Array.isArray(output)?output[0]:output;
      self.postMessage({type:'result',text:item.text,id:event.data.id,ms:Math.round(performance.now()-started)});
    }
  } catch(error) { self.postMessage({type:'error',message:error instanceof Error?error.message:'語音辨識失敗',id:event.data.id}); }
};
