import assert from 'node:assert/strict';
import worker, { handle } from '../worker.js';
let calls=[]; let failCopy=false;
globalThis.fetch=async(url,opt)=>{const m=url.split('/').pop();const b=JSON.parse(opt.body);calls.push([m,b]);
  return {json:async()=>({ok:!(failCopy&&m==='copyMessage'),description:'x'})}};
const env={BOT_TOKEN:'T',ADMIN_ID:'100',WEBHOOK_SECRET:'s3cret'};
const cl={id:200,type:'private'}, from={first_name:'Анна',username:'anna'};
const run=async(u,e=env)=>{calls=[];await handle(u,e);return calls};
// start
let c=await run({message:{chat:cl,from,text:'/start',message_id:1}});
assert.equal(c[0][0],'sendMessage');assert.ok(c[0][1].reply_markup);
// menu callback
c=await run({callback_query:{id:'q',data:'services',message:{chat:cl}}});
assert.deepEqual(c.map(x=>x[0]),['answerCallbackQuery','sendMessage']);assert.match(c[1][1].text,/Карточки/);
// client text -> admin with tag, ack
c=await run({message:{chat:cl,from,text:'Нужны карточки',message_id:2}});
assert.equal(c[0][1].chat_id,'100');assert.match(c[0][1].text,/Анна \(@anna\)  #id200/);assert.match(c[0][1].text,/Нужны карточки/);
assert.equal(c[1][1].chat_id,'200');
// photo with caption
c=await run({message:{chat:cl,from,photo:[{}],caption:'вот товар',message_id:3}});
assert.equal(c[0][0],'copyMessage');assert.match(c[0][1].caption,/#id200[\s\S]*вот товар/);
// sticker -> header + copy
c=await run({message:{chat:cl,from,sticker:{},message_id:4}});
assert.deepEqual(c.slice(0,2).map(x=>x[0]),['sendMessage','copyMessage']);assert.match(c[0][1].text,/#id200/);
// admin reply to text
c=await run({message:{chat:{id:100,type:'private'},from:{},text:'Здравствуйте!',message_id:9,reply_to_message:{text:'✉️ Анна (@anna)  #id200\n\nНужны карточки'}}});
assert.equal(c[0][0],'copyMessage');assert.equal(c[0][1].chat_id,'200');assert.equal(c[1][1].text,'✓ Отправлено');
// admin reply to photo caption
c=await run({message:{chat:{id:100,type:'private'},text:'ok',message_id:10,reply_to_message:{caption:'✉️ Анна  #id200'}}});
assert.equal(c[0][1].chat_id,'200');
// admin without reply -> hint, not forwarded to self
c=await run({message:{chat:{id:100,type:'private'},text:'привет',message_id:11}});
assert.equal(c.length,1);assert.match(c[0][1].text,/Ответить/);
// admin /start -> help
c=await run({message:{chat:{id:100,type:'private'},text:'/start',message_id:12}});
assert.match(c[0][1].text,/администратор/);
// failed reply
failCopy=true;c=await run({message:{chat:{id:100,type:'private'},text:'x',message_id:13,reply_to_message:{text:'#id200'}}});
assert.match(c[1][1].text,/Не получилось/);failCopy=false;
// /myid works without ADMIN_ID; client msgs ignored until configured
c=await run({message:{chat:cl,from,text:'/myid',message_id:14}},{...env,ADMIN_ID:''});assert.match(c[0][1].text,/200/);
c=await run({message:{chat:cl,from,text:'hi',message_id:15}},{...env,ADMIN_ID:''});assert.equal(c.length,0);
// groups ignored
c=await run({message:{chat:{id:-5,type:'group'},from,text:'hi',message_id:16}});assert.equal(c.length,0);
// HTTP layer: secret check & setup
let r=await worker.fetch(new Request('https://w.dev/webhook',{method:'POST',body:'{}'}),env);assert.equal(r.status,403);
r=await worker.fetch(new Request('https://w.dev/webhook',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':'s3cret'},body:JSON.stringify({message:{chat:cl,from,text:'/start',message_id:1}})}),env);assert.equal(r.status,200);
r=await worker.fetch(new Request('https://w.dev/setup?secret=bad'),env);assert.equal(r.status,403);
calls=[];r=await worker.fetch(new Request('https://w.dev/setup?secret=s3cret'),env);assert.equal(r.status,200);
assert.equal(calls[0][0],'setWebhook');assert.equal(calls[0][1].url,'https://w.dev/webhook');assert.equal(calls[0][1].secret_token,'s3cret');
console.log('ALL TESTS PASSED');
