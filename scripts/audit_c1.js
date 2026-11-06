'use strict';
// Local-only C1 evidence runner: Chromium CDP pipe, no packages or credentials.
const fs = require('fs');
const path = require('path');
const http = require('http');
const {spawn} = require('child_process');
const assert = require('assert');
const root = path.resolve(__dirname,'..');
const out = path.join(root,'docs/ui/phase-c1');
const port = Number(process.env.C1_PORT || 8131);
fs.mkdirSync(out,{recursive:true});
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.woff2':'font/woff2','.json':'application/json','.svg':'image/svg+xml'};
const server = http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const base=url.pathname.startsWith('/main/')?path.join(root,'scratch/main'):root;
  let rel=url.pathname.replace(/^\/main\//,'/');
  if(rel==='/')rel='/index.html';
  if(!path.extname(rel) && fs.existsSync(path.join(base,rel+'.html')))rel+='.html';
  const file=path.resolve(base,'.'+rel);
  if(!file.startsWith(base+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(fs.readFileSync(file));
});
let browser;
let seq=0,buf='',pending=new Map();
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function send(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},30000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});browser.stdio[3].write(JSON.stringify({id,method,params,sessionId})+'\0');});}
function onMessage(m){if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}}
async function tab(){const {targetId}=await send('Target.createTarget',{url:'about:blank'});const {sessionId:s}=await send('Target.attachToTarget',{targetId,flatten:true});await send('Page.enable',{},s);await send('Runtime.enable',{},s);await send('Network.enable',{},s);await send('Network.setBlockedURLs',{urls:['https://*','http://*.supabase.co/*','*sw.js*','*pwa-installer*']},s);return {s,targetId};}
async function evaluate(s,expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},s);if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function navigate(s,url){const nav=await send('Page.navigate',{url},s);if(nav.errorText)throw Error(JSON.stringify(nav));for(let i=0;i<200;i++){await delay(50);if(await evaluate(s,`document.readyState==='complete' && !!document.body && location.href===${JSON.stringify(url)}`))return;}throw Error('Navigation timed out '+url+' '+JSON.stringify(await evaluate(s,'({url:location.href,ready:document.readyState,html:document.body?.innerHTML.slice(0,500)})')));}
const fixture=`window.supabaseClient={auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signInWithPassword:()=>new Promise(()=>{}),signUp:()=>new Promise(()=>{}),updateUser:()=>new Promise(()=>{})}};`;
async function shot(s,name,clip){const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,...(clip?{clip}: {})},s);fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));}
(async()=>{
await new Promise(r=>server.listen(port,'127.0.0.1',r));
const executable=process.env.C1_BROWSER || 'C:/Users/stand/AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe';
browser=spawn(executable,['--headless','--no-sandbox','--disable-gpu','--remote-debugging-pipe','--no-first-run'],{stdio:['ignore','ignore','ignore','pipe','pipe'],windowsHide:true});
browser.stdio[4].on('data',chunk=>{buf+=chunk.toString();let i;while((i=buf.indexOf('\0'))>=0){const line=buf.slice(0,i);buf=buf.slice(i+1);if(line)onMessage(JSON.parse(line));}});
browser.on('error',e=>{console.error(e);process.exit(1);});
const origin='http://127.0.0.1:'+port;
let t=await tab();
await send('Page.addScriptToEvaluateOnNewDocument',{source:fixture},t.s);
const mode=process.argv[2] || 'all';
const layout=[];
if(mode==='all'||mode==='screenshots') {
for(const page of ['login','signup','reset-password','privacy','terms']){
 for(const width of [320,360,390,768,1024,1440,1920]){
  const height=width<600?1000:1100;
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},t.s);
  await navigate(t.s,origin+'/'+page+'.html');await delay(200);
  const metrics=await evaluate(t.s,`(()=>{const b=document.querySelector('.btn-gradient');const input=document.querySelector('.input-modern');return {width:innerWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth,input:input?getComputedStyle(input).fontSize:null,button:b?{bg:getComputedStyle(b).backgroundColor,color:getComputedStyle(b).color}:null,art:document.querySelector('.auth-brand-panel')?.getBoundingClientRect().width,card:document.querySelector('.auth-form-container')?.getBoundingClientRect().width}})()`);
  assert(metrics.scroll<=width && metrics.body<=width,page+' overflow '+width+': '+JSON.stringify(metrics));layout.push({page,...metrics});
  if(![390,1024,1440].includes(width))continue;
  await shot(t.s,page+'-'+width+'-default');
  if(['privacy','terms'].includes(page))continue;
  await evaluate(t.s,`document.querySelector('.input-modern').focus()`);await shot(t.s,page+'-'+width+'-focus');
  await evaluate(t.s,`document.querySelector('form').requestSubmit()`);await delay(60);
  assert(await evaluate(t.s,`[...document.querySelectorAll('.form-error')].some(e=>e.textContent && getComputedStyle(e).display!=='none')`),'Missing error '+page);
  await shot(t.s,page+'-'+width+'-error');
  await navigate(t.s,origin+'/'+page+'.html');
  await evaluate(t.s,`document.querySelectorAll('input').forEach(i=>{i.value=i.type==='email'?'c1-fixture@example.test':i.type==='password'?'C1Fixture!Password123':'C1 Fixture';i.checked=true;i.dispatchEvent(new Event('input',{bubbles:true}));});document.querySelector('form').requestSubmit()`);await delay(60);
  assert(await evaluate(t.s,`document.querySelector('form button[type=submit]').disabled`),'Missing loading '+page);
  await shot(t.s,page+'-'+width+'-loading');
 }
 console.log('Screenshots/overflow:',page);
}
fs.writeFileSync(path.join(out,'layout.json'),JSON.stringify(layout,null,2));
}
if(mode==='all'||mode==='checks') {
 const checks=[];
 for(const page of ['login','signup','reset-password','privacy','terms']) {
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false},t.s);
  await navigate(t.s,origin+'/'+page+'.html');
  const contrast=await evaluate(t.s,`(()=>{
   const rgba=s=>(s.match(/[\\d.]+/g)||[]).map(Number);
   const over=(a,b)=>a.slice(0,3).map((v,i)=>v*(a[3]??1)+b[i]*(1-(a[3]??1)));
   const lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
   return [...document.querySelectorAll('label,.auth-header-block p,.auth-form-container a,.nav-link,.legal-date,.legal-section p,.legal-section a')].filter(e=>e.getClientRects().length).map(e=>{
    let chain=[],n=e;while(n){chain.unshift(n);n=n.parentElement}let bg=[2,4,5];for(const n of chain)bg=over(rgba(getComputedStyle(n).backgroundColor),bg);
    const color=getComputedStyle(e).color,fg=over(rgba(color),bg),a=lum(fg),b=lum(bg);return {text:e.textContent.trim().slice(0,80),color,bg,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
   });
  })()`);
  for(const item of contrast)assert(item.ratio>=4.5,page+' contrast '+JSON.stringify(item));
  checks.push({page,contrast});console.log('Contrast:',page);
  const lm=await send('Page.getLayoutMetrics',{},t.s);
  const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:1440,height:lm.cssContentSize.height,scale:1}},t.s);
  fs.writeFileSync(path.join(out,page+'-1440-full.png'),Buffer.from(r.data,'base64'));
  if(page==='login') {
   await evaluate(t.s,`document.querySelector('.toggle-password-btn').click()`);
   assert.equal(await evaluate(t.s,`document.querySelector('#password').type`),'text');
   await evaluate(t.s,`document.querySelector('#forgot-password-trigger').click()`);
   assert.equal(await evaluate(t.s,`getComputedStyle(document.querySelector('#forgot-password-view')).display`),'block');
   await shot(t.s,'login-recovery');
   await evaluate(t.s,`document.querySelector('#back-to-login-btn').click()`);
   assert.equal(await evaluate(t.s,`getComputedStyle(document.querySelector('#login-form')).display`),'flex');
  }
  for(const theme of ['light','dark']){
   await evaluate(t.s,`document.documentElement.dataset.theme='${theme}'`);
   assert.equal(await evaluate(t.s,`getComputedStyle(document.body).backgroundColor`),'rgb(2, 4, 5)');
  }
 }
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]},t.s);
 await navigate(t.s,origin+'/login.html');
 assert.equal(await evaluate(t.s,`getComputedStyle(document.querySelector('.auth-brand-panel'),'::before').animationName`),'none');
 fs.writeFileSync(path.join(out,'contrast-and-interaction.json'),JSON.stringify(checks,null,2));
 console.log('Contrast, password toggle, recovery, saved themes and reduced motion passed');
}
// Existing fixture-based runtime suite, unchanged.
if(mode==='all'||mode==='runtime') {
await send('Target.closeTarget',{targetId:t.targetId});
t=await tab();
await navigate(t.s,origin+'/tests/headless_regression.html');
await send('Emulation.setVirtualTimePolicy',{policy:'pauseIfNetworkFetchesPending',budget:240000},t.s);
for(let i=0;i<360;i++){await delay(500);if(i%20===0){const partial=await evaluate(t.s,`({summary:document.querySelector('#results')?.textContent,checks:[...document.querySelectorAll('li.pass,li.fail')].map(e=>({status:e.className,text:e.textContent}))})`);fs.writeFileSync(path.join(out,'runtime-progress.json'),JSON.stringify(partial,null,2));console.log('Runtime progress:',partial.checks.length,partial.summary);}const status=await evaluate(t.s,`document.querySelector('#results')?.dataset.status`);if(status && status!=='RUNNING'){const result=await evaluate(t.s,`({status:document.querySelector('#results').dataset.status,checks:[...document.querySelectorAll('li.pass,li.fail')].map(e=>({status:e.className,text:e.textContent}))})`);fs.writeFileSync(path.join(out,'runtime.json'),JSON.stringify(result,null,2));assert.equal(status,'PASSED');console.log('Runtime:',result.checks.length,'checks');break;}if(i===359)throw Error('Runtime timeout');}
await send('Target.closeTarget',{targetId:t.targetId});
}
// Five cold-cache Fast 4G / 4x CPU runs, main and branch, no fixture mutations.
const perfBranches=(process.env.C1_BRANCHES || 'main,branch').split(',');
const perfPages=(process.env.C1_PAGES || 'login,signup,reset-password,privacy,terms').split(',');
const perf=process.env.C1_PAGES ? JSON.parse(fs.readFileSync(path.join(out,'performance-raw.json'),'utf8')).filter(r=>!perfBranches.includes(r.branch)||!perfPages.includes(r.page)) : [];
if(mode==='all'||mode==='perf') {
for(const branch of perfBranches)for(const page of perfPages){
 for(let run=1;run<=5;run++){
  const p=await tab();
  await send('Network.setCacheDisabled',{cacheDisabled:true},p.s);
  await send('Network.setBypassServiceWorker',{bypass:true},p.s);
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false},p.s);
  await send('Emulation.setCPUThrottlingRate',{rate:4},p.s);
  await send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1.6*1024*1024/8,uploadThroughput:750*1024/8,connectionType:'cellular4g'},p.s);
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.c1Perf={lcp:[],cls:0,longTasks:[]};new PerformanceObserver(l=>l.getEntries().forEach(e=>c1Perf.lcp.push({value:e.startTime,element:e.element?.tagName,id:e.element?.id,classes:e.element?.className,url:e.url}))).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(l=>l.getEntries().forEach(e=>{if(!e.hadRecentInput)c1Perf.cls+=e.value})).observe({type:'layout-shift',buffered:true});new PerformanceObserver(l=>l.getEntries().forEach(e=>c1Perf.longTasks.push({start:e.startTime,duration:e.duration}))).observe({type:'longtask',buffered:true});`},p.s);
  await navigate(p.s,origin+(branch==='main'?'/main/':'/')+page+'.html');await delay(2000);
  perf.push({branch,page,run,...await evaluate(p.s,'window.c1Perf')});
  await send('Target.closeTarget',{targetId:p.targetId});
 }
 fs.writeFileSync(path.join(out,'performance-raw.json'),JSON.stringify(perf,null,2));console.log('Performance:',branch,page);
}
}
await send('Browser.close');server.close();
})().catch(e=>{console.error(e);if(browser)browser.kill();server.close();process.exitCode=1;});
