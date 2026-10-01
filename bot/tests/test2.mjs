import assert from 'node:assert/strict';
import fs from 'node:fs';
const ROOT=new URL('../../',import.meta.url).pathname;
import worker, { handle, publishDue, publishPost } from '../worker.js';
const posts=JSON.parse(fs.readFileSync(new URL('../posts.json',import.meta.url),'utf8'));
// validate queue
const ids=new Set();
for(const p of posts){
  assert.ok(!ids.has(p.id));ids.add(p.id);
  assert.ok(!isNaN(Date.parse(p.at)),p.id);
  assert.ok(p.text.length<=1024,`${p.id} ${p.text.length}`);
  assert.ok(!p.text.includes('ваш_ник'));
  for(const m of p.media){assert.ok(fs.existsSync(ROOT+m.src),m.src);
    const sz=fs.statSync(ROOT+m.src).size; assert.ok(sz<(m.type==='video'?20e6:5e6),m.src);}
  assert.ok(p.media.length<=10);
}
let calls=[];
globalThis.fetch=async(url,opt)=>{
  if(String(url).includes('posts.json')) return {ok:true,json:async()=>posts};
  const m=url.split('/').pop();const b=JSON.parse(opt.body);calls.push([m,b]);
  const result=m==='sendMediaGroup'?[{message_id:51},{message_id:52}]:{message_id:50};
  return {json:async()=>({ok:true,result})};
};
const env={BOT_TOKEN:'T',ADMIN_ID:'100',WEBHOOK_SECRET:'s'};
// post 1 at 10:00 MSK -> run at 10:00 exactly and 10:14 posts, 09:59 and 10:15 not
const t1=Date.parse('2026-10-02T10:00:00+03:00');
for(const [now,exp] of [[t1,1],[t1+14*60e3,1],[t1-60e3,0],[t1+15*60e3,0]]){
  calls=[];await publishDue(env,now);
  assert.equal(calls.filter(c=>c[0]==='sendPhoto').length,exp,String(now-t1));
}
calls=[];await publishDue(env,t1);
assert.deepEqual(calls.map(c=>c[0]),['sendPhoto','pinChatMessage','sendMessage']);
assert.equal(calls[0][1].chat_id,'@marudi_studio');assert.equal(calls[0][1].photo,'https://uydilevich-ctrl.github.io/moi-web-sait/assets/posts/post-1-znakomstvo.jpg');
assert.match(calls[0][1].caption,/Мария/);assert.equal(calls[1][1].message_id,50);assert.match(calls[2][1].text,/Опубликовано/);
// album
calls=[];await publishPost(env,posts[1]);
assert.equal(calls[0][0],'sendMediaGroup');assert.equal(calls[0][1].media.length,4);assert.ok(calls[0][1].media[0].caption);assert.ok(!calls[0][1].media[1].caption);
// video
calls=[];await publishPost(env,posts[2]);
assert.equal(calls[0][0],'sendVideo');assert.match(calls[0][1].video,/video-peonies\.mp4$/);
// long text -> media then text
calls=[];await publishPost(env,{text:'x'.repeat(1500),media:[{type:'photo',src:'a.jpg'}]});
assert.deepEqual(calls.map(c=>c[0]),['sendPhoto','sendMessage']);assert.ok(!calls[0][1].caption);
// /queue from admin
calls=[];const realNow=Date.now;Date.now=()=>Date.parse('2026-10-06T00:00:00+03:00');
await handle({message:{chat:{id:100,type:'private'},text:'/queue',message_id:1}},env);
Date.now=realNow;
assert.match(calls[0][1].text,/Как рисунок оживает/);assert.doesNotMatch(calls[0][1].text,/Привет, я Мария/);
console.log(calls[0][1].text);
// scheduled entry
let waited;await worker.scheduled({scheduledTime:t1},env,{waitUntil:p=>waited=p});await waited;
console.log('ALL NEW TESTS PASSED');
