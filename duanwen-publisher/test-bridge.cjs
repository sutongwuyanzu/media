const {spawn}=require('node:child_process');
const path=require('node:path');
process.env.DUANWEN_TEST_PIPE = `\\\\.\\pipe\\duanwen-test-${process.pid}`;
const host=spawn(process.execPath,[path.join(__dirname,'native-host.cjs')],{stdio:['pipe','pipe','pipe']});
let b=Buffer.alloc(0);
host.stdout.on('data', c=>{b=Buffer.concat([b,c]);if(b.length<4||b.length<4+b.readUInt32LE(0))return;const m=JSON.parse(b.subarray(4,4+b.readUInt32LE(0)));const out=Buffer.from(JSON.stringify({id:m.id,ok:true,extensionId:'test',version:'test'}));const h=Buffer.alloc(4);h.writeUInt32LE(out.length);host.stdin.write(Buffer.concat([h,out]));});
setTimeout(()=>{const cli=spawn(process.execPath,[path.join(__dirname,'bridge.cjs'),'ping']);let out='';cli.stdout.on('data',c=>out+=c);cli.on('exit',code=>{host.kill();try{const r=JSON.parse(out);if(code!==0||r.extensionId!=='test')throw Error('bad response');console.log('native bridge roundtrip passed');}catch(e){console.error(e.message);process.exitCode=1;}});},500);
setTimeout(()=>{host.kill();process.exit(1)},8000).unref();
