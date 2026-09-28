const PROJECT_URL=Deno.env.get('SUPABASE_URL');
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const ALLOWED_ORIGINS=new Set(['https://tophik2345.github.io','https://fsb-up9-docs.linyks3.chatgpt.site']);
const enc=new TextEncoder();
const hex=(bytes)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const sha=async(value)=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value))));
const cors=origin=>({'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, DELETE, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Vary':'Origin','Cache-Control':'no-store'});
async function db(table,method='GET',filter='',body,prefer=''){
 const r=await fetch(PROJECT_URL+'/rest/v1/'+table+filter,{method,headers:{apikey:SERVICE_KEY,Authorization:'Bearer '+SERVICE_KEY,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const text=await r.text();return {status:r.status,ok:r.ok,data:text?JSON.parse(text):null};
}
function where(field,value,select){const params=new URLSearchParams();params.set(field,'eq.'+value);params.set('select',select);return '?'+params.toString()}
async function derive(password,salt,iterations){
 const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:Uint8Array.from(salt.match(/../g).map(x=>parseInt(x,16))),iterations,hash:'SHA-256'},key,256);
 return hex(new Uint8Array(bits));
}
function equal(a,b){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
async function session(req){const token=req.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_-]{40,100})$/)?.[1];if(!token)return null;
 const key=await sha(token),r=await db('fsb9_sessions','GET',where('token_hash',key,'role,expires_at'));
 if(!r.ok||!r.data?.length||new Date(r.data[0].expires_at).getTime()<=Date.now())return null;
 return {role:r.data[0].role,key};
}
async function login(req,reply){
 const raw=await req.text();if(raw.length>2048)return reply(400,{error:'Неверный пароль'});
 let password;try{password=JSON.parse(raw).password}catch{return reply(400,{error:'Неверный пароль'})}
 if(typeof password!=='string'||password.length>256)return reply(400,{error:'Неверный пароль'});
 const ip=req.headers.get('cf-connecting-ip')||req.headers.get('x-real-ip')||req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()||'unknown';
 const ipKey=await sha(ip),now=Date.now(),attempt=await db('fsb9_login_attempts','GET',where('ip_key',ipKey,'failures,window_end'));
 if(!attempt.ok)throw Error('rate check failed');
 const state=attempt.data?.[0];if(state&&new Date(state.window_end).getTime()>now&&state.failures>=6)return reply(429,{error:'Слишком много попыток. Попробуйте через 15 минут.'});
 const passwordRows=await db('fsb9_passwords','GET','?select=role,salt,hash,iterations');if(!passwordRows.ok||passwordRows.data?.length!==2)throw Error('password configuration missing');
 let role='';for(const row of passwordRows.data){const actual=await derive(password,row.salt,row.iterations);if(equal(actual,row.hash))role=row.role}
 if(!role){const failures=state&&new Date(state.window_end).getTime()>now?state.failures+1:1;
  const r=await db('fsb9_login_attempts','POST','?on_conflict=ip_key',{ip_key:ipKey,failures,window_end:new Date(now+900000).toISOString()},'resolution=merge-duplicates');if(!r.ok)throw Error('rate update failed');
  return reply(401,{error:'Неверный пароль'});
 }
 await db('fsb9_login_attempts','DELETE',where('ip_key',ipKey,'ip_key'));
 const token=hex(crypto.getRandomValues(new Uint8Array(32))),tokenHash=await sha(token);
 const saved=await db('fsb9_sessions','POST','',{token_hash:tokenHash,role,expires_at:new Date(now+8*3600000).toISOString()});if(!saved.ok)throw Error('session create failed');
 return reply(200,{token,role});
}
function clean(value){if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const limits={name:120,title:300,code:80,date:10,author:120,position:200,signature:120,intro:12000,decision:12000};const doc={};
 for(const [key,max] of Object.entries(limits)){const v=value[key];if(typeof v!=='string'||v.length>max)return null;doc[key]=v.trim()}
 return doc.name?doc:null;
}
Deno.serve(async(req)=>{
 const origin=req.headers.get('Origin')||'';const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{...(ALLOWED_ORIGINS.has(origin)?cors(origin):{}),'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
 try{if(!ALLOWED_ORIGINS.has(origin))return reply(403,{error:'Доступ запрещён'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
 const chunks=new URL(req.url).pathname.split('/');const marker=chunks.indexOf('fsb9-docs');const route=chunks.slice(marker+1);
 if(route[0]==='login'&&req.method==='POST')return await login(req,reply);
 const auth=await session(req);if(!auth)return reply(401,{error:'Требуется пароль'});
 if(route[0]==='session'&&req.method==='GET')return reply(200,{role:auth.role});
 if(route[0]==='logout'&&req.method==='POST'){await db('fsb9_sessions','DELETE',where('token_hash',auth.key,'token_hash'));return reply(200,{ok:true})}
 if(route[0]==='templates'&&route.length===1&&req.method==='GET'){
  const r=await db('fsb9_templates','GET','?select=doc&order=created_at.asc');if(!r.ok)throw Error('template read failed');return reply(200,r.data.map(row=>row.doc));
 }
 if(auth.role!=='admin')return reply(403,{error:'Только для администратора'});
 if(route[0]==='templates'&&route.length===1&&req.method==='POST'){
  const raw=await req.text();if(raw.length>30000)return reply(413,{error:'Слишком большой шаблон'});
  let doc;try{doc=clean(JSON.parse(raw))}catch{}if(!doc)return reply(400,{error:'Некорректный шаблон'});
  const r=await db('fsb9_templates','POST','',{name:doc.name,doc});if(r.status===409)return reply(409,{error:'Шаблон уже существует'});if(!r.ok)throw Error('template save failed');return reply(201,{ok:true});
 }
 if(route[0]==='templates'&&route.length===2&&req.method==='DELETE'){
  const name=decodeURIComponent(route[1]);if(name.length>120)return reply(400,{error:'Некорректное название'});
  const r=await db('fsb9_templates','DELETE',where('name',name,'name'),undefined,'return=representation');if(!r.ok)throw Error('template delete failed');if(!r.data?.length)return reply(404,{error:'Шаблон не найден'});return reply(200,{ok:true});
 }
 return reply(404,{error:'Не найдено'});
 }catch(error){console.error(error);return reply(500,{error:'Ошибка сервера'})}});
