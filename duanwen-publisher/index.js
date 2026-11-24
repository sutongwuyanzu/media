const urls={xiaohongshu:'https://creator.xiaohongshu.com/publish/publish?source=official&from=menu&target=image',douyin:'https://creator.douyin.com/creator-micro/content/upload'};
const names={xiaohongshu:'小红书',douyin:'抖音'};
const $=id=>document.getElementById(id);
const add=text=>{$('status').textContent+=text+'\n'};
const read=file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve({name:file.name,type:file.type,data:r.result});r.onerror=()=>reject(r.error);r.readAsDataURL(file)});
async function ready(tabId){for(let i=0;i<90;i++){const tab=await chrome.tabs.get(tabId);if(tab.status==='complete')return;await new Promise(r=>setTimeout(r,1000));}throw Error('页面加载超时')}
$('start').addEventListener('click',async()=>{
 const tags=$('tags').value.split(/[,，\n]/).map(t=>t.trim().replace(/^#+/,'')).filter(Boolean);
 const title=$('title').value.trim(),content=$('content').value.trim(),files=[...$('images').files],targets=[...document.querySelectorAll('fieldset input:checked')].map(x=>x.value);
 $('status').textContent='';if(!title||!content||!files.length||!targets.length){add('请填写标题、正文，选择图片和平台。');return}
 if(targets.includes('xiaohongshu')&&(title.length>20||content.length>1000)){add('小红书标题或正文超出限制，请调整后再试。');return}
 $('start').disabled=true;
 try{const images=await Promise.all(files.map(read));for(const platform of targets){add(`${names[platform]}：正在打开编辑页…`);try{const tab=await chrome.tabs.create({url:urls[platform],active:false});await ready(tab.id);await chrome.scripting.executeScript({target:{tabId:tab.id},files:['adapter.js']});const response=await chrome.tabs.sendMessage(tab.id,{platform,title,content,images,tags,declaration:platform==='xiaohongshu'&&$('xhsOriginal').checked?'original':platform==='douyin'&&$('douyinAi').checked?'ai':'none',dryRun:$('dryRun').checked});add(`${names[platform]}：${response.detail}`)}catch(e){add(`${names[platform]}：结果未确认：${e.message}。请检查作品管理和编辑页，勿重复提交。`)}}}finally{$('start').disabled=false}
});
