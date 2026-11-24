(() => {
 if (globalThis.__syncPublisher) return; globalThis.__syncPublisher=true;
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const visible=e=>{if(!e||!e.getClientRects().length||e.closest('[aria-hidden="true"]'))return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight&&s.visibility!=='hidden'&&s.display!=='none'&&Number(s.opacity)>0.01};
 const findText=(text)=>[...document.querySelectorAll('button,[role="tab"],[role="button"],div')].filter(e=>visible(e)&&e.textContent.trim()===text).sort((a,b)=>a.querySelectorAll('*').length-b.querySelectorAll('*').length)[0];
 const findRenderedText=(text)=>[...document.querySelectorAll('button,[role="button"],div,span')].filter(e=>e.getClientRects().length&&!e.closest('[aria-hidden="true"]')&&getComputedStyle(e).visibility!=='hidden'&&e.textContent.trim()===text).sort((a,b)=>a.querySelectorAll('*').length-b.querySelectorAll('*').length)[0];
 const wait=async(fn,ms=30000)=>{const end=Date.now()+ms;while(Date.now()<end){const v=fn();if(v)return v;await sleep(400)}throw Error('等待编辑控件超时')};
 function assign(el,value){if(el.isContentEditable){el.focus();document.execCommand('selectAll');document.execCommand('insertText',false,value);el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:value}));}else{const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}}
 const normalize=s=>(s||'').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\s+/g,' ').trim();
 async function addTopics(editor, tags) {
  if (!tags.length) return;
  if (tags.length > 5) throw Error('话题超过跨平台测试上限 5 个');
  const tokens='[data-topic-id],[data-tag-id],[data-topic-name],[contenteditable="false"],a[href*="topic"]';
  for (const tag of tags) {
   const clean=String(tag).trim().replace(/^#+/,'');
   if (!clean || /[\s#]/.test(clean)) throw Error('话题格式无效');
   editor.focus(); const range=document.createRange();range.selectNodeContents(editor);range.collapse(false);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
   document.execCommand('insertText',false,' #'+clean);
   let suggestion; try { suggestion=await wait(()=>[...document.querySelectorAll('[role="option"], [class*="topic"] [class*="item"], [class*="suggest"] [class*="item"], .creator-editor-topic-container > div')].find(e=>visible(e)&&e.textContent.trim().replace(/^#\s*/, '').split(/\s/)[0]===clean),6000); } catch { throw Error('未找到话题候选，可能需要手动选择；正文请重新检查'); }
   suggestion.click();
   await wait(()=>[...editor.querySelectorAll(tokens)].find(e=>e.textContent.replace(/\s/g,'').includes(clean)),5000);
  }
 }
 async function setDeclaration(platform, declaration) {
  if (!declaration || declaration==='none') return;
  if (platform==='xiaohongshu' && declaration==='original') {
   const row=[...document.querySelectorAll('.custom-switch-card')].find(e=>e.textContent.includes('原创声明'));
   const checkbox=row?.querySelector('input[type="checkbox"]');
   if (!checkbox) throw Error('找不到原创声明开关');
   if (!checkbox.checked) checkbox.click();
   await sleep(700);
   if ([...document.querySelectorAll('[role="dialog"],.d-modal')].some(e=>visible(e)&&e.textContent.includes('原创'))) throw Error('原创声明需要在平台页面确认，请检查');
   if (!checkbox.checked) throw Error('原创声明未确认开启');
  } else if (platform==='douyin' && declaration==='ai') {
   const trigger=findRenderedText('请选择自主声明');
   if (!trigger) throw Error('找不到抖音声明入口');
   trigger.scrollIntoView({block:'center'});
   trigger.click();
   const choice=await wait(()=>[...document.querySelectorAll('label')].find(e=>visible(e)&&e.textContent.includes('内容由AI生成')),5000);
   choice.click();
   const confirm=await wait(()=>[...document.querySelectorAll('button')].find(e=>visible(e)&&!e.disabled&&e.textContent.trim()==='确定'),5000);
   confirm.click(); await sleep(500);
   if (![...document.querySelectorAll('*')].some(e=>visible(e)&&e.textContent.trim()==='内容由AI生成')) throw Error('抖音声明未读回');
  }
 }
 async function run(m){
  if(m.platform==='douyin'){const tab=await wait(()=>findText('发布图文'));tab.click();}
  const file=await wait(()=>[...document.querySelectorAll('input[type=file]')].find(e=>!e.accept||/image|\.(jpg|jpeg|png|webp)/i.test(e.accept)));
  const dt=new DataTransfer();for(const img of m.images){const blob=await (await fetch(img.data)).blob();dt.items.add(new File([blob],img.name,{type:img.type||blob.type}))}file.files=dt.files;file.dispatchEvent(new Event('change',{bubbles:true}));
  const rendered=e=>e.getClientRects().length&&!e.closest('[aria-hidden="true"]')&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none';
  const title=await wait(()=>[...document.querySelectorAll('input')].find(e=>rendered(e)&&/标题/.test(e.placeholder||'')),60000);
  const body=await wait(()=>[...document.querySelectorAll('[contenteditable="true"],textarea')].find(rendered),30000);
  assign(title,m.title);assign(body,m.content);await sleep(1500);
  if(normalize(title.value)!==normalize(m.title)||normalize(body.innerText||body.value)!==normalize(m.content))return {detail:'内容读回不一致，未点击发布；请检查编辑页。'};
  await addTopics(body,m.tags||[]);
  if (!normalize(body.innerText||body.value).startsWith(normalize(m.content))) throw Error('添加话题后正文发生变化，已停止');
  await setDeclaration(m.platform,m.declaration||'none');
  if(m.dryRun!==false)return {ok:true,detail:'测试模式：标题、正文已读回，图片已提交；话题和声明按请求处理；未点击发布，请检查预览。'};
  const buttons=[...document.querySelectorAll('button')].filter(e=>e.getClientRects().length&&!e.closest('[aria-hidden="true"]')&&getComputedStyle(e).visibility!=='hidden'&&!e.disabled&&e.textContent.trim()==='发布');
  if(buttons.length!==1)return {detail:'未能唯一定位发布按钮，已停止；请检查编辑页。'};
  buttons[0].click();await sleep(5000);
  return {detail:'已尝试点击发布，结果未验证；请在作品管理中核查，勿重复提交。'};
 }
 chrome.runtime.onMessage.addListener((m,s,reply)=>{run(m).then(reply).catch(e=>reply({detail:'未完成：'+e.message+'；请检查编辑页。'}));return true});
})();
