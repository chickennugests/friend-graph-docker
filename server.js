'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=+process.env.PORT||8080,DATA=process.env.DATA_DIR||'/data',PASS=process.env.APP_PASSWORD||'';
const DIR=path.join(DATA,'sessions');fs.mkdirSync(DIR,{recursive:true});
const INDEX=path.join(__dirname,'public','index.html');
const idOk=s=>/^[a-f0-9]{8}$/.test(s||'');
const file=id=>path.join(DIR,id+'.json');
const read=id=>JSON.parse(fs.readFileSync(file(id),'utf8'));
function write(id,o){const t=file(id)+'.tmp';fs.writeFileSync(t,JSON.stringify(o));fs.renameSync(t,file(id))}
const h256=s=>crypto.createHash('sha256').update(String(s)).digest();
const fails=new Map();
function authed(req){
  if(!PASS)return true;
  const h=req.headers.authorization||'',t=h.startsWith('Bearer ')?h.slice(7):'';
  return crypto.timingSafeEqual(h256(t),h256(PASS));
}
function send(res,code,b,type){
  res.writeHead(code,{'Content-Type':type||'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
    'Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"});
  res.end(b==null?'':(typeof b==='string'||Buffer.isBuffer(b)?b:JSON.stringify(b)));
}
function body(req){return new Promise((ok,no)=>{let d='',n=0;req.on('data',c=>{n+=c.length;if(n>2e6){no(new Error('big'));req.destroy()}else d+=c});req.on('end',()=>{try{ok(d?JSON.parse(d):{})}catch(e){no(e)}});req.on('error',no)})}
const num=v=>Number.isFinite(+v)?+v:0;
function clean(g){
  g=g&&typeof g==='object'?g:{};
  const nodes=(Array.isArray(g.nodes)?g.nodes:[]).slice(0,2000).map(n=>({id:num(n.id),name:String(n.name||'').slice(0,80),color:String(n.color||'#5b7cff').slice(0,20),x:num(n.x),y:num(n.y)}));
  const edges=(Array.isArray(g.edges)?g.edges:[]).slice(0,20000).map(e=>({a:num(e.a),b:num(e.b),t:['friend','close','acq'].includes(e.t)?e.t:'friend'}));
  return{nodes,edges,uid:num(g.uid)||1,sizeByDeg:!!g.sizeByDeg,curType:['friend','close','acq'].includes(g.curType)?g.curType:'friend'};
}
function list(){
  const out=[];
  for(const f of fs.readdirSync(DIR)){
    if(!/^[a-f0-9]{8}\.json$/.test(f))continue;
    try{const s=read(f.slice(0,8));out.push({id:s.id,name:s.name,updated:s.updated,people:(s.graph.nodes||[]).length,links:(s.graph.edges||[]).length})}catch(e){}
  }
  return out;
}
http.createServer(async(req,res)=>{
  try{
    const p=new URL(req.url,'http://x').pathname,ip=req.socket.remoteAddress;
    if(p==='/healthz')return send(res,200,'ok','text/plain');
    if(req.method==='GET'&&(p==='/'||p==='/index.html'))return send(res,200,fs.readFileSync(INDEX),'text/html; charset=utf-8');
    if(!p.startsWith('/api/'))return send(res,404,{error:'not found'});
    const f=fails.get(ip);
    if(f&&f.n>=10&&Date.now()-f.t<600000)return send(res,429,{error:'too many attempts'});
    if(!authed(req)){const x=fails.get(ip)||{n:0,t:0};x.n++;x.t=Date.now();fails.set(ip,x);return send(res,401,{error:'auth'})}
    fails.delete(ip);
    const parts=p.split('/').filter(Boolean),id=parts[2];
    if(parts[1]!=='sessions')return send(res,404,{error:'not found'});
    if(!id){
      if(req.method==='GET')return send(res,200,list());
      if(req.method==='POST'){
        const b=await body(req),nid=crypto.randomBytes(4).toString('hex'),now=Date.now();
        const s={id:nid,name:String(b.name||'Untitled').slice(0,60),created:now,updated:now,graph:clean({})};
        write(nid,s);return send(res,201,{id:nid,name:s.name});
      }
      return send(res,405,{error:'method'});
    }
    if(!idOk(id)||!fs.existsSync(file(id)))return send(res,404,{error:'no such session'});
    if(req.method==='GET')return send(res,200,read(id));
    if(req.method==='PUT'){const b=await body(req),s=read(id);const bak=file(id).replace(/\.json$/,'.bak');try{if(Date.now()-fs.statSync(bak).mtimeMs>300000)fs.copyFileSync(file(id),bak)}catch(e){fs.copyFileSync(file(id),bak)}s.graph=clean(b.graph);s.updated=Date.now();write(id,s);return send(res,200,{ok:true,updated:s.updated})}
    if(req.method==='PATCH'){const b=await body(req),s=read(id);if(b.name)s.name=String(b.name).slice(0,60);write(id,s);return send(res,200,{ok:true})}
    if(req.method==='DELETE'){fs.unlinkSync(file(id));return send(res,204)}
    send(res,405,{error:'method'});
  }catch(e){send(res,e.message==='big'?413:400,{error:e.message})}
}).listen(PORT,'0.0.0.0',()=>console.log('friend-graph on :'+PORT+(PASS?' (password on)':' (NO PASSWORD)')));
