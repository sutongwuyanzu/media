const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const pipe = process.env.DUANWEN_TEST_PIPE || `\\\\.\\pipe\\duanwen-sync-${process.env.USERNAME}`;
let request;
try {
  if (process.argv[2] === 'ping') request = {action:'ping'};
  else if (process.argv[2] === 'fill' && process.argv[3]) {
    const task = JSON.parse(fs.readFileSync(process.argv[3],'utf8').replace(/^\uFEFF/,''));
    if (!['xiaohongshu','douyin'].includes(task.platform) || typeof task.title !== 'string' || !task.title.trim() || typeof task.content !== 'string' || !task.content.trim() || !Array.isArray(task.imagePaths) || !task.imagePaths.length) throw Error('任务需要平台、标题、正文和图片路径');
    task.images = task.imagePaths.map(p=>{
      if (!path.isAbsolute(p)) throw Error('图片必须使用绝对路径');
      const ext=path.extname(p).toLowerCase();
      const type=({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'})[ext];
      if (!type) throw Error('不支持的图片格式');
      return {name:path.basename(p), type, data:`data:${type};base64,${fs.readFileSync(p).toString('base64')}`};
    });
    delete task.imagePaths;
    request={action:'fill',task};
  } else throw Error('用法：node bridge.cjs ping 或 fill <任务JSON>');
  if (Buffer.byteLength(JSON.stringify(request),'utf8') > 15000000) throw Error('图片和任务超过当前通信上限，请压缩图片');
} catch (e) { console.error(e.message); process.exit(2); }
const socket = net.createConnection(pipe);
socket.setEncoding('utf8'); socket.setTimeout(request.action==='fill'?185000:12000);
socket.on('connect', () => socket.write(JSON.stringify(request)+'\n'));
let data=''; socket.on('data', c => data+=c);
socket.on('end', () => { try { const result=JSON.parse(data); console.log(JSON.stringify(result)); if (!result.ok) process.exitCode=1; } catch { console.error('无效响应'); process.exitCode=1; } });
socket.on('timeout', () => { console.error('连接超时，任务状态未确认'); socket.destroy(); process.exitCode=1; });
socket.on('error', () => { console.error('扩展尚未连接'); process.exitCode=1; });
