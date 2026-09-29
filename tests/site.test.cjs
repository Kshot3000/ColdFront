const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {page,settle,event,standings}=require('./helpers.cjs');

test('all ten pages initialize, render data, and never request location or the local network',async(t)=>{
 for(const name of ['index','news','games','stats','odds','injuries','practice','team','about','404']) await t.test(name,async()=>{
  const p=await page(name);try{
   assert.deepEqual(p.errors,[]);
   assert.equal(p.geoCalls,0);
   assert.ok(p.requests.every(u=>!/(127\.0\.0\.1|localhost)/.test(u)));
   assert.equal(p.w.document.querySelectorAll('.snow-toggle').length,1);
   assert.equal(p.w.document.querySelector('.snow-toggle').getAttribute('aria-pressed'),'true');
   assert.ok(!/NaN|undefined|\[object Object\]/.test(p.w.document.querySelector('main').textContent));
  }finally{p.close();}
 });
});

test('Bears adapters preserve zero, home/away, completed status, headlines, and the four North teams',async()=>{
 const p=await page('index');try{const api=p.w.CF.API;
  assert.equal(api.bearsGameFromScoreboard({events:[event('1','GB','MIN')]}),null);
  assert.equal(api.gameFromEvent(event('1','CHI','GB','post',undefined,0,7)).home.score,'0');
  assert.equal(api.scheduleList({events:[event('1')]} )[0].completed,false);
  assert.equal(api.scheduleList({events:[event('1')]} )[0].scoreMe,null);
  assert.equal(api.nextBearsGameFromSchedule({events:[event('1','PHI','CHI')]}).home,false);
  assert.deepEqual(Array.from(api.divisionTable(standings).rows,r=>r.abbr).sort(),['CHI','DET','GB','MIN']);
  assert.equal(api.normalizeNews({articles:[{headline:'Real headline'}]})[0].heading,'Real headline');
  assert.equal(p.w.document.querySelector('#ng-away-abbr').textContent,'CHI');
  assert.equal(p.w.document.querySelector('#ng-home-abbr').textContent,'PHI');
  assert.equal(p.w.document.querySelector('#season-record').textContent,'1–0');
 }finally{p.close();}
});

test('v1.76.0: season-log split between upcoming and completed games is labeled',async()=>{
 // The season log printed upcoming games, then a bare 6px orange-tinted bar,
 // then completed games — the bar explained nothing to a first-time visitor.
 // The split is now a ruled divider carrying a fan-facing tag in the site's
 // micro-label typography (Oswald, tracked-out uppercase), naming the rows
 // below as the season so far. Inline styles only; no stylesheet change, so
 // no CSS cache-bust is needed.
 const p=await page('games');try{const w=p.w;
  await settle(300);
  const body=w.document.querySelector('#log-table tbody');
  assert.ok(body&&body.children.length>2,'the season log renders with upcoming and completed rows');
  const div=w.document.querySelector('#log-table .log-divider');
  assert.ok(div,'the season log carries a labeled divider between upcoming and completed games');
  assert.match(div.textContent,/Completed/i,'the divider names the completed section: '+div.textContent);
  assert.match(div.textContent,/the season so far/i,'the divider explains what the rows below are: '+div.textContent);
  assert.ok(!/height:6px/.test(body.innerHTML),'the bare unlabeled bar is gone');
 }finally{p.close();}
});

test('snow is on in warm September weather, pauses persistently, and responds to reduced-motion changes',async()=>{
 const p=await page('index',{mobile:true});try{
  const b=p.w.document.querySelector('.snow-toggle');b.click();
  assert.equal(b.getAttribute('aria-pressed'),'false');assert.equal(p.w.localStorage.getItem('cf.snow'),'off');
  b.click();assert.equal(b.getAttribute('aria-pressed'),'true');
  p.media.get('(prefers-reduced-motion: reduce)').fire(true);
  assert.equal(b.disabled,true);assert.equal(b.getAttribute('aria-pressed'),'false');
  p.media.get('(prefers-reduced-motion: reduce)').fire(false);assert.equal(b.disabled,false);assert.equal(b.getAttribute('aria-pressed'),'true');
 }finally{p.close();}
 const reduced=await page('index',{reduced:true});try{assert.equal(reduced.frames,0);}finally{reduced.close();}
 const blocked=await page('index',{blockStorage:true});try{assert.deepEqual(blocked.errors,[]);blocked.w.document.querySelector('.snow-toggle').click();}finally{blocked.close();}
});

test('mobile menu has expanded state, closes on Escape, and restores keyboard focus',async()=>{
 const p=await page('index',{mobile:true});try{
  const b=p.w.document.querySelector('.nav-toggle');b.click();assert.equal(b.getAttribute('aria-expanded'),'true');
  p.w.document.dispatchEvent(new p.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(b.getAttribute('aria-expanded'),'false');assert.equal(p.w.document.activeElement,b);
 }finally{p.close();}
});

test('score predictions save to the correct matchup and never claim shared voting',async()=>{
 const p=await page('index');try{
  p.w.document.querySelector('#prediction-toggle').click();
  const f=p.w.document.querySelector('#prediction-form');assert.equal(f.hidden,false);
  p.w.document.querySelector('#prediction-bears').value=31;
  f.dispatchEvent(new p.w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(JSON.parse(p.w.localStorage.getItem('cf.pick.200')).bears,31);
  assert.match(p.w.document.querySelector('#prediction-status').textContent,/Saved on this device/);
 }finally{p.close();}
});

test('roster search, position, groups, favorites, and table view work together',async()=>{
 const p=await page('team');try{const d=p.w.document;
  assert.equal(d.querySelectorAll('.player-card').length,2);
  d.querySelector('[data-favorite="1"]').click();
  d.querySelector('[data-roster-group="favorites"]').click();assert.equal(d.querySelectorAll('.player-card').length,1);
  assert.deepEqual(JSON.parse(p.w.localStorage.getItem('cf.favorites')),['1']);
  d.querySelector('[data-roster-group="all"]').click();
  d.querySelector('#roster-q').value='54';d.querySelector('#roster-q').dispatchEvent(new p.w.Event('input'));assert.match(d.querySelector('.player-card').textContent,/Test Bears LB/);
  d.querySelector('#roster-q').value='';d.querySelector('#roster-q').dispatchEvent(new p.w.Event('input'));
  d.querySelector('#roster-pos').value='QB';d.querySelector('#roster-pos').dispatchEvent(new p.w.Event('change'));assert.equal(d.querySelectorAll('.player-card').length,1);
  d.querySelector('#roster-view').click();assert.equal(d.querySelector('#roster-table-wrap').hidden,false);assert.equal(d.querySelector('#roster-cards').hidden,true);
 }finally{p.close();}
});

test('game date deep links, day controls, and schedule home/away labels are correct',async()=>{
 const p=await page('games',{query:'?date=2026-09-28'});try{const d=p.w.document;
  assert.equal(d.querySelector('#day-pick').value,'2026-09-28');assert.match(d.querySelector('#board-pill').textContent,/2026-09-28/);
  assert.match(d.querySelector('#log-table tbody').textContent,/@ Philadelphia Eagles/);
  assert.match(d.querySelector('#log-table tbody').textContent,/vs Minnesota Vikings/);
  d.querySelector('#day-prev').click();await settle();assert.equal(d.querySelector('#day-pick').value,'2026-09-27');
  d.querySelector('#day-today').click();await settle();assert.equal(d.querySelector('#day-pick').value,'2026-09-25');
 }finally{p.close();}
});

test('optional odds request uses the real v4 sport and parameters and never leaks a key to proxies',async()=>{
 const p=await page('odds');try{let requested;
  p.w.CF.fetchJSON=async u=>{requested=new URL(u);return [];};
  p.w.CF.fetchVia=()=>{throw new Error('Key must never be proxied');};
  await p.w.CF.API.getOddsApi('test-placeholder');
  assert.equal(requested.hostname,'api.the-odds-api.com');assert.match(requested.pathname,/americanfootball_nfl/);
  assert.equal(requested.searchParams.get('apiKey'),'test-placeholder');assert.equal(requested.searchParams.get('markets'),'h2h,spreads,totals');
 }finally{p.close();}
});

test('offline feeds resolve to honest states and the navigation and snow remain usable',async()=>{
 const p=await page('index',{offline:true,noSnapshots:true});try{await settle(3000);
  assert.match(p.w.document.querySelector('#ng-pill').textContent,/unavailable/i);
  assert.match(p.w.document.querySelector('#wire-pill').textContent,/unavailable/i);
  assert.deepEqual(p.errors,[]);p.w.document.querySelector('.snow-toggle').click();
 }finally{p.close();}
});

test('game summaries include Bears leaders even when an opponent leads the game',async()=>{
 const p=await page('stats');try{
  const api=p.w.CF.API;
  api.getEvent=async()=>({header:{id:'100',competitions:[{...event('100','CHI','MIN','post').competitions[0],date:'2026-09-20T17:00:00Z'}]},gameInfo:{venue:{fullName:'Soldier Field'}},leaders:[{team:{abbreviation:'CHI'},leaders:[{name:'passingYards',leaders:[{athlete:{displayName:'Bears quarterback'},displayValue:'138 YDS',value:138}]}]}]});
  const game=await api.bearsGameEvent('100');
  assert.equal(game.name,'Minnesota Vikings at Chicago Bears');
  assert.equal(game.status.type.state,'post');
  assert.equal(game.competitions[0].venue.fullName,'Soldier Field');
  assert.equal(api.eventLeaders(game)[0].teamAbbr,'CHI');
  assert.equal(api.eventLeaders(game)[0].value,138);
 }finally{p.close();}
});

test('prediction markets use the NFL tag ID and filter closed or unrelated outcomes',async()=>{
 const p=await page('odds');try{
  const url=p.requests.find(u=>u.includes('/events/keyset'));
  assert.equal(new URL(url).searchParams.get('tag_id'),'100');
  const events=p.w.CF.API.polymarketBears([{title:'NFL champion',slug:'nfl-champion',markets:[
   {question:'Chicago Bears?',outcomes:'["Chicago","Opponent"]',outcomePrices:'["0","1"]'},
   {question:'Green Bay Packers?',outcomes:['Yes','No'],outcomePrices:['0.9','0.1']},
   {question:'Chicago Bears last season?',closed:true}
  ]}]);
  assert.equal(events[0].markets.length,1);assert.equal(events[0].markets[0].yes,0);
  assert.equal(events[0].markets[0].yesLabel,'Chicago');
  assert.equal(events[0].markets[0].url,'https://polymarket.com/event/nfl-champion');
 }finally{p.close();}
});

test('Cold Front Index frost dial renders with the live score and settles at the final reading',async()=>{
 const p=await page('index');try{
  await settle(400);
  const g=p.w.document.querySelector('#wx-gauge');
  const dial=g&&g.querySelector('.cfi-dial');
  assert.ok(dial,'dial rendered in the weather strip');
  const score=Math.round(p.w.CF.coldFrontGauge(p.w.CF.cacheGet('weather')).score);
  assert.ok(dial.getAttribute('aria-label').includes(String(score)),'aria-label names the live score');
  assert.ok(dial.getAttribute('aria-label').includes('of 100'));
  assert.ok(dial.querySelector('.cfi-value'),'frost arc present');
  assert.ok(dial.querySelector('.cfi-needle'),'needle present');
  assert.equal(g.getAttribute('data-cfi-score'),String(score));
  await settle(1500);
  assert.equal(dial.querySelector('.cfi-num').textContent,String(score),'count-up settles at the live score');
 }finally{p.close();}
 const reduced=await page('index',{reduced:true});try{
  await settle(400);
  const g=reduced.w.document.querySelector('#wx-gauge');
  const score=Math.round(reduced.w.CF.coldFrontGauge(reduced.w.CF.cacheGet('weather')).score);
  assert.ok(g&&g.querySelector('.cfi-dial'),'dial renders under reduced motion');
  assert.equal(g.querySelector('.cfi-num').textContent,String(score),'no animation under reduced motion, final reading shown');
 }finally{reduced.close();}
});

test('final game cards crown the winner and call out a Bears win',async()=>{
 const p=await page('games',{query:'?date=2026-09-20'});try{
  await settle(400);
  const card=p.w.document.querySelector('#board .game-card.bears-won');
  assert.ok(card,'Bears-win final gets the bears-won card');
  assert.equal(card.querySelector('.pill.won').textContent,'BEARS WIN · Final');
  assert.equal(card.querySelector('.side.winner .abbr').textContent,'CHI');
  assert.equal(card.querySelector('.side.loser .abbr').textContent,'MIN');
 }finally{p.close();}
});

test('homepage story cards wrap art in a zoom target and chip the source',async()=>{
 const p=await page('index');try{
  await settle(400);
  const card=p.w.document.querySelector('#home-news .story-card');
  assert.ok(card,'wire story card renders');
  assert.ok(card.querySelector('.story-art > .story-image'),'image is wrapped in .story-art');
  assert.ok(card.querySelector('.story-copy .story-source'),'source element present for the tag chip');
  assert.equal(card.querySelector('.story-copy h3').textContent,'Bears prepare for Monday night');
 }finally{p.close();}
});

test('hero entrance choreography staggers the load-in and stays off for reduced motion',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/experience.css'),'utf8');
 assert.match(css,/@keyframes cf-hero-rise\s*\{[^}]*opacity:\s*0/s,'entrance keyframes start hidden');
 const guard=css.indexOf('@media (prefers-reduced-motion: no-preference)');
 assert.ok(guard>0,'entrance is gated on no-preference');
 const block=css.slice(guard);
 const order=['.hero-copy .eyebrow','.hero-copy h1','.hero-copy .sub','.hero-actions','.hero-layout .match-card','.hero-note','.season-strip','.wire-ticker'];
 const delays=order.map(sel=>{
  const m=block.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[^}]*?animation:[^;]*?([\\d.]+)s both'));
  assert.ok(m,sel+' gets a staggered entrance delay');
  return parseFloat(m[1]);
 });
 assert.deepEqual([...delays].sort((a,b)=>a-b),delays,'entrance delays increase through the hero sequence');
 const p=await page('index');try{
  const q=p.w.document.querySelector.bind(p.w.document);
  assert.ok(q('.hero-copy .eyebrow')&&q('.hero-copy h1')&&q('.hero-copy .sub')&&q('.hero-actions')&&q('.hero-note')&&q('.hero-layout .match-card')&&q('.season-strip')&&q('.wire-ticker'),'every entrance target renders on the homepage');
 }finally{p.close();}
});

test('photo-band recomposition lifts the photo and anchors the art cluster',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/experience.css'),'utf8');
 assert.match(css,/\.photo-band::before\s*\{[^}]*0\.22\) 100%/s,'overlay falls off to 0.22 on the right edge');
 assert.match(css,/\.photo-band\.navy-pier \.photo-band-bg\s*\{[^}]*brightness\(0\.7\)/s,'navy-pier background lifted out of the crush');
 assert.match(css,/\.photo-band\.marina-city \.photo-band-bg\s*\{[^}]*brightness\(0\.78\)/s,'marina-city background lifted out of the crush');
 assert.match(css,/\.photo-band \.photo-band-art \.art-mark \+ \.art-mark\s*\{[^}]*margin-left:\s*-30px/s,'badges overlap into one emblem');
 assert.match(css,/\.photo-band \.photo-band-art::before\s*\{[^}]*radial-gradient/s,'frost aura anchors the emblem');
 const p=await page('games');try{
  await settle(300);
  const art=p.w.document.querySelector('.photo-band .photo-band-art');
  assert.ok(art,'games band carries the art cluster');
  assert.ok(art.querySelectorAll('.art-mark').length>=2,'band carries at least two art marks to compose');
 }finally{p.close();}
});

test('footer glow-up: bottom bar with PRL tip chip that copies the donation address',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/main.css'),'utf8');
 assert.match(css,/\.site-foot::before\s*\{[^}]*box-shadow:\s*0 1px 16px rgba\(232,\s*84,\s*30,\s*0\.35\)/s,'footer top edge glows orange');
 assert.match(css,/\.site-foot h4::before\s*\{[^}]*width:\s*3px/s,'column headers carry an orange tick');
 assert.match(css,/\.prl-chip:hover\s*\{[^}]*translateY\(-1px\)/s,'tip chip lifts on hover');
 assert.match(css,/\.prl-chip\.copied\s*\{[^}]*rgba\(110,\s*220,\s*150,\s*0\.65\)/s,'copied state flashes green');
 for(const name of ['index','news','games','stats','odds','injuries','practice','team','about','highlights','404']){
  const p=await page(name);try{
   const q=p.w.document.querySelector.bind(p.w.document);
   const chip=q('.foot-bottom .prl-chip[data-cf-copy="btc"]');
   assert.ok(chip,name+' footer has the BTC tip chip in the bottom bar');
   assert.equal(chip.getAttribute('aria-label'),'Copy Bitcoin (BTC) donation address to clipboard');
   assert.equal(p.w.CF.CONFIG.donations.find(d=>d.chain==='BTC').address,'3GnR7TWBXAB3pPztBWpNF4LMNEX5yX8vZK');
   const status=chip.querySelector('.prl-status');
   assert.equal(status.textContent,'Copy');
   chip.click();await settle(100);
   assert.ok(chip.classList.contains('copied'),'chip shows the copied state after click');
   assert.equal(status.textContent,'Copied');
   assert.ok(q('.foot-credit a[data-cf-x-handle]').textContent.includes('@kshot9000'),name+' keeps the footer @kshot9000 branding');
  }finally{p.close();}
 }
});

test('odds board highlights the best Bears price across books',async()=>{
 const p=await page('odds');try{const w=p.w;
  w.CF.API.getSchedule=async()=>({source:'live',data:{season:{displayName:'2026'},events:[event('200','PHI','CHI')]}});
  const payload=[{id:'200',name:'Chicago Bears at Philadelphia Eagles',competitions:[{odds:[
   {provider:{name:'DraftKings'},pointSpread:{home:{close:{line:-3}},away:{close:{line:3}}},overUnder:47.5,moneyline:{home:{close:{odds:-160}},away:{close:{odds:140}}}},
   {provider:{name:'FanDuel'},pointSpread:{home:{close:{line:-2.5}},away:{close:{line:2.5}}},overUnder:48,moneyline:{home:{close:{odds:-150}},away:{close:{odds:130}}}}
  ]}]}];
  w.CF.API.getOdds=async()=>({source:'live',data:payload});
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await settle(500);
  const d=w.document;
  const strip=d.querySelector('.best-strip');
  assert.ok(strip,'best-price strip renders above the board');
  assert.match(strip.textContent,/Best Bears prices/);
  assert.match(strip.textContent,/Spread \+3 @ DraftKings/,'Bears-away best spread is +3 at DraftKings');
  assert.match(strip.textContent,/ML \+140 @ DraftKings/,'Bears-away best ML is +140 at DraftKings');
  assert.match(strip.textContent,/Over 47\.5 @ DraftKings/,'best Over is the lowest total');
  assert.match(strip.textContent,/Under 48 @ FanDuel/,'best Under is the highest total');
  const bests=[...d.querySelectorAll('.odds-card b.best')].map(b=>b.textContent);
  assert.ok(bests.some(t=>t.includes('+3')&&t.includes('BEST')),'best spread cell is badged');
  assert.ok(bests.some(t=>t.includes('+140')&&t.includes('BEST')),'best ML cell is badged');
  assert.ok(bests.some(t=>t.includes('BEST OVER')),'best Over cell is badged');
  assert.ok(bests.some(t=>t.includes('BEST UNDER')),'best Under cell is badged');
  assert.ok(!/NaN|undefined|\[object Object\]/.test(d.querySelector('#odds-board').textContent));
 }finally{p.close();}
});

test('sticky header compacts on scroll and restores at the top',async()=>{
 const p=await page('index');try{const w=p.w,d=w.document;
  assert.equal(d.body.classList.contains('is-scrolled'),false,'header starts uncompressed');
  d.documentElement.scrollTop=500;w.dispatchEvent(new w.Event('scroll'));await settle(60);
  assert.equal(d.body.classList.contains('is-scrolled'),true,'scrolling past the threshold compacts the header');
  assert.ok(d.documentElement.style.getPropertyValue('--cf-head-h').endsWith('px'),'--cf-head-h is refreshed for the mobile nav offset');
  d.documentElement.scrollTop=0;w.dispatchEvent(new w.Event('scroll'));await settle(60);
  assert.equal(d.body.classList.contains('is-scrolled'),false,'returning to the top restores the header');
 }finally{p.close();}
});

test('season log rows carry the W/L result treatment',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/main.css'),'utf8');
 assert.match(css,/\.tbl tr\.result-w td:first-child\s*\{[^}]*inset 3px 0 0 var\(--orange\)/s,'wins carry an orange leading-edge thread');
 assert.match(css,/\.tbl tr\.result-w \.log-score\s*\{[^}]*#ffa76b/s,'win scores are brightened and bolded');
 assert.match(css,/\.tbl tr\.result-l td\s*\{[^}]*opacity:\s*0\.62/s,'losses recede');
 assert.match(css,/\.tbl tr\.result-l:hover td\s*\{[^}]*opacity:\s*1/s,'losses restore on hover');
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.tbl tr\.result-l td\s*\{[^}]*transition:\s*none/s,'the recede transition is gated on reduced motion');
 const p=await page('games');try{const w=p.w,d=w.document;
  const win=event('100','CHI','MIN','post','2026-09-20T17:00:00Z',24,17);
  const loss=event('101','CHI','GB','post','2026-09-13T17:00:00Z',17,24);
  const tie=event('102','CHI','DET','post','2026-09-06T17:00:00Z',20,20);
  w.CF.API.getSchedule=async()=>({source:'live',data:{season:{displayName:'2026'},events:[win,loss,tie]}});
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await settle(500);
  const rows=[...d.querySelectorAll('#log-table tbody tr')];
  const winRow=rows.find(r=>/Minnesota Vikings/.test(r.textContent));
  assert.ok(winRow.classList.contains('result-w'),'win row is marked result-w');
  assert.ok(winRow.classList.contains('boxrow'),'win row keeps its box-score hook');
  assert.match(winRow.querySelector('.log-score').textContent,/24–17/,'win score cell is labeled log-score');
  const lossRow=rows.find(r=>/Green Bay Packers/.test(r.textContent));
  assert.ok(lossRow.classList.contains('result-l'),'loss row is marked result-l');
  const tieRow=rows.find(r=>/Detroit Lions/.test(r.textContent));
  assert.ok(!tieRow.classList.contains('result-w')&&!tieRow.classList.contains('result-l'),'ties stay neutral');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
});

test('mobile drawer staggers its links, highlights the active page, and the toggle morphs to a close glyph',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/main.css'),'utf8');
 assert.match(css,/\.nav\.open a\s*\{[^}]*animation-delay:\s*calc\(var\(--ni, 0\) \* 45ms\)/s,'drawer links stagger their entrance');
 assert.match(css,/@keyframes cf-nav-in/,'drawer entrance keyframes exist');
 assert.match(css,/\.nav\.open a\.active\s*\{[^}]*inset 3px 0 0 var\(--orange\)/s,'active drawer link carries an orange leading-edge thread');
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.nav\.open a \{ animation: none; \}/,'drawer entrance is gated on reduced-motion');
 // v1.97.0: the toggle mark is an inline SVG whose bars truly morph into an
 // ✕ (the old text-glyph swap is gone), gated on reduced motion.
 assert.match(css,/\.nav-toggle \.nt-bar\s*\{[^}]*stroke:\s*currentColor/s,'the toggle bars inherit the button color');
 assert.match(css,/body\.nav-open \.nav-toggle \.nt-top\s*\{[^}]*rotate\(45deg\)/s,'the top bar swings into the ✕ when open');
 assert.match(css,/body\.nav-open \.nav-toggle \.nt-mid\s*\{[^}]*opacity:\s*0/s,'the middle bar collapses when open');
 assert.match(css,/body\.nav-open \.nav-toggle \.nt-bot\s*\{[^}]*rotate\(-45deg\)/s,'the bottom bar swings into the ✕ when open');
 assert.match(css,/prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.nav-toggle \.nt-bar\s*\{\s*transition:\s*none/s,'reduced motion gets the instant morph');
 const p=await page('index',{mobile:true});try{
  const w=p.w,d=w.document,b=d.querySelector('.nav-toggle'),nav=d.querySelector('.nav');
  const icon=()=>b.querySelector('svg.nt-icon');
  assert.ok(icon(),'the toggle carries an inline SVG icon');
  assert.equal(icon().querySelectorAll('line.nt-bar').length,3,'the icon has three morphing bars');
  assert.equal(icon().getAttribute('aria-hidden'),'true','the decorative icon stays out of the accessibility tree');
  assert.ok(!d.body.classList.contains('nav-open'),'the drawer starts closed');
  b.click();
  assert.ok(d.body.classList.contains('nav-open'),'opening adds body.nav-open');
  assert.equal(b.getAttribute('aria-expanded'),'true','the open state is announced');
  assert.equal(b.getAttribute('aria-label'),'Close menu','the label names the close action');
  assert.ok(icon(),'the SVG survives the open toggle — no textContent glyph swap');
  const links=Array.from(nav.querySelectorAll('a'));
  assert.ok(links.length>1,'drawer has links to stagger');
  assert.ok(links.every((a,i)=>a.style.getPropertyValue('--ni').trim()===String(i)),'each drawer link carries its stagger index');
  b.click();
  assert.ok(!d.body.classList.contains('nav-open'),'closing removes body.nav-open');
  assert.equal(b.getAttribute('aria-expanded'),'false','the closed state is announced');
  assert.equal(b.getAttribute('aria-label'),'Open menu','the label names the open action');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
});
test('injury report rows carry severity treatment and the availability snapshot counts them',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/main.css'),'utf8');
 assert.match(css,/\.tbl tr\.inj-sev-out td:first-child\s*\{\s*box-shadow:\s*inset 3px 0 0 var\(--orange\)/s,'out rows carry the orange leading edge');
 assert.match(css,/\.tbl tr\.inj-sev-questionable td:first-child\s*\{\s*box-shadow:\s*inset 3px 0 0 var\(--warn\)/s,'questionable rows carry the amber leading edge');
 assert.match(css,/#report-table \.st::before/,'report pills carry a severity dot');
 assert.match(css,/@keyframes cfSnapIn/,'snapshot strip entrance keyframes exist');
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.inj-snap-chip, \.inj-snap-clear \{ animation: none; \}/s,'snapshot entrance is gated on reduced-motion');
 const p=await page('injuries');try{
  const d=p.w.document;
  const row=d.querySelector('#report-table tbody tr');
  assert.ok(row && row.classList.contains('inj-sev-questionable'),'report row carries its severity class');
  const snap=d.querySelector('#rep-snapshot');
  assert.ok(snap,'snapshot strip exists');
  assert.match(snap.innerHTML,/inj-snap-chip sev-questionable/,'snapshot renders a questionable chip');
  assert.ok(snap.textContent.includes('1 listed'),'snapshot counts the listed players');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
});
test('NFC North matchup cards glow up: our-game treatment, identity chip, and result tint',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/main.css'),'utf8');
 assert.match(css,/#north-games \.mini-game\.our-game\s*\{[^}]*border-left:\s*3px solid var\(--orange\)/s,'our game carries the orange leading-edge thread');
 assert.match(css,/#north-games \.mini-game:hover,\s*#north-games \.mini-game:focus-visible/s,'hover and keyboard focus share the treatment');
 assert.match(css,/#north-games \.mini-status strong\s*\{[^}]*font-variant-numeric:\s*tabular-nums/s,'scores use tabular numerals');
 assert.match(css,/#north-games \.mini-game\.bears-loss\s*\{[^}]*opacity:\s*0\.62/s,'a Bears loss recedes the row');
 assert.match(css,/#north-games \.mini-game\.bears-win \.mini-status strong\s*\{[^}]*color:\s*var\(--orange-hot\)/s,'a Bears win warms the score');
 const p=await page('index');try{
  const ours=p.w.document.querySelector('#north-games .mini-game.our-game');
  assert.ok(ours,'the Bears game is marked our-game');
  assert.equal(ours.querySelector('.our-chip').textContent.trim(),'🐻 Our game','the identity chip renders');
  assert.ok(!ours.classList.contains('bears-win')&&!ours.classList.contains('bears-loss'),'a pre-game carries no result tint');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
 const win=event('301','CHI','DET','post','2026-09-21T17:00:00Z',31,17);
 const loss=event('302','GB','CHI','post','2026-09-21T21:25:00Z',27,20);
 const q=await page('index',{fetch:async(u)=>{if(u.href.includes('scoreboard')){const body={events:[win,loss]};return{ok:true,text:async()=>JSON.stringify(body),json:async()=>body};}}});try{
  const cards=[...q.w.document.querySelectorAll('#north-games .mini-game.our-game')];
  assert.equal(cards.length,2,'both Bears games are marked');
  assert.ok(cards[0].classList.contains('bears-win'),'the Bears win warms the score');
  assert.ok(cards[1].classList.contains('bears-loss'),'the Bears loss recedes');
  assert.ok(cards.every(c=>c.querySelector('.our-chip')),'every Bears game carries the chip');
  assert.deepEqual(q.errors,[]);
 }finally{q.close();}
});
test('roster player cards carry the group identity thread, entrance stagger, and skeleton loading',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/main.css'),'utf8');
 assert.match(css,/\.player-card\[data-group="offense"\]\s*\{\s*--group-accent:\s*var\(--orange-hot\)/s,'offense cards thread orange');
 assert.match(css,/\.player-card\[data-group="defense"\]\s*\{\s*--group-accent:\s*#6fa8d8/s,'defense cards thread ice blue');
 assert.match(css,/\.player-card\[data-group="special"\]\s*\{\s*--group-accent:\s*var\(--warn\)/s,'special teams cards thread gold');
 assert.match(css,/\.player-card:hover,\s*\.player-card:focus-within\s*\{[^}]*transform:\s*translateY\(-4px\)/s,'hover and keyboard focus share the card lift');
 assert.match(css,/\.favorite-button\[aria-pressed="true"\]\s*\{[^}]*box-shadow:\s*0 0 14px rgba\(255, 90, 31, 0\.5\)/s,'a saved favorite star glows');
 assert.match(css,/@keyframes cfRosterIn/,'roster entrance keyframes exist');
 assert.match(css,/\.player-card\.cf-enter\s*\{[^}]*animation-delay:\s*calc\(var\(--ni, 0\) \* 35ms\)/s,'the entrance staggers on a --ni cascade');
 assert.match(css,/\.skel-player \.skel-art\s*\{\s*height:\s*170px/s,'skeleton player cards mirror the card shape');
 const html=fs.readFileSync(path.join(__dirname,'../team.html'),'utf8');
 assert.match(html,/class="skel-player"/,'team page opens with skeleton player cards');
 assert.match(html,/role="status">Loading the Bears roster/,'the loading state announces to screen readers');
 const p=await page('team');try{
  const d=p.w.document;
  const cards=[...d.querySelectorAll('#roster-cards .player-card')];
  assert.ok(cards.length>=2,'the roster renders player cards');
  const qb=cards.find(c=>/Test Bears QB/.test(c.textContent));
  const lb=cards.find(c=>/Test Bears LB/.test(c.textContent));
  assert.equal(qb.getAttribute('data-group'),'offense','the QB threads offense orange');
  assert.equal(lb.getAttribute('data-group'),'defense','the LB threads defense ice');
  assert.ok(qb.classList.contains('cf-enter'),'first paint staggers the entrance');
  assert.equal(qb.style.getPropertyValue('--ni'),'0','the stagger index cascades');
  assert.equal(cards[1].style.getPropertyValue('--ni'),'1','the second card follows the cascade');
  const fav=qb.querySelector('.favorite-button');
  assert.equal(fav.getAttribute('aria-pressed'),'false','the favorite star starts unpressed');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
});
test('highlights video cards carry the identity thread, entrance stagger, and skeleton loading',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/highlights.css'),'utf8');
 assert.match(css,/\.hl-card::before\s*\{[^}]*background:\s*linear-gradient\(90deg,\s*var\(--orange-hot\)/s,'cards carry the orange identity thread');
 assert.match(css,/\.hl-card:hover \.hl-mini-play,\s*\.hl-card:focus-visible \.hl-mini-play/s,'the play badge answers hover and keyboard focus alike');
 assert.match(css,/@media \(hover: none\)\s*\{[\s\S]*?\.hl-mini-play/s,'touch users keep the play badge on');
 assert.match(css,/@keyframes hlPlayPing/,'the attention ring pings');
 assert.match(css,/@keyframes hlRise/,'highlights entrance keyframes exist');
 assert.match(css,/\.hl-card\.cf-enter\s*\{[^}]*animation-delay:\s*calc\(var\(--hi, 0\) \* 40ms\)/s,'the entrance staggers on a --hi cascade');
 assert.match(css,/\.hl-skel \.skel-shot/s,'skeleton video cards mirror the card shape');
 assert.match(css,/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.hl-card\.cf-enter\s*\{\s*animation:\s*none/s,'reduced motion snaps the entrance');
 const p=await page('highlights');try{
  const d=p.w.document;
  const cards=[...d.querySelectorAll('#hl-list .hl-card')];
  assert.ok(cards.length>=2,'the feed renders video cards');
  assert.ok(cards.every(c=>c.classList.contains('cf-enter')),'first paint staggers every card');
  assert.equal(cards[0].style.getPropertyValue('--hi'),'0','the cascade starts at --hi: 0');
  assert.equal(cards[1].style.getPropertyValue('--hi'),'1','the second card follows the cascade');
  assert.ok(cards.some(c=>c.getAttribute('data-kind')==='highlight'),'game footage carries the highlight kind');
  d.querySelector('.hl-filters [data-filter="highlight"]').click();await settle();
  const filtered=[...d.querySelectorAll('#hl-list .hl-card')];
  assert.ok(filtered.length>=1,'the highlights-only filter renders footage');
  assert.ok(filtered.every(c=>!c.classList.contains('cf-enter')),'filter re-renders stay instant');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
});
test('highlights feature frame carries the identity thread, display-type title, and poster keyboard parity',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/highlights.css'),'utf8');
 assert.match(css,/\.hl-now::before\s*\{[^}]*background:\s*linear-gradient\(90deg,\s*var\(--orange-hot\)/s,'the now-playing strip carries the orange identity thread');
 assert.match(css,/\.hl-feature:focus-within \.hl-now::before/,'the thread ignites when the frame holds keyboard focus');
 assert.match(css,/\.hl-now h2\s*\{[^}]*font-family:\s*var\(--display\)/s,'the featured title sets in the display typeface');
 assert.match(css,/\.hl-eyebrow\s*\{[^}]*letter-spacing:\s*0\.28em/s,'the ❄ NOW PLAYING eyebrow carries the tape-room identity');
 assert.match(css,/\.hl-poster:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--orange-hot\)/s,'the keyboard-operable poster shows the family focus ring');
 assert.match(css,/\.hl-poster:focus-visible \.hl-play/s,'the big play badge answers keyboard focus like hover');
 assert.match(css,/@keyframes hlNowIn/,'the swap fade keyframes exist');
 assert.match(css,/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.hl-now\.hl-now-in\s*\{\s*animation:\s*none/s,'reduced motion snaps the swap fade');
 const p=await page('highlights');try{
  const d=p.w.document;
  const now=d.querySelector('#hl-feature .hl-now');
  assert.ok(now,'the feature frame renders a now-playing strip');
  assert.match(now.querySelector('.hl-eyebrow').textContent,/Now playing/,'the strip opens with the eyebrow');
  assert.ok(now.querySelector('h2').textContent.length>3,'the strip shows the featured title');
  assert.ok(now.classList.contains('hl-now-in'),'the strip fades in on load');
  const cards=[...d.querySelectorAll('#hl-list .hl-card')];
  assert.ok(cards.length>=2,'the feed renders video cards');
  const second=cards.find(c=>!c.classList.contains('is-active'))||cards[1];
  second.click();await settle();
  const swapped=d.querySelector('#hl-feature .hl-now');
  assert.ok(swapped.classList.contains('hl-now-in'),'the strip re-fades when a new video loads');
  assert.equal(swapped.querySelector('h2').textContent,second.querySelector('.hl-title').textContent,'the strip follows the chosen video');
  assert.ok(d.querySelector('#hl-feature iframe'),'the swap loads the real player');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
});
test('last-game box score renders a final scorecard with the winner glow and the Bears chip',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/experience.css'),'utf8');
 assert.match(css,/\.bx-card::before\s*\{[^}]*background:\s*linear-gradient\(90deg,\s*var\(--orange-hot\)/s,'the scorecard carries the orange identity thread');
 assert.match(css,/\.bx-team\.winner \.bx-score\s*\{[^}]*text-shadow:\s*0 0 22px rgba\(255,\s*90,\s*31,\s*0\.65\)/s,'the winner score glows');
 assert.match(css,/\.bx-team\.winner \.bx-abbr\s*\{[^}]*color:\s*var\(--orange-hot\)/s,'the winner abbr warms to orange');
 assert.match(css,/\.bx-team\.loser\s*\{[^}]*opacity:\s*0\.55/s,'the loser recedes');
 assert.match(css,/\.bx-team\.loser:hover\s*\{[^}]*opacity:\s*1/s,'hover restores the loser row');
 assert.match(css,/\.bx-card:focus-within \.bx-team\.loser\s*\{[^}]*opacity:\s*1/s,'keyboard focus also restores the loser row');
 assert.match(css,/@keyframes bxRise/,'scorecard entrance keyframes exist');
 assert.match(css,/\.bx-card\.cf-enter\s*\{[^}]*animation:\s*bxRise/s,'first paint frost-fades the card in');
 assert.match(css,/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.bx-card\.cf-enter\s*\{\s*animation:\s*none/s,'reduced motion snaps the entrance');
 assert.match(css,/@media \(max-width: 560px\) \{[\s\S]*?\.bx-score\s*\{\s*font-size:\s*28px/s,'the card compacts on small screens');
 const p=await page('stats');try{
  const d=p.w.document;
  const card=d.querySelector('#lastbox .bx-card');
  assert.ok(card,'the last-game box renders a scorecard');
  assert.ok(card.classList.contains('cf-enter'),'first paint carries the entrance class');
  const rows=[...card.querySelectorAll('.bx-team')];
  assert.equal(rows.length,2,'both sides render');
  const chi=rows.find(r=>/Chicago Bears/.test(r.textContent));
  const min=rows.find(r=>/Minnesota Vikings/.test(r.textContent));
  assert.ok(chi.classList.contains('winner'),'the 24-point Bears side glows as the winner');
  assert.ok(chi.querySelector('.bx-chip'),'the Bears row carries the identity chip');
  assert.ok(min.classList.contains('loser'),'the losing side recedes');
  assert.equal(chi.querySelector('.bx-score').textContent,'24','the Bears score reads');
  assert.equal(min.querySelector('.bx-score').textContent,'17','the opponent score reads');
  const res=card.querySelector('.pill.won');
  assert.ok(res,'a Bears win earns the bright result pill');
  assert.match(res.textContent,/W 24–17/,'the result pill names the Bears win');
  assert.ok(/Soldier Field/.test(card.querySelector('.bx-meta').textContent),'the venue and date line survives');
  assert.ok(card.querySelector('.pill.final'),'the final pill survives');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
});
test('season-pulse tiles render as stat cards with the identity thread, record glow, and differential tint',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/experience.css'),'utf8');
 assert.match(css,/\.stat-tile::before\s*\{[^}]*background:\s*linear-gradient\(90deg,\s*var\(--orange-hot\)/s,'the tiles carry the orange identity thread');
 assert.match(css,/\.stat-tile\.record-win b\s*\{[^}]*text-shadow:\s*0 0 14px rgba\(255,\s*90,\s*31,\s*0\.5\)/s,'a winning record glows warm');
 assert.match(css,/\.stat-tile\.record-loss b\s*\{[^}]*opacity:\s*0\.55/s,'a losing record recedes');
 assert.match(css,/\.stat-tile\.record-loss:hover b\s*\{[^}]*opacity:\s*1/s,'hover restores the receding record');
 assert.match(css,/\.stat-tile\.diff-pos b\s*\{[^}]*color:\s*#b9e3c6/s,'a positive differential tints ice-green');
 assert.match(css,/\.stat-tile\.diff-neg b\s*\{[^}]*opacity:\s*0\.6/s,'a negative differential recedes cool');
 assert.match(css,/@keyframes tileRise/,'tile entrance keyframes exist');
 assert.match(css,/\.stat-tile\.cf-enter\s*\{[^}]*animation:\s*tileRise/s,'first paint frost-fades the tiles in');
 assert.match(css,/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.stat-tile\.cf-enter\s*\{\s*animation:\s*none/s,'reduced motion snaps the entrance');
 assert.match(css,/@media \(max-width: 560px\) \{[\s\S]*?\.stat-tile b\s*\{\s*font-size:\s*24px/s,'the tiles compact on small screens');
 const p=await page('stats');try{
  const d=p.w.document;
  const tiles=[...d.querySelectorAll('#pulse .stat-tile')];
  assert.equal(tiles.length,4,'all four pulse tiles render');
  assert.ok(tiles.every(t=>t.classList.contains('cf-enter')),'first paint carries the entrance class');
  assert.deepEqual(tiles.map((t,i)=>t.style.getPropertyValue('--ni')),['0','1','2','3'],'entrance staggers across the tiles');
  const rec=tiles[0],diff=tiles[3];
  assert.ok(rec.classList.contains('record-win'),'the 1–0 record glows as a win');
  assert.equal(rec.querySelector('b').textContent,'1–0','the record reads');
  assert.ok(diff.classList.contains('diff-pos'),'the +7 differential tints positive');
  assert.equal(diff.querySelector('b').textContent,'+7','the differential reads');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
});
test('sunday desk renders a matchup duel card with countdown, thread, and first-paint entrance',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/experience.css'),'utf8');
 assert.match(css,/\.next-opp-card::before\s*\{[^}]*background:\s*linear-gradient\(90deg,\s*var\(--orange-hot\)/s,'the desk carries the orange identity thread');
 assert.match(css,/@keyframes duelRise/,'duel entrance keyframes exist');
 assert.match(css,/\.duel\.cf-enter \.duel-side\s*\{[^}]*animation:\s*duelRise/s,'first paint frost-fades the duel in');
 assert.match(css,/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.duel\.cf-enter \.duel-side[\s\S]*?animation:\s*none/s,'reduced motion snaps the entrance');
 assert.match(css,/@media \(max-width: 560px\) \{[\s\S]*?\.duel-side \{\s*padding:\s*10px/s,'the duel compacts on small screens');
 assert.match(css,/\.duel-side\.bears \.duel-abbr\s*\{[^}]*text-shadow:\s*0 0 16px rgba\(255,\s*90,\s*31,\s*0\.45\)/s,'the Bears abbr glows warm');
 const p=await page('games');try{
  const d=p.w.document;
  const duel=d.querySelector('#next-opp-duel');
  assert.equal(duel.hidden,false,'the duel paints when the schedule answers');
  assert.equal(duel.getAttribute('aria-hidden'),'true','the visual duel is hidden from assistive tech');
  assert.ok(duel.classList.contains('cf-enter'),'first paint carries the entrance class');
  const abbrs=[...duel.querySelectorAll('.duel-abbr')].map(e=>e.textContent);
  assert.deepEqual(abbrs,['CHI','PHI'],'the duel pits CHI against the fixture opponent');
  assert.ok(duel.querySelector('.duel-side.bears .duel-bear'),'the Bears side carries the identity chip');
  assert.equal(duel.querySelector('.duel-vs').textContent,'@','the mid names the away site');
  const cd=d.querySelector('#next-opp-countdown');
  assert.equal(cd.hidden,false,'the countdown chip shows');
  assert.match(cd.textContent,/^Kickoff in 2d 20h$/,'the countdown reads to the fixture kickoff');
  assert.ok(!cd.classList.contains('today'),'a two-day countdown is not flagged urgent');
  const vs=d.querySelector('#next-opp-vs');
  assert.ok(vs.classList.contains('sr-only'),'the matchup line is screen-reader only');
  assert.equal(vs.textContent,'Chicago Bears at Philadelphia Eagles','the live region still announces the matchup');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
});
test('wire story cards get the glow-up: identity thread, focus parity, source chip, first-paint entrance',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/main.css'),'utf8');
 assert.match(css,/\.news-item::before\s*\{[^}]*background:\s*linear-gradient\(90deg,\s*var\(--orange-hot\)/s,'the wire cards carry the orange identity thread');
 assert.match(css,/\.news-item:hover::before,\s*\.news-item:focus-within::before\s*\{\s*opacity:\s*1/s,'the thread ignites on hover and keyboard focus');
 assert.match(css,/\.news-item:hover,\s*\.news-item:focus-within\s*\{[^}]*transform:\s*translateY\(-3px\)/s,'hover lift has :focus-within keyboard parity');
 assert.match(css,/\.news-item:hover \.headline,\s*\.news-item:focus-within \.headline\s*\{\s*color:\s*var\(--orange-hot\)/s,'the headline warms under hover and keyboard focus');
 assert.match(css,/\.news-item \.headline:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--orange-hot\)/s,'headline links carry a visible focus ring');
 assert.match(css,/\.news-item \.meta span:first-child\s*\{[^}]*border-radius:\s*999px/s,'the source renders as a chip');
 assert.match(css,/\.news-item\.cf-enter\s*\{[^}]*animation:\s*cfRosterIn/s,'first paint frost-fades the cards in');
 assert.match(css,/\.news-item\.cf-enter\s*\{[^}]*animation-delay:\s*calc\(var\(--ni, 0\) \* 35ms\)/s,'the entrance staggers on a --ni cascade');
 assert.match(css,/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.news-item\.cf-enter\s*\{\s*animation:\s*none/s,'reduced motion snaps the entrance');
 const p=await page('news');try{
  const d=p.w.document;
  const cards=[...d.querySelectorAll('#news-list .news-item')];
  assert.ok(cards.length>0,'the wire paints story cards');
  assert.ok(cards.every(c=>c.classList.contains('cf-enter')),'first paint carries the entrance class');
  assert.equal(cards[0].style.getPropertyValue('--ni'),'0','the first card leads the stagger cascade');
  assert.ok(cards[0].querySelector('.headline'),'cards carry a headline link');
  const rail=[...d.querySelectorAll('#injury-news .news-item')];
  assert.ok(rail.every(c=>c.classList.contains('cf-enter')),'the injury rail enters on first paint too');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
});
test('hero match-card speaks Bears: identity follows the team, finals carry the winner treatment',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/experience.css'),'utf8');
 assert.match(css,/\.match-card \.side\.is-bears \.abbr\s*\{[^}]*color:\s*#ff7941/s,'the orange identity follows the Bears side');
 assert.match(css,/\.match-card \.side\.is-bears \.bears-chip\s*\{\s*display:\s*block/s,'the Bears side reveals the identity chip');
 assert.match(css,/\.match-card\.final \.side\.winner \.score/s,'finals glow the winner score');
 assert.match(css,/\.match-card\.final \.side\.loser\s*\{\s*opacity:\s*0\.55/s,'finals recede the loser');
 assert.match(css,/\.match-card\.bears-won\s*\{[^}]*border-top-color:\s*var\(--orange-hot\)/s,'a Bears win floods the card thread');
 const p=await page('index');try{
  const d=p.w.document;
  const away=d.querySelector('#ng-away-abbr').closest('.side');
  const home=d.querySelector('#ng-home-abbr').closest('.side');
  assert.ok(away.classList.contains('is-bears'),'the away Bears carry the identity (fixture: CHI at PHI)');
  assert.ok(!home.classList.contains('is-bears'),'the home opponent recedes');
  assert.ok(!d.querySelector('#next-game').classList.contains('final'),'a pre-game card is not a final');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
 const q=await page('index',{fetch:async(u)=>{
  if(u.pathname.endsWith('/scoreboard')){
   const data={events:[event('100','CHI','MIN','post','2026-09-20T17:00:00Z',24,17)]};
   return {ok:true,text:async()=>JSON.stringify(data),json:async()=>data};
  }
 }});try{
  const d=q.w.document;
  const card=d.querySelector('#next-game');
  assert.ok(card.classList.contains('final'),'the final card carries the result state');
  assert.ok(card.classList.contains('bears-won'),'a Bears win floods the thread');
  const homeSide=d.querySelector('#ng-home-abbr').closest('.side');
  const awaySide=d.querySelector('#ng-away-abbr').closest('.side');
  assert.ok(homeSide.classList.contains('is-bears'),'the home Bears carry the identity');
  assert.ok(homeSide.classList.contains('winner'),'the Bears side wins');
  assert.ok(awaySide.classList.contains('loser'),'the opponent recedes');
  const pill=d.querySelector('#ng-pill');
  assert.ok(pill.classList.contains('won'),'the status pill warms');
  assert.match(pill.textContent,/BEARS WIN/,'the pill names the win');
  assert.deepEqual(q.errors,[]);
 }finally{q.close();}
});
test('week clock phases get the glow-up: identity thread, NOW chip, focus parity, first-paint entrance',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/main.css'),'utf8');
 assert.match(css,/\.week-clock-phase::before\s*\{[^}]*background:\s*linear-gradient/s,'the phases carry an identity thread');
 assert.match(css,/\.week-clock-phase\.is-active::before\s*\{[^}]*var\(--orange-hot\)/s,'the thread floods orange on the active phase');
 assert.match(css,/\.week-clock-phase::after\s*\{[^}]*content:\s*"NOW"/s,'the active phase reveals a NOW chip');
 assert.match(css,/\.week-clock-phase:hover,\s*\.week-clock-phase:focus-visible\s*\{[^}]*transform:\s*translateY\(-1px\)/s,'hover lift has :focus-visible keyboard parity');
 assert.match(css,/\.week-clock-phase:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--orange-hot\)/s,'keyboard focus carries a visible ring');
 assert.match(css,/\.week-clock-phase\.is-active \.phase-label\s*\{[^}]*color:\s*var\(--orange-hot\)/s,'the active label warms');
 assert.match(css,/\.week-clock-phase\s*\{[^}]*animation:\s*cfRosterIn/s,'first paint frost-fades the phases in');
 assert.match(css,/\.week-clock-phase:nth-child\(3\)\s*\{\s*--ni:\s*2/s,'the entrance staggers across the strip');
 assert.match(css,/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.week-clock-phase\s*\{\s*animation:\s*none/s,'reduced motion snaps the entrance');
 const p=await page('index');try{
  const d=p.w.document;
  const phases=[...d.querySelectorAll('#week-clock .week-clock-phase')];
  assert.equal(phases.length,4,'the strip paints four phases');
  const active=phases.filter(x=>x.classList.contains('is-active'));
  assert.equal(active.length,1,'exactly one phase is active against the fixture schedule');
  assert.equal(active[0].getAttribute('data-phase'),'media','the fixture kickoff lands in media week');
  assert.equal(active[0].getAttribute('aria-current'),'step','the active phase is exposed as the current step');
  assert.equal(d.querySelector('#week-clock-pill').textContent,'media','the pill names the active phase');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
});
test('player leaders render as leaderboards with the identity thread, glyph chips, and glowing lines',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/experience.css'),'utf8');
 assert.match(css,/\.tbl-wrap\.ld::before\s*\{[^}]*background:\s*linear-gradient\(90deg,\s*var\(--orange-hot\)/s,'the leaders wrapper carries the orange identity thread');
 assert.match(css,/\.ld-line\s*\{[^}]*font-family:\s*var\(--display\)/s,'the line number gets display typography');
 assert.match(css,/\.tbl\.ld tr\.ld-row:hover td[\s\S]{0,160}?background:\s*rgba\(232,\s*84,\s*30,\s*0\.08\)/s,'rows warm on hover');
 assert.match(css,/\.tbl\.ld tr\.ld-row:focus-within td[\s\S]{0,160}?background:\s*rgba\(232,\s*84,\s*30,\s*0\.08\)/s,'keyboard focus warms rows too');
 assert.match(css,/\.tbl\.ld \.ld-leader a:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--orange-hot\)/s,'the leader link gets a visible focus ring');
 assert.match(css,/@keyframes ldRise/,'leaderboard entrance keyframes exist');
 assert.match(css,/\.tbl-wrap\.ld\.cf-enter\s*\{[^}]*animation:\s*ldRise/s,'first paint frost-fades the table in');
 assert.match(css,/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.tbl-wrap\.ld\.cf-enter\s*\{\s*animation:\s*none/s,'reduced motion snaps the entrance');
 assert.match(css,/@media \(max-width: 560px\) \{[\s\S]*?\.ld-line\s*\{\s*font-size:\s*15px/s,'the lines compact on small screens');
 const p=await page('stats');try{
  const d=p.w.document;
  const wrap=d.querySelector('#leaders .tbl-wrap.ld');
  assert.ok(wrap,'the leaders table carries the family wrapper');
  assert.ok(wrap.classList.contains('cf-enter'),'first paint carries the entrance class');
  const rows=[...wrap.querySelectorAll('tr.ld-row')];
  assert.ok(rows.length>=1,'leader rows render');
  const cat=rows[0].querySelector('.ld-cat');
  assert.ok(cat.querySelector('.ld-glyph'),'the category carries a glyph chip');
  assert.equal(cat.querySelector('.ld-glyph').textContent,'🏈','passing maps to the football glyph');
  assert.ok(/Passing/.test(cat.textContent),'the category label survives');
  const line=rows[0].querySelector('.ld-line');
  assert.equal(line.textContent,'250 YDS','the line reads as the headline stat');
  const box=d.querySelector('#lastbox .tbl-wrap.ld');
  assert.ok(box,'the box-score leaders sub-table gets the same treatment');
  assert.ok(box.classList.contains('cf-enter'),'the sub-table also frost-fades on first paint');
  const bcat=box.querySelector('.ld-cat .ld-glyph');
  assert.ok(bcat && /Passing/.test(bcat.parentElement.textContent),'the sub-table keeps category glyphs');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
});
test('division standings glow up: identity thread, Bears chip, leader crown, and streak pills',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/experience.css'),'utf8');
 assert.match(css,/\.tbl-wrap\.stnd::before\s*\{[^}]*background:\s*linear-gradient\(90deg,\s*var\(--orange-hot\)/s,'the standings wrapper carries the orange identity thread');
 assert.match(css,/\.tbl\.stnd tr\.stnd-me td:first-child\s*\{[^}]*box-shadow:\s*inset 3px 0 0 var\(--orange-hot\)/s,'the Bears row carries the orange leading edge');
 assert.match(css,/\.stnd-bear\s*\{[^}]*border:\s*1px solid rgba\(232,\s*84,\s*30,\s*0\.5\)/s,'the bear identity chip is styled');
 assert.match(css,/\.stnd-crown\.hot\s*\{[^}]*box-shadow:\s*0 0 12px rgba\(255,\s*90,\s*31,\s*0\.35\)/s,'the leader crown glows when it is the Bears');
 assert.match(css,/\.tbl\.stnd \.stnd-pct\s*\{[^}]*font-family:\s*var\(--display\)/s,'the Pct column gets display typography');
 assert.match(css,/\.tbl\.stnd tr\.stnd-row:hover td[\s\S]{0,160}?background:\s*rgba\(232,\s*84,\s*30,\s*0\.08\)/s,'rows warm on hover');
 assert.match(css,/\.tbl\.stnd tr\.stnd-row:focus-within td[\s\S]{0,160}?background:\s*rgba\(232,\s*84,\s*30,\s*0\.08\)/s,'keyboard focus warms rows too');
 assert.match(css,/\.stnd-strk\.up\s*\{[^}]*background:\s*rgba\(232,\s*84,\s*30,\s*0\.2\)/s,'win streaks warm orange');
 assert.match(css,/@keyframes stndRise/,'standings entrance keyframes exist');
 assert.match(css,/\.tbl-wrap\.stnd\.cf-enter[\s\S]{0,80}?animation:\s*stndRise/s,'first paint frost-fades the table in');
 assert.match(css,/\.race-bars\.stnd\.cf-enter[\s\S]{0,80}?animation:\s*stndRise/s,'the race bars enter with the table');
 assert.match(css,/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.tbl-wrap\.stnd\.cf-enter[\s\S]*?animation:\s*none/s,'reduced motion snaps the entrance');
 assert.match(css,/@media \(max-width: 560px\) \{[\s\S]*?\.tbl\.stnd \.stnd-pct\s*\{\s*font-size:\s*13\.5px/s,'the Pct compacts on small screens');
 const p=await page('index');try{
  const d=p.w.document;
  const wrap=d.querySelector('#division .tbl-wrap.stnd');
  assert.ok(wrap,'the North standings wrapper carries the family treatment');
  assert.ok(wrap.classList.contains('cf-enter'),'first paint carries the entrance class');
  const rows=[...d.querySelectorAll('#div-table.stnd tr.stnd-row')];
  assert.equal(rows.length,4,'the four North teams render');
  const chi=rows.find(r=>/Chicago Bears/.test(r.textContent));
  assert.ok(chi.classList.contains('stnd-me'),'the Bears row is marked as ours');
  assert.ok(chi.querySelector('.stnd-bear'),'the Bears row carries the bear chip');
  assert.equal(chi.querySelector('.stnd-pct').textContent,'1.000','the Pct reads in display numerals');
  const crown=rows[0].querySelector('.stnd-crown');
  assert.ok(crown && /DIV LEAD/.test(crown.textContent),'the division leader carries the crown');
  assert.ok(rows[0].classList.contains('stnd-me'),'the Bears lead the fixture division');
  assert.ok(crown.classList.contains('hot'),'the crown glows when the Bears lead');
  assert.ok(d.querySelector('#div-race.stnd.cf-enter'),'the race bars enter with the table');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
 const g=await page('games');try{
  const d=g.w.document;
  const wrap=d.querySelector('#div-table-2').closest('.tbl-wrap.stnd');
  assert.ok(wrap,'the Division watch wrapper carries the family treatment');
  assert.ok(wrap.classList.contains('cf-enter'),'first paint carries the entrance class');
  const rows=[...d.querySelectorAll('#div-table-2.stnd tr.stnd-row')];
  assert.equal(rows.length,4,'the four North teams render on games.html');
  const chi=rows.find(r=>/Chicago Bears/.test(r.textContent));
  assert.ok(chi.querySelector('.stnd-bear'),'the Bears row carries the bear chip there too');
  assert.ok(rows[0].querySelector('.stnd-crown'),'the division leader carries the crown there too');
  assert.ok(rows[0].querySelector('.stnd-strk'),'streaks render as pills');
  assert.deepEqual(g.errors,[]);
 }finally{g.close();}
});
test('odds board glow up: identity thread, focus parity, warm best rows, first-paint entrance',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/experience.css'),'utf8');
 assert.match(css,/\.odds-card::before[,\s][\s\S]{0,200}?background:\s*linear-gradient\(90deg,\s*var\(--orange-hot\)/s,'the wire odds card carries the orange identity thread');
 assert.match(css,/\.poly-card:hover::before,\s*\.poly-card:focus-within::before\s*\{\s*opacity:\s*1;\s*\}/s,'the thread ignites on keyboard focus too');
 assert.match(css,/\.odds-card:focus-within\s*\{[\s\S]{0,120}?transform:\s*translateY\(-3px\)/s,'keyboard focus lifts the odds card like hover does');
 assert.match(css,/\.odds-card a:focus-visible,\s*\.poly-card a:focus-visible\s*\{[\s\S]{0,120}?outline:\s*2px solid var\(--orange-hot\)/s,'the details links get a visible focus ring');
 assert.match(css,/\.odds-row:has\(b\.best\)\s*\{[\s\S]{0,120}?background:\s*rgba\(255,\s*90,\s*31,\s*0\.08\)/s,'the row holding the BEST chip warms');
 assert.match(css,/@keyframes oddsRise/,'the odds entrance keyframes exist');
 assert.match(css,/\.odds-card\.cf-enter[\s\S]{0,200}?animation:\s*oddsRise/s,'first paint frost-fades the odds cards in');
 assert.match(css,/\.odds-card\.cf-enter[\s\S]{0,200}?animation-delay:\s*calc\(var\(--ni,\s*0\)\s*\*\s*0\.06s\)/s,'the entrance staggers across cards');
 assert.match(css,/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.odds-card\.cf-enter[\s\S]*?animation:\s*none/s,'reduced motion snaps the odds entrance');
 const p=await page('odds');try{const w=p.w,d=w.document;
  let poly=d.querySelector('#poly-board .poly-card');
  assert.ok(poly,'a Polymarket card renders on first paint');
  assert.ok(poly.classList.contains('cf-enter'),'the first paint carries the entrance class');
  assert.ok(poly.style.getPropertyValue('--ni')!=='' ,'the card carries a stagger index');
  // Mock the league wire like the best-price test, then re-render: the wire
  // cards should enter on this first successful paint too.
  w.CF.API.getSchedule=async()=>({source:'live',data:{season:{displayName:'2026'},events:[event('200','PHI','CHI')]}});
  const payload=[{id:'200',name:'Chicago Bears at Philadelphia Eagles',competitions:[{odds:[
   {provider:{name:'DraftKings'},pointSpread:{home:{close:{line:-3}},away:{close:{line:3}}},overUnder:47.5,moneyline:{home:{close:{odds:-160}},away:{close:{odds:140}}}},
   {provider:{name:'FanDuel'},pointSpread:{home:{close:{line:-2.5}},away:{close:{line:2.5}}},overUnder:48,moneyline:{home:{close:{odds:-150}},away:{close:{odds:130}}}}
  ]}]}];
  w.CF.API.getOdds=async()=>({source:'live',data:payload});
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await settle(500);
  const cards=[...d.querySelectorAll('#odds-board .odds-card')];
  assert.equal(cards.length,2,'both book cards render');
  assert.ok(cards.every(c=>c.classList.contains('cf-enter')),'every wire card enters on first paint');
  assert.ok(cards[0].style.getPropertyValue('--ni')==='0' && cards[1].style.getPropertyValue('--ni')==='1','the stagger index climbs per card');
  assert.ok(d.querySelector('.best-strip.cf-enter'),'the best-price strip enters with the board');
  const warm=d.querySelector('#odds-board .odds-row:has(b.best)');
  assert.ok(warm,'the winning row exists');
  assert.ok(!/NaN|undefined|\[object Object\]/.test(d.querySelector('#odds-board').textContent));
  // One more render simulates the 60-second auto-refresh: it must stay instant.
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await settle(500);
  assert.ok(!d.querySelector('#odds-board .odds-card.cf-enter'),'refresh re-renders stay instant on the wire board');
  assert.ok(!d.querySelector('#poly-board .poly-card.cf-enter'),'refresh re-renders stay instant on the Polymarket board');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
});
test('practice tracker becomes a week-intel table: identity thread, intensity edges, today warmth, first-paint entrance',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/experience.css'),'utf8');
 assert.match(css,/\.tbl-wrap\.trk::before\s*\{[^}]*background:\s*linear-gradient\(90deg,\s*var\(--orange-hot\)/s,'the tracker wrapper carries the orange identity thread');
 assert.match(css,/\.tbl\.trk tr\.trk-lv4 td:first-child\s*\{[^}]*box-shadow:\s*inset 3px 0 0 var\(--orange-hot\)/s,'game-day rows carry the hot orange leading edge');
 assert.match(css,/\.tbl\.trk tr\.trk-lv0 td:first-child\s*\{[^}]*box-shadow:\s*inset 3px 0 0 rgba\(92,\s*122,\s*153/s,'off-day rows carry the ice leading edge');
 assert.match(css,/\.tbl\.trk tr\.trk-row:hover td[\s\S]{0,160}?background:\s*rgba\(232,\s*84,\s*30,\s*0\.08\)/s,'rows warm on hover');
 assert.match(css,/\.tbl\.trk tr\.trk-row:focus-within td[\s\S]{0,160}?background:\s*rgba\(232,\s*84,\s*30,\s*0\.08\)/s,'keyboard focus warms rows too');
 assert.match(css,/\.tbl\.trk tr\.trk-row\.trk-today td\s*\{[^}]*background:\s*rgba\(232,\s*84,\s*30,\s*0\.1\)/s,'the today row is warmed');
 assert.match(css,/@keyframes trkRise/,'the tracker entrance keyframes exist');
 assert.match(css,/\.tbl-wrap\.trk\.cf-enter[\s\S]{0,80}?animation:\s*trkRise/s,'first paint frost-fades the tracker in');
 assert.match(css,/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.tbl-wrap\.trk\.cf-enter[\s\S]*?animation:\s*none/s,'reduced motion snaps the entrance');
 // The fixture clock is a Friday evening in Chicago (2026-09-26T03:00:00Z).
 const pdata={updated:'2026-09-26',rows:[
  {date:'Sat',session:'Travel day',focus:'—',media:'—',notes:'Off'},
  {date:'Sun',session:'Kickoff vs Packers',focus:'Soldier Field',media:'Availability report',notes:''},
  {date:'Fri',session:'Full practice',focus:'Red zone',media:'Presser',notes:''}
 ]};
 const p=await page('practice',{fetch:async(u)=>u.pathname.endsWith('/practice.json')?{ok:true,json:async()=>pdata}:undefined});
 try{const w=p.w,d=w.document;
  const wrap=d.querySelector('#tracker').closest('.tbl-wrap.trk');
  assert.ok(wrap,'the tracker wrapper carries the family treatment');
  assert.ok(wrap.classList.contains('cf-enter'),'first paint carries the entrance class');
  const rows=[...d.querySelectorAll('#tracker tr.trk-row')];
  assert.equal(rows.length,3,'the three sessions render');
  const sat=rows.find(r=>/Travel/.test(r.textContent));
  assert.ok(sat.classList.contains('trk-lv0'),'an off/travel day gets the ice edge');
  const sun=rows.find(r=>/Kickoff/.test(r.textContent));
  assert.ok(sun.classList.contains('trk-lv4'),'game day gets the hot orange edge');
  const fri=rows.find(r=>/Full practice/.test(r.textContent));
  assert.ok(fri.classList.contains('trk-lv3'),'a full session gets the orange edge');
  assert.ok(fri.classList.contains('trk-today'),'the fixture Friday is marked as today');
  assert.ok(/today/.test(fri.textContent),'the today pill reads on the row');
  assert.equal(d.querySelector('#track-pill').textContent,'3 sessions','the pill counts the sessions');
  assert.ok(!/NaN|undefined|\[object Object\]/.test(d.querySelector('#tracker').textContent));
  // One more render simulates the 5-minute auto-refresh: it must stay instant.
  wrap.classList.remove('cf-enter');
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await settle(300);
  const wrap2=d.querySelector('#tracker').closest('.tbl-wrap.trk');
  assert.ok(wrap2,'the wrapper survives the refresh');
  assert.ok(!wrap2.classList.contains('cf-enter'),'refresh re-renders stay instant');
  assert.equal(d.querySelectorAll('#tracker tr.trk-row').length,3,'the rows re-render');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
});

test('wire ticker items get the glow-up: warm hover, ignited source chip, focus ring',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'..','css','experience.css'),'utf8');
 assert.match(css,/\.wt-item:hover,\s*\.wt-item:focus-visible\s*\{[^}]*text-shadow:\s*0 0 14px rgba\(255,\s*122,\s*40/s,'headlines glow warm on hover and keyboard focus');
 assert.match(css,/\.wt-item:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--orange-hot\)/s,'the moving marquee gives keyboard users a visible focus ring');
 assert.match(css,/\.wt-item:hover \.wt-src,\s*\.wt-item:focus-visible \.wt-src/s,'the source chip ignites under attention');
 assert.match(css,/\.wt-item:hover \+ \.wt-sep,\s*\.wt-item:focus-visible \+ \.wt-sep/s,'the snowflake separator sparkles as a headline passes');
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.wt-item,\s*\.wt-src,\s*\.wt-sep\s*\{\s*transition:\s*none/s,'reduced motion snaps the item transitions');
 const p=await page('index');try{const d=p.w.document;
  const items=[...d.querySelectorAll('#wire-ticker-track .wt-item')];
  assert.ok(items.length>0,'ticker items render from the wire fixture');
  const first=items[0];
  assert.ok(first.querySelector('.wt-src'),'each item carries a source chip');
  assert.ok(/^https:\/\//.test(first.getAttribute('href')),'items link out to real stories');
  assert.ok(!/NaN|undefined|\[object Object\]/.test(d.querySelector('#wire-ticker').textContent));
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
});

test('weather strip glow-up: condition-aware sky glyph and the identity thread',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'..','css','main.css'),'utf8');
 assert.match(css,/\.weather-strip::before\s*\{[^}]*background:\s*linear-gradient\(90deg,\s*var\(--orange\)/s,'the strip carries the orange identity thread');
 assert.match(css,/\.wx-icon\s*\{/s,'the condition glyph has its own class');
 const p=await page('index');try{const w=p.w,d=w.document;
  const icon=d.querySelector('#wx-icon');
  assert.ok(icon,'the brand carries a condition icon slot');
  assert.equal(icon.textContent,'☀️','the fixture clear sky renders a sun glyph');
  assert.ok(!/⛈/.test(d.querySelector('.wx-brand').textContent),'the hard-coded storm glyph is gone');
  assert.equal(w.CF.wxIcon({code:3}),'☁️','overcast maps to clouds');
  assert.equal(w.CF.wxIcon({code:71}),'❄️','light snow maps to snow');
  assert.equal(w.CF.wxIcon({code:95}),'🌩️','thunder maps to a storm');
  assert.equal(w.CF.wxIcon({code:null,phrase:'Snow Likely'}),'❄️','the NWS fallback reads snow from the phrase');
  assert.equal(w.CF.wxIcon({code:null,phrase:'Chance Showers And Thunderstorms'}),'🌩️','thunder wins over showers in the fallback phrase');
  assert.equal(w.CF.wxIcon({code:null,phrase:'Mostly Sunny'}),'☀️','the fallback reads sunny');
  assert.ok(!/NaN|undefined|\[object Object\]/.test(d.querySelector('[data-cf-weather]').textContent));
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
});

test('roster cards degrade gracefully when the feed omits a jersey number',async()=>{
 // Practice-squad call-ups and specialists sometimes arrive without a jersey
 // in the ESPN feed — the card must never show a dangling "#—".
 const noNumber={athletes:[{position:'specialTeam',items:[{id:'9',displayName:'Test Long Snapper',position:{abbreviation:'LS'}}]}]};
 const p=await page('team',{fetch:async(u)=>{
   if(u.pathname.includes('/roster'))return{ok:true,text:async()=>JSON.stringify(noNumber),json:async()=>noNumber};
 }});try{const d=p.w.document;
  const card=d.querySelector('.player-card');assert.ok(card,'the jersey-less player still renders a card');
  const st=card.querySelector('.st').textContent;
  assert.doesNotMatch(st,/#—/,'no dangling number dash');
  assert.equal(st,'LS','the line falls back to the position alone');
  assert.equal(card.querySelectorAll('.player-number').length,0,'no number slot when there is no jersey');
  const emblem=card.querySelector('.player-emblem');
  assert.ok(emblem,'the portrait carries the paw emblem instead of fallback text');
  assert.ok(emblem.getAttribute('src').includes('img/paw-mark.svg'),'the emblem is the brand paw mark');
  assert.equal(emblem.getAttribute('aria-hidden'),'true','the decorative emblem stays out of the a11y tree');
  assert.ok(!/NaN|undefined|\[object Object\]/.test(card.textContent));
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
});

test('donation cards get the family treatment: identity thread, keyboard copy, entrance',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'..','css','main.css'),'utf8');
 assert.match(css,/\.don-card::before\s*\{[^}]*background:\s*linear-gradient\(90deg,\s*var\(--orange-hot\)/s,'the cards carry the orange identity thread');
 assert.match(css,/\.don-card:hover,\s*\.don-card:focus-within\s*\{[^}]*transform:\s*translateY\(-3px\)/s,'hover lift has focus-within parity');
 assert.match(css,/\.don-card:hover \.lbl,\s*\.don-card:focus-within \.lbl/s,'the label warms under attention');
 assert.match(css,/\.don-card \.addr:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--orange-hot\)/s,'the copy strip gets a visible focus ring');
 assert.match(css,/\.don-card\.cf-enter\s*\{[^}]*animation:\s*cfRosterIn/s,'the cards enter with the staggered frost-fade');
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.don-card\.cf-enter\s*\{\s*animation:\s*none/s,'reduced motion snaps the entrance');
 const p=await page('about');try{const d=p.w.document;
  const cards=[...d.querySelectorAll('#don-grid .don-card')];
  assert.equal(cards.length,3,'all three donation cards render');
  cards.forEach((c,i)=>{
   assert.ok(c.classList.contains('cf-enter'),'card '+i+' enters staggered');
   assert.equal(c.style.getPropertyValue('--ni'),String(i),'card '+i+' carries its stagger index');
   const addr=c.querySelector('.addr');
   assert.equal(addr.getAttribute('tabindex'),'0','the copy strip is keyboard-focusable');
   assert.equal(addr.getAttribute('role'),'button','the copy strip is exposed as a button');
   assert.ok(addr.getAttribute('aria-label'),'the copy strip names its action');
  });
  const text=d.querySelector('#don-grid').textContent;
  assert.ok(text.includes('3GnR7TWBXAB3pPztBWpNF4LMNEX5yX8vZK'),'the BTC tip address is intact');
  assert.ok(!text.includes('prl1p62v09vuzyd8kdz9l23jaf3kph4wwx6jqcmhkkhg8lhr2qlxky8psu3zw9d'),'the PRL donation address is gone per Kyle');
  assert.ok(!/NaN|undefined|\[object Object\]/.test(text));
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
});

test('polymarket line-movement chips: pure helper and first-paint silence',async()=>{
 const p=await page('odds');try{const CF=p.w.CF;
  const up=CF.polyMoveChip(0.60,0.63);
  assert.match(up,/class="mv up"/,'an upward move earns the up chip');
  assert.ok(up.includes('▲3¢'),'the up chip shows the cent delta');
  assert.match(up,/aria-label="up 3 cents since your last check"/,'the chip announces itself to screen readers');
  const down=CF.polyMoveChip(0.63,0.60);
  assert.match(down,/class="mv down"/,'a downward move earns the down chip');
  assert.ok(down.includes('▼3¢'),'the down chip shows the cent delta');
  const one=CF.polyMoveChip(0.60,0.61);
  assert.match(one,/class="mv up"/,'a single-cent move still chips');
  assert.equal(CF.polyMoveChip(0.60,0.604),'','sub-cent jitter stays silent');
  assert.equal(CF.polyMoveChip(0.60,0.60),'','an unchanged price stays silent');
  assert.equal(CF.polyMoveChip(null,0.60),'','the first render (no previous price) stays silent');
  assert.equal(CF.polyMoveChip(undefined,null),'','missing prices stay silent');
  const d=p.w.document;
  assert.equal(d.querySelectorAll('#poly-board .mv').length,0,'first paint shows no movement chips');
  assert.ok(d.querySelector('.mv.up'),'the legend shows the up glyph');
  assert.ok(!/NaN|undefined|\[object Object\]/.test(d.querySelector('#poly-board').textContent));
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
});

test('city-tile glow-up: identity thread, keyboard parity, focus ring, reduced motion',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/main.css'),'utf8');
 assert.match(css,/\.city-tile::before\s*\{[^}]*linear-gradient\(90deg,\s*var\(--orange-hot\)/s,'the tile carries the orange identity thread across its top');
 assert.match(css,/\.city-tile:hover::before,\s*\.city-tile:focus-within::before\s*\{\s*opacity:\s*1/s,'the thread ignites on hover and keyboard focus');
 assert.match(css,/\.city-tile:focus-within \.city-tile-bg,\s*\.city-tile:focus-visible \.city-tile-bg\s*\{[^}]*transform:\s*scale\(1\.06\)/s,'keyboard focus gets the same background zoom as hover');
 assert.match(css,/\.city-tile:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--orange-hot\)/s,'the tile shows a visible focus ring');
 assert.match(css,/\.city-tile:hover \.city-tile-label strong,\s*\.city-tile:focus-within \.city-tile-label strong\s*\{\s*color:\s*var\(--orange-hot\)/s,'the call to action warms under attention');
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.city-tile,/s,'reduced motion snaps the tile transitions');
 for(const [f,v] of [['index.html','1.97.0'],['about.html','1.97.0']]){
  const html=fs.readFileSync(path.join(__dirname,'..',f),'utf8');
  assert.ok(html.includes('css/main.css?v='+v),f+' busts the stylesheet cache at v'+v);
 }
});

test('ad slots stay invisible until a publisher ID is set, then fill correctly',async()=>{
 // No publisher ID -> slots removed entirely, page stays clean.
 for(const [name,slot] of [['index','homeLeaderboard'],['news','newsRail'],['odds','oddsInline']]){
  const p=await page(name);try{const w=p.w;
   w.CF.CONFIG.ads.client='';w.CF.initAds();
   assert.equal(w.document.querySelectorAll('[data-ad-slot]').length,0,name+' removes its ad slot when no publisher ID is set');
  }finally{p.close();}
 }
 // Config default now carries the live publisher ID (Auto ads serve site-wide).
 const commonSrc=fs.readFileSync(path.join(__dirname,'../js/common.js'),'utf8');
 assert.ok(commonSrc.includes('client: "ca-pub-3316742664595468"'),'default ads client is the live publisher ID');
 // Live path: with a publisher ID + ad-unit ID the slot fills with an <ins>.
 const p=await page('index');try{const w=p.w;
  const host=w.document.createElement('div');
  host.className='ad-slot';host.setAttribute('data-ad-slot','homeLeaderboard');
  w.document.body.appendChild(host);
  w.CF.CONFIG.ads.client='ca-pub-1234567890123456';
  w.CF.CONFIG.ads.slots.homeLeaderboard='9876543210';
  w.CF.initAds();
  const ins=host.querySelector('ins.adsbygoogle');
  assert.ok(ins,'slot fills with an adsbygoogle <ins>');
  assert.equal(ins.getAttribute('data-ad-client'),'ca-pub-1234567890123456');
  assert.equal(ins.getAttribute('data-ad-slot'),'9876543210');
  assert.equal(ins.getAttribute('data-ad-format'),'auto');
  assert.equal(host.getAttribute('aria-label'),'Advertisement');
  assert.ok(w.document.querySelector('script[src*="pagead2.googlesyndication.com"]'),'AdSense library loads once');
  // Placement without an ad-unit ID stays empty.
  w.CF.CONFIG.ads.slots.newsRail='';
  const host2=w.document.createElement('div');
  host2.setAttribute('data-ad-slot','newsRail');
  w.document.body.appendChild(host2);
  w.CF.initAds();
  assert.equal(w.document.querySelectorAll('[data-ad-slot="newsRail"]').length,0,'slot without an ad-unit ID is removed');
 }finally{p.close();}
 // ads.txt exists for AdSense verification; about.html carries the privacy note.
 assert.ok(fs.existsSync(path.join(__dirname,'../ads.txt')),'ads.txt exists at the site root');
 const about=fs.readFileSync(path.join(__dirname,'../about.html'),'utf8');
 assert.ok(about.includes('id="privacy"'),'about page has the privacy section');
});

test('referral slots stay hidden until your links are set, then render sponsored CTAs',async()=>{
 // No links configured -> slots removed entirely.
 {
  const p=await page('odds');try{const w=p.w;
   w.CF.CONFIG.referrals.polymarket='';w.CF.CONFIG.referrals.kalshi='';w.CF.initReferrals();
   assert.equal(w.document.querySelectorAll('[data-ref-slot]').length,0,'ref slots removed when no referral links are set');
  }finally{p.close();}
 }
 // With links set (live defaults) -> the page's own slots render as sponsored cards.
 {
  const p=await page('odds');try{const w=p.w;
   const cards=w.document.querySelectorAll('.ref-card');
   assert.equal(cards.length,2,'both referral cards render');
   const links=[...w.document.querySelectorAll('.ref-card a.ref-link')];
   assert.equal(links[0].getAttribute('href'),w.CF.CONFIG.referrals.polymarket);
   assert.equal(links[0].target,'_blank');
   assert.ok(links[0].rel.includes('sponsored')&&links[0].rel.includes('nofollow'),'outbound referral link is marked sponsored+nofollow');
   assert.ok(links[0].textContent.includes('18+'),'referral CTA carries the 18+ note');
   assert.ok(w.document.querySelector('.ref-card').getAttribute('aria-label').includes('Sponsored'),'card is labelled as sponsored for screen readers');
  }finally{p.close();}
 }
 // CSS carries the family treatment: identity thread ignites on hover/focus.
 const css=fs.readFileSync(path.join(__dirname,'../css/main.css'),'utf8');
 assert.match(css,/\.ref-card:hover::before,\s*\.ref-card:focus-within::before\s*\{[^}]*linear-gradient\(180deg,\s*var\(--orange-hot\)/s,'ref card identity thread ignites on hover and keyboard focus');
 assert.match(css,/\.ref-link:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--orange-hot\)/s,'ref link has a visible keyboard focus ring');
 assert.match(css,/prefers-reduced-motion:\s*reduce[\s\S]*?\.ref-card[\s\S]*?transition:\s*none/s,'reduced motion snaps ref card transitions');
});

test('whiteout 404 page carries the family treatment: identity thread, frost numeral, reduced motion',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/main.css'),'utf8');
 assert.match(css,/\.whiteout-card::before\s*\{[^}]*linear-gradient\(90deg,\s*var\(--orange-hot\)/s,'the whiteout card carries the orange identity thread across its top');
 assert.match(css,/\.whiteout-card:hover::before,\s*\.whiteout-card:focus-within::before\s*\{\s*opacity:\s*1/s,'the thread ignites on hover and keyboard focus');
 assert.match(css,/\.whiteout-num\s*\{[^}]*background:\s*linear-gradient\(180deg,[^}]*background-clip:\s*text/s,'the 404 numeral renders in frost-gradient display type');
 assert.match(css,/\.whiteout-actions \.btn:hover\s*\{[^}]*transform:\s*translateY\(-2px\)/s,'action buttons lift and warm under attention');
 assert.match(css,/\.whiteout-card\s*\{[^}]*animation:\s*cfSnapIn/s,'the card enters with a frost-fade on first paint');
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.whiteout-card,\s*\.whiteout-snow span\s*\{\s*animation:\s*none/s,'reduced motion snaps the whiteout animations');
 const html=fs.readFileSync(path.join(__dirname,'..','404.html'),'utf8');
 assert.ok(html.includes('css/main.css?v=1.97.0'),'404.html busts the stylesheet cache');
 assert.ok(html.includes('class="whiteout-card"'),'the 404 page uses the whiteout card markup');
 assert.ok(!html.includes('font-size:64px'),'inline snowflake styling is gone');
 assert.ok(html.includes('data-cf-copy="btc"'),'footer tip chip is intact');
});

test('playbook quick-cards get keyboard parity and a staggered entrance',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/main.css'),'utf8');
 assert.match(css,/\.quick a:hover::before,\s*\.quick a:focus-within::before\s*\{\s*opacity:\s*1/s,'the thread ignites on hover and keyboard focus');
 assert.match(css,/\.quick a:hover,\s*\.quick a:focus-within\s*\{\s*border-color:\s*var\(--glass-border-hot\)/s,'keyboard focus gets the same lift and warmth as hover');
 assert.match(css,/\.quick a:hover \.ico,\s*\.quick a:focus-within \.ico\s*\{\s*transform:\s*translateY\(-2px\)/s,'the icon warms under keyboard attention too');
 assert.match(css,/\.quick a:focus-visible\s*\{\s*outline:\s*2px solid var\(--orange-hot\)/s,'the card shows a visible family focus ring');
 assert.match(css,/\.grid\.quick a\s*\{[^}]*animation:\s*cfSnapIn[^}]*backwards/s,'the cards enter with a frost-fade on first paint');
 assert.match(css,/\.grid\.quick a:nth-child\(9\)\s*\{\s*--qi:\s*8;\s*\}/s,'the stagger covers all nine playbook cards');
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.quick a,\s*\.quick a::before,\s*\.quick a \.ico\s*\{\s*transition:\s*none/s,'reduced motion snaps the quick-card transitions');
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.ok(html.includes('css/main.css?v=1.97.0'),'index.html busts the stylesheet cache');
 assert.ok(html.includes('data-cf-copy="btc"'),'footer tip chip is intact');
});

test('v1.58.0: the "Make your call" pick-card gets the family treatment',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/experience.css'),'utf8');
 assert.match(css,/\.prediction::before/,'the pick card carries the orange identity thread');
 assert.match(css,/\.prediction:focus-within::before\s*\{\s*opacity:\s*1/s,'the thread ignites when the card holds keyboard focus');
 assert.match(css,/\.predict-bears::before/,'the Bears well carries an orange leading edge');
 assert.match(css,/\.predict-opp::before/,'the opponent well carries an ice leading edge');
 assert.match(css,/\.predict-well input\s*\{[^}]*font-family:\s*var\(--display\)/s,'score inputs use display typography');
 assert.match(css,/\.predict-well input:focus-visible\s*\{\s*outline:\s*2px solid var\(--orange-hot\)/s,'score inputs show the family focus ring');
 assert.match(css,/#prediction-toggle\[aria-expanded="true"\] \.toggle-mark\s*\{\s*transform:\s*rotate\(45deg\)/s,'the toggle morphs ＋ into ✕');
 assert.match(css,/\.prediction-diff\.is-bears\s*\{[^}]*box-shadow/s,'the Bears differential glows');
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)[\s\S]*#prediction-toggle \.toggle-mark[\s\S]*transition:\s*none/,'reduced motion snaps the pick-card transitions');
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.ok(html.includes('css/experience.css?v=1.105.0'),'index.html busts the experience.css cache');
 assert.ok(html.includes('js/home.js?v=1.99.0'),'index.html busts the home.js cache');
 assert.ok(html.includes('id="prediction-diff"'),'the live differential chip exists');
 assert.ok(html.includes('class="toggle-mark"'),'the toggle carries the morph mark');
 assert.ok(html.includes('id="prediction-opponent-abbr"'),'the opponent well names the matchup');
 assert.ok(html.includes('data-cf-copy="btc"'),'footer tip chip is intact');
});

test('v1.58.0: the prediction differential answers every keystroke',async()=>{
 const p=await page('index');try{const d=p.w.document;
  d.querySelector('#prediction-toggle').click();
  const diff=d.querySelector('#prediction-diff');
  assert.equal(d.querySelector('#prediction-opponent-name').textContent,'PHI');
  assert.equal(d.querySelector('#prediction-opponent-abbr').textContent,'PHI');
  assert.equal(diff.textContent,'BEARS BY 7');
  assert.ok(diff.classList.contains('is-bears'));
  d.querySelector('#prediction-bears').value=10;
  d.querySelector('#prediction-bears').dispatchEvent(new p.w.Event('input',{bubbles:true}));
  assert.equal(diff.textContent,'PHI BY 7');
  assert.ok(diff.classList.contains('is-opp'));
  d.querySelector('#prediction-other').value=10;
  d.querySelector('#prediction-other').dispatchEvent(new p.w.Event('input',{bubbles:true}));
  assert.equal(diff.textContent,'DEAD EVEN');
  assert.ok(diff.classList.contains('is-tie'));
  d.querySelector('#prediction-bears').value='';
  d.querySelector('#prediction-bears').dispatchEvent(new p.w.Event('input',{bubbles:true}));
  assert.equal(diff.textContent,'');
 }finally{p.close();}
});

test('v1.59.0: social tiles join the family — identity thread, icon warm-up, focus ring',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/experience.css'),'utf8');
 assert.match(css,/\.social-grid a::before/,'the tile carries the orange identity thread');
 assert.match(css,/\.social-grid a:hover::before,\s*\.social-grid a:focus-visible::before\s*\{\s*opacity:\s*1/s,'the thread ignites on hover and keyboard focus');
 assert.match(css,/\.social-grid a:hover \.ico,\s*\.social-grid a:focus-visible \.ico\s*\{[^}]*color:\s*var\(--orange-hot\)/s,'the icon warms under attention');
 assert.match(css,/\.social-grid a:focus-visible\s*\{\s*outline:\s*2px solid var\(--orange-hot\)/s,'the tile shows a visible family focus ring');
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.social-grid a::before[\s\S]*transition:\s*none/,'reduced motion snaps the social-tile transitions');
 const index=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.ok(index.includes('css/experience.css?v=1.105.0'),'index.html busts the experience.css cache');
 assert.ok(index.includes('data-cf-copy="btc"'),'footer tip chip is intact');
 const practice=fs.readFileSync(path.join(__dirname,'..','practice.html'),'utf8');
 assert.ok(practice.includes('css/experience.css?v=1.105.0'),'practice.html busts the experience.css cache');
 assert.ok(practice.includes('data-cf-copy="btc"'),'footer tip chip is intact on practice.html');
});

test('v1.59.0: social grids render safe external links on index and practice',async()=>{
 for(const name of ['index','practice']){ const p=await page(name); try{
  const d=p.w.document;
  const sel=name==='index'?'#home-socials':'#practice-socials';
  const links=[...d.querySelectorAll(sel+' a')];
  assert.ok(links.length>0,sel+' renders tiles');
  for(const a of links){
   assert.ok(a.href.startsWith('https://'),'tile points off-site safely');
   assert.equal(a.getAttribute('target'),'_blank');
   assert.ok((a.getAttribute('rel')||'').includes('noopener'),'tile carries rel=noopener');
   assert.ok(a.querySelector('.ico'),'tile carries its icon');
  }
  assert.ok(!/NaN|undefined|\[object Object\]/.test(d.querySelector(sel).textContent));
 }finally{p.close();}}
});

test('v1.60.0: odds-board cards join the family — identity thread, keyboard parity, focus ring',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/main.css'),'utf8');
 assert.match(css,/\.odds-card::before,\s*\.poly-card::before\s*\{[^}]*linear-gradient\(90deg,\s*var\(--orange-hot\)/s,'the cards carry the orange identity thread across the top');
 assert.match(css,/\.odds-card::before,\s*\.poly-card::before\s*\{[^}]*opacity:\s*0\.35/s,'the thread sits dim at rest');
 assert.match(css,/\.odds-card:hover::before,\s*\.odds-card:focus-within::before,\s*\.poly-card:hover::before,\s*\.poly-card:focus-within::before\s*\{\s*opacity:\s*1/s,'the thread ignites on hover and keyboard focus');
 assert.match(css,/\.odds-card:focus-within,\s*\.poly-card:focus-within\s*\{\s*outline:\s*2px solid var\(--orange-hot\)/s,'the card shows the family focus ring while it holds focus');
 assert.match(css,/\.odds-card:hover \.book,\s*\.odds-card:focus-within \.book\s*\{[^}]*text-shadow:/s,'the book label warms under attention');
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.odds-card::before,\s*\.poly-card::before,\s*\.poly-price\s*\{\s*transition:\s*none/,'reduced motion snaps the odds-card transitions');
 const odds=fs.readFileSync(path.join(__dirname,'..','odds.html'),'utf8');
 assert.ok(odds.includes('css/main.css?v=1.97.0'),'odds.html busts the stylesheet cache');
 assert.ok(odds.includes('data-cf-copy="btc"'),'footer tip chip is intact');
});

test('v1.60.1: CF.fmt rounds stray float volumes instead of printing them raw',async()=>{
 const p=await page('odds'); try{
  const fmt=p.w.CF.fmt;
  assert.equal(fmt(268.18067599999995),'268.2','Polymarket float volume rounds to one decimal');
  assert.equal(fmt(42),'42','integers stay exact');
  assert.equal(fmt(1500),'1.5K','thousands keep the K form');
  assert.equal(fmt(2500000),'2.5M','millions keep the M form');
  assert.equal(fmt(null),'—','null stays an em dash');
 }finally{p.close();}
});

test('v1.60.1: RSS titles decode double-escaped entities before render',async()=>{
 const p=await page('news'); try{
  const xml='<rss><channel><item><title>Patrick Beverley on the season: &amp;quot;What is going on, man?&amp;quot;</title><link>https://example.com/story</link><pubDate>Sun, 27 Sep 2026 12:00:00 GMT</pubDate></item></channel></rss>';
  const items=p.w.CF.API.parseRss(xml);
  assert.equal(items.length,1,'one item parses');
  assert.equal(items[0].title,'Patrick Beverley on the season: "What is going on, man?"','double-escaped quotes decode to real quotes');
  // The render path then escapes once, so the card shows quotes, not entities.
  const html=p.w.CF.esc(items[0].title);
  assert.ok(!html.includes('&amp;quot;'),'rendered HTML carries no double-escaped entity');
  assert.ok(html.includes('&quot;'),'quotes are safely escaped exactly once');
 }finally{p.close();}
});

test('v1.72.0: RSS titles decode stack-escaped entities to a fixpoint',async()=>{
 const p=await page('news'); try{
  // Three stacking levels: &amp;amp;quot; in the XML. One decode pass left
  // "&quot;" in the string, which the render path re-escaped — headlines
  // printed the literal text "&quot;" on the Wide Wire (seen live).
  const xml='<rss><channel><item><title>Patrick Beverley on the season: &amp;amp;quot;What is going on, man?&amp;amp;quot;</title><link>https://example.com/story</link><pubDate>Sun, 27 Sep 2026 12:00:00 GMT</pubDate><description>He said &amp;quot;no comment&amp;quot; after the game</description><source url="https://example.com">Chi &amp;amp;amp; Times</source></item></channel></rss>';
  const items=p.w.CF.API.parseRss(xml);
  assert.equal(items.length,1,'one item parses');
  assert.equal(items[0].title,'Patrick Beverley on the season: "What is going on, man?"','triple-escaped quotes decode to real quotes');
  assert.equal(items[0].desc,'He said "no comment" after the game','descriptions decode stacked entities too');
  assert.equal(items[0].source,'Chi & Times','source decodes stacked entities too');
  const html=p.w.CF.esc(items[0].title);
  assert.ok(!html.includes('&amp;quot;'),'rendered HTML carries no stacked entity');
  assert.ok(html.includes('&quot;'),'quotes are safely escaped exactly once');
 }finally{p.close();}
});

test('v1.61.0: crowd probability bars use the single-fill convention with a 50/50 tick',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/experience.css'),'utf8');
 assert.match(css,/\.poly-bar::after\s*\{[^}]*left:\s*50%/s,'the bar carries a 50/50 reference tick');
 assert.ok(!/\.poly-bar\s+\.no\b/.test(css),'the old two-segment no-side rule is gone');
 const p=await page('odds'); try{
  // The harness mocks gamma-api.polymarket.com with a 60/40 Bears market.
  p.w.document.dispatchEvent(new p.w.Event('DOMContentLoaded')); await settle(500);
  const bar=p.w.document.querySelector('#poly-board .poly-card .poly-bar');
  assert.ok(bar,'the probability bar renders on the crowd board');
  const segs=[...bar.querySelectorAll('i')];
  assert.equal(segs.length,1,'exactly one fill segment, not a yes/no strip');
  assert.ok(segs[0].classList.contains('fill'),'the segment is the fill');
  assert.equal(segs[0].style.width,'60%','the fill runs to the yes price');
  assert.equal(bar.getAttribute('aria-label'),'Implied probability: 60% yes, 40% no','the bar still announces both sides');
  const odds=fs.readFileSync(path.join(__dirname,'..','odds.html'),'utf8');
  assert.ok(odds.includes('tick = the 50/50 line'),'the legend names the tick');
  assert.ok(!odds.includes('bar = crowd is'),'the old two-bar legend copy is gone');
  assert.ok(odds.includes('css/experience.css?v=1.105.0'),'odds.html busts the stylesheet cache');
  assert.ok(odds.includes('js/odds.js?v=1.95.0'),'odds.html busts the odds script cache');
  assert.ok(odds.includes('data-cf-copy="btc"'),'footer tip chip is intact');
 }finally{p.close();}
});

test('v1.62.0: hero next-game card paints a frost skeleton before the schedule answers',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/experience.css'),'utf8');
 assert.match(css,/\.match-card \.skel-match\s*\{[^}]*min-height:\s*49px/s,'the abbr skeleton matches the display-type height');
 assert.match(css,/\.match-card \.countdown \.skel-unit\s*\{[^}]*flex:\s*1/s,'the countdown skeletons fill the unit row evenly');
 const p=await page('index'); try{
  const d=p.w.document;
  // The mocked schedule answers, so the skeleton status must be gone and real content painted.
  assert.equal(d.querySelector('#ng-skel-status'),null,'the skeleton status is removed on first paint');
  assert.ok(!/Finding the next kickoff/.test(d.querySelector('#ng-title').textContent),'the placeholder title is gone');
  assert.equal(d.querySelector('#ng-away-abbr').textContent,'CHI','the away abbr paints real data');
  assert.equal(d.querySelector('#ng-home-abbr').textContent,'PHI','the home abbr paints real data');
  assert.ok(!d.querySelector('#ng-pill').classList.contains('is-loading'),'the status pill stops shimmering once painted');
  assert.ok(!/NaN|undefined|\[object Object\]/.test(d.querySelector('#next-game').textContent));
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert.ok(html.includes('id="ng-skel-status"'),'the skeleton status announces the load in markup');
  assert.ok(html.includes('class="pill is-loading" id="ng-pill"'),'the status pill shimmers while connecting');
  assert.ok(html.includes('aria-hidden="true"'),"skeletons stay out of the accessibility tree");
  assert.ok(html.includes('css/experience.css?v=1.105.0'),'index.html busts the experience.css cache');
  assert.ok(html.includes('js/home.js?v=1.99.0'),'index.html busts the home.js cache');
  assert.ok(html.includes('data-cf-copy="btc"'),'footer tip chip is intact');
 }finally{p.close();}
});

test('v1.63.0: last-meeting stats stay honest when the season log has no meeting',async()=>{
 // Fixture: next kickoff is @ PHI, and the season log holds no completed
 // Bears-Eagles meeting, so both surfaces must say "Not met yet" scoped to
 // the season log — never the all-time-looking "No prior".
 const gp=await page('games');try{
  const d=gp.w.document;
  const preview=d.querySelector('#next-opp-preview');
  assert.ok(preview && !preview.hidden,'the games matchup preview paints');
  const stat=[...preview.querySelectorAll('.matchup-stat')].find(s=>s.querySelector('.k') && s.querySelector('.k').textContent==='Last meeting');
  assert.ok(stat,'the last-meeting stat exists on games.html');
  assert.equal(stat.querySelector('.v').textContent,'Not met yet','no false all-time claim on the value');
  assert.match(stat.querySelector('.s').textContent,/no completed meeting vs PHI in the season log/i,'the sub scopes the claim to the season log');
  assert.ok(!/No prior/.test(preview.textContent),'the misleading copy is gone from the preview');
  assert.deepEqual(gp.errors,[]);
 }finally{gp.close();}
 const hp=await page('index');try{
  const d=hp.w.document;
  const desk=d.querySelector('#sunday-desk');
  assert.ok(desk,'the homepage sunday desk paints');
  const stat=[...desk.querySelectorAll('.matchup-stat')].find(s=>s.querySelector('.k') && s.querySelector('.k').textContent==='Last meeting');
  assert.ok(stat,'the last-meeting stat exists on index.html');
  assert.equal(stat.querySelector('.v').textContent,'Not met yet','no false all-time claim on the value');
  assert.match(stat.querySelector('.s').textContent,/no meeting in the season log/i,'the sub scopes the claim to the season log');
  assert.ok(!/No prior/.test(desk.textContent),'the misleading copy is gone from the desk');
  assert.deepEqual(hp.errors,[]);
 }finally{hp.close();}
 const ih=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 const gh=fs.readFileSync(path.join(__dirname,'..','games.html'),'utf8');
 assert.ok(ih.includes('js/home.js?v=1.99.0'),'index.html busts the home.js cache');
 assert.ok(gh.includes('js/games.js?v=1.102.0'),'games.html busts the games.js cache');
 assert.ok(ih.includes('data-cf-copy="btc"'),'footer tip chip is intact');
});
test('last-game box score leaders split into team blocks, Bears first, with accessible dividers',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/experience.css'),'utf8');
 assert.match(css,/\.tbl\.ld tr\.ld-div th\s*\{[^}]*border-top:\s*1px solid var\(--glass-border\)/s,'the team divider is a real styled row');
 assert.match(css,/tr\.ld-div\.me th\s*\{[^}]*box-shadow:\s*inset 3px 0 0 var\(--orange\)/s,'the Bears divider carries the orange leading edge');
 assert.match(css,/tr\.ld-div\.me \.ld-div-abbr\s*\{[^}]*color:\s*var\(--orange-hot\)/s,'the Bears abbr chip glows orange');
 assert.match(css,/\.ld-div-abbr\s*\{[^}]*color:\s*var\(--ice\)/s,'the opponent abbr chip reads cool ice');
 // Two-team wire: leaders arrive value-sorted, so both teams' "Passing Yards"
 // rows can sit next to each other with no grouping. The table must regroup
 // them with the Bears block first.
 const summaryBody={
  header:{
   id:'100',name:'Minnesota Vikings at Chicago Bears',date:'2026-09-20T17:00:00Z',
   status:{type:{state:'post',completed:true,shortDetail:'Final'}},
   competitions:[{status:{type:{state:'post',completed:true,shortDetail:'Final'}},venue:{fullName:'Soldier Field'},competitors:[
    {homeAway:'home',team:{id:'3',abbreviation:'CHI',displayName:'Chicago Bears'},score:{value:24,displayValue:'24'}},
    {homeAway:'away',team:{id:'9',abbreviation:'MIN',displayName:'Minnesota Vikings'},score:{value:17,displayValue:'17'}}]}]},
  leaders:[
   {team:{id:'9',abbreviation:'MIN',displayName:'Minnesota Vikings'},leaders:[
    {name:'passingYards',displayName:'Passing Yards',leaders:[{athlete:{displayName:'Carson Wentz',position:{abbreviation:'QB'}},value:210,displayValue:'210 YDS',team:{id:'9'}}]}]},
   {team:{id:'3',abbreviation:'CHI',displayName:'Chicago Bears'},leaders:[
    {name:'passingYards',displayName:'Passing Yards',leaders:[{athlete:{displayName:'Caleb Williams',position:{abbreviation:'QB'}},value:195,displayValue:'195 YDS',team:{id:'3'}}]},
    {name:'rushingYards',displayName:'Rushing Yards',leaders:[{athlete:{displayName:"D'Andre Swift",position:{abbreviation:'RB'}},value:78,displayValue:'78 YDS',team:{id:'3'}}]}]}]};
 const p=await page('stats',{fetch:async(u)=>{
  if(u.pathname.includes('/summary')) return {ok:true,text:async()=>JSON.stringify(summaryBody),json:async()=>summaryBody};
 }});try{
  const d=p.w.document;
  const table=d.querySelector('#lastbox .tbl.ld');
  assert.ok(table,'the box-score leaders table renders');
  const divs=[...table.querySelectorAll('tr.ld-div')];
  assert.equal(divs.length,2,'two teams get two dividers');
  const [chi,min]=divs;
  assert.ok(chi.classList.contains('me'),'the first divider is the Bears block');
  assert.match(chi.textContent,/Chicago Bears/,'the Bears divider names the team');
  assert.match(chi.textContent,/🐻/,'the Bears divider carries the identity mark');
  assert.equal(chi.querySelector('th').getAttribute('colspan'),'3','the divider spans all columns');
  assert.equal(chi.querySelector('th').getAttribute('scope'),'rowgroup','the divider announces the team block to screen readers');
  assert.match(min.textContent,/Minnesota Vikings/,'the opponent divider names the team');
  assert.ok(!min.classList.contains('me'),'the opponent divider stays cool');
  const bodies=[...table.querySelectorAll('tbody')];
  assert.equal(bodies.length,2,'each team block is its own tbody');
  const chiRows=[...bodies[0].querySelectorAll('tr.ld-row')];
  assert.equal(chiRows.length,2,'both Bears leaders sit in the Bears block');
  assert.match(chiRows[0].textContent,/Caleb Williams/,'the Bears passing leader leads the block');
  assert.match(bodies[1].textContent,/Carson Wentz/,'the Vikings leader sits in the Vikings block');
  assert.equal(table.querySelector('caption').textContent,'Last game leaders by team','the caption matches the new grouping');
  assert.ok(!/Passing Yards[\s\S]{0,200}Passing Yards/.test(bodies[0].textContent),'no repeated category inside one team block');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
 // Single-team wire keeps the old flat render: no divider for one block.
 const q=await page('stats');try{
  const d=q.w.document;
  const table=d.querySelector('#lastbox .tbl.ld');
  assert.ok(table,'the default fixture still renders the leaders table');
  assert.equal(table.querySelectorAll('tr.ld-div').length,0,'a lone team renders with no divider');
  assert.deepEqual(q.errors,[]);
 }finally{q.close();}
 const sh=fs.readFileSync(path.join(__dirname,'..','stats.html'),'utf8');
 assert.ok(sh.includes('js/stats.js?v=1.65.0'),'stats.html busts the stats.js cache');
 assert.ok(sh.includes('css/experience.css?v=1.105.0'),'stats.html busts the experience.css cache');
 assert.ok(sh.includes('data-cf-copy="btc"'),'footer tip chip is intact');
});

test('v1.66.0: unfilled ad slots self-collapse; filled slots survive untouched',async()=>{
 const p=await page('index');try{const w=p.w;
  // Page load pushed a live-path slot whose <ins> will never fill in jsdom.
  assert.ok(w.document.querySelectorAll('[data-ad-slot]').length>=1,'a live slot exists after page load');
  w.CF.collapseUnfilledAds();
  assert.equal(w.document.querySelectorAll('[data-ad-slot]').length,0,'an unfilled slot is removed from the DOM');
  // A slot AdSense filled (status + rendered iframe) survives the check untouched.
  const host=w.document.createElement('div');
  host.className='ad-slot';host.setAttribute('data-ad-slot','homeLeaderboard');
  const ins=w.document.createElement('ins');ins.className='adsbygoogle';
  ins.setAttribute('data-ad-status','filled');
  const frame=w.document.createElement('iframe');ins.appendChild(frame);
  host.appendChild(ins);w.document.body.appendChild(host);
  w.CF.collapseUnfilledAds();
  assert.ok(w.document.body.contains(host),'a filled slot survives the unfilled check');
  assert.ok(w.document.querySelector('ins.adsbygoogle iframe'),'the served ad iframe is never touched');
  // A slot AdSense explicitly marked unfilled is removed too.
  const host2=w.document.createElement('div');
  host2.className='ad-slot';host2.setAttribute('data-ad-slot','oddsInline');
  const ins2=w.document.createElement('ins');ins2.className='adsbygoogle';
  ins2.setAttribute('data-ad-status','unfilled');host2.appendChild(ins2);
  w.document.body.appendChild(host2);
  w.CF.collapseUnfilledAds();w.CF.collapseUnfilledAds(); // idempotent
  assert.equal(w.document.querySelectorAll('[data-ad-slot="oddsInline"]').length,0,'an unfilled-marked slot is removed and the check is idempotent');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
 // Every page busts the common.js cache at the new key.
 for(const f of ['index','news','games','stats','odds','injuries','practice','team','about','highlights','404']){
  const html=fs.readFileSync(path.join(__dirname,'..',f+'.html'),'utf8');
  assert.ok(html.includes('js/common.js?v=1.97.0'),f+'.html busts the common.js cache');
 }
});

test('v1.67.0: visitor copy stays fan-facing — no developer maintenance notes on injuries or practice',async()=>{
 const injuries=fs.readFileSync(path.join(__dirname,'..','injuries.html'),'utf8');
 assert.ok(!injuries.includes('data/injuries.json'),'injuries.html no longer names the repo file to visitors');
 assert.ok(!injuries.includes('update in 30 seconds'),'injuries.html hero no longer sounds like a build doc');
 assert.ok(injuries.includes('the official NFL pregame injury report is the source of truth'),'injuries.html keeps the honesty callout');
 assert.ok(injuries.includes('js/injuries.js?v=1.94.0'),'injuries.html busts the injuries.js cache');
 assert.ok(injuries.includes('data-cf-copy="btc"'),'footer tip chip is intact on injuries.html');
 const practice=fs.readFileSync(path.join(__dirname,'..','practice.html'),'utf8');
 assert.ok(!practice.includes('data/practice.json'),'practice.html no longer names the repo file to visitors');
 assert.ok(!practice.includes('make it yours'),'practice.html tracker note no longer sounds like a template doc');
 assert.ok(practice.includes('js/practice.js?v=1.67.0'),'practice.html busts the practice.js cache');
 assert.ok(practice.includes('data-cf-copy="btc"'),'footer tip chip is intact on practice.html');
 // The practice heat renders the new fan-facing week-strip note when data exists.
 const p=await page('practice',{fetch:async(u)=>u.pathname.endsWith('/practice.json')?{ok:true,json:async()=>({updated:'2026-09-26',note:'',rows:[{date:'Fri',session:'Full practice',focus:'Red zone',media:'Presser',notes:''}],participation:[]})}:undefined});
 try{
  const w=p.w;await settle(300);
  const note=w.document.querySelector('#practice-heat .heat-note');
  assert.ok(note,'the week strip carries a heat note');
  assert.ok(!note.textContent.includes('practice.json'),'the heat note no longer names the repo file');
  assert.ok(note.textContent.includes('facility to gameday'),'the heat note reads fan-facing');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
});

test('v1.68.0: injury prose stays compact — table shows the short designation, wire excerpts clamp to 3 lines',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/main.css'),'utf8');
 assert.match(css,/\.news-item \.inj-excerpt\s*\{[^}]*-webkit-line-clamp:\s*3/s,'wire excerpts clamp to 3 lines');
 assert.match(css,/\.news-item \.inj-excerpt\s*\{[^}]*overflow:\s*hidden/s,'wire excerpts hide the overflow');
 const injuries=fs.readFileSync(path.join(__dirname,'..','injuries.html'),'utf8');
 assert.ok(injuries.includes('js/injuries.js?v=1.94.0'),'injuries.html busts the injuries.js cache');
 assert.ok(injuries.includes('js/api.js?v=1.72.0'),'injuries.html busts the api.js cache');
 assert.ok(injuries.includes('css/main.css?v=1.97.0'),'injuries.html busts the main.css cache');
 assert.ok(injuries.includes('data-cf-copy="btc"'),'footer tip chip is intact on injuries.html');
 const index=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.ok(index.includes('js/home.js?v=1.99.0'),'index.html busts the home.js cache');
 assert.ok(index.includes('js/api.js?v=1.72.0'),'index.html busts the api.js cache');
 assert.ok(index.includes('data-cf-copy="btc"'),'footer tip chip is intact on index.html');
 const payload={injuries:[{displayName:'Chicago Bears',injuries:[{athlete:{displayName:'Test Bears LB',position:{abbreviation:'LB'}},status:'Questionable',date:'2026-09-25',shortComment:'Hamstring — limited practice',longComment:'The linebacker was held out of team drills on Friday with a hamstring injury that has lingered for weeks and could keep him sidelined through Sunday.'}]}]};
 const resp={ok:true,text:async()=>JSON.stringify(payload),json:async()=>payload};
 const p=await page('injuries',{fetch:async(u)=>u.pathname.endsWith('/injuries')?resp:undefined});
 try{
  const w=p.w;await settle(300);
  const tds=[...w.document.querySelectorAll('#report-table tbody tr td')];
  assert.ok(tds.length>=5,'the report table paints a row');
  assert.strictEqual(tds[2].textContent,'Hamstring — limited practice','the INJURY cell shows the short designation, not the full prose');
  assert.ok(tds[2].getAttribute('title') && tds[2].getAttribute('title').includes('lingered for weeks'),'the INJURY cell keeps the full prose in a title tooltip');
  const wire=w.document.querySelector('#wire-list .news-item');
  assert.ok(wire,'a wire card painted');
  assert.strictEqual(wire.querySelector('.headline').textContent,'Test Bears LB','the wire headline is the player name alone');
  const excerpt=wire.querySelector('.inj-excerpt');
  assert.ok(excerpt,'the wire card carries a clamped excerpt');
  assert.ok(excerpt.textContent.includes('lingered for weeks'),'the full prose stays in the DOM for screen readers');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
});

test('v1.69.0: sunday-desk status pill and footnote speak plain fan-facing words',async()=>{
 // The pill names the live sources feeding the desk in plain words — never the
 // developer shorthand ("live sched", "poly", "home wx") — and the footnote is
 // pure provenance: the section header already carries the "Full desk →" link,
 // so the old duplicate "Games Sunday desk →" link read as leftover scaffolding.
 const p=await page('index');try{
  const d=p.w.document;
  const pill=d.querySelector('#sunday-desk-pill');
  assert.ok(pill,'the sunday-desk pill exists');
  assert.ok(/Live schedule/.test(pill.textContent),'the pill says Live schedule, not "live sched"');
  assert.ok(!/poly|wx|live sched|snapshot/.test(pill.textContent),'no developer shorthand in the pill');
  const desk=d.querySelector('#sunday-desk');
  assert.ok(desk,'the sunday desk paints');
  const note=desk.querySelector('.src-note');
  assert.ok(note,'the provenance footnote exists');
  assert.match(note.textContent,/season log/i,'the footnote credits the season log');
  assert.ok(!note.querySelector('a[href="games.html#next-opp"]'),'the footnote no longer duplicates the header Full desk link');
  assert.ok(!/Games Sunday desk/.test(desk.textContent),'the scaffolding copy is gone from the desk');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.ok(html.includes('js/home.js?v=1.99.0'),'index.html busts the home.js cache');
 assert.ok(html.includes('data-cf-copy="btc"'),'footer tip chip is intact');
 const js=fs.readFileSync(path.join(__dirname,'..','js/home.js'),'utf8');
 assert.ok(!js.includes('"live sched"') && !js.includes('"poly"') && !js.includes('"home wx"'),'the shorthand bits are gone from home.js');
});

test('v1.70.0: 404 base resolves per host — the custom domain no longer 404s its own assets',async()=>{
 // The old hardcoded <base href="/ColdFront/"> made every stylesheet, script,
 // and image resolve under /ColdFront/*, which 404s on coldfronthq.com
 // (verified live) — a bad URL served a raw unstyled page. The base is now
 // chosen at parse time: /ColdFront/ on the github.io project URL, / elsewhere.
 const html=fs.readFileSync(path.join(__dirname,'..','404.html'),'utf8');
 const noScripts=html.replace(/<script[\s\S]*?<\/script>/g,'');
 assert.ok(!/<base[^>]*>/.test(noScripts),'no static base tag remains to 404 assets on the custom domain');
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 const baseScript=scripts.find(s=>s.includes("createElement('base')"));
 assert.ok(baseScript,'the parse-time base script exists in 404.html');
 for(const [hostname,expected] of [['kshot3000.github.io','/ColdFront/'],['coldfronthq.com','/'],['localhost','/']]){
  let inserted=null;const firstChild={};
  const fakeDocument={head:{firstChild,insertBefore(el,ref){inserted={href:el.href,atFirst:ref===firstChild};}},createElement:()=>({})};
  new Function('document','location',baseScript)(fakeDocument,{hostname});
  assert.ok(inserted,'the script inserts a base element on '+hostname);
  assert.equal(inserted.href,expected,'base resolves to '+expected+' on '+hostname);
  assert.ok(inserted.atFirst,'the base lands ahead of every relative asset');
 }
 assert.ok(html.includes('data-cf-copy="btc"'),'footer tip chip is intact on the 404 page');
 assert.ok(html.includes('@kshot9000'),'footer credit is intact on the 404 page');
});

test('v1.71.0: injury status pills speak fan English — cryptic feed codes become plain words',async()=>{
 // Feeds ship terse codes ("ir", "pup", "nfi") that read as jargon on a fan
 // page; the shared label map translates the known codes and passes anything
 // unknown through verbatim — it must never invent a label. The severity
 // class mapping is untouched: "ir" still scores the hot "out" treatment.
 const p=await page('injuries');try{
  const L=p.w.CF.injStatusLabel;
  assert.equal(L('ir'),'Injured Reserve');
  assert.equal(L('IR'),'Injured Reserve');
  assert.equal(L('pup'),'PUP List');
  assert.equal(L('nfi'),'NFI List');
  assert.equal(L('Out'),'Out');
  assert.equal(L('doubtful'),'Doubtful');
  assert.equal(L('questionable'),'Questionable');
  assert.equal(L('Suspended'),'Suspended');
  assert.equal(L('Out for season'),'Out for season','unknown phrasing passes through verbatim');
  assert.equal(L('Achilles'),'Achilles','an unknown status is never relabeled');
  assert.equal(p.w.CF.injStatusCls('ir'),'out','severity still treats IR as out');
  const css=fs.readFileSync(path.join(__dirname,'..','css/main.css'),'utf8');
  assert.ok(/\.st\s*\{[^}]*white-space:\s*nowrap/.test(css),'.st pills never wrap mid-label');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
 const injuries=fs.readFileSync(path.join(__dirname,'..','js/injuries.js'),'utf8');
 assert.ok(injuries.includes('CF.injStatusLabel(row.status)'),'the report table prints the fan-English label');
 const home=fs.readFileSync(path.join(__dirname,'..','js/home.js'),'utf8');
 assert.ok(home.includes('CF.injStatusLabel(row.status)'),'the homepage injury table prints the fan-English label');
 const ih=fs.readFileSync(path.join(__dirname,'..','injuries.html'),'utf8');
 assert.ok(ih.includes('js/injuries.js?v=1.94.0'),'injuries.html busts the injuries.js cache');
 const xh=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.ok(xh.includes('js/home.js?v=1.99.0'),'index.html busts the home.js cache');
 assert.ok(xh.includes('data-cf-copy="btc"'),'footer tip chip is intact on the homepage');
});

test('photo-band copy stays fan-facing — photo credits live on the about page, not in the bands',async()=>{
 // v1.67.0 swept maintenance notes off injuries/practice but missed the photo
 // bands: games/news/stats ended their fan-facing band copy with internal
 // photo-credit and trademark-disclaimer language ("Unsplash photography;
 // Cold Front marks only", "Never league logos"). The credits are fully
 // attributed on about.html + img/ATTRIBUTION.txt, so the bands speak fan.
 const credit=/unsplash|wikimedia|marks only|original cold front art|never league logos/i;
 for(const name of ['games','news','stats','about','highlights','injuries','odds','team']){
  const p=await page(name);try{
   const bands=p.w.document.querySelectorAll('.photo-band-copy p');
   assert.ok(bands.length>0,name+' has photo-band copy');
   for(const band of bands) assert.ok(!credit.test(band.textContent),name+' band copy is fan-facing: '+band.textContent);
  }finally{p.close();}
 }
 // The about page keeps the real attribution — this run removed nothing from it.
 const p=await page('about');try{
  assert.ok(/photo credits/i.test(p.w.document.querySelector('main').textContent),'about page still carries the full photo credits');
 }finally{p.close();}
});

test('v1.74.0: sunday-desk matchup line names the stadium once — no duplicated venue',async()=>{
 // The games.html Sunday Desk matchup line built the site token as
 // "Home · Soldier Field" and then appended g.venue again, printing
 // "Home · Soldier Field · Soldier Field" on the marquee card (seen live
 // on game day, Bears vs Eagles). The venue token now comes only from
 // g.venue, with "Soldier Field" as the home fallback. A home fixture with
 // the live venue + a TV network reproduces the exact shape.
 const homeEv=event('201','CHI','PHI');
 const p=await page('games',{fetch:async u=>{
  if(u.pathname.includes('/teams/chicago/schedule')){
   const body=JSON.stringify({season:{displayName:'2026',type:2},events:[homeEv]});
   return {ok:true,json:async()=>JSON.parse(body),text:async()=>body};
  }
 }});
 try{
  const meta=p.w.document.querySelector('#next-opp-meta');
  assert.ok(meta,'the sunday-desk meta line renders');
  const hits=(meta.textContent.match(/Soldier Field/g)||[]).length;
  assert.equal(hits,1,'the venue appears exactly once in the detail line: '+meta.textContent);
  assert.match(meta.textContent,/Home · Soldier Field · TV/,'home games read Home, venue, then the TV line');
  assert.ok(!/Soldier Field · Soldier Field/.test(meta.textContent),'the duplicated stadium is gone');
 }finally{p.close();}
});

test('v1.75.0: cfi spark pill labels the trend in plain fan words — no bare acronym knob',async()=>{
 // The weather strip's CFI spark pill showed the trend sparkline beside the
 // bare acronym "CFI", which first-time visitors read as an unexplained
 // (even interactive) control — nothing in visible text said what it was.
 // The pill's visible label now names the window in plain words
 // ("next 7 days" for the forecast path, "recent readings" for history),
 // with the full "Cold Front Index" name kept in the tooltip and on the
 // dial beside it.
 const p=await page('index');try{const w=p.w;
  const days=[],tMax=[],wind=[],snow=[];
  for(let i=0;i<7;i++){days.push('2026-09-2'+i);tMax.push(10+i%3);wind.push(8+i);snow.push(0);}
  const wx={daily:{time:days,temperature_2m_max:tMax,wind_speed_10m_max:wind,snowfall_sum:snow},gauge:{score:12,cls:'mild',label:'mild'}};
  const host=w.document.createElement('span');
  w.CF.paintCfiSpark(wx,host);
  assert.equal(host.hidden,false,'the pill renders when the forecast covers a week');
  const label=host.querySelector('.cfi-spark-label');
  assert.ok(label,'the pill carries a visible label');
  assert.equal(label.textContent,'next 7 days','the pill label names the trend window in plain words: '+label.textContent);
  assert.ok(!/\bCFI\b/.test(label.textContent),'the bare acronym is gone from the visible label');
  assert.ok(host.title.includes('Cold Front Index'),'the tooltip still names the index: '+host.title);
  // History path: no daily data, readings from a prior visit.
  w.localStorage.setItem('cf.'+w.CF.cfiHistoryKey,JSON.stringify([{score:10,t:1},{score:14,t:2}]));
  const host2=w.document.createElement('span');
  w.CF.paintCfiSpark({daily:{time:[]},gauge:{score:12,cls:'mild',label:'mild'}},host2);
  const label2=host2.querySelector('.cfi-spark-label');
  assert.ok(label2,'the history pill carries a visible label');
  assert.equal(label2.textContent,'recent readings','the history pill label speaks plain words: '+label2.textContent);
 }finally{p.close();}
});

test('v1.77.0: games sunday-desk footnote speaks plain fan-facing words',async()=>{
 // The Sunday-desk src-note on games.html ended on developer shorthand —
 // "wire / Polymarket when the feeds answer" — the same class of leak cleaned
 // up on the home desk (v1.69.0) and the CFI pill (v1.75.0). It now names the
 // provenance ("Rest & last meeting come from the season log") and the
 // refresh behavior ("Lines and market prices refresh automatically") in
 // words a fan reads at a glance. Inline HTML only: no JS/CSS changed, so no
 // cache-bust bump is required.
 const html=fs.readFileSync(path.join(__dirname,'..','games.html'),'utf8');
 const note=html.match(/<p class="src-note"[^>]*>.*?<\/p>/s);
 assert.ok(note,'the sunday-desk src-note exists on games.html');
 const copy=note[0];
 assert.ok(/Rest &amp; last meeting come from the season log/.test(copy),'the footnote credits the season log in fan words');
 assert.ok(/Lines and market prices refresh automatically/.test(copy),'the refresh note reads fan-facing');
 assert.ok(!/wire \/ Polymarket when the feeds answer/.test(copy),'the developer shorthand is gone');
 assert.ok(!/when the feeds/.test(copy),'no "feeds" internals leak into the visible copy');
 assert.ok(copy.includes('Season log ↓') && copy.includes('Odds →'),'the quick links survive the rewrite');
});

test('v1.78.0: section dividers read as field markings, not loading bars',async()=>{
 // Fresh-eyes review: every section header carried a 4px rule whose first
 // third was a hard orange "fill" against an empty fading track — the
 // universal grammar of a partial loading indicator. On a site whose
 // sections genuinely load async ("tuning…", "connecting"), it trained
 // visitors to read "still loading." The divider is now a uniform
 // full-width frost hairline with evenly spaced yard-line ticks: no filled
 // segment anywhere, so it can never read as progress.
 const css=fs.readFileSync(path.join(__dirname,'..','css','main.css'),'utf8');
 const block=css.match(/\.section-head \.rule\s*\{[^}]*\}/s);
 assert.ok(block,'the .section-head .rule block exists');
 const rule=block[0];
 assert.ok(!/var\(--orange-hot\) 0 18%|18% 34%/.test(rule),'the old partial-fill gradient (orange 0-34%, track after) is gone');
 assert.ok(!/orange-hot/.test(rule),'no bright orange fill segment remains on the divider');
 assert.ok(/repeating-linear-gradient/.test(rule),'the divider uses a repeating yard-line tick pattern');
 assert.ok(/mask-image/.test(rule),'the ticks are clipped to a soft yard-line band');
 // The stylesheet changed, so every page must carry the fresh cache key —
 // a stale key would serve cached CSS whose rule still reads as a loader.
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('css/main.css?v=1.97.0'),name+'.html carries the v1.97.0 main.css cache key');
  assert.ok(!/main\.css\?v=1\.(96\.0|95\.0|94\.0|93\.0|92\.0|91\.0|90\.0|82\.0|7[0-7])/.test(html),name+'.html has no stale main.css key');
 }
});

test('v1.79.0: snow toggle docks in the header on phones — never parks on content',async()=>{
 // Fresh-eyes live QA (2026-09-28): the floating "Snow on" pill sat fixed at
 // bottom-right on phones, covering the responsible-gambling helpline number
 // on odds.html and the matchup line on the NEXT UP card. The toggle now docks
 // into the sticky header (left of the menu button) on narrow screens, so it
 // can never float over readable content. Desktop keeps the floating pill.
 const css=fs.readFileSync(path.join(__dirname,'..','css','experience.css'),'utf8');
 const mob=css.match(/@media \(max-width:760px\)\s*\{([\s\S]*?)\n\}\n@media \(max-width:440px\)/);
 assert.ok(mob,'the 760px mobile block exists');
 const block=mob[1];
 assert.ok(/\.snow-toggle\s*\{[^}]*position:\s*static/s.test(block),'on phones the toggle leaves the fixed layer (position:static)');
 assert.ok(/\.snow-toggle\s*\{[^}]*margin-left:\s*auto/s.test(block),'the docked toggle sits at the header\'s right, before the menu button');
 assert.ok(/\.snow-toggle \.snow-label\s*\{\s*display:\s*none/s.test(block),'the text label hides on phones — icon-only, state stays in aria-label/aria-pressed');
 assert.ok(!/\.snow-toggle\s*\{[^}]*position:\s*fixed/s.test(block),'no fixed positioning remains on the mobile toggle');
 // Desktop pill untouched: the base rule (outside the media block) still floats.
 const base=css.split('@media')[0];
 assert.ok(/\.snow-toggle\s*\{[^}]*position:\s*fixed/s.test(base),'the desktop pill still floats bottom-right');
 // snow.js inserts the control into the header bar, and the label is wrapped
 // so the phone layout can collapse it to icon-only.
 const snow=fs.readFileSync(path.join(__dirname,'..','js','snow.js'),'utf8');
 assert.ok(/headBar\.insertBefore\(control, navToggle\)/.test(snow),'the toggle is inserted before the menu button in the header');
 assert.ok(/class="snow-label"/.test(snow),'the toggle label is wrapped in a .snow-label span');
 // Both changed assets are cache-busted on every page — a stale key would
 // keep serving the old floating-pill CSS/JS to returning phones.
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('css/experience.css?v=1.105.0'),name+'.html carries the v1.101.0 experience.css cache key');
  assert.ok(html.includes('js/snow.js?v=1.104.0'),name+'.html carries the v1.104.0 snow.js cache key');
  assert.ok(!/experience\.css\?v=1\.(100|101|102|[0-7]|80|85|92|99)\.0"|snow\.js\?v=1\.(1[0-7]|18|79|100)\.0"/.test(html),name+'.html has no stale experience/snow cache key');
 }
});

test('v1.100.0: snow toggle escapes the header backdrop-filter trap on desktop',async()=>{
 // Live QA (2026-09-29) caught the desktop "Snow on" pill parked inside the
 // header, burying the X nav link: .site-head carries backdrop-filter, which
 // makes it a containing block for fixed descendants, so the CSS
 // position:fixed never reached the viewport — the pill sat at the header's
 // bottom-right with right:18px/bottom:18px relative to the header. The toggle
 // now re-homes by viewport: document.body on desktop (no filters there, so
 // the fixed float works as drawn), header dock on phones. Same 760px
 // breakpoint the CSS dock rule uses, with a change listener for resizes.
 const p=await page('index');
 try{
  assert.deepEqual(p.errors,[]);
  const tgl=p.w.document.querySelector('.snow-toggle');
  assert.ok(tgl,'the toggle exists');
  // jsdom's matchMedia stub defaults (max-width:760px) to no-match = desktop.
  assert.equal(tgl.parentElement,p.w.document.body,'on desktop the toggle lives on document.body, outside the filtered header');
  assert.ok(!p.w.document.querySelector('.site-head .snow-toggle'),'no toggle remains inside .site-head on desktop');
  const mq=p.media.get('(max-width: 760px)');
  assert.ok(mq,'the placement query uses the same 760px breakpoint as the CSS dock rule');
  mq.fire(true);
  assert.ok(p.w.document.querySelector('.snow-toggle').closest('.site-head .wrap'),'on phones the toggle docks back into the header bar');
  mq.fire(false);
  assert.equal(p.w.document.querySelector('.snow-toggle').parentElement,p.w.document.body,'flipping back to desktop re-homes it to the body');
  // The toggle still announces itself the way the v1.79.0 contract requires.
  assert.equal(p.w.document.querySelector('.snow-toggle').getAttribute('aria-pressed'),'true');
 }finally{p.close();}
});

test('v1.80.0: Bears identity chip anchors to the Bears row — no stray floating bear',async()=>{
 // Live QA (2026-09-28) caught a ~16px bear head floating detached between
 // the AWAY and HOME rows on the NEXT UP hero card. Cause: .match-card .vs
 // never gets display:grid, so the matchup rows stack full-width; the chip
 // was absolutely centered at left:50% of that full-width row, landing in
 // mid-card. It now anchors to the start of the Bears row (left:0), hovering
 // directly above their abbr. Same selector family was also hiding the
 // "Make your call" well's own bear chip (display:none, never inside
 // .side.is-bears); it now renders inline in the predict-team flex row.
 const css=fs.readFileSync(path.join(__dirname,'..','css','experience.css'),'utf8');
 const chip=css.match(/\.match-card \.bears-chip\s*\{[^}]*\}/s);
 assert.ok(chip,'the .match-card .bears-chip block exists');
 // v1.99.0 superseded the absolute anchoring: fresh-eyes live QA caught the
 // left:0/top:50% chip landing ON the score digits (rows stack full-width and
 // left-aligned). The chip now rides in flow above the Bears' abbreviation.
 assert.ok(/position:\s*static/.test(chip[0]),'the chip left the absolute layer (position:static)');
 assert.ok(!/left:\s*50%/.test(chip[0]),'no left:50% centering remains on the chip');
 assert.ok(!/translateX\(-50%\)/.test(chip[0]),'no -50% x-shift remains on the chip');
 const pred=css.match(/\.match-card \.predict-team \.bears-chip\s*\{[^}]*\}/s);
 assert.ok(pred,'the predict-team chip override exists');
 assert.ok(/position:\s*static/.test(pred[0]),'the prediction-well chip leaves the absolute layer (position:static)');
 assert.ok(/display:\s*inline-block/.test(pred[0]),'the prediction-well chip is visible in the flex row');
 // The stylesheet changed, so every page must carry the fresh cache key.
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('css/experience.css?v=1.105.0'),name+'.html carries the v1.101.0 experience.css cache key');
  assert.ok(!/experience\.css\?v=1\.(100|101|102|80|85|92|99)\.0"/.test(html),name+'.html has no stale experience.css key');
 }
});

test('v1.81.0: Bears identity chip rides the Bears row — no overlap with the venue line',async()=>{
 // Fresh-eyes live QA (2026-09-28): v1.80.0 anchored the hero card's bear
 // chip to the row start but 10px ABOVE the row (top:-10px), so the glyph
 // landed on the "Soldier Field" venue line sitting directly above the
 // Bears row — reading as a glitch on the hero. (When the Bears are the
 // away side it would have hit the match title instead.) The chip now pins
 // to the row's left edge and centers vertically on the Bears block, so it
 // reads as attached to the row with clear air above and below.
 const css=fs.readFileSync(path.join(__dirname,'..','css','experience.css'),'utf8');
 const chip=css.match(/\.match-card \.bears-chip\s*\{[^}]*\}/s);
 assert.ok(chip,'the .match-card .bears-chip block exists');
 // v1.99.0 superseded the absolute vertical centering: fresh-eyes live QA
 // caught the top:50% chip landing ON the score digits. The chip now rides
 // in flow above the Bears' abbreviation and can never touch the digits.
 assert.ok(/position:\s*static/.test(chip[0]),'the chip left the absolute layer (position:static)');
 assert.ok(!/position:\s*absolute/.test(chip[0]),'no absolute positioning remains on the chip');
 assert.ok(!/top:\s*50%/.test(chip[0]),'no top:50% vertical centering remains');
 assert.ok(!/translateY\(-50%\)/.test(chip[0]),'no -50% y-shift remains');
 assert.ok(!/top:\s*-10px/.test(chip[0]),'no top:-10px hover-above-the-row remains');
 assert.ok(!/left:\s*50%/.test(chip[0]),'no left:50% centering remains on the chip');
 // The predict-team override from v1.80.0 survives untouched.
 const pred=css.match(/\.match-card \.predict-team \.bears-chip\s*\{[^}]*\}/s);
 assert.ok(pred,'the predict-team chip override still exists');
 assert.ok(/position:\s*static/.test(pred[0]),'the prediction-well chip still renders inline');
 // The stylesheet changed, so every page must carry the fresh cache key.
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('css/experience.css?v=1.105.0'),name+'.html carries the v1.101.0 experience.css cache key');
  assert.ok(!/experience\.css\?v=1\.(100|101|102|80|85|92|99)\.0"/.test(html),name+'.html has no stale experience.css key');
 }
});

test('v1.82.0: the playbook grid\'s closing card spans the row — no orphan tile',async()=>{
 // Fresh-eyes review (2026-09-28): the nine "Your fan playbook" tiles sat in
 // a 4-column grid, so "Behind the front" always landed alone on the last row
 // at every breakpoint — one orphan tile under a tidy 2x4 block. That card is
 // also thematically the odd one out (the builder and the tip jar, not a
 // content section), so it now spans the full row as a wide feature banner.
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.ok(html.includes('<a href="about.html" class="wide">'),'the about/builder card carries the wide class');
 const css=fs.readFileSync(path.join(__dirname,'..','css','main.css'),'utf8');
 const wide=css.match(/\.grid\.quick a\.wide\s*\{[^}]*\}/s);
 assert.ok(wide,'the .grid.quick a.wide block exists');
 assert.ok(/grid-column:\s*1\s*\/\s*-1/.test(wide[0]),'the wide card spans the full row (grid-column: 1 / -1)');
 assert.ok(/flex-direction:\s*row/.test(wide[0]),'the wide card lays out horizontally');
 assert.ok(/min-height:\s*0/.test(wide[0]),'the wide card drops the 145px tile min-height');
 const arrow=css.match(/\.grid\.quick a\.wide::after\s*\{[^}]*\}/s);
 assert.ok(arrow,'the wide card carries a lead-in arrow (::after)');
 assert.ok(/transform:\s*translateX\(7px\)/.test(css),'the arrow nudges right on hover/focus');
 // The stylesheet changed, so every page must carry the fresh cache key.
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const p=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(p.includes('css/main.css?v=1.97.0'),name+'.html carries the v1.97.0 main.css cache key');
  assert.ok(!/main\.css\?v=1\.(96\.0|95\.0|94\.0|93\.0|92\.0|91\.0|90\.0|82\.0|78\.0)/.test(p),name+'.html has no stale main.css key');
 }
 // Footer branding must survive the release.
 const common=fs.readFileSync(path.join(__dirname,'..','js','common.js'),'utf8');
 assert.ok(common.includes('3GnR7TWBXAB3pPztBWpNF4LMNEX5yX8vZK'),'the BTC tip chip address survives in common.js');
 assert.ok(html.includes('3GnR…8vZK'),'the truncated BTC display survives in index.html');
 assert.ok(html.includes('@kshot9000'),'the @kshot9000 attribution survives');
});

test('v1.83.0: wind reads in mph everywhere — no km/h, no inflated kickoff number',async()=>{
 // Fresh-eyes review (2026-09-28) spotted "wind 11 km/h" in the games.html
 // Sunday-desk meta chip next to "wind 11 mph" in the kickoff weather line.
 // Digging in found two defects sharing one cause: wx.wind arrives in km/h
 // (Open-Meteo's wind_speed_10m). The weather strip converts to mph, but
 // CF.kickoffWeatherHTML printed the raw km/h value under an "mph" label —
 // overstating wind by 61% on every home game day (used on games.html's
 // Sunday desk and index.html's next-opp card) — while the desk chip printed
 // the right value in metric units, clashing with the strip. Both now convert
 // inline (km/h / 1.609344), matching the strip's convention.
 const common=fs.readFileSync(path.join(__dirname,'..','js','common.js'),'utf8');
 assert.ok(/Math\.round\(wx\.wind \/ 1\.609344\) \+ " mph"/.test(common),'kickoffWeatherHTML converts km/h to mph');
 const gamesJs=fs.readFileSync(path.join(__dirname,'..','js','games.js'),'utf8');
 assert.ok(/Math\.round\(wx\.wind \/ 1\.609344\) \+ " mph"/.test(gamesJs),'the sunday-desk chip converts km/h to mph');
 assert.ok(!/km\/h/.test(common),'no km/h display string remains in common.js');
 assert.ok(!/km\/h/.test(gamesJs),'no km/h display string remains in games.js');
 // Behavioral: the mocked Open-Meteo fixture reports wind_speed_10m:16, so a
 // rendered home game day must read "wind 10 mph" (16/1.609344 = 9.94 -> 10),
 // not "16 mph" and not "16 km/h", in both the desk chip and the kickoff line.
 const homeEv=event('201','CHI','PHI');
 const p=await page('games',{fetch:async u=>{
  if(u.pathname.includes('/teams/chicago/schedule')){
   const body=JSON.stringify({season:{displayName:'2026',type:2},events:[homeEv]});
   return {ok:true,json:async()=>JSON.parse(body),text:async()=>body};
  }
 }});
 try{
  const chip=p.w.document.querySelector('#next-opp-chip');
  assert.ok(chip,'the sunday-desk weather chip renders');
  assert.match(chip.textContent,/wind 10 mph/,'the chip reads the converted 10 mph: '+chip.textContent);
  assert.ok(!/km\/h/.test(chip.textContent),'no metric wind in the chip');
  const kw=p.w.document.querySelector('.kickoff-wx.in-desk');
  assert.ok(kw,'the kickoff weather block renders in the desk');
  assert.match(kw.textContent,/wind 10 mph/,'the kickoff line reads the converted 10 mph: '+kw.textContent);
  assert.ok(!/km\/h/.test(kw.textContent),'no metric wind in the kickoff line');
  assert.ok(!/wind 16 mph/.test(kw.textContent),'the old inflated number is gone');
 }finally{p.close();}
 // Both changed assets are cache-busted on every page they load on — a stale
 // key would keep serving the inflated wind number to returning visitors.
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('js/common.js?v=1.97.0'),name+'.html carries the v1.97.0 common.js cache key');
  assert.ok(!/common\.js\?v=1\.(9[0-6]|8[0-9]|7[0-9]|[0-6][0-9])/.test(html),name+'.html has no stale common.js key');
 }
 const ghtml=fs.readFileSync(path.join(__dirname,'..','games.html'),'utf8');
 assert.ok(ghtml.includes('js/games.js?v=1.102.0'),'games.html carries the v1.94.0 games.js cache key');
 assert.ok(!/games\.js\?v=1\.(10[01]|9[0-9]|8[0-9]|7[0-9]|[0-6][0-9])\.0"/.test(ghtml),'games.html has no stale games.js key');
 // Footer branding must survive the release.
 assert.ok(common.includes('3GnR7TWBXAB3pPztBWpNF4LMNEX5yX8vZK'),'the BTC tip chip address survives in common.js');
 assert.ok(ghtml.includes('@kshot9000'),'the @kshot9000 attribution survives on games.html');
});

test('v1.84.0: sunday-desk week pill reads "WK 3", never "WK Week 3"',async()=>{
 // Fresh-eyes visual QA (2026-09-28) caught the Sunday Desk duel card's week
 // pill reading "WK Week 3" live on games.html. Root cause: the ESPN adapter
 // (js/api.js) yields e.week.text verbatim ("Week 3"), and paintDuel in
 // js/games.js prefixed its own "WK " unconditionally — doubling the word.
 // The pill now strips a leading "Week" before the prefix goes on, so it
 // reads "WK 3" whether the feed says "Week 3" or "3". Non-week labels
 // ("Wild Card") pass through untouched.
 const games=fs.readFileSync(path.join(__dirname,'..','js','games.js'),'utf8');
 assert.ok(/replace\(\/\^Week\\s\+\/i, ""\)/.test(games),'paintDuel strips a leading "Week" before the WK prefix');
 assert.ok(!/duel-week.*WK ' \+ CF\.esc\(String\(g\.week\)\)/.test(games),'the old unconditional WK prefix is gone');
 // Behavioral: a mocked schedule whose week.text is "Week 3" renders "WK 3".
 const wk3={...event('201','PHI','CHI'),week:{text:'Week 3'}};
 const p=await page('games',{fetch:async u=>{
  if(u.pathname.includes('/teams/chicago/schedule')){
   const body=JSON.stringify({season:{displayName:'2026',type:2},events:[wk3]});
   return {ok:true,json:async()=>JSON.parse(body),text:async()=>body};
  }
 }});
 try{
  await settle(300);
  const pill=p.w.document.querySelector('#next-opp-duel .duel-week');
  assert.ok(pill,'the sunday-desk duel card renders its week pill');
  assert.equal(pill.textContent.trim(),'WK 3','the pill reads WK 3, not WK Week 3: '+pill.textContent);
 }finally{p.close();}
 // Bare-number week text ("4") still renders "WK 4" — no regression on the
 // path that worked before.
 const wk4={...event('202','PHI','CHI'),week:{text:'4'}};
 const q=await page('games',{fetch:async u=>{
  if(u.pathname.includes('/teams/chicago/schedule')){
   const body=JSON.stringify({season:{displayName:'2026',type:2},events:[wk4]});
   return {ok:true,json:async()=>JSON.parse(body),text:async()=>body};
  }
 }});
 try{
  await settle(300);
  const pill=q.w.document.querySelector('#next-opp-duel .duel-week');
  assert.ok(pill,'the week pill renders for a bare-number week label');
  assert.equal(pill.textContent.trim(),'WK 4','the pill reads WK 4: '+pill.textContent);
 }finally{q.close();}
 // Only games.html loads games.js, so only its key moves — but every page
 // loads common.js and must not pick up a stale key. Footer branding survives.
 const ghtml=fs.readFileSync(path.join(__dirname,'..','games.html'),'utf8');
 assert.ok(ghtml.includes('js/games.js?v=1.102.0'),'games.html carries the v1.94.0 games.js cache key');
 assert.ok(!/games\.js\?v=1\.(10[01]|9[0-9]|8[0-9]|7[0-9]|[0-6][0-9])\.0"/.test(ghtml),'games.html has no stale games.js key');
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('js/common.js?v=1.97.0'),name+'.html keeps the v1.97.0 common.js cache key');
 }
 assert.ok(ghtml.includes('@kshot9000'),'the @kshot9000 attribution survives on games.html');
});

test('v1.85.0: hero venue line reads as a shared stadium divider, not an away-column tag',async()=>{
 // Desktop live-QA catch: the venue line ("Soldier Field") sat left-aligned
 // directly under the away block, reading as "PHI · AWAY · Soldier Field".
 // It is now a centered, tracked uppercase micro-label with a stadium glyph
 // and breathing room from both teams; the frost skeleton keeps the centering
 // but skips the glyph until real content paints. experience.css changed, so
 // every page's cache key moves to v1.85.0. Footer branding survives.
 const css=fs.readFileSync(path.join(__dirname,'../css/experience.css'),'utf8');
 assert.match(css,/\.match-card \.mid\s*\{[^}]*text-align:\s*center/s,'the venue line centers between the two teams');
 assert.match(css,/\.match-card \.mid\s*\{[^}]*text-transform:\s*uppercase/s,'the venue line speaks the tracked micro-label voice');
 assert.match(css,/\.match-card \.mid::before\s*\{[^}]*🏟/s,'a stadium glyph anchors the venue line');
 assert.match(css,/\.match-card \.mid:has\(\.skel\)::before\s*\{[^}]*content:\s*none/s,'the glyph waits for real content, not the frost skeleton');
 const p=await page('index');try{
  const d=p.w.document;
  const mid=d.querySelector('#ng-mid');
  assert.equal(mid.textContent,'Soldier Field','the fixture venue paints into the divider');
  assert.ok(!mid.querySelector('.skel'),'the frost skeleton swaps out when real data paints');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('css/experience.css?v=1.105.0'),name+'.html carries the v1.101.0 experience.css cache key');
  assert.ok(!/experience\.css\?v=1\.(10[012]|9[0-9]|8[0-9]|7[0-9]|[0-6][0-9])\.0"/.test(html),name+'.html has no stale experience.css key');
  assert.ok(html.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
  assert.ok(html.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
 }
});

test('v1.86.0: Polymarket volumes render as dollar-compact figures',async()=>{
 // Fresh-eyes visual QA (2026-09-28) caught Polymarket cards on odds.html
 // mixing "Vol 268.2" (a bare float with no unit) next to "Vol 6.7K" and
 // "Vol 1.7M". Volumes are dollars, so every card now reads the same
 // dollar-compact voice: $268, $6.7K, $1.8M. The stray float
 // 268.18067599999995 rounds to a whole dollar, not 268.2.
 const odds=fs.readFileSync(path.join(__dirname,'..','js','odds.js'),'utf8');
 assert.ok(/fmtPolyVol/.test(odds),'odds.js formats Polymarket volume with the dollar-compact helper');
 assert.ok(/"\$"\s*\+\s*compact\(1e6,\s*"M"\)/.test(odds),'millions compact with a $ prefix');
 assert.ok(!/"Vol " \+ CF\.fmt\(m\.volume\)/.test(odds),'the bare shared formatter is gone from the volume line');
 // Behavioral: mocked Polymarket feed renders all three volume bands.
 const ev=(vol)=>({title:'Chicago Bears win?',slug:'bears',markets:[{question:'Chicago Bears win?',outcomes:['Yes','No'],outcomePrices:['0.6','0.4'],slug:'bears',volume:vol}]});
 const p=await page('odds',{fetch:async u=>{
  if(u.hostname==='gamma-api.polymarket.com'&&u.pathname.includes('/events/keyset')){
   const body=JSON.stringify({events:[ev(268.18067599999995),ev(6721.5),ev(1800000)]});
   return {ok:true,json:async()=>JSON.parse(body),text:async()=>body};
  }
 }});
 try{
  await settle(300);
  const subs=Array.from(p.w.document.querySelectorAll('#poly-board .sub')).map(el=>el.textContent.trim());
  assert.ok(subs.length>=3,'three poly cards render with volumes: '+JSON.stringify(subs));
  assert.ok(subs.some(s=>s.includes('Vol $268')&&!s.includes('268.2')),'stray float renders as Vol $268: '+subs[0]);
  assert.ok(subs.some(s=>s.includes('Vol $6.7K')),'thousands compact as Vol $6.7K');
  assert.ok(subs.some(s=>s.includes('Vol $1.8M')),'millions compact as Vol $1.8M');
 }finally{p.close();}
 // Only odds.html loads odds.js, so only its key moves to v1.86.0. Footer
 // branding and all other cache keys are untouched.
 const html=fs.readFileSync(path.join(__dirname,'..','odds.html'),'utf8');
 assert.ok(html.includes('js/odds.js?v=1.95.0'),'odds.html carries the v1.95.0 odds.js cache key');
 assert.ok(!/odds\.js\?v=1\.(9[0-4]|8[0-9]|7[0-9]|6[0-9]|5[0-9]|[0-4][0-9])/.test(html),'odds.html has no stale odds.js key');
 assert.ok(html.includes('@kshot9000'),'the @kshot9000 attribution survives on odds.html');
 assert.ok(html.includes('data-cf-copy="btc"'),'the BTC tip chip survives on odds.html');
});

test('v1.87.0: season-log date cells separate the date from kickoff with a middot',async()=>{
 // Fresh-eyes visual QA (2026-09-28, screenshot-confirmed) caught the season
 // log's first column reading "Thu, Oct 227:15 PM CDT" — the bare space
 // between the date and the dim kickoff time had no visible presence in
 // render, so date and time fused. The row builder now follows the site's own
 // date voice (common.js already paints "date · time" the same way): date, a
 // visible middot, then the kickoff in dim. A middot can never collapse like
 // a space, so the fusion is structurally impossible.
 const games=fs.readFileSync(path.join(__dirname,'..','js','games.js'),'utf8');
 assert.ok(games.includes('class="dim">· '),'the log row separates date and kickoff with a middot in dim');
 assert.ok(!games.includes('CF.fmtDate(g.date) + " <span'),'the bare-space date/time join is gone from the log row');
 // Behavioral: the fixture schedule renders both log rows with a middot
 // between date and kickoff, in the right order, with no empty cells.
 const p=await page('games');try{
  await settle(300);
  const cells=Array.from(p.w.document.querySelectorAll('#log-table tbody tr:not(.log-divider) td:first-child'))
    .map(td=>td.textContent.trim()).filter(t=>t.length);
  assert.ok(cells.length>=2,'the season log renders date cells: '+JSON.stringify(cells));
  for(const c of cells){
   assert.ok(c.includes('·'),'the date cell carries a visible middot separator: '+c);
   assert.match(c,/^[A-Za-z]{3}, [A-Za-z]{3} \d{1,2} · \d{1,2}:\d{2} [AP]M [A-Z]{3,4}$/,'the cell reads "date · kickoff": '+c);
  }
 }finally{p.close();}
 // Only games.html loads games.js, so only its key moves to v1.87.0 —
 // common.js changed this release, so its key moves to v1.89.0 everywhere. Footer
 // branding survives.
 const ghtml=fs.readFileSync(path.join(__dirname,'..','games.html'),'utf8');
 assert.ok(ghtml.includes('js/games.js?v=1.102.0'),'games.html carries the v1.94.0 games.js cache key');
 assert.ok(!/games\.js\?v=1\.(10[01]|9[0-9]|8[0-9]|7[0-9]|[0-6][0-9])\.0"/.test(ghtml),'games.html has no stale games.js key');
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('js/common.js?v=1.97.0'),name+'.html keeps the v1.97.0 common.js cache key');
  assert.ok(html.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
  assert.ok(html.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
 }
});

test('v1.88.0: team hero headline speaks the live roster count',async()=>{
 // Fresh-eyes visual QA (2026-09-28, screenshot-confirmed): the team page's
 // photo-band hero read "Fifty-three names. One city." while the roster pill
 // directly below it reported the feed's real count ("live · 83 players") —
 // a data contradiction in the page's most prominent copy. The headline is
 // now live-aware: when the roster loads, team.js rewrites it to the same
 // number the pill reports ("83 names. One city."). The poetic fifty-three
 // line survives as the pre-load and feed-down fallback voice.
 const html=fs.readFileSync(path.join(__dirname,'..','team.html'),'utf8');
 assert.ok(html.includes('<h3 id="roster-hero-line">Fifty-three names. One city.</h3>'),
   'the hero headline carries the roster-hero-line id with the fifty-three fallback');
 const team=fs.readFileSync(path.join(__dirname,'..','js','team.js'),'utf8');
 assert.ok(team.includes('roster-hero-line'),'team.js targets the hero headline');
 assert.ok(team.includes('all.length + " names. One city."'),'the hero rewrite uses the live roster count');
 // Behavioral: the fixture roster ships two players, so the hero and the
 // pill must agree on "2" after the feed settles.
 const p=await page('team');try{
  await settle(300);
  const hero=p.w.document.querySelector('#roster-hero-line').textContent.trim();
  const pill=p.w.document.querySelector('#roster-pill').textContent.trim();
  assert.equal(hero,'2 names. One city.','the hero headline carries the fixture count: '+hero);
  assert.ok(pill.includes('2 players'),'the pill reports the same count: '+pill);
 }finally{p.close();}
 // Only team.html loads team.js, so only its key moves to v1.88.0 —
 // common.js changed this release, so its key moves to v1.89.0 everywhere. Footer
 // branding survives.
 assert.ok(html.includes('js/team.js?v=1.105.0'),'team.html carries the v1.88.0 team.js cache key');
 assert.ok(!/team\.js\?v=1\.(8[0-8]|7[0-9]|[0-6][0-9])\.0"/.test(html),'team.html has no stale team.js key');
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const ph=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(ph.includes('js/common.js?v=1.97.0'),name+'.html keeps the v1.97.0 common.js cache key');
  assert.ok(ph.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
  assert.ok(ph.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
 }
});

test('v1.89.0: injury designations speak fan English — "ir" and "inactive" never read as raw feed codes',async()=>{
 // Fresh-eyes follow-up to v1.71.0: the status PILL got the fan-English map,
 // but the injury DESIGNATION cells still printed ESPN's raw shortComment —
 // the home training-room table's LATEST UPDATE column and the injuries page
 // INJURY cell could read "ir" or "inactive". Both now run the compact
 // designation through CF.injStatusLabel; descriptive prose
 // ("Hamstring — limited practice") passes through verbatim, never relabeled.
 const common=fs.readFileSync(path.join(__dirname,'..','js','common.js'),'utf8');
 assert.ok(common.includes('"inactive": "Inactive"'),'the shared map learns "inactive"');
 const payload={injuries:[{displayName:'Chicago Bears',injuries:[
  {athlete:{displayName:'IR Test LB',position:{abbreviation:'LB'}},status:'Out',date:'2026-09-25',shortComment:'ir',longComment:'ir'},
  {athlete:{displayName:'Inactive Test WR',position:{abbreviation:'WR'}},status:'Out',date:'2026-09-25',shortComment:'inactive',longComment:'inactive'},
  {athlete:{displayName:'Hammy Test CB',position:{abbreviation:'CB'}},status:'Questionable',date:'2026-09-25',shortComment:'Hamstring — limited practice',longComment:'The cornerback was limited in Friday practice with a hamstring injury and is listed as questionable.'}
 ]}]};
 const resp={ok:true,text:async()=>JSON.stringify(payload),json:async()=>payload};
 const fetchMock=async(u)=>u.pathname.endsWith('/injuries')?resp:undefined;
 // injuries.html: the INJURY cell of each report row.
 const p=await page('injuries',{fetch:fetchMock});try{
  const w=p.w;await settle(300);
  const rows=[...w.document.querySelectorAll('#report-table tbody tr')];
  assert.ok(rows.length>=3,'the report table paints the fixture rows');
  const cells=rows.map(r=>r.children[2]);
  assert.strictEqual(cells[0].textContent,'Injured Reserve','"ir" reads as Injured Reserve');
  assert.strictEqual(cells[1].textContent,'Inactive','"inactive" reads as Inactive');
  assert.strictEqual(cells[2].textContent,'Hamstring — limited practice','descriptive prose passes through verbatim');
  assert.ok(cells[2].getAttribute('title')&&cells[2].getAttribute('title').includes('questionable'),'the prose row keeps its long comment in the title tooltip');
  assert.ok(!cells[0].getAttribute('title'),'no tooltip when the short comment and long comment agree');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
 // index.html: the training-room LATEST UPDATE column.
 const q=await page('index',{fetch:fetchMock});try{
  const w=q.w;await settle(300);
  const rows=[...w.document.querySelectorAll('#home-injuries tbody tr')];
  assert.ok(rows.length>=3,'the home training-room table paints the fixture rows');
  const cells=rows.map(r=>r.children[2].textContent);
  assert.ok(cells.includes('Injured Reserve'),'"ir" never shows raw on the home table: '+cells.join(' | '));
  assert.ok(cells.includes('Inactive'),'"inactive" never shows raw on the home table: '+cells.join(' | '));
  assert.ok(!cells.some(c=>c==='ir'||c==='inactive'),'no raw feed codes remain in the LATEST UPDATE column');
  assert.deepEqual(q.errors,[]);
 }finally{q.close();}
 // Cache keys: common.js changed this release, so its key moves to v1.89.0 on
 // all 11 pages; only index.html and injuries.html carry the changed page
 // scripts. Footer branding survives.
 const ih=fs.readFileSync(path.join(__dirname,'..','injuries.html'),'utf8');
 assert.ok(ih.includes('js/injuries.js?v=1.94.0'),'injuries.html busts the injuries.js cache');
 assert.ok(ih.includes('js/common.js?v=1.97.0'),'injuries.html busts the common.js cache');
 const xh=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.ok(xh.includes('js/home.js?v=1.99.0'),'index.html busts the home.js cache');
 assert.ok(xh.includes('js/common.js?v=1.97.0'),'index.html busts the common.js cache');
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('js/common.js?v=1.97.0'),name+'.html carries the v1.97.0 common.js cache key');
  assert.ok(!/common\.js\?v=1\.(9[0-6]|8[0-9]|7[0-9]|[0-6][0-9])/.test(html),name+'.html has no stale common.js key');
  assert.ok(html.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
  assert.ok(html.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
 }
});

test('v1.90.0: the injury rail stacks like a callout on phones — no leftover sidebar edge',async()=>{
 // Fresh-eyes review (2026-09-29): on news.html and injuries.html the `.rail`
 // div sits in a 2-col grid that collapses to one column under 860px — but the
 // rail kept its desktop sidebar styling (3px orange left rule + 14px left
 // indent). On a phone that left edge reads as a layout glitch and eats scarce
 // width. Stacked, the rail keeps the orange identity as a top rule.
 const css=fs.readFileSync(path.join(__dirname,'..','css','main.css'),'utf8');
 const mq=css.match(/@media\s*\(max-width:\s*860px\)\s*\{[^}]*\.rail\s*\{[^}]*\}/s);
 assert.ok(mq,'an 860px media block carries the stacked .rail override');
 assert.ok(/border-left:\s*0/.test(mq[0]),'the leftover sidebar edge is removed (border-left: 0)');
 assert.ok(/padding-left:\s*0/.test(mq[0]),'the left indent is reclaimed (padding-left: 0)');
 assert.ok(/border-top:\s*3px solid var\(--orange\)/.test(mq[0]),'the orange identity thread moves to a top rule');
 assert.ok(/padding-top:\s*16px/.test(mq[0]),'the top rule gets breathing room (padding-top: 16px)');
 // The desktop rail rule itself is untouched.
 const desktop=css.match(/\.rail\s*\{\s*border-left:\s*3px solid var\(--orange\);\s*padding-left:\s*14px;\s*\}/s);
 assert.ok(desktop,'the desktop sidebar rail treatment survives unchanged');
 // Both rails live inside grids that stack at 860px.
 assert.ok(/#news-grid,\s*#injury-grid\s*\{\s*grid-template-columns:\s*1fr !important/.test(css),'both rail grids still collapse under 860px');
 // The stylesheet changed, so every page must carry the fresh cache key —
 // a stale key would serve CSS where the phone rail still leans on the sidebar edge.
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('css/main.css?v=1.97.0'),name+'.html carries the v1.97.0 main.css cache key');
  assert.ok(!/main\.css\?v=1\.(96\.0|95\.0|94\.0|93\.0|92\.0|91\.0|90\.0|82\.0|7[0-7])/.test(html),name+'.html has no stale main.css key');
 }
 // Footer branding must survive the release.
 const common=fs.readFileSync(path.join(__dirname,'..','js','common.js'),'utf8');
 assert.ok(common.includes('3GnR7TWBXAB3pPztBWpNF4LMNEX5yX8vZK'),'the BTC tip chip address survives in common.js');
});

test('v1.91.0: touch users get 16px fields — no iOS auto-zoom on form controls',async()=>{
 // Fresh-eyes review (2026-09-29): iOS Safari zooms the viewport whenever a
 // focused input is under 16px. The roster search + position filter
 // (13.5px), the board date-picker (13px), and the Odds API key field (13px)
 // all sat under that line, so every iPhone fan who tapped one got yanked
 // into a zoomed view and had to pinch back out. Under a coarse pointer the
 // fields now render at 16px; the desktop type scale is untouched.
 const css=fs.readFileSync(path.join(__dirname,'..','css','main.css'),'utf8');
 const mq=css.match(/@media\s*\(pointer:\s*coarse\)\s*\{([\s\S]*?)\n\}/);
 assert.ok(mq,'a coarse-pointer media block carries the touch field-size override');
 const block=mq[0];
 for(const sel of ['\\.roster-controls input','\\.roster-controls select','input\\[type="date"\\]','\\.key-box input']){
  assert.ok(new RegExp(sel).test(block),sel+' is covered by the touch override');
 }
 assert.ok(/font-size:\s*16px/.test(block),'the touch override sets 16px (the iOS no-zoom line)');
 // The desktop declarations keep their designed sizes.
 assert.ok(/\.roster-controls input,\s*\.roster-controls select\s*\{[^}]*font-size:\s*13\.5px/.test(css),'the desktop roster controls stay 13.5px');
 assert.ok(/input\[type="date"\]\s*\{[^}]*font-size:\s*13px/.test(css),'the desktop date picker stays 13px');
 assert.ok(/\.key-box input\s*\{[^}]*font-size:\s*13px/.test(css),'the desktop key field stays 13px');
 // The stylesheet changed, so every page must carry the fresh cache key —
 // a stale key would serve CSS where iPhone fields still trigger the zoom.
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('css/main.css?v=1.97.0'),name+'.html carries the v1.97.0 main.css cache key');
  assert.ok(!/main\.css\?v=1\.(96\.0|95\.0|94\.0|93\.0|92\.0|91\.0|90\.0)/.test(html),name+'.html has no stale main.css key');
 }
 // Footer branding must survive the release.
 const common=fs.readFileSync(path.join(__dirname,'..','js','common.js'),'utf8');
 assert.ok(common.includes('3GnR7TWBXAB3pPztBWpNF4LMNEX5yX8vZK'),'the BTC tip chip address survives in common.js');
});

test('v1.92.0: dead buttons admit it — disabled .btn/.text-button stop looking live',async()=>{
 // Fresh-eyes review (2026-09-29): the hero "Make your call" toggle and the
 // odds "Load full board" button both spend time disabled (during loads; the
 // toggle also stays disabled when the schedule feed has no matchup for it),
 // but nothing in the stylesheets said so — they looked fully clickable while
 // silently swallowing clicks. Now a disabled .btn flattens to a muted,
 // no-lift, no-glow state (the primary orange cools to a dead ember), and the
 // ghost-style .text-button drops to dimmed steel-blue.
 const main=fs.readFileSync(path.join(__dirname,'..','css','main.css'),'utf8');
 const exp=fs.readFileSync(path.join(__dirname,'..','css','experience.css'),'utf8');
 const btnDis=main.match(/\.btn:disabled,\s*\.btn\[disabled\]\s*\{[^}]*\}/s);
 assert.ok(btnDis,'main.css carries a disabled .btn rule');
 assert.ok(/cursor:\s*not-allowed/.test(btnDis[0]),'the disabled .btn refuses the pointer');
 assert.ok(/box-shadow:\s*none/.test(btnDis[0]),'the disabled .btn kills the glow');
 const btnDisHover=main.match(/\.btn:disabled:hover[^{]*\{[^}]*\}/s);
 assert.ok(btnDisHover,'main.css pins the disabled .btn hover state');
 assert.ok(/transform:\s*none/.test(btnDisHover[0]),'the disabled .btn never lifts on hover');
 const btnDisPrim=main.match(/\.btn\.primary:disabled[^{]*\{[^}]*\}/s);
 assert.ok(btnDisPrim,'main.css cools the disabled primary .btn');
 assert.ok(!/linear-gradient\(135deg,\s*var\(--orange\)/.test(btnDisPrim[0]),'the disabled primary is no longer the live orange gradient');
 const txtDis=exp.match(/\.text-button:disabled,\s*\.text-button\[disabled\]\s*\{[^}]*\}/s);
 assert.ok(txtDis,'experience.css carries a disabled .text-button rule');
 assert.ok(/cursor:\s*not-allowed/.test(txtDis[0]),'the disabled .text-button refuses the pointer');
 assert.ok(/color:\s*rgba\(150,\s*178,\s*205,\s*0\.42\)/.test(txtDis[0]),'the disabled .text-button drops to dimmed steel-blue');
 // The wire-up still disables at the right moments — the affordance only
 // styles what the JS already does.
 const home=fs.readFileSync(path.join(__dirname,'..','js','home.js'),'utf8');
 assert.ok(/prediction-toggle"\)\.disabled\s*=/.test(home),'home.js still disables the prediction toggle');
 const odds=fs.readFileSync(path.join(__dirname,'..','js','odds.js'),'utf8');
 assert.ok(/odds-key-go"\)\.disabled\s*=\s*true/.test(odds),'odds.js still disables the full-board button during fetch');
 // Both stylesheets changed, so every page must carry the fresh cache keys —
 // a stale key would serve CSS where dead buttons still look live.
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('css/main.css?v=1.97.0'),name+'.html carries the v1.97.0 main.css cache key');
  assert.ok(html.includes('css/experience.css?v=1.105.0'),name+'.html carries the v1.101.0 experience.css cache key');
  assert.ok(!/main\.css\?v=1\.(96|95|94|93|92|91)\.0/.test(html),name+'.html has no stale main.css key');
  assert.ok(!/experience\.css\?v=1\.(100|101|102|85|92|99)\.0"/.test(html),name+'.html has no stale experience.css key');
  assert.ok(html.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
  assert.ok(html.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
 }
 // Footer branding must survive the release.
 const common=fs.readFileSync(path.join(__dirname,'..','js','common.js'),'utf8');
 assert.ok(common.includes('3GnR7TWBXAB3pPztBWpNF4LMNEX5yX8vZK'),'the BTC tip chip address survives in common.js');
});

test('v1.93.0: the kickoff countdown digits hold still — tabular-nums on the hero countdown',()=>{
 // Fresh-eyes review (2026-09-29): the home hero "Next up" card re-renders
 // its kickoff countdown every second (js/home.js setInterval), but the
 // digits sat in Oswald — a condensed proportional face — with no
 // font-variant-numeric, so every tick visibly jittered the numerals inside
 // their units. The most-viewed live animation on the site read nervous
 // instead of premium. One line of CSS steadies it, matching the tabular-nums
 // treatment the desk-countdown pill and season-strip numbers already carry.
 const main=fs.readFileSync(path.join(__dirname,'..','css','main.css'),'utf8');
 const unit=main.match(/\.countdown \.unit b\s*\{[^}]*\}/s);
 assert.ok(unit,'main.css carries a .countdown .unit b rule');
 assert.ok(/font-family:\s*var\(--display\)/.test(unit[0]),'the countdown digits keep the Oswald display face');
 assert.ok(/font-variant-numeric:\s*tabular-nums/.test(unit[0]),'the countdown digits get tabular figures');
 // The re-render cadence is untouched — the fix is presentation only.
 const home=fs.readFileSync(path.join(__dirname,'..','js','home.js'),'utf8');
 assert.ok(/setInterval\(renderCountdown,\s*1000\)/.test(home),'home.js still ticks the countdown every second');
 // The stylesheet changed, so every page must carry the fresh cache key —
 // a stale key would serve CSS where the countdown digits still jitter.
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('css/main.css?v=1.97.0'),name+'.html carries the v1.97.0 main.css cache key');
  assert.ok(!/main\.css\?v=1\.(96|95|94|93|92|91)\.0/.test(html),name+'.html has no stale main.css key');
  assert.ok(html.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
  assert.ok(html.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
 }
 // Footer branding must survive the release.
 const common=fs.readFileSync(path.join(__dirname,'..','js','common.js'),'utf8');
 assert.ok(common.includes('3GnR7TWBXAB3pPztBWpNF4LMNEX5yX8vZK'),'the BTC tip chip address survives in common.js');
});

test('v1.94.0: live pills carry data-freshness stamps — source AND when it was read',async()=>{
 // Fresh-eyes review (2026-09-29): every live surface refreshes on a timer,
 // but the section pills only named the source ("live", "snapshot") — never
 // when the numbers were last read, so a fan couldn't tell a line refreshed
 // 10 seconds ago from one rendered an hour ago. CF.freshStamp keeps the
 // pill's existing label and appends a dim, tabular-nums "· 42s ago" stamp,
 // re-read by one shared 15s ticker (text-only, no fetches, reduced-motion
 // safe); the exact wall-clock rides in the title tooltip. Offline/error
 // pills keep their plain honest text — the stamp is success-only.
 const common=fs.readFileSync(path.join(__dirname,'..','js','common.js'),'utf8');
 assert.ok(/CF\.freshStamp\s*=/.test(common),'common.js carries the CF.freshStamp helper');
 const main=fs.readFileSync(path.join(__dirname,'..','css','main.css'),'utf8');
 const stampRule=main.match(/\.fresh-stamp\s*\{[^}]*\}/s);
 assert.ok(stampRule,'main.css carries the .fresh-stamp rule');
 assert.ok(/font-variant-numeric:\s*tabular-nums/.test(stampRule[0]),'the stamp uses tabular figures like the countdown digits');
 assert.ok(/color:\s*var\(--text-dim\)/.test(stampRule[0]),'the stamp drops to the ice-dim tone so the source label keeps the accent');
 // Helper contract, direct: label survives, the stamp ticks in, exact time
 // lands in the tooltip, and a null pill is a no-op (never a crash).
 const p=await page('index');try{const w=p.w;
  assert.equal(typeof w.CF.freshStamp,'function','CF.freshStamp is exposed');
  w.CF.freshStamp(null,'live',w.Date.now());
  const el=w.document.createElement('span');el.className='pill ok';
  w.CF.freshStamp(el,'live · wire',w.Date.now());
  assert.match(el.textContent,/live · wire/,'the source label survives the stamp');
  assert.match(el.textContent,/ago/,'the stamp reads as a relative age');
  const stamp=el.querySelector('.fresh-stamp');
  assert.ok(stamp,'the stamp rides inside the pill as its own span');
  assert.equal(stamp.getAttribute('aria-hidden'),'true','the ticking span stays out of the screen-reader chatter');
  assert.match(stamp.getAttribute('title'),/^read /,'the exact wall-clock rides in the title tooltip');
 }finally{p.close();}
 // Integration: the fixture renders stamp every success pill on the live
 // surfaces, and nothing on the failure paths.
 const g=await page('games');try{const d=g.w.document;
  for(const id of ['#board-pill','#log-pill','#div2-pill']){
   const pill=d.querySelector(id);
   assert.ok(pill&&pill.querySelector('.fresh-stamp'),id+' carries a freshness stamp: '+(pill?pill.textContent:'missing'));
   assert.match(pill.textContent,/ago/,id+' reads as a relative age');
  }
 }finally{g.close();}
 const o=await page('odds');try{const d=o.w.document;
  assert.ok(d.querySelector('#poly-pill'),'the Polymarket header carries its own pill');
  assert.ok(d.querySelector('#poly-pill .fresh-stamp'),'the Polymarket pill carries a freshness stamp');
 }finally{o.close();}
 const n=await page('news');try{const d=n.w.document;
  const pill=d.querySelector('#feed-pill');
  assert.ok(pill&&pill.querySelector('.fresh-stamp'),'the news feed pill carries a freshness stamp');
  assert.ok(!d.querySelector('#feed-updated'),'the redundant Checked-clock span is gone from news.html');
 }finally{n.close();}
 // Changed assets are cache-busted everywhere they load — a stale key would
 // serve CSS without the stamp rule or JS that never paints one.
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('css/main.css?v=1.97.0'),name+'.html carries the v1.97.0 main.css cache key');
  assert.ok(html.includes('js/common.js?v=1.97.0'),name+'.html carries the v1.97.0 common.js cache key');
  assert.ok(!/main\.css\?v=1\.(96\.0|95\.0|94\.0|93\.0|92\.0|91\.0|90\.0|82\.0|7[0-7])/.test(html),name+'.html has no stale main.css key');
  assert.ok(!/common\.js\?v=1\.(9[0-6]|8[0-9]|7[0-9]|[0-6][0-9])/.test(html),name+'.html has no stale common.js key');
  assert.ok(html.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
  assert.ok(html.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
 }
 const locks=[['odds.html','js/odds.js?v=1.95.0'],['games.html','js/games.js?v=1.102.0'],
              ['index.html','js/home.js?v=1.99.0'],['injuries.html','js/injuries.js?v=1.94.0'],
              ['news.html','js/news.js?v=1.94.0']];
 for(const [file,key] of locks){
  const html=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
  assert.ok(html.includes(key),file+' carries its page-script cache key: '+key);
 }
 // Footer branding must survive the release.
 assert.ok(common.includes('3GnR7TWBXAB3pPztBWpNF4LMNEX5yX8vZK'),'the BTC tip chip address survives in common.js');
});

test('v1.95.0: the odds ↻ button admits when it\'s working — disables, spins, pills say so',async()=>{
 // The ↻ Refresh button fired both loaders with zero feedback and stayed
 // clickable mid-flight, so spam clicks stacked concurrent renders; the
 // Polymarket pill never said "checking…" either. Both loaders now funnel
 // through refreshOdds: the button disables (v1.92.0's honest affordance),
 // flips to a spinning "Checking…", and repeat/overlapping refreshes stand
 // down until both loaders settle.
 const css=fs.readFileSync(path.join(__dirname,'..','css','main.css'),'utf8');
 assert.ok(css.includes('@keyframes cfBusySpin'),'the busy-spin keyframes exist');
 assert.ok(/#odds-refresh \.cf-spin\s*\{[^}]*animation:\s*cfBusySpin/.test(css),'the refresh glyph spins while busy');
 assert.ok(/prefers-reduced-motion: reduce\)\s*\{\s*#odds-refresh \.cf-spin\s*\{\s*animation:\s*none/.test(css),'reduced motion gets the static label');
 const odds=fs.readFileSync(path.join(__dirname,'..','js','odds.js'),'utf8');
 assert.ok(odds.includes('function refreshOdds()'),'odds.js funnels refreshes through refreshOdds');
 assert.ok(odds.includes('function setOddsBusy(busy)'),'odds.js carries the busy-state switch');
 assert.ok(odds.includes('Promise.allSettled([loadWireOdds(), loadPoly()])'),'both loaders settle before the button wakes');
 assert.ok(odds.includes('CF.refresh.register(refreshOdds, 60e3)'),'the 60s auto-beat funnels through the same guard');
 assert.ok(odds.includes('btn.setAttribute("aria-busy"'),'the busy state is announced to assistive tech');
 // Behavioral: hold the Polymarket feed for 400ms so the refresh is
 // observably in flight (page() itself settles 50ms after DOMContentLoaded).
 const wait=400;
 const p=await page('odds',{fetch:async u=>{
  if(u.hostname==='gamma-api.polymarket.com'&&u.pathname.includes('/events/keyset')){
   await settle(wait);
   const body='{"events":[]}';
   return {ok:true,json:async()=>JSON.parse(body),text:async()=>body};
  }
 }});
 try{
  const btn=p.w.document.querySelector('#odds-refresh');
  assert.equal(btn.disabled,true,'the button disables while the feeds are in flight');
  assert.equal(btn.getAttribute('aria-busy'),'true','aria-busy is set in flight');
  assert.ok(/Checking/.test(btn.textContent),'the button reads Checking… in flight: '+btn.textContent);
  assert.ok(btn.querySelector('.cf-spin'),'the spinning glyph rides inside the busy label');
  assert.equal(p.w.document.querySelector('#poly-pill').textContent,'checking…','the Polymarket pill says checking… in flight');
  await settle(wait+300);
  assert.equal(btn.disabled,false,'the button wakes when both loaders settle');
  assert.equal(btn.getAttribute('aria-busy'),'false','aria-busy clears after the refresh');
  assert.equal(btn.textContent.trim(),'↻ Refresh','the label restores after the refresh: '+btn.textContent);
  assert.equal(p.w.document.querySelector('#poly-pill').textContent,'Polymarket · no Bears markets','the pill lands on an honest empty label, not a stuck checking…');
  // A manual click re-enters the busy state and releases again.
  btn.click();
  await settle(50);
  assert.equal(btn.disabled,true,'a manual refresh disables the button while in flight');
  await settle(wait+300);
  assert.equal(btn.disabled,false,'the manual refresh releases the button');
 }finally{p.close();}
 // The two changed assets are cache-busted everywhere they load; nothing
 // else moves. Footer branding survives.
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('css/main.css?v=1.97.0'),name+'.html carries the v1.97.0 main.css cache key');
  assert.ok(!/main\\.css\\?v=1\\.(96\\.0|95\\.0|94\\.0|93\\.0|92\\.0|91\\.0|90\\.0|82\\.0|7[0-7])/.test(html),name+'.html has no stale main.css key');
 }
 const ohtml=fs.readFileSync(path.join(__dirname,'..','odds.html'),'utf8');
 assert.ok(ohtml.includes('js/odds.js?v=1.95.0'),'odds.html carries the v1.95.0 odds.js cache key');
 assert.ok(!/odds\\.js\\?v=1\\.(9[0-4]|8[0-9]|7[0-9]|6[0-9]|5[0-9]|[0-4][0-9])/.test(ohtml),'odds.html has no stale odds.js key');
 assert.ok(ohtml.includes('@kshot9000'),'the @kshot9000 attribution survives on odds.html');
 assert.ok(ohtml.includes('data-cf-copy="btc"'),'the BTC tip chip survives on odds.html');
});

test('v1.96.0: the weather strip says when the front was read — live wall-clock, cached age',async()=>{
 // The strip above the fold on every page re-reads the front every 10
 // minutes, but #wx-now never named WHEN the numbers were read — a fan
 // couldn't tell a two-minute-old reading from one that predates the morning
 // commute. Both weather loaders now stamp wx.readAt, and CF.wxReadStamp
 // paints the stamp: a dim wall-clock ("read 10:00 PM CDT") on live reads,
 // the reading's age ("cached 5m ago") on offline cache reads, in the same
 // relative-age vocabulary as the v1.94.0 pill stamps. Old cache entries
 // without a readAt keep the bare "cached" label rather than an invented age.
 const common=fs.readFileSync(path.join(__dirname,'..','js','common.js'),'utf8');
 assert.ok(/CF\.wxReadStamp\s*=/.test(common),'common.js carries the CF.wxReadStamp helper');
 assert.equal((common.match(/wx\.readAt\s*=\s*Date\.now\(\)/g)||[]).length,2,'both weather loaders stamp the read moment');
 // Behavioral, live path: the strip names its read time in #wx-now.
 const p=await page('index');try{const w=p.w;
  await settle(150);
  const now=w.document.querySelector('#wx-now');
  assert.ok(now,'the weather strip renders the now line');
  assert.match(now.textContent,/read 10:00 PM CDT/,'the live strip names its read time: '+now.textContent);
  assert.ok(/57°F/.test(now.textContent),'the live numbers still render: '+now.textContent);
  const stamp=now.querySelector('[aria-hidden="true"]');
  assert.ok(stamp,'the read stamp stays out of the screen-reader chatter, matching the v1.94.0 stamps');
 }finally{p.close();}
 // Behavioral, offline path: a cached read names the reading's age.
 const fixedNow=+new Date('2026-09-26T03:00:00Z');
 const stored={ts:fixedNow-5*60e3,ttl:600e3,data:{tempC:14,feelsC:12,wind:16,gusts:null,humidity:null,
   code:0,phrase:null,time:null,snowProb:null,snowCm:null,daily:null,source:'open-meteo',
   readAt:fixedNow-5*60e3,gauge:null}};
 const q=await page('index',{offline:true,storage:{'cf.weather':JSON.stringify(stored)}});
 try{const w=q.w;
  await settle(150);
  const now=w.document.querySelector('#wx-now');
  assert.ok(now,'the offline weather strip renders the now line');
  assert.match(now.textContent,/cached 5m ago/,'the cached strip names the reading\'s age: '+now.textContent);
  assert.ok(!/read 10:00 PM/.test(now.textContent),'the cached read never claims a fresh wall-clock: '+now.textContent);
 }finally{q.close();}
 // Both changed this release: both are cache-busted everywhere they load,
 // footer branding survives. Pins roll forward with the release (v1.97.0).
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('js/common.js?v=1.97.0'),name+'.html carries the v1.97.0 common.js cache key');
  assert.ok(!/common\.js\?v=1\.(9[0-6]|8[0-9]|7[0-9]|[0-6][0-9])/.test(html),name+'.html has no stale common.js key');
  assert.ok(html.includes('css/main.css?v=1.97.0'),name+'.html holds the v1.97.0 main.css cache key');
  assert.ok(html.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
  assert.ok(html.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
 }
 assert.ok(common.includes('3GnR7TWBXAB3pPztBWpNF4LMNEX5yX8vZK'),'the BTC tip chip address survives in common.js');
});

test('v1.97.0: the nav toggle is a real SVG hamburger→✕ morph, and the front door names its theme color',async()=>{
 // The ☰/✕ toggle was a text glyph swapped via textContent: on several
 // Android skins and desktop Linux builds it rendered as a blurry emoji-ish
 // block, and the celebrated "morph" was just a 90° rotation of the glyph.
 // The mark is now an inline SVG whose bars inherit currentColor (orange
 // closed, white on the hot-orange open button) and truly morph: the outer
 // bars swing to meet and cross while the middle collapses. common.js no
 // longer writes textContent — the open state is pure CSS off body.nav-open,
 // with the morph gated on reduced motion. Also: index.html and 404.html
 // were the only pages missing <meta name="theme-color">, so mobile browser
 // chrome clashed with the brand on the two front-door pages.
 const common=fs.readFileSync(path.join(__dirname,'..','js','common.js'),'utf8');
 assert.ok(!/toggle\.textContent\s*=/.test(common),'common.js no longer swaps the toggle via textContent');
 assert.ok(/setAttribute\("aria-expanded", "true"\)/.test(common),'the open state is still announced');
 assert.ok(/setAttribute\("aria-label", "Close menu"\)/.test(common),'the close action is still labeled');
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  const m=html.match(/<button class="nav-toggle"[^>]*>([\s\S]*?)<\/button>/);
  assert.ok(m,name+'.html has a nav toggle');
  assert.ok(/<svg class="nt-icon"/.test(m[1]),name+'.html toggle carries the SVG icon');
  assert.ok(!/☰/.test(m[1]),name+'.html toggle has no text glyph left');
  assert.ok(html.includes('js/common.js?v=1.97.0'),name+'.html carries the v1.97.0 common.js cache key');
  assert.ok(!/common\.js\?v=1\.(9[0-6]|8[0-9]|7[0-9]|[0-6][0-9])/.test(html),name+'.html has no stale common.js key');
  assert.ok(html.includes('css/main.css?v=1.97.0'),name+'.html carries the v1.97.0 main.css cache key');
  assert.ok(!/main\.css\?v=1\.(96\.0|95\.0|94\.0|93\.0|92\.0|91\.0|90\.0|82\.0|7[0-7])/.test(html),name+'.html has no stale main.css key');
  assert.ok(/<meta name="theme-color" content="#060d18">/.test(html),name+'.html names the brand theme color');
  assert.ok(html.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
  assert.ok(html.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
 }
 assert.ok(common.includes('3GnR7TWBXAB3pPztBWpNF4LMNEX5yX8vZK'),'the BTC tip chip address survives in common.js');
});

test('v1.98.0: the hero rotator layers are pre-composed for their viewport — no raw portrait in the desktop rotation',async()=>{
 // The third hero layer used the raw 1400x1867 portrait soldier-field-dark.webp
 // as its desktop src, so every ~14s the front door crossfaded from composed
 // landscape vistas into a thin CSS-cropped slice of the same stadium. Layer 2
 // now points at an art-directed 1600x928 "gate" crop (dome sweep over the
 // colonnade and gate 6) derived from that source; the portrait survives only
 // as the mobile <source>, where the tall mobile hero suits it.
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 const layers=[...html.matchAll(/<picture class="hero-layer[^"]*"[^>]*>([\s\S]*?)<\/picture>/g)];
 assert.equal(layers.length,3,'the hero rotator still has three layers');
 layers.forEach((m,i)=>{
  const img=m[1].match(/<img[^>]*src="([^"]+)"[^>]*width="(\d+)"[^>]*height="(\d+)"/);
  assert.ok(img,'layer '+i+' has a sized desktop img');
  assert.ok(+img[2]>=+img[3],'layer '+i+' desktop art is landscape ('+img[2]+'x'+img[3]+') — no portrait slice in the rotation');
  assert.ok(fs.existsSync(path.join(__dirname,'..',img[1])),'layer '+i+' desktop art exists on disk: '+img[1]);
 });
 const l2=layers[2][1];
 assert.ok(/src="img\/hero-soldier-gate-desk\.webp"/.test(l2),'layer 2 desktop art is the gate crop');
 assert.ok(!/src="img\/soldier-field-dark\.webp"/.test(l2),'layer 2 no longer serves the raw portrait on desktop');
 assert.ok(/srcset="img\/soldier-field-dark-sm\.webp"/.test(l2),'layer 2 keeps the portrait source for the tall mobile hero');
 assert.ok(html.includes('@kshot9000'),'the @kshot9000 attribution survives on index.html');
 assert.ok(html.includes('data-cf-copy="btc"'),'the BTC tip chip survives on index.html');
});

test('v1.99.0: the hero card stops lying about finals — kicker follows game state, bear chip leaves the digits',async()=>{
 // Fresh-eyes live QA (2026-09-29): the hero next-game card read "NEXT UP ·
 // CHICAGO BEARS" while its own pill read "BEARS WIN · Final" for yesterday's
 // game — a self-contradiction in the hero's credibility anchor. The kicker
 // now follows the game state (Next up / Live now / Last result). The same
 // review caught the 🐻 identity chip sitting directly on top of the score
 // digits: the matchup rows stack vertically and left-aligned, so the
 // absolute left:0/top:50% chip overlapped the "27". The chip now rides in
 // flow above the Bears' abbreviation and can never touch the digits.
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.ok(html.includes('<span id="ng-kicker">Next up · Chicago Bears</span>'),'the kicker is addressable and defaults to the next-game voice');
 const js=fs.readFileSync(path.join(__dirname,'..','js','home.js'),'utf8');
 assert.ok(/ng-kicker/.test(js),'home.js paints the kicker');
 assert.ok(/Last result · Chicago Bears/.test(js),'a final flips the kicker to "Last result"');
 assert.ok(/Live now · Chicago Bears/.test(js),'a live game flips the kicker to "Live now"');
 const css=fs.readFileSync(path.join(__dirname,'..','css','experience.css'),'utf8');
 const chip=css.match(/\.match-card \.bears-chip\s*\{[^}]*\}/s);
 assert.ok(chip,'the .match-card .bears-chip block exists');
 assert.ok(/position:\s*static/.test(chip[0]),'the chip left the absolute layer (position:static)');
 assert.ok(!/position:\s*absolute/.test(chip[0]),'no absolute positioning remains on the chip');
 assert.ok(/display:\s*none/.test(chip[0]),'the chip still hides until the Bears side claims it');
 assert.ok(/\.match-card \.side\.is-bears \.bears-chip\s*\{\s*display:\s*block/s.test(css),'the Bears side still reveals the identity chip');
 // Behavioral: a pre-game card reads "Next up", a final reads "Last result".
 const p=await page('index');try{
  assert.equal(p.w.document.querySelector('#ng-kicker').textContent,'Next up · Chicago Bears','the pre-game kicker names the next game');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
 const q=await page('index',{fetch:async(u)=>{
  if(u.pathname.endsWith('/scoreboard')){
   const data={events:[event('100','CHI','MIN','post','2026-09-20T17:00:00Z',24,17)]};
   return {ok:true,text:async()=>JSON.stringify(data),json:async()=>data};
  }
 }});try{
  const d=q.w.document;
  assert.equal(d.querySelector('#ng-kicker').textContent,'Last result · Chicago Bears','the final kicker never says "Next up" about a finished game');
  assert.match(d.querySelector('#ng-pill').textContent,/BEARS WIN/,'the pill still names the win beside the honest kicker');
  const chipEl=d.querySelector('#ng-home-abbr').closest('.side').querySelector('.bears-chip');
  const pos=q.w.getComputedStyle(chipEl).position;
  assert.equal(pos,'static','the painted bear chip is in flow, never over the digits');
  assert.deepEqual(q.errors,[]);
 }finally{q.close();}
 // The stylesheet and page script changed, so the fresh keys ride everywhere.
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const h=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(h.includes('css/experience.css?v=1.105.0'),name+'.html carries the v1.101.0 experience.css cache key');
  assert.ok(!/experience\.css\?v=1\.(10[012]|9[0-9]|8[0-9]|7[0-9]|[0-6][0-9])\.0"/.test(h),name+'.html has no stale experience.css key');
  assert.ok(h.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
  assert.ok(h.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
 }
 assert.ok(html.includes('js/home.js?v=1.99.0'),'index.html carries the v1.99.0 home.js cache key');
 assert.ok(html.includes('3GnR…8vZK'),'the BTC tip chip address survives in the footer');
});

test('v1.101.0: the hero CTAs stack on narrow phones — no more squished two-line buttons',async()=>{
 // Live QA (2026-09-29) caught the front-door CTAs at 390px as two 173px
 // buttons squeezed side-by-side by the 440px "flex:1" rule, so "ENTER GAME
 // CENTER" and "CATCH THE LATEST" each wrapped to two lines (measured 66px
 // tall). Under 440px the actions now stack vertically, full-width, with
 // nowrap — two clean single-line tap targets in the ESPN/Apple mobile
 // pattern. Desktop and tablet keep the side-by-side row.
 const css=fs.readFileSync(path.join(__dirname,'..','css','experience.css'),'utf8');
 const mob=css.match(/@media \(max-width:440px\)\s*\{([\s\S]*?)\n\}\n@media \(prefers-reduced-motion:reduce\)/);
 assert.ok(mob,'the 440px narrow-phone block exists');
 const block=mob[1];
 assert.ok(/\.hero-actions\s*\{[^}]*flex-direction:\s*column/s.test(block),'on narrow phones the hero actions stack vertically');
 assert.ok(/\.hero-actions\s*\{[^}]*align-items:\s*stretch/s.test(block),'the stacked actions stretch full-width');
 assert.ok(/\.hero-actions \.btn\s*\{[^}]*width:\s*100%/s.test(block),'each CTA takes the full row width');
 assert.ok(/\.hero-actions \.btn\s*\{[^}]*white-space:\s*nowrap/s.test(block),'the CTA labels can never wrap mid-glyph — single line each');
 assert.ok(!/\.hero-actions \.btn\s*\{[^}]*flex:\s*1[^0-9]/s.test(block),'the old flex:1 squeeze that caused the wrap is gone');
 // Desktop base rule untouched: the row still wraps side-by-side up top.
 const base=css.split('@media')[0];
 assert.ok(/\.hero-actions\s*\{[^}]*display:\s*flex[^}]*flex-wrap:\s*wrap/s.test(base),'desktop keeps the side-by-side flex-wrap row');
 // The stylesheet changed, so the fresh key rides everywhere, with branding intact.
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const h=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(h.includes('css/experience.css?v=1.105.0'),name+'.html carries the v1.101.0 experience.css cache key');
  assert.ok(!/experience\\.css\\?v=1\\.(10[012]\\.0|99\\.0|9[0-9]\\.0|8[0-9]\\.0|7[0-9]\\.0|[0-6][0-9]\\.0)/.test(h),name+'.html has no stale experience.css key');
  assert.ok(h.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
  assert.ok(h.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
 }
 const fh=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.ok(fh.includes('3GnR…8vZK'),'the BTC tip chip address survives in the footer');
});

test('v1.102.0: the box-score card gets a real scoreboard header — the score is the headline',async()=>{
 // Live QA (2026-09-29) showed the box-score card's score as a small 15px
 // inline line ("Green Bay Packers 17 · Chicago Bears 24 (Soldier Field)")
 // that a scanning fan could miss — a box score's #1 job is the score.
 // loadBoxscore now builds a scoreboard duel in the family .duel language:
 // away left, home right, the final in display numerals (.box-num), the
 // winner's number in the orange identity glow (.win), the Bears side in the
 // .bears treatment with the 🐻 chip, venue parked in the mid. Pre-game shows
 // em-dash numerals (.tbd). The visual duel is aria-hidden; an sr-only
 // sentence carries the same facts. Leaders rows gain the v1.39.0 glyph
 // chips (ld-cat/ld-glyph) for family consistency with the stats page, and
 // the error state uses CF.emptyHTML instead of raw markup.
 const js=fs.readFileSync(path.join(__dirname,'..','js','games.js'),'utf8');
 assert.ok(js.includes('duel box-duel'),'the box score builds a scoreboard duel');
 assert.ok(js.includes('box-num'),'the score renders in display numerals');
 assert.ok(js.includes('" win"'),'the winner\'s number carries the identity glow');
 assert.ok(js.includes('box-num')&&/tbd/.test(js),'pre-game shows em-dash numerals');
 assert.ok(js.includes('duel-bear'),'the Bears side wears the 🐻 identity chip');
 assert.ok(js.includes('sr-only'),'the duel facts survive as sr-only text for assistive tech');
 assert.ok(js.includes('aria-hidden="true"'),'the visual duel is hidden from assistive tech');
 assert.ok(js.includes('ld-cat')&&js.includes('ld-glyph'),'leaders rows carry the family glyph chips');
 assert.ok(js.includes('pill live'),'a live game gets the pulsing live pill, not a flat default');
 assert.ok(js.includes('CF.emptyHTML({ icon: "📋", title: "Box score unavailable"'),'the error state uses CF.emptyHTML');
 // The stylesheet carries the duel styles; the fresh keys ride everywhere.
 const css=fs.readFileSync(path.join(__dirname,'..','css','experience.css'),'utf8');
 assert.ok(/\.box-num\s*\{[^}]*font-family:\s*var\(--display\)/s.test(css),'the score numerals use the display typeface');
 assert.ok(/\.box-num\.win\s*\{[^}]*#ffa76b/s.test(css),'the winner glows orange');
 assert.ok(/\.box-num\.tbd\s*\{[^}]*var\(--text-dim\)/s.test(css),'pre-game numerals recede');
 assert.ok(/\.box-venue\s*\{/.test(css),'the venue has a mid-column home');
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const h=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(h.includes('css/experience.css?v=1.105.0'),name+'.html carries the v1.102.0 experience.css cache key');
  assert.ok(!/experience\.css\?v=1\.(10[012]|9[0-9]|8[0-9]|7[0-9]|[0-6][0-9])\.0"/.test(h),name+'.html has no stale experience.css key');
  assert.ok(h.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
  assert.ok(h.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
 }
 const gh=fs.readFileSync(path.join(__dirname,'..','games.html'),'utf8');
 assert.ok(gh.includes('js/games.js?v=1.102.0'),'games.html carries the v1.102.0 games.js cache key');
 assert.ok(!/games\.js\?v=1\.(10[01]|9[0-9]|8[0-9]|7[0-9]|[0-6][0-9])\.0"/.test(gh),'games.html has no stale games.js key');
 const fh=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.ok(fh.includes('3GnR…8vZK'),'the BTC tip chip address survives in the footer');
});

test('v1.103.0: games.html carries one photo-band — the stacked Navy Pier band is gone',async()=>{
 // The games page was the only one with two decorative photo-bands stacked
 // back-to-back (~600px of atmosphere before the Sunday desk card). Every
 // other page has exactly one; the second (Navy Pier) band added nothing the
 // Soldier Field band didn't already say, so the Sunday desk now sits ~300px
 // higher. Pure markup deletion — no stylesheet or script changes.
 const p=await page('games');try{
  const bands=p.w.document.querySelectorAll('main .photo-band');
  assert.equal(bands.length,1,'games.html has exactly one photo-band');
  assert.ok(bands[0].classList.contains('soldier'),'the surviving band is the Soldier Field one');
  assert.equal(p.w.document.querySelectorAll('main .photo-band.navy-pier').length,0,'the Navy Pier band is gone');
  assert.ok(!/Ferris glow/.test(p.w.document.querySelector('main').textContent),'the Ferris-glow copy is gone with it');
  assert.ok(p.w.document.querySelector('#next-opp'),'the Sunday desk card still leads the content');
  assert.ok(p.w.document.querySelector('.photo-band-copy p'),'the surviving band keeps its fan-facing copy');
 }finally{p.close();}
});

test('v1.104.0: the snow pill rides above the footer instead of parking on the tip chip',async()=>{
 // Live QA (2026-09-29) caught the desktop "Snow on" pill overlapping the
 // footer "Tip the build · BTC" chip at the page bottom: both live at the
 // viewport's bottom-right, so the pill buried the chip's Copy label. The
 // pill now measures, on every scroll/resize, the overlap between its own
 // bottom edge and the footer's top edge, and lifts by overlap + 12px —
 // tracking 1:1 with the scroll, so it never lags. It re-parks at bottom:18
 // once the footer scrolls away. Phones are exempt: the pill docks in the
 // header there (position:static) and never meets the footer.
 const p=await page('odds');try{
  assert.deepEqual(p.errors,[]);
  const w=p.w, tgl=w.document.querySelector('.snow-toggle'), foot=w.document.querySelector('.site-foot');
  assert.ok(tgl&&foot,'the toggle and the footer exist');
  // Simulate the page bottom: the pill parked at 836–882 in a 900px
  // viewport, the footer's top edge at 700 — 182px of overlap.
  tgl.getBoundingClientRect=()=>({top:836,bottom:882,left:0,right:0,width:0,height:46,x:0,y:836,toJSON(){}});
  foot.getBoundingClientRect=()=>({top:700,bottom:1100,left:0,right:0,width:0,height:400,x:0,y:700,toJSON(){}});
  w.dispatchEvent(new w.Event('scroll'));
  await settle(50);
  const lifted=parseFloat(tgl.style.bottom);
  assert.ok(lifted>18,'the pill lifts above the footer (bottom:'+tgl.style.bottom+')');
  assert.ok(Math.abs(lifted-(18+182+12))<1,'the lift equals overlap + 12px gap: '+tgl.style.bottom);
  // Footer scrolled out of view: the pill re-parks at its CSS bottom:18.
  foot.getBoundingClientRect=()=>({top:1200,bottom:1600,left:0,right:0,width:0,height:400,x:0,y:1200,toJSON(){}});
  w.dispatchEvent(new w.Event('scroll'));
  await settle(50);
  assert.equal(tgl.style.bottom,'','the pill re-parks once the footer is out of view');
  // The BTC tip chip the pill used to bury is intact.
  assert.ok(w.document.querySelector('[data-cf-copy="btc"]'),'the footer tip chip is still there');
  assert.ok(w.document.querySelector('.site-foot').textContent.includes('3GnR…8vZK'),'the tip chip still carries the BTC address');
 }finally{p.close();}
});

test('v1.105.0: jersey-less roster cards carry the paw emblem, not giant "CHI" text',async()=>{
 // Fresh-eyes QA (2026-09-29) caught the number-slot fallback rendering "CHI"
 // in the same 92px display treatment as jersey numbers — and on phones the
 // three letters clipped the card edge. A number slot must stay a number; a
 // feed that omits a jersey (practice-squad call-ups, specialists) now gets
 // the paw emblem as a designed watermark instead of fake number text.
 const p=await page('team',{fetch:async(u)=>{
  if(u.pathname.includes('/roster')){
   const data={athletes:[{position:'offense',items:[
    {id:'1',displayName:'Test Bears QB',jersey:'18',position:{abbreviation:'QB'},links:[{href:'https://www.espn.com/'}]},
    {id:'2',displayName:'Test Bears Call-Up',jersey:'',position:{abbreviation:'WR'}}
   ]}]};
   return {ok:true,text:async()=>JSON.stringify(data),json:async()=>data};
  }
 }});try{
  await settle(300);
  const cards=[...p.w.document.querySelectorAll('#roster-cards .player-card')];
  assert.equal(cards.length,2,'both fixture players render');
  const numbered=cards[0].querySelector('.player-number');
  assert.ok(numbered,'the jerseyed player keeps the number watermark');
  assert.equal(numbered.textContent,'18','the watermark is the real jersey number');
  const emblem=cards[1].querySelector('.player-emblem');
  assert.ok(emblem,'the jersey-less player carries the paw emblem');
  assert.equal(emblem.tagName,'IMG','the emblem is an image');
  assert.ok(emblem.getAttribute('src').includes('img/paw-mark.svg'),'the emblem is the brand paw mark');
  assert.equal(emblem.getAttribute('alt'),'','the emblem is decorative');
  assert.equal(emblem.getAttribute('aria-hidden'),'true','the emblem is hidden from assistive tech');
  assert.equal(cards[1].querySelectorAll('.player-number').length,0,'no number slot on the jersey-less card');
  assert.ok(!/>\s*CHI\s*</.test(cards[1].innerHTML),'no giant "CHI" fallback text remains');
  // The position line still degrades gracefully (no dangling "#—").
  assert.match(cards[1].querySelector('.st').textContent,/^WR$/,'the stat line is just the position: '+cards[1].querySelector('.st').textContent);
 }finally{p.close();}
 // Source-level pins: the fallback is gone from the template, the stylesheet
 // carries the emblem watermark rules (desktop + the 440px phone scale-down).
 const team=fs.readFileSync(path.join(__dirname,'..','js','team.js'),'utf8');
 assert.ok(!team.includes('jersey || "CHI"'),'the "CHI" fallback text is gone from team.js');
 assert.ok(team.includes('player-emblem'),'team.js renders the emblem for jersey-less players');
 const css=fs.readFileSync(path.join(__dirname,'..','css','experience.css'),'utf8');
 assert.ok(/\.player-portrait img\.player-emblem\s*\{[^}]*position:\s*absolute[^}]*opacity:\s*\.17/.test(css),'the emblem is an absolutely-positioned watermark');
 assert.ok(/\.player-portrait img\.player-emblem\s*\{[^}]*width:\s*72px/.test(css),'the emblem scales down at the 440px breakpoint');
});
