
const $ = selector => document.querySelector(selector);
$('.brand-avatar').src=$('.seal-emblem').src;
$('#loginCrest').src='up9-crest-transparent.webp';
const crestSrc='up9-crest-transparent.webp';
const allowed = new Set(['B','STRONG','I','EM','U','OL','UL','LI','DIV','P','BR']);
$('#date').value = '2026-09-27';
function safeHtml(root) {
  const output = document.createElement('div');
  function copy(node, parent) {
    if (node.nodeType === Node.TEXT_NODE) { parent.appendChild(document.createTextNode(node.textContent)); return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (!allowed.has(node.tagName)) { for (const child of node.childNodes) copy(child,parent); return; }
    const el = document.createElement(node.tagName.toLowerCase());
    parent.appendChild(el);
    for (const child of node.childNodes) copy(child,el);
  }
  for (const child of root.childNodes) copy(child,output);
  return output.innerHTML;
}
function countWords(node) { return (node.innerText.trim().match(/\S+/g) || []).length; }
function update() {
  const val = id => $(id).value;
  const template=val('#template');
  const documentCode=val('#code').trim().replace(/^№\s*/,'');
  const kind=template.startsWith('Постановление')?'decree':template.startsWith('Заключение')?'conclusion':template.startsWith('Уведомление')?'notice':template.startsWith('Рапорт')?'report':'custom';
  $('.paper').dataset.kind=kind;
  const stampEl=$('.stamp img'),stampChoice=val('#stampChoice');
  stampEl.hidden=!stampChoice;
  stampEl.parentElement.hidden=!stampChoice;
  if(stampChoice)stampEl.src=`up9-stamp-${stampChoice}.webp`;
  const head=$('#referenceHeader');head.replaceChildren();
  const node=(tag,text,parent=head)=>{const el=document.createElement(tag);el.textContent=text;parent.appendChild(el);return el};
  const lines=$('#intro').innerText.split('\n').map(x=>x.trim()).filter(Boolean);
  if(kind==='decree'){
    const top=node('div','',head);top.className='reference-agency';
    node('strong','ФЕДЕРАЛЬНАЯ СЛУЖБА БЕЗОПАСНОСТИ\nУПРАВЛЕНИЕ СОБСТВЕННОЙ БЕЗОПАСНОСТИ\n(9 УПРАВЛЕНИЕ ФСБ РО)',top);
    node('small','г. Москва, ул. Большая Лубянка, д. 27\n9usb.fsbro@gmail.ru',top);
  }else if(kind==='conclusion'||kind==='report'){
    node('div',lines[kind==='conclusion'?1:0]||'',head).className='reference-recipient';
  }else if(kind==='notice'){
    const columns=node('div','',head);columns.className='reference-columns';
    node('div','ФЕДЕРАЛЬНАЯ\nСЛУЖБА БЕЗОПАСНОСТИ\n(ФСБ РО)\n\nУПРАВЛЕНИЕ «М»'+(documentCode?'\n№ '+documentCode:''),columns);
    node('div',lines[0]||'',columns);
  }
  const dates=$('#referenceDate');dates.hidden=kind==='custom'||kind==='notice'||kind==='report';
  dates.children[0].textContent=(kind==='decree'?'г. Москва':'')+(documentCode?'\n№ '+documentCode:'');
  dates.children[1].textContent=kind==='decree'?'':'г. Москва';
  $('#pcode').textContent = documentCode;
  $('#pdate').textContent = val('#date') ? new Date(val('#date')+'T12:00:00').toLocaleDateString('ru-RU') : '';
  $('#ptype').textContent = ({'Постановление о привлечении к дисциплинарной ответственности':'ПОСТАНОВЛЕНИЕ','Заключение по результатам служебной проверки':'ЗАКЛЮЧЕНИЕ','Уведомление о проведении служебной проверки':'УВЕДОМЛЕНИЕ','Рапорт о нарушении требований внутреннего устава':'РАПОРТ'})[val('#template')] || val('#template').replace(' СК','').toUpperCase();
  $('#ptitle').textContent = val('#title');
  $('#pintro').innerHTML = safeHtml($('#intro'));
  const skip=kind==='conclusion'?2:kind==='decree'||kind==='report'||kind==='notice'?1:0;
  for(let i=0;i<skip;i++)$('#pintro').firstElementChild?.remove();
  for (const paragraph of $('#pintro').children) {
    paragraph.classList.toggle('doc-caption', /^УСТАНОВИЛ\s*:?\s*$/i.test(paragraph.textContent.trim()));
  }
  $('#ppoints').innerHTML = safeHtml($('#decision'));
  $('#decisionCaption').textContent = kind==='conclusion'?'':'ПОСТАНОВИЛ:';
  $('#decisionCaption').hidden = kind!=='decree'||!$('#decision').innerText.trim();
  $('#decisionEditorLabel').textContent = val('#template').startsWith('Заключение') ? 'Выводы' : 'Постановил';
  $('#decisionEditorLabel').hidden = !$('#decision').innerText.trim();
  $('#pauthor').textContent = val('#author');
  $('#pposition').textContent = val('#position');
  $('#pfooterdate').textContent = $('#pdate').textContent;
  const typedSignature=val('#signatureText').trim();
  $('#psignature').textContent = typedSignature===val('#author').trim()?'':typedSignature;
  $('#breadcrumb').textContent = val('#title');
  $('#introCount').textContent = countWords($('#intro')) + ' слов';
  $('#pointsCount').textContent = countWords($('#decision')) + ' слов';
  scheduleDownload();
}
document.querySelectorAll('input:not(#code),select,[contenteditable]').forEach(el => el.addEventListener('input',update));
let codeUpdateTimer;
$('#code').addEventListener('input',()=>{
  clearTimeout(codeUpdateTimer);
  scheduleDownload();
  codeUpdateTimer=setTimeout(update,180);
});
$('#code').addEventListener('change',()=>{clearTimeout(codeUpdateTimer);update()});
let templates={};
let authToken='',currentRole='';
const ENDPOINT='https://hpeqnqsgcqskjpdjkxcm.supabase.co/functions/v1/fsb9-docs';
async function api(action,options={}){
 const headers={'Content-Type':'application/json',...(authToken?{Authorization:'Bearer '+authToken}:{})};
 const response=await fetch(ENDPOINT+'/'+action,{...options,headers:{...headers,...options.headers}});
 return response;
}
async function loadTemplates(){
 const role=currentRole;$('#roleBadge').textContent=role==='admin'?'Администратор':'Пользователь';
 $('#addTemplate').hidden=role!=='admin';$('#deleteTemplate').hidden=role!=='admin';
 const response=await api('templates');if(!response.ok)throw new Error('Не удалось загрузить шаблоны');
 const list=await response.json();templates=Object.fromEntries(list.map(t=>[t.name,t]));
 $('#template').replaceChildren(...list.map(t=>new Option(t.name,t.name)));
 const side=$('#sideTemplates');side.replaceChildren(...list.map((t,index)=>{
   const button=document.createElement('button');button.type='button';button.className='side-template';
   const number=document.createElement('span');number.className='side-number';number.textContent=String(index+1).padStart(2,'0');
   const label=document.createElement('span');label.textContent=t.name;button.append(number,label);
   button.onclick=()=>{$('#template').value=t.name;$('#template').dispatchEvent(new Event('change'))};
   return button;
 }));
 if(list.length)$('#template').dispatchEvent(new Event('change'));
}
$('#loginForm').addEventListener('submit',async event=>{
 event.preventDefault();const button=$('#loginForm button');button.disabled=true;$('#loginError').textContent='';
 try{const response=await api('login',{method:'POST',body:JSON.stringify({password:$('#password').value})});const data=await response.json();
  if(!response.ok){$('#loginError').textContent=data.error||'Не удалось войти';return}
  authToken=data.token;currentRole=data.role;$('#password').value='';await loadTemplates();$('#loginGate').hidden=true;$('.app').hidden=false;
 }catch(error){console.error(error);$('#loginError').textContent='Ошибка соединения'}finally{button.disabled=false}
});
function setParagraphs(element,value){element.replaceChildren();for(const line of value.split('\n')){const p=document.createElement('p');if(/^УСТАНОВИЛ\s*:?\s*$/i.test(line.trim())){const strong=document.createElement('strong');strong.textContent=line;p.appendChild(strong)}else p.textContent=line||' ';element.appendChild(p)}}
function setPoints(element,value){element.replaceChildren();if(!value)return;const ol=document.createElement('ol');for(const line of value.split('\n')){if(!line.trim())continue;const li=document.createElement('li');li.textContent=line;ol.appendChild(li)}element.appendChild(ol)}
$('#addTemplate').onclick=async()=>{
 const name=prompt('Название нового шаблона:');if(!name?.trim())return;
 const data={name:name.trim(),title:$('#title').value,code:$('#code').value,date:$('#date').value,author:$('#author').value,position:$('#position').value,signature:$('#signatureText').value,intro:$('#intro').innerText,decision:[...$('#decision').querySelectorAll('li')].map(li=>li.innerText).join('\n')||$('#decision').innerText};
 const response=await api('templates',{method:'POST',body:JSON.stringify(data)});
 if(!response.ok){alert((await response.json()).error||'Ошибка сохранения');return}
 await loadTemplates();$('#template').value=data.name;$('#template').dispatchEvent(new Event('change'));
};
$('#deleteTemplate').onclick=async()=>{
 const name=$('#template').value;if(!confirm('Удалить шаблон «'+name+'»?'))return;
 const response=await api('templates/'+encodeURIComponent(name),{method:'DELETE'});
 if(!response.ok){alert('Не удалось удалить шаблон');return}
 await loadTemplates();
};
$('#logout').onclick=async()=>{if(authToken)await api('logout',{method:'POST'});authToken='';currentRole='';templates={};$('.app').hidden=true;$('#loginGate').hidden=false;$('#template').replaceChildren();$('#sideTemplates').replaceChildren()};
document.querySelectorAll('[contenteditable]').forEach(el=>el.addEventListener('paste',e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'))}));
$('#template').addEventListener('change',()=>{
  const doc=templates[$('#template').value]; if(!doc) return;
  for(const button of $('#sideTemplates').children)button.classList.toggle('active',button.lastElementChild?.textContent===doc.name);
  for(const key of ['title','code','date','author','position']) $('#'+key).value=doc[key];
  $('#signatureText').value=(doc.signature||'').trim()===(doc.author||'').trim()?'':(doc.signature||'');
  setParagraphs($('#intro'),doc.intro);
  setPoints($('#decision'),doc.decision);
  $('#clearSignature').click(); update();
});
$('#addPoint').onclick = () => {
  let list = $('#decision').querySelector('ol');
  if (!list) { list=document.createElement('ol'); $('#decision').appendChild(list); }
  const li=document.createElement('li'); li.appendChild(document.createElement('br')); list.appendChild(li);
  const range=document.createRange(); range.selectNodeContents(li); range.collapse(true);
  const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(range); $('#decision').focus(); update();
};
$('#printDoc').onclick=()=>window.print();
let downloadTimer,downloadGeneration=0;
function scheduleDownload(){
  const anchor=$('#downloadDoc'); anchor.removeAttribute('href');anchor.setAttribute('aria-disabled','true');anchor.textContent='Подготовка PNG…';
  const generation=++downloadGeneration;
  clearTimeout(downloadTimer);downloadTimer=setTimeout(()=>prepareDownload(generation),250);
}
async function prepareDownload(generation){
  if($('.paper').dataset.kind!=='custom')return prepareReferenceDownload(generation);
  const button=$('#downloadDoc');
  try {
    const width=1240, margin=65, right=width-margin;
    const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
    let y=0;
    const font=(size,bold=false,italic=false)=>`${italic?'italic ':''}${bold?'bold ':''}${size}px "Times New Roman", serif`;
    function line(text,x,baseline,size=25,bold=false,color='#151515',italic=false){ctx.font=font(size,bold,italic);ctx.fillStyle=color;ctx.fillText(text,x,baseline)}
    function wrapped(text,x,maxWidth,size=25,bold=false,indent=0){
      ctx.font=font(size,bold);const words=text.trim().split(/\s+/),lines=[];let current='';
      for(const word of words){const candidate=current?current+' '+word:word;if(ctx.measureText(candidate).width>maxWidth-(lines.length?0:indent)&&current){lines.push(current);current=word}else current=candidate}
      if(current)lines.push(current);
      for(let i=0;i<lines.length;i++){line(lines[i],x+(i===0?indent:0),y,size,bold);y+=size*1.44}
      return lines.length;
    }
    function paragraph(text,bold=false){
      if(!text.trim())return;
      if(/^УСТАНОВИЛ\s*:?\s*$/i.test(text.trim())){centerCaption(text);return}
      wrapped(text,margin,right-margin,25,bold);y+=18
    }
    function centerCaption(text){
      ctx.font=font(25,true);line(text.trim(),(width-ctx.measureText(text.trim()).width)/2,y,25,true);y+=25*1.44+18;
    }
    function imageLoaded(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src})}
    const emblem=await imageLoaded(document.querySelector('.seal-emblem').src);
    const paragraphs=[...$('#pintro').children].map(p=>({text:p.innerText,bold:p.querySelector('b,strong')!==null&&p.innerText.trim()===p.querySelector('b,strong')?.innerText.trim()}));
    // First measure content at the same font and width used for the final image.
    y=735;
    for(const p of paragraphs)paragraph(p.text,p.bold);
    if(!$('#decisionCaption').hidden){y+=12;centerCaption($('#decisionCaption').textContent)}
    const items=[...$('#ppoints').querySelectorAll('li')].map(li=>li.innerText);
    for(let i=0;i<items.length;i++){wrapped((i+1)+'. '+items[i],margin+22,right-margin-22,25);y+=9}
    const footerY=Math.max(1640,y+55),height=footerY+240;
    canvas.width=width;canvas.height=height;
    ctx.fillStyle='#e6e6e5';ctx.fillRect(0,0,width,height);
    ctx.drawImage(emblem,555,30,130,245);
    line('ФЕДЕРАЛЬНАЯ СЛУЖБА БЕЗОПАСНОСТИ',margin,242,25,true);
    line('Управление № 9 · Россия Онлайн',margin,272,24,true);
    ctx.strokeStyle='#888';ctx.lineWidth=1.5;ctx.strokeRect(890,85,285,105);
    line('ДЛЯ СВЕДЕНИЯ',908,119,20);line($('#ptype').textContent,908,145,20);line('Экз. № 1',908,171,20);
    ctx.beginPath();ctx.moveTo(margin,312);ctx.lineTo(right,312);ctx.moveTo(margin,420);ctx.lineTo(right,420);ctx.stroke();
    line('№ '+$('#pcode').textContent,margin,353,21);
    line('место г. Москва',right-164,384,20);
    const docType=$('#ptype').textContent;const spacing=10;
    ctx.font=font(52,true);const titleWidth=[...docType].reduce((sum,char)=>sum+ctx.measureText(char).width+spacing,0)-spacing;let x=(width-titleWidth)/2;
    for(const char of docType){line(char,x,500,52,true);x+=ctx.measureText(char).width+spacing}
    ctx.font=font(29);line($('#ptitle').textContent,(width-ctx.measureText($('#ptitle').textContent).width)/2,555,29);
    y=735;
    for(const p of paragraphs)paragraph(p.text,p.bold);
    if(!$('#decisionCaption').hidden){y+=12;centerCaption($('#decisionCaption').textContent)}
    for(let i=0;i<items.length;i++){wrapped((i+1)+'. '+items[i],margin+22,right-margin-22,25);y+=9}
    ctx.strokeStyle='#aaa';ctx.beginPath();ctx.moveTo(margin,footerY);ctx.lineTo(right,footerY);ctx.stroke();
    line($('#pposition').textContent,margin,footerY+38,21);
    if($('#stampChoice').value){const seal=await imageLoaded($('.stamp img').src);ctx.drawImage(seal,margin,footerY+65,125,125)}
    ctx.textAlign='right';line('Дата: '+$('#pdate').textContent,right,footerY+38,21);line($('#pauthor').textContent,right,footerY+75,23,true);ctx.textAlign='left';
    const signature=$('#psignatureImage');
    if(!signature.hidden&&signature.src){const signImg=await imageLoaded(signature.src);ctx.drawImage(signImg,right-300,footerY+95,260,75)}
    else {ctx.textAlign='right';line($('#psignature').textContent,right,footerY+143,36,false,'#576584',true);ctx.textAlign='left'}
    const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!png)throw new Error('PNG не создан');
    if(generation!==downloadGeneration)return;
    const oldUrl=button.dataset.blobUrl;
    button.href=URL.createObjectURL(png);button.dataset.blobUrl=button.href;
    button.download=(docType.toLowerCase().replace(/[^а-яёa-z0-9]+/gi,'-')||'документ')+'.png';
    button.removeAttribute('aria-disabled');button.textContent='Скачать PNG';
    if(oldUrl)URL.revokeObjectURL(oldUrl);
  }catch(error){console.error(error);if(generation===downloadGeneration)button.textContent='Ошибка подготовки PNG'}
}
async function prepareReferenceDownload(generation){
  const button=$('#downloadDoc'),kind=$('.paper').dataset.kind;
  try{
    const canvas=document.createElement('canvas');canvas.width=1240;canvas.height=3000;
    const ctx=canvas.getContext('2d'),center=620;
    const paragraphs=[...$('#pintro').children].map(p=>p.innerText.trim()).filter(Boolean);
    const points=[...$('#ppoints').querySelectorAll('li')].map(li=>li.innerText.trim());
    const loadImage=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src});
    const stampEl=$('.stamp img'),stamp=$('#stampChoice').value?await loadImage(stampEl.src):null;
    const crest=await loadImage(crestSrc);
    const font=(size=26,bold=false,italic=false)=>`${italic?'italic ':''}${bold?'bold ':''}${size}px "Times New Roman", serif`;
    function write(text,x,y,size=26,bold=false,align='left'){
      ctx.font=font(size,bold);ctx.fillStyle='#111';ctx.textAlign=align;ctx.fillText(text,x,y);ctx.textAlign='left';
    }
    function wrap(text,x,y,width,size=26,indent=0,bold=false){
      ctx.font=font(size,bold);const words=text.split(/\s+/).filter(Boolean),lines=[];let line='',first=true;
      for(const word of words){const trial=line?line+' '+word:word;if(line&&ctx.measureText(trial).width>width-(first?indent:0)){lines.push(line);line=word;first=false}else line=trial}
      if(line)lines.push(line);
      for(let i=0;i<lines.length;i++){
        const current=lines[i],left=x+(i===0?indent:0),available=width-(i===0?indent:0),parts=current.split(' ');
        if(i<lines.length-1&&parts.length>1){ctx.font=font(size,bold);const total=parts.reduce((n,p)=>n+ctx.measureText(p).width,0),gap=(available-total)/(parts.length-1);let px=left;for(const part of parts){write(part,px,y,size,bold);px+=ctx.measureText(part).width+gap}}
        else write(current,left,y,size,bold);
        y+=size*1.43;
      }
      return y+size*.55;
    }
    function render(){
      ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
      const title=$('#ptype').textContent,subtitle=$('#ptitle').textContent;
      let y,x=kind==='decree'?110:170,width=1240-x*2;
      if(kind==='decree'){
        write('ФЕДЕРАЛЬНАЯ СЛУЖБА БЕЗОПАСНОСТИ',center,310,29,true,'center');
        write('УПРАВЛЕНИЕ СОБСТВЕННОЙ БЕЗОПАСНОСТИ',center,346,29,true,'center');
        write('(9 УПРАВЛЕНИЕ ФСБ РО)',center,382,27,true,'center');
        write('г. Москва, ул. Большая Лубянка, д. 27',center,445,22,false,'center');
        write('9usb.fsbro@gmail.ru',center,477,22,false,'center');
        write(title,center,567,34,true,'center');write(subtitle,center,615,27,true,'center');
        write('г. Москва',x,725,25);
        if($('#pcode').textContent)write('№ '+$('#pcode').textContent,x,761,23);
        y=805;
      }else if(kind==='conclusion'||kind==='report'){
        const recipient=$('#referenceHeader').innerText.trim().split(/\n/);
        let ry=215;for(const line of recipient){ry=wrap(line,700,ry,390,25,0,false)+2}
        write(title,center,kind==='conclusion'?435:445,30,true,'center');
        write(subtitle,center,kind==='conclusion'?476:510,25,false,'center');
        if(kind==='conclusion'){if($('#pcode').textContent)write('№ '+$('#pcode').textContent,170,580,23);write('г. Москва',1070,548,25,false,'right');y=615}
        else y=640;
      }else{
        const left=$('#referenceHeader .reference-columns>div:first-child').innerText.split(/\n/);
        const right=$('#referenceHeader .reference-columns>div:last-child').innerText.split(/(?=Кому:|От:|Email:)/).map(s=>s.trim()).filter(Boolean);
        let hy=225;for(const line of left){if(line.trim())write(line,360,hy,25,/(УПРАВЛЕНИЕ)/.test(line),'center');hy+=33}
        hy=230;for(const line of right){hy=wrap(line,730,hy,400,24)+5}
        write(title,center,560,30,true,'center');write(subtitle.toLowerCase(),center,594,25,true,'center');y=650;
      }
      for(const paragraph of paragraphs){
        if(/^УСТАНОВИЛ\s*:?\s*$/i.test(paragraph)){y+=6;write(paragraph,center,y,27,true,'center');y+=52;continue}
        y=wrap(paragraph,x,y,width,26,66)+7;
      }
      if(kind==='decree'&&points.length){y+=9;write('ПОСТАНОВИЛ:',center,y,27,true,'center');y+=58}
      points.forEach((point,i)=>{write((i+1)+'.',x+25,y,25);y=wrap(point,x+75,y,width-75,26)+18});
      const footerY=Math.max(kind==='decree'?1490:kind==='report'?1195:kind==='notice'?1330:1400,y+65);
      const position=$('#pposition').textContent;
      let py=footerY+15;for(const part of position.split(',').map(s=>s.trim())){write(part,x,py,25);py+=33}
      ctx.drawImage(crest,555,25,130,245);
      if(stamp)ctx.drawImage(stamp,x+8,footerY+70,135,135);
      const drawn=$('#psignatureImage');
      write('Дата: '+$('#pdate').textContent,1240-x,footerY+20,23,false,'right');
      write($('#pauthor').textContent,1240-x,footerY+58,25,true,'right');
      if(!drawn.hidden&&$('#signaturePad'))ctx.drawImage($('#signaturePad'),780,footerY+82,230,70);
      else if($('#psignature').textContent)write($('#psignature').textContent,880,footerY+130,27,false,'center');
      return footerY+230;
    }
    let bottom=render(),needed=Math.max(1754,Math.ceil(bottom));
    if(needed!==canvas.height){canvas.height=needed;render()}
    const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!png)throw new Error('PNG не создан');if(generation!==downloadGeneration)return;
    const oldUrl=button.dataset.blobUrl;button.href=URL.createObjectURL(png);button.dataset.blobUrl=button.href;
    button.download=(kind+'-'+($('#pdate').textContent||'документ').replace(/[^0-9а-яёa-z]+/gi,'-'))+'.png';
    button.removeAttribute('aria-disabled');button.textContent='Скачать PNG';if(oldUrl)URL.revokeObjectURL(oldUrl);
  }catch(error){console.error(error);if(generation===downloadGeneration)button.textContent='Ошибка подготовки PNG'}
}
function initSignature(){
  const canvas=$('#signaturePad'),ctx=canvas.getContext('2d'); let drawing=false,hasInk=false;
  function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}}
  function sync(){const img=$('#psignatureImage');img.src=canvas.toDataURL('image/png');img.hidden=!hasInk;$('#psignature').hidden=hasInk}
  canvas.addEventListener('pointerdown',e=>{drawing=true;hasInk=true;canvas.setPointerCapture(e.pointerId);const p=point(e);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+.01,p.y+.01);ctx.strokeStyle='#3a4c78';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.stroke();sync()});
  canvas.addEventListener('pointermove',e=>{if(!drawing)return;const p=point(e);ctx.lineTo(p.x,p.y);ctx.stroke();sync()});
  for(const event of ['pointerup','pointercancel'])canvas.addEventListener(event,()=>{drawing=false;scheduleDownload()});
  $('#clearSignature').onclick=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);hasInk=false;sync();scheduleDownload()};sync();
}
initSignature();