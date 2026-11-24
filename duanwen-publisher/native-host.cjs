const net = require('node:net');
const crypto = require('node:crypto');
const pipe = process.env.DUANWEN_TEST_PIPE || `\\\\.\\pipe\\duanwen-sync-${process.env.USERNAME}`;
let buffer = Buffer.alloc(0);
const pending = new Map();
function send(message) {
  const body = Buffer.from(JSON.stringify(message));
  if (body.length > 1024 * 1024) throw new Error('消息过大');
  const header = Buffer.alloc(4); header.writeUInt32LE(body.length);
  process.stdout.write(Buffer.concat([header, body]));
}
process.stdin.on('data', chunk => {
  buffer = Buffer.concat([buffer, chunk]);
  while (buffer.length >= 4) {
    const n = buffer.readUInt32LE(0);
    if (n > 1024 * 1024) process.exit(1);
    if (buffer.length < n + 4) return;
    let msg; try { msg = JSON.parse(buffer.subarray(4, n + 4)); } catch { process.exit(1); }
    buffer = buffer.subarray(n + 4);
    const p = pending.get(msg.id);
    if (p) { clearTimeout(p.timer); pending.delete(msg.id); p.socket.end(JSON.stringify(msg) + '\n'); }
  }
});
process.stdin.on('end', () => process.exit(0));
const server = net.createServer(socket => {
  let data = ''; socket.setEncoding('utf8');
  socket.on('data', chunk => {
    data += chunk;
    if (Buffer.byteLength(data, 'utf8') > 16000000) { socket.destroy(); return; }
    if (!data.includes('\n')) return;
    const line = data.slice(0, data.indexOf('\n')); data = '';
    let request; try { request = JSON.parse(line); } catch { socket.end('{"error":"invalid_json"}\n'); return; }
    if (!['ping','fill'].includes(request.action)) { socket.end('{"error":"unsupported_action"}\n'); return; }
    const id = crypto.randomUUID();
    const timer = setTimeout(() => { pending.delete(id); socket.end('{"error":"extension_timeout"}\n'); }, request.action === 'fill' ? 180000 : 10000);
    pending.set(id, { socket, timer });
    if (request.action === 'fill') {
      const encoded = Buffer.from(JSON.stringify(request.task)).toString('base64');
      const size = 262144, total = Math.ceil(encoded.length / size);
      send({id, action:'fill_begin', total});
      for (let i=0;i<total;i++) send({id, action:'fill_chunk', index:i, data:encoded.slice(i*size,(i+1)*size)});
      send({id, action:'fill_end'});
    } else send({id, action:'ping'});
  });
  socket.on('error', () => {});
});
server.on('error', () => process.exit(1));
server.listen(pipe);
