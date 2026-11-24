chrome.action.onClicked.addListener(() => chrome.tabs.create({url: chrome.runtime.getURL('index.html')}));
const urls={xiaohongshu:'https://creator.xiaohongshu.com/publish/publish?source=official&from=menu&target=image',douyin:'https://creator.douyin.com/creator-micro/content/upload'};
let bridge;
const incoming=new Map();
async function fill(task) {
  if (!task || !urls[task.platform] || typeof task.title !== 'string' || !task.title.trim() || typeof task.content !== 'string' || !task.content.trim() || !Array.isArray(task.images) || !task.images.length) throw Error('无效的图文任务');
  if (task.tags !== undefined && (!Array.isArray(task.tags) || !task.tags.every(t=>typeof t==='string' && t.trim() && t.length<=50))) throw Error('话题格式无效');
  if (!['none','original','ai'].includes(task.declaration || 'none')) throw Error('声明类型无效');
  if (task.title.length>20 || task.content.length>1000) throw Error('标题或正文超过图文平台限制');
  if (!task.images.every(i=>typeof i.data==='string' && /^data:image\/(png|jpeg|webp);base64,/.test(i.data))) throw Error('图片格式无效');
  const tab=await chrome.tabs.create({url:urls[task.platform],active:false});
  for(let i=0;i<90;i++){const current=await chrome.tabs.get(tab.id);if(current.status==='complete') break;if(i===89) throw Error('页面加载超时');await new Promise(r=>setTimeout(r,1000));}
  await chrome.scripting.executeScript({target:{tabId:tab.id},files:['adapter.js']});
  const result=await chrome.tabs.sendMessage(tab.id,{platform:task.platform,title:task.title,content:task.content,images:task.images,tags:task.tags||[],declaration:task.declaration||'none',dryRun:true});
  return {tabId:tab.id,result};
}
function connect() {
  if (bridge) return;
  const port=chrome.runtime.connectNative('com.duanwen.sync'); bridge=port;
  port.onMessage.addListener(message => {
    if (message.action === 'ping') port.postMessage({id:message.id,ok:true,extensionId:chrome.runtime.id,version:chrome.runtime.getManifest().version});
    else if (message.action === 'fill_begin') {
      if (!Number.isInteger(message.total)||message.total<1||message.total>100||incoming.size>=4) return port.postMessage({id:message.id,ok:false,error:'数据包无效'});
      incoming.set(message.id,{total:message.total,parts:[]});
    } else if(message.action==='fill_chunk') {
      const item=incoming.get(message.id);
      if (!item||message.index!==item.parts.length||typeof message.data!=='string'||message.data.length>262144) { incoming.delete(message.id); return port.postMessage({id:message.id,ok:false,error:'数据分片无效'}); }
      item.parts.push(message.data);
    } else if(message.action==='fill_end') {
      const item=incoming.get(message.id);incoming.delete(message.id);
      try {
        if (!item||item.parts.length!==item.total) throw Error('数据分片不完整');
        const raw=atob(item.parts.join(''));const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));const task=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
        fill(task).then(result=>port.postMessage({id:message.id,ok:result.result?.ok===true,...result})).catch(e=>port.postMessage({id:message.id,ok:false,error:e.message}));
      } catch(e) {port.postMessage({id:message.id,ok:false,error:e.message});}
    }
  });
  port.onDisconnect.addListener(() => { incoming.clear(); bridge = null; chrome.alarms.create('bridge-reconnect', {delayInMinutes: 1}); });
}
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === 'bridge-reconnect') connect(); });
connect();
