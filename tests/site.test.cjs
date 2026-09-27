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
 const p=await page('index',{mobile:true});try{
  const w=p.w,d=w.document,b=d.querySelector('.nav-toggle'),nav=d.querySelector('.nav');
  assert.equal(b.textContent.trim(),'\u2630','toggle starts as a hamburger');
  b.click();
  assert.equal(b.textContent.trim(),'\u2715','toggle morphs to a close glyph when open');
  const links=Array.from(nav.querySelectorAll('a'));
  assert.ok(links.length>1,'drawer has links to stagger');
  assert.ok(links.every((a,i)=>a.style.getPropertyValue('--ni').trim()===String(i)),'each drawer link carries its stagger index');
  b.click();
  assert.equal(b.textContent.trim(),'\u2630','toggle returns to a hamburger when closed');
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
  assert.equal(card.querySelector('.player-number').textContent,'CHI','the portrait falls back to the team mark');
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
  assert.equal(cards.length,4,'all four donation cards render');
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
  assert.ok(text.includes('prl1p62v09vuzyd8kdz9l23jaf3kph4wwx6jqcmhkkhg8lhr2qlxky8psu3zw9d'),'the PRL donation address is intact');
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
 for(const [f,v] of [['index.html','1.54.0'],['about.html','1.51.0']]){
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
 assert.ok(html.includes('css/main.css?v=1.52.0'),'404.html busts the stylesheet cache');
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
 assert.ok(html.includes('css/main.css?v=1.54.0'),'index.html busts the stylesheet cache');
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
 assert.ok(html.includes('css/experience.css?v=1.59.0'),'index.html busts the experience.css cache');
 assert.ok(html.includes('js/home.js?v=1.58.0'),'index.html busts the home.js cache');
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
 assert.ok(index.includes('css/experience.css?v=1.59.0'),'index.html busts the experience.css cache');
 assert.ok(index.includes('data-cf-copy="btc"'),'footer tip chip is intact');
 const practice=fs.readFileSync(path.join(__dirname,'..','practice.html'),'utf8');
 assert.ok(practice.includes('css/experience.css?v=1.59.0'),'practice.html busts the experience.css cache');
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
 assert.ok(odds.includes('css/main.css?v=1.60.0'),'odds.html busts the stylesheet cache');
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
  assert.ok(odds.includes('css/experience.css?v=1.61.0'),'odds.html busts the stylesheet cache');
  assert.ok(odds.includes('js/odds.js?v=1.61.0'),'odds.html busts the odds script cache');
  assert.ok(odds.includes('data-cf-copy="btc"'),'footer tip chip is intact');
 }finally{p.close();}
});
