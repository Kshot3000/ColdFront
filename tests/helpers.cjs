const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');
const names = { CHI:'Chicago Bears', GB:'Green Bay Packers', MIN:'Minnesota Vikings', DET:'Detroit Lions', PHI:'Philadelphia Eagles' };
function event(id, home='CHI', away='GB', state='pre', date='2026-09-28T23:15:00Z', hs=0, as=0) {
  return { id, name:names[away]+' at '+names[home], date, season:{displayName:'2026'}, status:{type:{state,completed:state==='post',shortDetail:state==='post'?'Final':'Scheduled'}}, competitions:[{status:{type:{state,completed:state==='post'}},venue:{fullName:'Soldier Field'},competitors:[{homeAway:'home',team:{id:home==='CHI'?'3':'9',abbreviation:home,displayName:names[home]},score:{value:hs,displayValue:String(hs)}},{homeAway:'away',team:{id:away==='CHI'?'3':'9',abbreviation:away,displayName:names[away]},score:String(as)}],leaders:[{name:'passingYards',displayName:'Passing',leaders:[{team:{id:'3'},athlete:{displayName:'Test Bears QB',position:{abbreviation:'QB'}},value:250,displayValue:'250 YDS'}]}],broadcasts:[{names:['ESPN']}]}] };
}
const past=event('100','CHI','MIN','post','2026-09-20T17:00:00Z',24,17);
const next=event('200','PHI','CHI');
const schedule={season:{displayName:'2026',type:2},events:[past,next]};
const standings={children:[{name:'NFC',standings:{entries:Object.entries(names).map(([abbr,name],i)=>({team:{abbreviation:abbr,displayName:name},stats:[{name:'wins',value:2},{name:'losses',value:0},{name:'winPercent',value:1},{name:'divisionRank',value:i+1}]}))}}]};
const roster={athletes:[{position:'offense',items:[{id:'1',displayName:'Test Bears QB',jersey:'18',position:{abbreviation:'QB'},headshot:{href:'https://example.com/qb.png'},links:[{href:'https://www.espn.com/'}]}]},{position:'defense',items:[{id:'2',displayName:'Test Bears LB',jersey:'54',position:{abbreviation:'LB'}}]}]};
const news={articles:[{headline:'Bears prepare for Monday night',published:'2026-09-25T22:00:00Z',links:{web:{href:'https://www.espn.com/'}},images:[]}]};
const injuries={injuries:[{displayName:'Chicago Bears',injuries:[{athlete:{displayName:'Test Bears LB',position:{abbreviation:'LB'}},status:'Questionable',date:'2026-09-25',shortComment:'Limited practice'}]}]};
const weather={current:{temperature_2m:14,apparent_temperature:12,wind_speed_10m:16,wind_gusts_10m:25,weather_code:0},daily:{}};
class FixedDate extends Date { constructor(...args){super(...(args.length?args:['2026-09-26T03:00:00Z']));} static now(){return +new Date('2026-09-26T03:00:00Z');} }
const settle = (ms=50) => new Promise(resolve=>setTimeout(resolve,ms));
async function page(name, options={}) {
  const errors=[],requests=[],media=new Map(); let geoCalls=0, frames=0;
  const vc=new VirtualConsole(); vc.on('jsdomError',e=>{if(!/Not implemented: navigation/.test(e.message))errors.push(e.message);});
  const dom=new JSDOM(fs.readFileSync(path.join(root,name+'.html'),'utf8'),{url:'https://kshot3000.github.io/ColdFront/'+name+'.html'+(options.query||''),runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
  const w=dom.window;
  await new Promise(resolve=>w.document.readyState==='loading'?w.document.addEventListener('DOMContentLoaded',resolve,{once:true}):resolve());
  w.Date=FixedDate; w.innerWidth=options.mobile?390:1440;w.innerHeight=900;
  w.matchMedia=(query)=>{if(!media.has(query)){const listeners=[];media.set(query,{matches:query.includes('reduced-motion')&&Boolean(options.reduced),addEventListener:(_,fn)=>listeners.push(fn),fire(value){this.matches=value;listeners.forEach(fn=>fn(this));}});}return media.get(query);};
  w.HTMLCanvasElement.prototype.getContext=()=>({setTransform(){},clearRect(){},beginPath(){},arc(){},fill(){}});
  w.requestAnimationFrame=()=>++frames;w.cancelAnimationFrame=()=>{};
  w.setInterval=()=>0;w.clearInterval=()=>{};
  w.Element.prototype.scrollIntoView=function(){};
  Object.defineProperty(w.navigator,'geolocation',{value:{getCurrentPosition(){geoCalls++;},watchPosition(){geoCalls++;}}});
  w.document.execCommand=()=>true;
  if(options.storage)for(const [k,v] of Object.entries(options.storage))w.localStorage.setItem(k,v);
  if(options.blockStorage)Object.defineProperty(w,'localStorage',{get(){throw new Error('Storage denied');}});
  w.fetch=async(input)=>{
    const u=new URL(input,w.location.href);requests.push(u.href);
    if(options.fetch){const custom=await options.fetch(u);if(custom)return custom;}
    if(options.noSnapshots && u.pathname.includes('/data/snapshots/'))throw new Error('No saved snapshot');
    if(options.offline && u.hostname!=='kshot3000.github.io')throw new Error('Offline fixture');
    let data={};
    if(u.hostname==='kshot3000.github.io')data=JSON.parse(fs.readFileSync(path.join(root,u.pathname.replace('/ColdFront/',''))));
    else if(u.pathname.includes('/roster'))data=roster;
    else if(u.pathname.includes('/schedule'))data=schedule;
    else if(u.pathname.endsWith('/standings'))data=standings;
    else if(u.pathname.endsWith('/injuries'))data=injuries;
    else if(u.pathname.endsWith('/news'))data=news;
    else if(u.pathname.endsWith('/scoreboard')){const date=u.searchParams.get('dates');data={events:date==='20260920'?[past]:date==='20260925'?[]:[next]};}
    else if(u.hostname==='api.open-meteo.com')data=weather;
    else if(u.hostname==='gamma-api.polymarket.com')data=u.pathname.includes('/tags/')?{id:'100',slug:'nfl'}:{events:[{title:'Chicago Bears win?',slug:'bears',markets:[{question:'Chicago Bears win?',outcomes:['Yes','No'],outcomePrices:['0.6','0.4'],slug:'bears'}]}]};
    else if(u.pathname.includes('/rss/')||u.pathname.includes('/news/search'))return {ok:true,text:async()=>'<rss><channel><item><title>Bears injury news</title><link>https://www.chicagobears.com/news</link><description>Latest report</description></item></channel></rss>'};
    return {ok:true,text:async()=>JSON.stringify(data),json:async()=>data};
  };
  for(const el of [...w.document.querySelectorAll('script[src]')])w.eval(fs.readFileSync(path.join(root,el.getAttribute('src').split('?')[0]),'utf8'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  await settle();
  return {w,dom,errors,requests,media,get geoCalls(){return geoCalls;},get frames(){return frames;},close(){w.close();}};
}
module.exports={page,settle,event,schedule,standings,roster};
