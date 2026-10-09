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
 // v1.116.0 — the art slot carries a photograph when the feed ships one and
 // composed story-aware fallback art when it doesn't; both live inside the
 // .story-art zoom target, and the source tag chip is untouched.
 const p=await page('index',{fetch:async(u)=>{
  if(u.pathname.endsWith('/news')){
   const data={articles:[
    {headline:'Bears prepare for Monday night',published:'2026-09-25T22:00:00Z',links:{web:{href:'https://www.espn.com/'}},images:[{url:'https://example.com/photo.jpg'}]},
    {headline:'Bears injury report: two starters limited',published:'2026-09-25T21:00:00Z',links:{web:{href:'https://www.espn.com/'}},images:[],description:'Limited in practice'}
   ]};
   return {ok:true,text:async()=>JSON.stringify(data),json:async()=>data};
  }
 }});
 try{
  await settle(400);
  const cards=[...p.w.document.querySelectorAll('#home-news .story-card')];
  assert.equal(cards.length,2,'both wire story cards render');
  assert.ok(cards[0].querySelector('.story-art > .story-image'),'image is wrapped in .story-art');
  const fb=cards[1].querySelector('.story-art.story-art-fallback');
  assert.ok(fb,'an imageless story renders composed fallback art inside the zoom target');
  assert.equal(fb.querySelector('.story-art-glyph').textContent,'🩹','the injury story carries the bandage glyph');
  assert.ok(cards[0].querySelector('.story-copy .story-source'),'source element present for the tag chip');
  assert.equal(cards[0].querySelector('.story-copy h3').textContent,'Bears prepare for Monday night');
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

test('v1.146.0: photo-band art emblem centers on phones instead of huddling left',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/experience.css'),'utf8');
 assert.match(css,/\.photo-band \.photo-band-art\s*\{[^}]*margin-left:\s*auto;\s*margin-right:\s*auto/s,'mobile photo-band art is horizontally centered');
 const html=fs.readFileSync(path.join(__dirname,'../games.html'),'utf8');
 assert.ok(html.includes('experience.css?v=1.195.0'),'games.html pins experience.css 1.187.0');
});

test('v1.147.0: duel names wrap on narrow phones instead of ellipsizing',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/experience.css'),'utf8');
 assert.match(css,/@media\s*\(max-width:\s*380px\)\s*\{[^}]*\.duel-name\s*>\s*span:last-child\s*\{[^}]*white-space:\s*normal/s,'narrow-phone duel names wrap instead of ellipsizing');
 const html=fs.readFileSync(path.join(__dirname,'../games.html'),'utf8');
 assert.ok(html.includes('experience.css?v=1.195.0'),'games.html pins experience.css 1.187.0');
});

test('v1.148.0: the 18+ age cue becomes a badge and the pm-legend glyph pair never splits',async()=>{
 // The referral small used to end with a bare "· 18+" fragment that stranded
 // at the start of a wrapped line on phones; now the age floor wears .ref-age.
 {
  const p=await page('odds');try{const w=p.w;
   const small=w.document.querySelector('.ref-card small');
   assert.ok(small,'a referral card renders');
   const age=small.querySelector('.ref-age');
   assert.ok(age,'the age cue is its own badge');
   assert.equal(age.textContent,'18+','the badge reads 18+');
   assert.ok(!small.textContent.includes('·'),'no bare mid-dot fragment remains');
  }finally{p.close();}
 }
 const css=fs.readFileSync(path.join(__dirname,'../css/main.css'),'utf8');
 assert.match(css,/\.ref-age\s*\{[^}]*white-space:\s*nowrap/s,'the age badge wraps as one unit');
 assert.match(css,/\.ref-age\s*\{[^}]*letter-spacing:\s*1\.5px/s,'the age badge keeps the family pill voice');
 // The legend's ▲▼ pair used to split across lines ("▲ =" line end, "▼ ="
 // next line); now the pair rides one nowrap span.
 const odds=fs.readFileSync(path.join(__dirname,'../odds.html'),'utf8');
 assert.ok(/<span style="white-space:nowrap"><span class="mv up"[^]*?<span class="mv down"/s.test(odds),'the pm-legend movement glyphs ride one nowrap span');
 // Cache keys moved with the release.
 assert.ok(odds.includes('css/main.css?v=1.191.0'),'odds.html pins main.css 1.191.0');
 assert.ok(odds.includes('js/common.js?v=1.195.0'),'odds.html pins common.js 1.192.0');
});

test('v1.149.0: the season-log empty state fits the phone scrollport instead of hiding its link',async()=>{
 // games.html's season-log table carries a 560px min-width, so when every
 // feed fails the plain-text empty sentence stretched the full scroll
 // canvas: a phone read "…no snapshot saved on this" with the ESPN fallback
 // link stranded off-screen past the right edge. The message now rides a
 // .log-empty span that sizes to the visible scrollport and wraps whole on
 // <=640px (same pattern as the v1.129.0 .empty panels).
 const js=fs.readFileSync(path.join(__dirname,'../js/games.js'),'utf8');
 assert.ok(js.includes('<span class="log-empty">'),'the empty message rides a .log-empty span');
 const css=fs.readFileSync(path.join(__dirname,'../css/main.css'),'utf8');
 assert.match(css,/#log-table\s+\.log-empty\s*\{[^}]*width:\s*calc\(100vw\s*-\s*64px\)/s,'the span sizes to the visible scrollport');
 assert.match(css,/#log-table\s+\.log-empty\s*\{[^}]*white-space:\s*normal/s,'the sentence wraps whole');
 // Cache keys moved with the release: main.css on all eleven pages, games.js
 // on games.html only.
 const gh=fs.readFileSync(path.join(__dirname,'../games.html'),'utf8');
 assert.ok(gh.includes('css/main.css?v=1.191.0'),'games.html pins main.css 1.191.0');
 assert.ok(gh.includes('js/games.js?v=1.193.0'),'games.html pins games.js 1.163.0');
 for(const name of ['index','news','stats','odds','injuries','practice','team','about','highlights','404']){
  const html=fs.readFileSync(path.join(__dirname,'../'+name+'.html'),'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'),name+'.html pins main.css 1.191.0');
 }
 // Footer branding untouched by this release.
 assert.ok(gh.includes('data-cf-copy="btc"'),'the BTC tip chip survives on games.html');
 assert.ok(gh.includes('@kshot9000'),'the @kshot9000 attribution survives on games.html');
});

test('footer glow-up: bottom bar with PRL tip chip that copies the donation address',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/main.css'),'utf8');
 assert.match(css,/\.site-foot::before\s*\{[^}]*box-shadow:\s*0 1px 16px rgba\(232,\s*84,\s*30,\s*0\.35\)/s,'footer top edge glows orange');
 assert.match(css,/\.site-foot h3::before\s*\{[^}]*width:\s*3px/s,'column headers carry an orange tick');
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
test('highlights NFL league reels merge with a source badge, and the freshness line names both sources',async()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/highlights.css'),'utf8');
 assert.match(css,/\.hl-src\s*\{[^}]*color:\s*#bcd7f5/s,'the league source badge sets in ice steel, not brand orange');
 assert.match(css,/\.hl-feature:hover \.hl-now \.hl-src/s,'the league badge answers hover/focus like the Highlight chip');
 const hjs=fs.readFileSync(path.join(__dirname,'../js/highlights.js'),'utf8');
 assert.ok(hjs.includes('UCDVYQ4Zhbm3S2dlz7P1GBDg'),'the verified NFL league channel ID is wired in, not a guessed one');
 const hhtml=fs.readFileSync(path.join(__dirname,'../highlights.html'),'utf8');
 assert.ok(!/highlights\.js\?v=(?!1\.181\.0")1\.[0-9]+\.0"/.test(hhtml),'highlights.html has no stale highlights.js key');
 assert.ok(!/highlights\.css\?v=(?!1\.187\.0")1\.[0-9]+\.0"/.test(hhtml),'highlights.html has no stale highlights.css key');
 assert.ok(hhtml.includes('https://www.youtube.com/@NFL'),'the page links the NFL channel alongside the Bears channel');
 const atom=(items)=>'<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">'+
  items.map(i=>'<entry><yt:videoId>'+i.id+'</yt:videoId><title>'+i.title+'</title><published>'+i.pub+'</published><media:thumbnail url="https://i.ytimg.com/vi/'+i.id+'/hqdefault.jpg"/></entry>').join('')+'</feed>';
 const bears=[
  {id:'bear1',title:'Bears Weekly: Eagles preview',pub:'2026-09-28T20:00:00Z'},
  {id:'bear2',title:'Press Conference: Ben Johnson',pub:'2026-09-27T20:00:00Z'}
 ];
 const nfl=[
  {id:'nfl1',title:'Bears vs. Vikings | NFL Week 2 Game Highlights',pub:'2026-09-28T23:00:00Z'},
  {id:'nfl2',title:'Chiefs vs. Eagles | NFL Week 2 Game Highlights',pub:'2026-09-28T22:00:00Z'},
  {id:'nfl3',title:'Top 10 plays of Week 2',pub:'2026-09-28T21:00:00Z'}
 ];
 const p=await page('highlights',{fetch:async(u)=>{
  if(u.pathname.endsWith('data/snapshots/highlights.json'))return{ok:true,json:async()=>({fetched:'2026-09-29T00:00:00Z',items:[]}),text:async()=>'{}'};
  if(u.hostname==='www.youtube.com'&&u.pathname==='/feeds/videos.xml'){
   if(u.searchParams.get('channel_id')==='UCDVYQ4Zhbm3S2dlz7P1GBDg')return{ok:true,text:async()=>atom(nfl)};
   return{ok:true,text:async()=>atom(bears)};
  }
 }});
 try{
  const d=p.w.document;
  const cards=[...d.querySelectorAll('#hl-list .hl-card')];
  assert.equal(cards.length,3,'the Bears feed plus the gated league reel render');
  const titles=cards.map(c=>c.querySelector('.hl-title').textContent);
  assert.ok(titles[0].includes('Bears vs. Vikings'),'the league game reel sorts first by publish date');
  const nflCards=cards.filter(c=>c.querySelector('.hl-src'));
  assert.equal(nflCards.length,1,'exactly the Bears game reel wears the NFL badge');
  assert.equal(nflCards[0].querySelector('.hl-src').textContent,'NFL','the badge reads NFL');
  assert.ok(!titles.some(t=>t.includes('Chiefs')),'non-Bears league videos are gated out');
  assert.ok(!titles.some(t=>t.includes('Top 10')),'non-highlight league videos are gated out');
  assert.ok(nflCards[0].getAttribute('data-kind')==='highlight','the league reel classifies as footage');
  d.querySelector('.hl-filters [data-filter="highlight"]').click();await settle();
  const filtered=[...d.querySelectorAll('#hl-list .hl-card')];
  assert.ok(filtered.some(c=>c.querySelector('.hl-src')),'the league reel survives the highlights-only filter');
  assert.match(d.querySelector('#hl-updated').textContent,/Fresh from the Bears channel — 1 game highlight reel leading the board/,'the freshness line names the channel and the leading reel');
  assert.match(d.querySelector('#hl-pill').textContent,/live · 3 videos/,'the pill counts the merged feed');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
});
test('v1.175.0: the game-reel shelf leads the highlights board and opens the featured player',async()=>{
 // Kyle's report: the page showed channel videos but no game highlights —
 // both channels' RSS windows rotate the per-game reels out within days
 // under Shorts and pressers. The shelf (data/snapshots/highlights.json,
 // built by scripts/refresh-highlights.py from the full video lists)
 // carries verified reels; the page merges them in, reels first.
 const shelf=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/snapshots/highlights.json'),'utf8'));
 assert.ok(Array.isArray(shelf.items)&&shelf.items.length>=3,'the shelf carries a bench of game reels');
 const ids=new Set();let prev=null;
 for(const it of shelf.items){
  assert.ok(it.videoId&&it.title&&it.published,'every shelf reel carries an id, a title, and a verified publish date');
  assert.ok(!ids.has(it.videoId),'shelf reels are unique');ids.add(it.videoId);
  assert.ok(it.src==='nfl'||it.src==='bears','shelf reels come from the two official channels');
  assert.ok(/\bhighlights?\b/i.test(it.title),'shelf titles are highlight reels');
  if(prev!==null)assert.ok(Date.parse(it.published)<=prev,'the shelf is newest-first');
  prev=Date.parse(it.published);
 }
 const hjs=fs.readFileSync(path.join(__dirname,'../js/highlights.js'),'utf8');
 assert.ok(hjs.includes('snapshotGet("highlights")'),'the page loads the reel shelf');
 const emptyAtom='<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015"></feed>';
 const shelfStub={fetched:'2026-10-01T00:00:00Z',items:[
  {videoId:'shelfOld',title:'Bears vs. Lions | Game Highlights',published:'2026-09-20T00:00:00Z',src:'nfl'},
  {videoId:'shelfNew',title:'Chicago Bears Highlights vs. Eagles',published:'2026-09-29T00:00:00Z',src:'bears'}
 ]};
 const p=await page('highlights',{fetch:async(u)=>{
  if(u.pathname.endsWith('data/snapshots/highlights.json'))return{ok:true,json:async()=>shelfStub,text:async()=>JSON.stringify(shelfStub)};
  if(u.hostname==='www.youtube.com')return{ok:true,text:async()=>emptyAtom};
 }});
 try{
  const d=p.w.document;
  const cards=[...d.querySelectorAll('#hl-list .hl-card')];
  assert.equal(cards.length,2,'only the shelf renders when the feeds are down');
  assert.equal(cards[0].querySelector('.hl-title').textContent,'Chicago Bears Highlights vs. Eagles','the newest reel leads the board');
  assert.match(d.querySelector('#hl-feature .hl-now h2').textContent,/Eagles/,'the featured player opens on the newest game reel');
  assert.match(d.querySelector('#hl-updated').textContent,/saved game reels/,'the freshness line credits the shelf honestly');
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
 for(const [f,v] of [['index.html','1.191.0'],['about.html','1.191.0']]){
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
  // v1.111.0 — the slot is a zero-height placeholder until AdSense actually
  // fills it: no is-live chrome, no Advertisement label, no reserved band.
  assert.ok(!host.classList.contains('is-live'),'an unfilled slot carries no live chrome yet');
  assert.equal(host.getAttribute('aria-label'),null,'an unfilled slot carries no Advertisement label yet');
  // Simulate the fill: AdSense marks the <ins> filled and injects an iframe.
  ins.setAttribute('data-ad-status','filled');
  const frame=w.document.createElement('iframe');ins.appendChild(frame);
  await new Promise((r)=>setTimeout(r,10)); // let the MutationObserver fire
  assert.ok(host.classList.contains('is-live'),'a filled slot gains the live chrome');
  assert.equal(host.getAttribute('aria-label'),'Advertisement');
  assert.equal(host.getAttribute('role'),'complementary');
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
 assert.ok(html.includes('css/main.css?v=1.191.0'),'404.html busts the stylesheet cache');
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
 assert.ok(html.includes('css/main.css?v=1.191.0'),'index.html busts the stylesheet cache');
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
 assert.ok(html.includes('css/experience.css?v=1.195.0'),'index.html busts the experience.css cache');
 assert.ok(html.includes('js/home.js?v=1.195.0'),'index.html busts the home.js cache');
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
 assert.ok(index.includes('css/experience.css?v=1.195.0'),'index.html busts the experience.css cache');
 assert.ok(index.includes('data-cf-copy="btc"'),'footer tip chip is intact');
 const practice=fs.readFileSync(path.join(__dirname,'..','practice.html'),'utf8');
 assert.ok(practice.includes('css/experience.css?v=1.195.0'),'practice.html busts the experience.css cache');
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
 assert.ok(odds.includes('css/main.css?v=1.191.0'),'odds.html busts the stylesheet cache');
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

test('v1.107.0: snapshot wide-wire headlines decode stacked entities like the live path',async()=>{
 // Force the snapshot branch: the harness mock answers the live RSS
 // upstreams with a 1-item fixture, so block them and let the delayed
 // baked-snapshot race win (1400ms).
 const noLive=async(u)=>{
   if(u.hostname==='www.bing.com'||u.hostname==='news.google.com') throw new Error('no live RSS in test');
 };
 const p=await page('news',{fetch:noLive}); try{
  const api=p.w.CF.API;
  // The shared decoder: the exact entity-stacked string baked into
  // data/snapshots/gnews.json collapses to real quotes, and clean text
  // passes through untouched (idempotent on already-decoded input).
  assert.equal(api.unescRss('Season: &quot;What is going on, man?&quot;'),'Season: "What is going on, man?"','snapshot-style single-level entities decode');
  assert.equal(api.unescRss('Plain headline — no entities'), 'Plain headline — no entities','clean text is untouched');
  assert.equal(api.unescRss(null), null,'null stays null');
  // End to end through the snapshot branch: with live RSS blocked, the
  // baked gnews.json wins — and the Beverley headline must arrive decoded.
  const items=await api.getGoogleNews('Chicago Bears',12);
  assert.equal(api.rssSource,'cache','the snapshot branch served the items');
  const bev=items.find((it)=>/Beverley/.test(it.title||''));
  assert.ok(bev,'the baked snapshot still carries the Beverley headline');
  assert.ok(!bev.title.includes('&quot;'),'snapshot title carries no literal entity');
  assert.ok(bev.title.includes('"What is going on, man?"'),'snapshot title shows real quotes');
  const rendered=p.w.CF.esc(bev.title);
  assert.ok(!rendered.includes('&amp;quot;'),'rendered HTML carries no double-escaped entity');
  assert.ok(rendered.includes('&quot;'),'quotes are safely escaped exactly once');
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
  assert.ok(odds.includes('css/experience.css?v=1.195.0'),'odds.html busts the stylesheet cache');
  assert.ok(odds.includes('js/odds.js?v=1.164.0'),'odds.html busts the odds script cache');
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
  assert.ok(html.includes('css/experience.css?v=1.195.0'),'index.html busts the experience.css cache');
  assert.ok(html.includes('js/home.js?v=1.195.0'),'index.html busts the home.js cache');
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
 assert.ok(ih.includes('js/home.js?v=1.195.0'),'index.html busts the home.js cache');
 assert.ok(gh.includes('js/games.js?v=1.193.0'),'games.html busts the games.js cache');
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
 assert.ok(sh.includes('css/experience.css?v=1.195.0'),'stats.html busts the experience.css cache');
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
  assert.ok(html.includes('js/common.js?v=1.195.0'),f+'.html busts the common.js cache');
 }
});

test('v1.67.0: visitor copy stays fan-facing — no developer maintenance notes on injuries or practice',async()=>{
 const injuries=fs.readFileSync(path.join(__dirname,'..','injuries.html'),'utf8');
 assert.ok(!injuries.includes('data/injuries.json'),'injuries.html no longer names the repo file to visitors');
 assert.ok(!injuries.includes('update in 30 seconds'),'injuries.html hero no longer sounds like a build doc');
 assert.ok(injuries.includes('the official NFL pregame injury report is the source of truth'),'injuries.html keeps the honesty callout');
 assert.ok(injuries.includes('js/injuries.js?v=1.177.0'),'injuries.html busts the injuries.js cache');
 assert.ok(injuries.includes('data-cf-copy="btc"'),'footer tip chip is intact on injuries.html');
 const practice=fs.readFileSync(path.join(__dirname,'..','practice.html'),'utf8');
 assert.ok(!practice.includes('data/practice.json'),'practice.html no longer names the repo file to visitors');
 assert.ok(!practice.includes('make it yours'),'practice.html tracker note no longer sounds like a template doc');
 assert.ok(practice.includes('js/practice.js?v=1.136.0'),'practice.html busts the practice.js cache');
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
 assert.ok(injuries.includes('js/injuries.js?v=1.177.0'),'injuries.html busts the injuries.js cache');
 assert.ok(injuries.includes('js/api.js?v=1.127.0'),'injuries.html busts the api.js cache');
 assert.ok(injuries.includes('css/main.css?v=1.191.0'),'injuries.html busts the main.css cache');
 assert.ok(injuries.includes('data-cf-copy="btc"'),'footer tip chip is intact on injuries.html');
 const index=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.ok(index.includes('js/home.js?v=1.195.0'),'index.html busts the home.js cache');
 assert.ok(index.includes('js/api.js?v=1.127.0'),'index.html busts the api.js cache');
 assert.ok(index.includes('data-cf-copy="btc"'),'footer tip chip is intact on index.html');
 const payload={injuries:[{displayName:'Chicago Bears',injuries:[{athlete:{displayName:'Test Bears LB',position:{abbreviation:'LB'}},status:'Questionable',date:'2026-09-25',shortComment:'Hamstring — limited practice',longComment:'The linebacker was held out of team drills on Friday with a hamstring injury that has lingered for weeks and could keep him sidelined through Sunday.',details:{type:'Hamstring',detail:'',side:''}}]}]};
 const resp={ok:true,text:async()=>JSON.stringify(payload),json:async()=>payload};
 const p=await page('injuries',{fetch:async(u)=>u.pathname.endsWith('/injuries')?resp:undefined});
 try{
  const w=p.w;await settle(300);
  const tds=[...w.document.querySelectorAll('#report-table tbody tr td')];
  assert.ok(tds.length>=5,'the report table paints a row');
  // v1.108.0 — the INJURY cell shows the structured designation (ESPN details),
  // never the full comment sentence and never a status code.
  assert.strictEqual(tds[2].textContent,'Hamstring','the INJURY cell shows the structured designation, not the full prose');
  assert.ok(tds[2].getAttribute('title') && tds[2].getAttribute('title').includes('lingered for weeks'),'the INJURY cell keeps the full prose in a title tooltip');
  const wire=w.document.querySelector('#wire-list .news-item');
  assert.ok(wire,'a wire card painted');
  assert.strictEqual(wire.querySelector('.headline').textContent,'Test Bears LB','the wire headline is the player name alone');
  assert.ok(wire.querySelector('.st'),'the wire card carries a real status pill');
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
 assert.ok(html.includes('js/home.js?v=1.195.0'),'index.html busts the home.js cache');
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
 assert.ok(ih.includes('js/injuries.js?v=1.177.0'),'injuries.html busts the injuries.js cache');
 const xh=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.ok(xh.includes('js/home.js?v=1.195.0'),'index.html busts the home.js cache');
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
  assert.ok(html.includes('css/main.css?v=1.191.0'),name+'.html carries the v1.143.0 main.css cache key');
  assert.ok(!/main\.css\?v=1\.(148|111|97|96|95|94|93|92|91|90|82|7[0-7])\.0"/.test(html),name+'.html has no stale main.css key');
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
  assert.ok(html.includes('css/experience.css?v=1.195.0'),name+'.html carries the v1.120.0 experience.css cache key');
  assert.ok(html.includes('js/snow.js?v=1.137.0'),name+'.html carries the v1.137.0 snow.js cache key');
  assert.ok(!/experience\.css\?v=1\.(100|101|102|117|119|120|[0-7]|80|85|92|99)\.0"|snow\.js\?v=1\.(1[0-7]|18|79|100|104)\.0"/.test(html),name+'.html has no stale experience/snow cache key');
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
  assert.ok(html.includes('css/experience.css?v=1.195.0'),name+'.html carries the v1.120.0 experience.css cache key');
  assert.ok(!/experience\.css\?v=1\.(100|101|102|117|119|120|80|85|92|99)\.0"/.test(html),name+'.html has no stale experience.css key');
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
  assert.ok(html.includes('css/experience.css?v=1.195.0'),name+'.html carries the v1.120.0 experience.css cache key');
  assert.ok(!/experience\.css\?v=1\.(100|101|102|117|119|120|80|85|92|99)\.0"/.test(html),name+'.html has no stale experience.css key');
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
  assert.ok(p.includes('css/main.css?v=1.191.0'),name+'.html carries the v1.143.0 main.css cache key');
  assert.ok(!/main\.css\?v=1\.(148|111|97|96|95|94|93|92|91|90|82|78)\.0"/.test(p),name+'.html has no stale main.css key');
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
  assert.ok(html.includes('js/common.js?v=1.195.0'),name+'.html carries the v1.111.0 common.js cache key');
  assert.ok(!/common\.js\?v=(?!1.195.0")1\.[0-9]+\.0"/.test(html),name+'.html has no stale common.js key');
 }
 const ghtml=fs.readFileSync(path.join(__dirname,'..','games.html'),'utf8');
 assert.ok(ghtml.includes('js/games.js?v=1.193.0'),'games.html carries the v1.94.0 games.js cache key');
 assert.ok(!/games\.js\?v=(?!1.193.0")1\.[0-9]+\.0"/.test(ghtml),'games.html has no stale games.js key');
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
 assert.ok(ghtml.includes('js/games.js?v=1.193.0'),'games.html carries the v1.94.0 games.js cache key');
 assert.ok(!/games\.js\?v=(?!1.193.0")1\.[0-9]+\.0"/.test(ghtml),'games.html has no stale games.js key');
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('js/common.js?v=1.195.0'),name+'.html keeps the v1.111.0 common.js cache key');
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
  assert.ok(html.includes('css/experience.css?v=1.195.0'),name+'.html carries the v1.120.0 experience.css cache key');
  assert.ok(!/experience\.css\?v=1\.(1(0[012]|1[0-9]|20)|9[0-9]|8[0-9]|7[0-9]|[0-6][0-9])\.0"/.test(html),name+'.html has no stale experience.css key');
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
 assert.ok(html.includes('js/odds.js?v=1.164.0'),'odds.html carries the v1.95.0 odds.js cache key');
 assert.ok(!/odds\.js\?v=(?!1.164.0)1\.[0-9]+\.0/.test(html),'odds.html has no stale odds.js key');
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
 assert.ok(ghtml.includes('js/games.js?v=1.193.0'),'games.html carries the v1.94.0 games.js cache key');
 assert.ok(!/games\.js\?v=(?!1.193.0")1\.[0-9]+\.0"/.test(ghtml),'games.html has no stale games.js key');
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('js/common.js?v=1.195.0'),name+'.html keeps the v1.111.0 common.js cache key');
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
 assert.ok(html.includes('<p class="band-line" id="roster-hero-line">Fifty-three names. One city.</p>'),
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
 assert.ok(html.includes('js/team.js?v=1.174.0'),'team.html carries the v1.88.0 team.js cache key');
 assert.ok(!/team\.js\?v=(?!1\.174\.0")1\.[0-9]+\.0"/.test(html),'team.html has no stale team.js key');
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const ph=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(ph.includes('js/common.js?v=1.195.0'),name+'.html keeps the v1.111.0 common.js cache key');
  assert.ok(ph.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
  assert.ok(ph.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
 }
});

test('v1.89.0: injury designations speak fan English — "ir" and "inactive" never read as raw feed codes',async()=>{
 // Fresh-eyes follow-up to v1.71.0: the status PILL got the fan-English map.
 // v1.108.0 — the injury DESIGNATION cells now show ESPN's structured
 // details (type + detail + side), never a status code and never raw feed
 // shorthand. A row with no structured details shows an em dash, not "ir".
 const common=fs.readFileSync(path.join(__dirname,'..','js','common.js'),'utf8');
 assert.ok(common.includes('"inactive": "Inactive"'),'the shared map learns "inactive"');
 const payload={injuries:[{displayName:'Chicago Bears',injuries:[
  {athlete:{displayName:'IR Test LB',position:{abbreviation:'LB'}},status:'Out',date:'2026-09-25',shortComment:'ir',longComment:'ir'},
  {athlete:{displayName:'Inactive Test WR',position:{abbreviation:'WR'}},status:'Out',date:'2026-09-25',shortComment:'inactive',longComment:'inactive'},
  {athlete:{displayName:'Hammy Test CB',position:{abbreviation:'CB'}},status:'Questionable',date:'2026-09-25',shortComment:'Hamstring — limited practice',longComment:'The cornerback was limited in Friday practice with a hamstring injury and is listed as questionable.',details:{type:'Hamstring',detail:'',side:''}}
 ]}]};
 const resp={ok:true,text:async()=>JSON.stringify(payload),json:async()=>payload};
 const fetchMock=async(u)=>u.pathname.endsWith('/injuries')?resp:undefined;
 // injuries.html: the INJURY cell of each report row.
 const p=await page('injuries',{fetch:fetchMock});try{
  const w=p.w;await settle(300);
  const rows=[...w.document.querySelectorAll('#report-table tbody tr')];
  assert.ok(rows.length>=3,'the report table paints the fixture rows');
  const cells=rows.map(r=>r.children[2]);
  // v1.108.0 — no structured details, so the INJURY cell shows an em dash:
  // never the raw "ir", and never the status code "Injured Reserve".
  assert.strictEqual(cells[0].textContent,'—','"ir" with no structured injury reads as an em dash, not a status code');
  assert.strictEqual(cells[1].textContent,'—','"inactive" with no structured injury reads as an em dash');
  assert.strictEqual(cells[2].textContent,'Hamstring','the structured designation shows the body part');
  assert.ok(cells[2].getAttribute('title')&&cells[2].getAttribute('title').includes('questionable'),'the prose row keeps its long comment in the title tooltip');
  // v1.108.0 — the tooltip carries the comment whenever it differs from the
  // designation, so the "ir" row's tooltip preserves that signal.
  assert.ok(cells[0].getAttribute('title')&&cells[0].getAttribute('title').includes('ir'),'the tooltip preserves the comment when it differs from the designation');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
 // index.html: the training-room LATEST UPDATE column.
 const q=await page('index',{fetch:fetchMock});try{
  const w=q.w;await settle(300);
  const rows=[...w.document.querySelectorAll('#home-injuries tbody tr')];
  assert.ok(rows.length>=3,'the home training-room table paints the fixture rows');
  const cells=rows.map(r=>r.children[2].textContent);
  assert.ok(!cells.some(c=>c==='ir'||c==='inactive'),'no raw feed codes remain in the LATEST UPDATE column: '+cells.join(' | '));
  assert.ok(!cells.some(c=>/Injured Reserve|Out/.test(c)&&c!=='Hamstring'),'no status codes leak into the injury column: '+cells.join(' | '));
  assert.deepEqual(q.errors,[]);
 }finally{q.close();}
 // Cache keys: common.js changed this release, so its key moves to v1.108.0 on
 // all 11 pages; only index.html and injuries.html carry the changed page
 // scripts. Footer branding survives.
 const ih=fs.readFileSync(path.join(__dirname,'..','injuries.html'),'utf8');
 assert.ok(ih.includes('js/injuries.js?v=1.177.0'),'injuries.html busts the injuries.js cache');
 assert.ok(ih.includes('js/common.js?v=1.195.0'),'injuries.html busts the common.js cache');
 const xh=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.ok(xh.includes('js/home.js?v=1.195.0'),'index.html busts the home.js cache');
 assert.ok(xh.includes('js/common.js?v=1.195.0'),'index.html busts the common.js cache');
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('js/common.js?v=1.195.0'),name+'.html carries the v1.111.0 common.js cache key');
  assert.ok(!/common\.js\?v=(?!1.195.0")1\.[0-9]+\.0"/.test(html),name+'.html has no stale common.js key');
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
  assert.ok(html.includes('css/main.css?v=1.191.0'),name+'.html carries the v1.143.0 main.css cache key');
  assert.ok(!/main\.css\?v=1\.(148|111|97|96|95|94|93|92|91|90|82|7[0-7])\.0"/.test(html),name+'.html has no stale main.css key');
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
  assert.ok(html.includes('css/main.css?v=1.191.0'),name+'.html carries the v1.143.0 main.css cache key');
  assert.ok(!/main\.css\?v=1\.(148|111|97|96|95|94|93|92|91|90)\.0"/.test(html),name+'.html has no stale main.css key');
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
  assert.ok(html.includes('css/main.css?v=1.191.0'),name+'.html carries the v1.143.0 main.css cache key');
  assert.ok(html.includes('css/experience.css?v=1.195.0'),name+'.html carries the v1.120.0 experience.css cache key');
  assert.ok(!/main\.css\?v=1\.(148|111|96|95|94|93|92|91)\.0/.test(html),name+'.html has no stale main.css key');
  assert.ok(!/experience\.css\?v=1\.(100|101|102|117|119|120|85|92|99)\.0"/.test(html),name+'.html has no stale experience.css key');
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
  assert.ok(html.includes('css/main.css?v=1.191.0'),name+'.html carries the v1.143.0 main.css cache key');
  assert.ok(!/main\.css\?v=1\.(148|111|96|95|94|93|92|91)\.0/.test(html),name+'.html has no stale main.css key');
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
 const stampRule=main.match(/^\.fresh-stamp\s*\{[^}]*\}/m);
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
  assert.ok(html.includes('css/main.css?v=1.191.0'),name+'.html carries the v1.143.0 main.css cache key');
  assert.ok(html.includes('js/common.js?v=1.195.0'),name+'.html carries the v1.111.0 common.js cache key');
  assert.ok(!/main\.css\?v=1\.(148|111|97|96|95|94|93|92|91|90|82|7[0-7])\.0"/.test(html),name+'.html has no stale main.css key');
  assert.ok(!/common\.js\?v=(?!1.195.0")1\.[0-9]+\.0"/.test(html),name+'.html has no stale common.js key');
  assert.ok(html.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
  assert.ok(html.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
 }
 const locks=[['odds.html','js/odds.js?v=1.164.0'],['games.html','js/games.js?v=1.193.0'],
              ['index.html','js/home.js?v=1.195.0'],['injuries.html','js/injuries.js?v=1.177.0'],
              ['news.html','js/news.js?v=1.178.0']];
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
  assert.ok(html.includes('css/main.css?v=1.191.0'),name+'.html carries the v1.143.0 main.css cache key');
  assert.ok(!/main\.css\?v=1\.(111\.0|97\.0|96\.0|95\.0|94\.0|93\.0|92\.0|91\.0|90\.0|82\.0|7[0-7])/.test(html),name+'.html has no stale main.css key');
 }
 const ohtml=fs.readFileSync(path.join(__dirname,'..','odds.html'),'utf8');
 assert.ok(ohtml.includes('js/odds.js?v=1.164.0'),'odds.html carries the v1.95.0 odds.js cache key');
 assert.ok(!/odds\.js\?v=(?!1.164.0)1\.[0-9]+\.0/.test(ohtml),'odds.html has no stale odds.js key');
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
 // footer branding survives. Pins roll forward with the release (v1.111.0).
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('js/common.js?v=1.195.0'),name+'.html carries the v1.111.0 common.js cache key');
  assert.ok(!/common\.js\?v=(?!1.195.0")1\.[0-9]+\.0"/.test(html),name+'.html has no stale common.js key');
  assert.ok(html.includes('css/main.css?v=1.191.0'),name+'.html holds the v1.143.0 main.css cache key');
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
  assert.ok(html.includes('js/common.js?v=1.195.0'),name+'.html carries the v1.111.0 common.js cache key');
  assert.ok(!/common\.js\?v=(?!1.195.0")1\.[0-9]+\.0"/.test(html),name+'.html has no stale common.js key');
  assert.ok(html.includes('css/main.css?v=1.191.0'),name+'.html carries the v1.143.0 main.css cache key');
  assert.ok(!/main\.css\?v=1\.(148|111|97|96|95|94|93|92|91|90|82|7[0-7])\.0"/.test(html),name+'.html has no stale main.css key');
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
 // v1.145.0: the rotator shows real field photography (gameday field, Bears
 // huddle, stadium + skyline aerial) — same invariant, new art: every desktop
 // layer is a pre-composed 1600x928 landscape, every mobile layer a 900x1100
 // portrait, all files on disk.
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 const layers=[...html.matchAll(/<picture class="hero-layer[^"]*"[^>]*>([\s\S]*?)<\/picture>/g)];
 assert.equal(layers.length,3,'the hero rotator still has three layers');
 layers.forEach((m,i)=>{
  const img=m[1].match(/<img[^>]*src="([^"]+)"[^>]*width="(\d+)"[^>]*height="(\d+)"/);
  assert.ok(img,'layer '+i+' has a sized desktop img');
  assert.ok(+img[2]>=+img[3],'layer '+i+' desktop art is landscape ('+img[2]+'x'+img[3]+') — no portrait slice in the rotation');
  assert.ok(fs.existsSync(path.join(__dirname,'..',img[1])),'layer '+i+' desktop art exists on disk: '+img[1]);
  const src=m[1].match(/<source[^>]*srcset="([^"]+)"[^>]*>/);
  assert.ok(src,'layer '+i+' has a mobile source');
  assert.ok(fs.existsSync(path.join(__dirname,'..',src[1])),'layer '+i+' mobile art exists on disk: '+src[1]);
 });
 const l2=layers[2][1];
 assert.ok(/src="img\/hero-field-skyline-desk\.webp"/.test(l2),'layer 2 desktop art is the stadium-skyline field crop');
 assert.ok(!/src="img\/soldier-field-dark\.webp"/.test(l2),'layer 2 no longer serves the raw portrait on desktop');
 assert.ok(/srcset="img\/hero-field-skyline-mobile\.webp"/.test(l2),'layer 2 keeps a portrait crop for the tall mobile hero');
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
  assert.ok(h.includes('css/experience.css?v=1.195.0'),name+'.html carries the v1.120.0 experience.css cache key');
  assert.ok(!/experience\.css\?v=1\.(1(0[012]|1[0-9]|20)|9[0-9]|8[0-9]|7[0-9]|[0-6][0-9])\.0"/.test(h),name+'.html has no stale experience.css key');
  assert.ok(h.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
  assert.ok(h.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
 }
 assert.ok(html.includes('js/home.js?v=1.195.0'),'index.html carries the v1.99.0 home.js cache key');
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
  assert.ok(h.includes('css/experience.css?v=1.195.0'),name+'.html carries the v1.120.0 experience.css cache key');
  assert.ok(!/experience\.css\?v=1\.(1(0[012]|1[0-9]|20)\.0|99\.0|9[0-9]\.0|8[0-9]\.0|7[0-9]\.0|[0-6][0-9]\.0)/.test(h),name+'.html has no stale experience.css key');
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
  assert.ok(h.includes('css/experience.css?v=1.195.0'),name+'.html carries the v1.120.0 experience.css cache key');
  assert.ok(!/experience\.css\?v=1\.(1(0[012]|1[0-9]|20)|9[0-9]|8[0-9]|7[0-9]|[0-6][0-9])\.0"/.test(h),name+'.html has no stale experience.css key');
  assert.ok(h.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
  assert.ok(h.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
 }
 const gh=fs.readFileSync(path.join(__dirname,'..','games.html'),'utf8');
 assert.ok(gh.includes('js/games.js?v=1.193.0'),'games.html carries the v1.102.0 games.js cache key');
 assert.ok(!/games\.js\?v=(?!1.193.0")1\.[0-9]+\.0"/.test(gh),'games.html has no stale games.js key');
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

test('v1.106.0: the wire\'s fallback thumbnails are story-aware, not one snowflake',async()=>{
 // Fresh-eyes QA (2026-09-29): every wire story without a working image wore
 // the same ❄ tile — ESPN hotlinks 404 behind their protection and the wide
 // wire ships no images at all, so the list read as a wall of identical
 // missing-image boxes. Fallbacks now carry a story-aware glyph (injury /
 // game / roster move / brand snowflake) plus one of four whisper-quiet
 // tints keyed off the headline, so neighboring cards read as distinct
 // stories. A dead <img> swaps to the same treatment via CF.thumbFallback.
 const p=await page('news',{fetch:async(u)=>{
  if(u.pathname.endsWith('/news')){
   const data={articles:[
    {headline:'Bears QB sidelined with concussion, questionable for Sunday',published:'2026-09-25T22:00:00Z',links:{web:{href:'https://www.espn.com/'}},images:[],description:'Limited in practice'},
    {headline:'Bears win overtime thriller over Packers at Soldier Field',published:'2026-09-25T21:00:00Z',links:{web:{href:'https://www.espn.com/'}},images:[],description:'Recap'},
    {headline:'Bears sign veteran lineman to two-year contract extension',published:'2026-09-25T20:00:00Z',links:{web:{href:'https://www.espn.com/'}},images:[],description:'Roster move'}
   ]};
   return {ok:true,text:async()=>JSON.stringify(data),json:async()=>data};
  }
 }});try{
  await settle(300);
  const w=p.w;
  // v1.108.0 — the wire partitions injury-shaped stories into the injury rail,
  // so the concussion story renders there and the other two stay on the main wire.
  const tiles=[...w.document.querySelectorAll('#news-list .thumb-fallback'),...w.document.querySelectorAll('#injury-news .thumb-fallback')];
  assert.equal(tiles.length,3,'all three image-less stories render fallback tiles across the wire and the rail');
  const glyphs=tiles.map(t=>t.textContent);
  assert.ok(glyphs.includes('🩹'),'the injury story carries the bandage glyph: '+glyphs.join(','));
  assert.ok(glyphs.includes('🏈'),'the game story carries the football glyph: '+glyphs.join(','));
  assert.ok(glyphs.includes('📋'),'the roster-move story carries the clipboard glyph: '+glyphs.join(','));
  assert.ok(!glyphs.includes('❄'),'no story falls back to the generic snowflake: '+glyphs.join(','));
  const tints=tiles.map(t=>t.className);
  assert.ok(tints.every(c=>/\btf-t[0-3]\b/.test(c)),'every tile carries a tint class: '+tints.join(' | '));
  // A dead <img> must swap to the same story-aware tile, glyph and tint intact.
  const probe=w.document.createElement('img');
  probe.className='thumb';probe.setAttribute('data-glyph','🏈');probe.setAttribute('data-tint','tf-t2');
  const host=tiles[0].parentNode;host.appendChild(probe);
  w.CF.thumbFallback(probe);
  const swapped=host.querySelectorAll('.thumb-fallback');
  assert.equal(swapped.length,2,'the dead image becomes a fallback tile');
  assert.equal(swapped[1].textContent,'🏈','the swap keeps the story glyph');
  assert.ok(swapped[1].classList.contains('tf-t2'),'the swap keeps the tint');
 }finally{p.close();}
 // Source-level pins: the shared swap lives in common.js, the glyph/tint
 // logic in news.js, the tints in main.css.
 const common=fs.readFileSync(path.join(__dirname,'..','js','common.js'),'utf8');
 assert.ok(common.includes('CF.thumbFallback ='),'common.js defines the shared CF.thumbFallback helper');
 const news=fs.readFileSync(path.join(__dirname,'..','js','news.js'),'utf8');
 assert.ok(!/onerror="this\.replaceWith\(Object\.assign/.test(news),'the inline dead-image snowflake swap is gone from news.js');
 assert.ok(news.includes('data-glyph')&&news.includes('data-tint'),'news.js stamps glyph+tint onto wire thumbnails');
 const css=fs.readFileSync(path.join(__dirname,'..','css','main.css'),'utf8');
 assert.ok(/\.thumb-fallback\.tf-t1\s*\{[^}]*background:\s*rgba\(255,\s*106,\s*31,\s*0\.07\)/.test(css),'the fallback tiles carry the warm orange whisper tint');
 assert.ok(/\.thumb-fallback\.tf-t3\s*\{[^}]*background:\s*rgba\(150,\s*180,\s*210,\s*0\.06\)/.test(css),'the fallback tiles carry the cool steel whisper tint');
 // Cache-bust pins: all three changed assets carry the release key everywhere.
 for(const [f,key] of [['news.html','js/news.js?v=1.178.0'],['index.html','js/common.js?v=1.195.0'],['news.html','css/main.css?v=1.191.0']]){
  const html=fs.readFileSync(path.join(__dirname,'..',f),'utf8');
  assert.ok(html.includes(key),f+' carries the '+key+' cache key');
 }
});

test('v1.108.0: word-boundary truncation never cuts mid-word and always ends with an ellipsis',async()=>{
 const p=await page('index');try{const t=p.w.CF.truncateWords;
  assert.equal(t('short text',140),'short text','text that fits returns as-is');
  assert.equal(t('The Bears defense forced three turnovers on Sunday afternoon',20),'The Bears defense…','cuts at the last space before the limit');
  assert.ok(t('word '.repeat(50),140).endsWith('…'),'long text ends with an ellipsis');
  assert.ok(!/\\w…$/.test(t('word '.repeat(50),140).replace(/…$/,'')),'no partial word before the ellipsis');
  assert.equal(t('a'.repeat(200),140),'a'.repeat(140)+'…','a single unbroken token falls back to a hard cut');
  assert.equal(t('',140),'','empty stays empty');
  assert.equal(t(null,140),'','null stays empty');
 }finally{p.close();}
});

test('v1.108.0: placeholder late-night kickoffs read as unset, real ones keep their time',async()=>{
 const p=await page('index');try{const k=p.w.CF.kickoffTime;
  assert.equal(k('2027-01-10T05:00:00Z'),'','ESPN\u2019s 11 PM CT placeholder is not a real kickoff time');
  assert.ok(k('2026-10-11T17:00:00Z').length>0,'a normal Sunday kickoff keeps its time: '+k('2026-10-11T17:00:00Z'));
  assert.equal(k(''),'', 'empty stays empty');
  assert.equal(k(null),'','null stays empty');
  // The season log must not print the fake 11 PM.
  const cell=k('2027-01-10T05:00:00Z')?'':'Time TBD';
  assert.equal(cell,'Time TBD');
 }finally{p.close();}
});

test('v1.108.0: Polymarket cent pairs always sum to 100 and the bar alt text matches the chips',async()=>{
 const pm=(prices,volume)=>{const body={events:[{title:'Bears test',slug:'bears-test',markets:[{question:'Will the Bears test?',outcomes:['Yes','No'],outcomePrices:prices,volume:String(volume),endDate:'2027-01-27T04:59:00Z',slug:'bears-test'}]}]};return{ok:true,json:async()=>body,text:async()=>JSON.stringify(body)};};
 const p=await page('odds',{fetch:async(u)=>{
  if(u.hostname==='gamma-api.polymarket.com'&&!u.pathname.includes('/tags/'))return pm(['0.505','0.495'],63000);
 }});try{
  await settle(600);
  const d=p.w.document;
  const yes=d.querySelector('.poly-price.yes'),no=d.querySelector('.poly-price.no');
  assert.ok(yes&&no,'both price chips render');
  const yc=Number(yes.textContent.match(/(\d+)¢/)[1]),nc=Number(no.textContent.match(/(\d+)¢/)[1]);
  assert.equal(yc+nc,100,'the displayed pair sums to exactly 100: '+yc+'¢ + '+nc+'¢');
  assert.equal(yc,51,'yes rounds normally: 50.5¢ -> 51¢');
  assert.equal(no.textContent.includes('49¢'),true,'no is 100 - yes: '+no.textContent.trim());
  const bar=d.querySelector('.poly-bar');
  assert.ok(bar,'the implied-probability bar renders');
  assert.equal(bar.getAttribute('aria-label'),'Implied probability: 51% yes, 49% no','the alt text uses the same rounded pair as the chips');
  assert.ok(d.querySelector('.poly-card .sub').textContent.includes('$63K'),'volume drops the useless .0: '+d.querySelector('.poly-card .sub').textContent.trim());
  assert.ok(d.querySelector('.poly-card .sub').textContent.includes('2027'),'the market end date carries its year: '+d.querySelector('.poly-card .sub').textContent.trim());
 }finally{p.close();}
});

test('v1.108.0: a binary market with one missing side still renders both chips',async()=>{
 const pm=()=>{const body={events:[{title:'Bears test',slug:'bears-test',markets:[{question:'Will the Bears test?',outcomes:['Yes','No'],outcomePrices:['','0.7475'],volume:'54.94',endDate:'2027-01-27T04:59:00Z',slug:'bears-test'}]}]};return{ok:true,json:async()=>body,text:async()=>JSON.stringify(body)};};
 const p=await page('odds',{fetch:async(u)=>{
  if(u.hostname==='gamma-api.polymarket.com'&&!u.pathname.includes('/tags/'))return pm();
 }});try{
  await settle(600);
  const d=p.w.document;
  const yes=d.querySelector('.poly-price.yes'),no=d.querySelector('.poly-price.no');
  assert.ok(yes,'the missing Yes side is derived, not dropped: '+d.querySelector('.poly-card .pr').textContent.trim());
  assert.ok(no,'the present No side still renders');
  const yc=Number(yes.textContent.match(/(\d+)¢/)[1]),nc=Number(no.textContent.match(/(\d+)¢/)[1]);
  assert.equal(yc+nc,100,'the completed pair sums to 100');
 }finally{p.close();}
});

test('v1.108.0: injury rows carry a structured designation and the table never prints a status code as the injury',async()=>{
 const p=await page('injuries');try{const api=p.w.CF.API;
  const rows=api.bearsInjuryRows({timestamp:'2026-09-29',injuries:[{displayName:'Chicago Bears',team:{abbreviation:'CHI'},injuries:[
   {athlete:{displayName:'Caleb Williams',position:{abbreviation:'QB'}},status:'Doubtful',date:'2026-09-29',shortComment:'doubtful',details:{type:'Hamstring',detail:'Strain',side:'Right'}},
   {athlete:{displayName:'Anthony Johnson Jr.',position:{abbreviation:'S'}},status:'Injured Reserve',date:'2026-09-29',shortComment:'ir',details:{type:'Undisclosed',detail:'Not Specified',side:'Not Specified'}},
   {athlete:{displayName:'Braxton Jones',position:{abbreviation:'OT'}},status:'Questionable',date:'2026-09-29',shortComment:'Jones (knee) is doubtful to return.',details:{type:'Knee',detail:'',side:''}},
  ]}]});
  assert.ok(rows.found,'the Bears report is found');
  const byName=(n)=>rows.rows.find((r)=>r.name===n);
  assert.equal(byName('Caleb Williams').injury,'Hamstring — Strain (Right)','type + detail + side compose the designation');
  assert.equal(byName('Anthony Johnson Jr.').injury,'Undisclosed','junk detail values are skipped, Undisclosed survives');
  assert.equal(byName('Braxton Jones').injury,'Knee','the designation is the body part, not the in-game prose');
  assert.equal(byName('Braxton Jones').status,'Questionable','the official designation is untouched by the old in-game note');
  assert.notEqual(byName('Anthony Johnson Jr.').injury,'Injured Reserve','the INJURY field never echoes the STATUS column');
 }finally{p.close();}
});

test('v1.108.0: roster practice-squad duplicates are disambiguated and missing data stays clean',async()=>{
 const dupRoster={athletes:[
  {position:'defense',items:[
   {id:'1',displayName:'Jonathan Garvin',jersey:'52',position:{abbreviation:'DE'},status:{type:'active',name:'Active'}},
   {id:'2',displayName:'Marcus Davenport',jersey:'52',position:{abbreviation:'DE'},status:{type:'practice-squad',name:'Practice Squad'}},
   {id:'3',displayName:'Buddy Johnson',position:{abbreviation:'LB'},status:{type:'practice-squad',name:'Practice Squad'}},
  ]},
 ]};
 const p=await page('team',{fetch:async(u)=>{
  if(u.pathname.includes('/roster'))return{ok:true,json:async()=>dupRoster,text:async()=>JSON.stringify(dupRoster)};
 }});try{
  await settle(600);
  const d=p.w.document;
  const badges=[...d.querySelectorAll('.ps-tag')];
  assert.ok(badges.length>=1,'the practice-squad holder of a shared number carries a PS badge');
  assert.ok(badges.every((b)=>b.textContent.trim()==='PS'),'the badge reads PS');
  const cards=[...d.querySelectorAll('.player-card')].map((c)=>c.textContent);
  const davenport=cards.find((t)=>t.includes('Marcus Davenport'));
  assert.ok(davenport&&davenport.includes('PS'),'Davenport\u2019s card is disambiguated: '+String(davenport).slice(0,80));
  const garvin=cards.find((t)=>t.includes('Jonathan Garvin'));
  assert.ok(garvin&&!garvin.includes('PS '),'the active-roster holder is not tagged');
  assert.ok(!/jersey\s*52[^]*jersey\s*52/i.test(d.body.innerHTML.replace(/PS/g,'')),'no invented numbers appear');
  const rows=[...d.querySelectorAll('#roster-table tbody tr')].map((r)=>r.textContent);
  const buddy=rows.find((t)=>t.includes('Buddy Johnson'));
  assert.ok(buddy,'Buddy Johnson renders');
  assert.ok(buddy.includes('LB'),'his position renders: '+buddy.trim().slice(0,60));
 }finally{p.close();}
});

test('v1.108.0: single-book boards drop the BEST comparison noise',async()=>{
 const p=await page('odds');try{const w=p.w;
  w.CF.API.getSchedule=async()=>({source:'live',data:{season:{displayName:'2026'},events:[event('200','PHI','CHI')]}});
  const payload=[{id:'200',name:'Chicago Bears at Philadelphia Eagles',competitions:[{odds:[
   {provider:{name:'DraftKings'},pointSpread:{home:{close:{line:-3}},away:{close:{line:3}}},overUnder:47.5,moneyline:{home:{close:{odds:-160}},away:{close:{odds:140}}}}
  ]}]}];
  w.CF.API.getOdds=async()=>({source:'live',data:payload});
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await settle(500);
  const d=w.document;
  assert.equal(d.querySelector('.best-strip'),null,'no best-price strip on a single-book board');
  assert.equal(d.querySelectorAll('.best-chip').length,0,'no BEST chips on a single-book board');
 }finally{p.close();}
});

test('v1.108.0: footer spacing, season-log header, 404 title, prediction toggle, and season strip labels',async()=>{
 const p=await page('index');try{const d=p.w.document;
  assert.ok(d.querySelector('.foot-credit').innerHTML.includes('©&nbsp;'),'the footer keeps its space after © on narrow wraps');
  assert.equal(d.querySelector('#prediction-toggle').getAttribute('title').length>0,true,'Make your call explains itself when disabled');
  assert.ok(d.querySelector('#season-diff').textContent!==undefined,'the season differential renders');
  const label=[...d.querySelectorAll('.season-strip > div')].find((el)=>el.querySelector('#season-diff'));
  assert.match(label.querySelector('span').textContent,/total/i,'the differential label says it is a season total: '+label.querySelector('span').textContent);
 }finally{p.close();}
 const g=await page('games');try{
  await settle(300);
  const ths=[...g.w.document.querySelectorAll('#log-table thead th')];
  const last=ths[ths.length-1];
  assert.ok(last.querySelector('.sr-only'),'the box-score column has a screen-reader header');
  assert.equal(last.querySelector('.sr-only').textContent,'Box score','the header names the column: '+last.textContent);
 }finally{g.close();}
 const f=await page('404');try{
  assert.equal(f.w.document.title,'404 — Lost in the Snow · The Cold Front','the 404 page has a real title');
 }finally{f.close();}
});

test('v1.108.0: every changed script carries the release cache key on every page',async()=>{
 const changed=[['js/common.js','1.195.0'],['js/api.js','1.127.0'],['js/home.js','1.195.0'],['js/games.js','1.193.0'],['js/odds.js','1.164.0'],['js/news.js','1.178.0'],['js/injuries.js','1.177.0'],['js/team.js','1.174.0']];
 const pages={index:['js/common.js','js/api.js','js/home.js'],games:['js/common.js','js/api.js','js/games.js'],odds:['js/common.js','js/api.js','js/odds.js'],news:['js/common.js','js/api.js','js/news.js'],injuries:['js/common.js','js/api.js','js/injuries.js'],team:['js/common.js','js/api.js','js/team.js'],stats:['js/common.js','js/api.js'],about:['js/common.js','js/api.js'],practice:['js/common.js','js/api.js'],highlights:['js/common.js','js/api.js'],'404':['js/common.js']};
 for(const [page,scripts] of Object.entries(pages)){
  const html=fs.readFileSync(path.join(__dirname,'..',page+'.html'),'utf8');
  for(const s of scripts){
   const want=changed.find(([f])=>f===s);
   if(want)assert.ok(html.includes(s+'?v='+want[1]),page+'.html busts '+s+' at v'+want[1]);
  }
 }
});

test('v1.109.0: the paw emblem no longer ghosts behind real headshot photos',async()=>{
 // Fresh-eyes QA (2026-09-29) caught the paw placeholder watermark peeking
 // out from behind real headshot photos on jersey-less cards (Nick McCloud,
 // Zavier Scott, Keidron Smith…) — it read as a broken-image state. The
 // emblem now only ghosts the number slot when there is no photo to fill it:
 // a :has rule hides it while a visible headshot is present, and the emblem
 // stays in the DOM so a photo that fails to load (its onerror hides it)
 // still degrades to the composed badge instead of an empty frame.
 const p=await page('team',{fetch:async(u)=>{
  if(u.pathname.includes('/roster')){
   const data={athletes:[{position:'offense',items:[
    {id:'1',displayName:'Test Bears RB',jersey:'',position:{abbreviation:'RB'},headshot:{href:'https://example.com/rb.png'},links:[{href:'https://www.espn.com/'}]},
    {id:'2',displayName:'Test Bears WR',jersey:'',position:{abbreviation:'WR'},links:[{href:'https://www.espn.com/'}]}
   ]}]};
   return {ok:true,text:async()=>JSON.stringify(data),json:async()=>data};
  }
 }});try{
  await settle(300);
  const cards=[...p.w.document.querySelectorAll('#roster-cards .player-card')];
  assert.equal(cards.length,2,'both fixture players render');
  const sel='.player-portrait:has(> img:not(.player-emblem):not([hidden])) img.player-emblem';
  // Jersey-less WITH a photo: the emblem stays in the DOM (photo-failure
  // fallback) but the :has rule matches it, so the stylesheet hides it.
  const withPhoto=cards[0];
  assert.ok(withPhoto.querySelector('img:not(.player-emblem)'),'the photo img renders');
  assert.ok(withPhoto.querySelector(sel),'the hiding rule matches the emblem while the photo is visible');
  // Jersey-less WITHOUT a photo: no :has match — the emblem stays visible.
  const noPhoto=cards[1];
  assert.ok(noPhoto.querySelector('.player-emblem'),'the emblem renders when there is no photo');
  assert.equal(noPhoto.querySelector(sel),null,'the hiding rule does not match when there is no photo');
  // Photo-failure resilience: hiding the photo <img> (what its onerror does)
  // drops the :has match, so the emblem returns as the composed fallback.
  withPhoto.querySelector('img:not(.player-emblem)').hidden=true;
  assert.equal(withPhoto.querySelector(sel),null,'a failed photo restores the emblem fallback');
 }finally{p.close();}
 // Source-level pins: the :has rule ships in experience.css, and team.html
 // busts the stylesheet cache at the release version.
 const css=fs.readFileSync(path.join(__dirname,'..','css','experience.css'),'utf8');
 assert.ok(css.includes('.player-portrait:has(> img:not(.player-emblem):not([hidden])) img.player-emblem'),'the emblem-hiding rule ships in experience.css');
 const team=fs.readFileSync(path.join(__dirname,'..','team.html'),'utf8');
 assert.ok(team.includes('css/experience.css?v=1.195.0'),'team.html busts the experience.css cache');
});

test('v1.111.0: an unfilled ad slot is a zero-height placeholder — no empty Advertisement band',async()=>{
 const p=await page('index');try{const w=p.w;
  w.CF.CONFIG.ads.client='ca-pub-1234567890123456';
  w.CF.CONFIG.ads.slots.homeLeaderboard='9876543210';
  const host=w.document.createElement('div');
  host.className='ad-slot';host.setAttribute('data-ad-slot','homeLeaderboard');
  w.document.body.appendChild(host);
  w.CF.initAds();
  // While AdSense has not filled the slot, it carries none of the live chrome.
  assert.ok(!host.classList.contains('is-live'),'no is-live class before the fill');
  assert.equal(host.getAttribute('aria-label'),null,'no Advertisement label before the fill');
  assert.equal(host.getAttribute('role'),null,'no complementary role before the fill');
  // The placeholder never reserves a visible band: no margins, no padding,
  // no border, no label text, no min-height. (jsdom reports computed zeros
  // as "0", so compare numerically.)
  const cs=w.getComputedStyle(host);
  for(const [prop,what] of [['marginTop','top margin'],['marginBottom','bottom margin'],['paddingTop','padding'],['minHeight','minimum height'],['borderTopWidth','hairline frame']]){
   assert.equal(parseFloat(cs[prop])||0,0,'the placeholder reserves no '+what);
  }
  assert.equal(w.document.querySelectorAll('.ad-slot.is-live').length,0,'no live ad chrome anywhere on the page');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
 // Source-level pins: the zero-footprint placeholder and deferred chrome
 // ship in main.css and common.js, both cache-busted at the release key.
 const css=fs.readFileSync(path.join(__dirname,'..','css','main.css'),'utf8');
 assert.match(css,/\.ad-slot\s*\{\s*margin:\s*0 auto;[^}]*padding:\s*0;/s,'the base slot is a zero-footprint placeholder');
 assert.match(css,/\.ad-slot\.is-live\s*\{\s*margin:\s*26px auto;/s,'the live slot carries the section spacing');
 const common=fs.readFileSync(path.join(__dirname,'..','js','common.js'),'utf8');
 assert.ok(common.includes('new MutationObserver(markLive)'),'initAds applies live chrome only after a real fill');
 for(const f of ['index','news','odds']){
  const html=fs.readFileSync(path.join(__dirname,'..',f+'.html'),'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'),f+'.html busts the main.css cache');
  assert.ok(html.includes('js/common.js?v=1.195.0'),f+'.html busts the common.js cache');
 }
});

test('v1.112.0: the wire cards compose — padded copy, meta row pinned to the card bottom',async()=>{
 // Fresh-eyes QA (2026-09-29) caught the homepage "Fresh off the wire" cards
 // landing ragged: .story-copy had no padding at all (headlines sat ~4px from
 // the card edge while the frost skeleton kept a comfortable 18px), and the
 // copy block never grew to fill the grid-stretched card — so the
 // margin-top:auto on .story-end was dead and the "time ago / Read story" row
 // floated at a different height on every card in the row.
 const p=await page('index');try{
  await settle(300);
  const cards=[...p.w.document.querySelectorAll('#home-news .story-card')];
  assert.ok(cards.length>0,'the fixture wire renders story cards');
  for(const card of cards){
   const copy=card.querySelector('.story-copy');
   assert.ok(copy,'each card carries a copy block');
   assert.ok(copy.querySelector('.story-source'),'the source chip renders inside the copy block');
   assert.ok(copy.querySelector('h3'),'the headline renders inside the copy block');
   assert.ok(copy.querySelector('.story-end'),'the meta row renders inside the copy block');
  }
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
 // Source-level pins: the composition rule ships in experience.css (growing
 // flex column + skeleton rhythm), and all eleven pages bust the stylesheet
 // cache at the release key.
 const css=fs.readFileSync(path.join(__dirname,'..','css','experience.css'),'utf8');
 assert.match(css,/\.story-card \.story-copy\s*\{\s*display:\s*flex;\s*flex-direction:\s*column;\s*flex:\s*1 1 auto;\s*gap:\s*10px;\s*padding:\s*18px;\s*\}/s,'the wire-card composition rule ships in experience.css');
 for(const f of ['index','news','games','stats','odds','injuries','practice','team','about','highlights','404']){
  const html=fs.readFileSync(path.join(__dirname,'..',f+'.html'),'utf8');
  assert.ok(html.includes('css/experience.css?v=1.195.0'),f+'.html busts the experience.css cache');
 }
});

test('v1.113.0: injury designations drop ESPN\'s echoed detail — "Concussion (Concussion)" reads as "Concussion"',async()=>{
 // Fresh-eyes QA on injuries.html caught Tyson Bagent's INJURY cell reading
 // "Concussion (Concussion)": ESPN's payload echoes the type as the detail.
 // The designation composer now drops a detail that case-insensitively equals
 // the type, while genuinely different details still compose ("Hamstring —
 // Strain (Right)"). The fix lives in js/api.js, so its cache key moves to
 // v1.113.0 on all ten pages that load it; footer branding is untouched.
 const payload={injuries:[{displayName:'Chicago Bears',injuries:[
  {athlete:{displayName:'Echo Test QB',position:{abbreviation:'QB'}},status:'Questionable',date:'2026-09-25',shortComment:'Concussion protocol',longComment:'The quarterback entered the concussion protocol on Tuesday and did not practice Friday.',details:{type:'Concussion',detail:'Concussion',side:'Not Specified'}},
  {athlete:{displayName:'Echo Case Test WR',position:{abbreviation:'WR'}},status:'Questionable',date:'2026-09-25',shortComment:'Hamstring strain',longComment:'The receiver was limited Friday with a hamstring strain.',details:{type:'hamstring',detail:'HAMSTRING',side:''}},
  {athlete:{displayName:'Normal Test LB',position:{abbreviation:'LB'}},status:'Questionable',date:'2026-09-25',shortComment:'Hamstring strain',longComment:'The linebacker was limited Friday with a hamstring strain.',details:{type:'Hamstring',detail:'Strain',side:'Right'}}
 ]}]};
 const resp={ok:true,text:async()=>JSON.stringify(payload),json:async()=>payload};
 const p=await page('injuries',{fetch:async(u)=>u.pathname.endsWith('/injuries')?resp:undefined});
 try{
  const w=p.w;await settle(300);
  const rows=[...w.document.querySelectorAll('#report-table tbody tr')];
  assert.ok(rows.length>=3,'the report table paints the fixture rows');
  const cells=rows.map(r=>r.children[2].textContent);
  assert.ok(cells.includes('Concussion'),'the echoed detail is dropped: '+cells.join(' | '));
  assert.ok(cells.includes('hamstring'),'the echo drop is case-insensitive: '+cells.join(' | '));
  assert.ok(!cells.some(c=>/\(Concussion\)/i.test(c)&&c.toLowerCase()!=='concussion'),'no "Concussion (Concussion)" remains: '+cells.join(' | '));
  assert.ok(cells.includes('Hamstring — Strain (Right)'),'a genuinely different detail still composes: '+cells.join(' | '));
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
 // Source-level pins: the dedupe ships in js/api.js, and all ten pages that
 // load api.js bust its cache at the release key.
 const api=fs.readFileSync(path.join(__dirname,'..','js','api.js'),'utf8');
 assert.ok(api.includes('dDetailEcho'),'the echo-dropping designation composer ships in js/api.js');
 for(const f of ['index','news','games','stats','odds','injuries','practice','team','about','highlights']){
  const html=fs.readFileSync(path.join(__dirname,'..',f+'.html'),'utf8');
  assert.ok(html.includes('js/api.js?v=1.127.0'),f+'.html busts the api.js cache');
 }
});

test('v1.114.0: the hero never bills a stale pre-game scoreboard as the next kickoff',async()=>{
 // The nightly-baked scoreboard can sit ~24h stale: after a Monday night game
 // it still flags the game "pre". The hero preferred the scoreboard outright,
 // so a snapshot-served fan saw last night's game as "Next kickoff" with a
 // dead "waiting for the live board" countdown. Now a "pre" game whose
 // kickoff is past the 6h grace window is discarded and the schedule's true
 // next game takes the hero.
 const stalePre=event('999','CHI','MIN','pre','2026-09-25T17:00:00Z');
 const p=await page('index',{fetch:async(u)=>{
  if(u.pathname.endsWith('/scoreboard')){
   const body={events:[stalePre]};
   return {ok:true,text:async()=>JSON.stringify(body),json:async()=>body};
  }
 }});
 try{
  const w=p.w;await settle(500);
  const title=w.document.querySelector('#ng-title').textContent;
  assert.match(title,/Philadelphia Eagles/,'the hero falls back to the schedule next game: '+title);
  assert.doesNotMatch(title,/Minnesota Vikings/,'the stale scoreboard game is gone from the hero: '+title);
  assert.ok(!/waiting for the live board/.test(w.document.querySelector('#ng-countdown').textContent),
   'no dead countdown line for a game that already kicked off');
  // Unit-level: the predicate itself.
  const api=w.CF.API;
  assert.equal(api.preGameKickoffStale({state:'pre',date:'2026-09-25T17:00:00Z'}),true,'a pre game 10h past kickoff is stale');
  assert.equal(api.preGameKickoffStale({state:'pre',date:'2026-09-26T01:00:00Z'}),false,'a pre game 2h past kickoff is inside the grace window');
  assert.equal(api.preGameKickoffStale({state:'pre',date:'2026-09-28T23:15:00Z'}),false,'a future pre game is not stale');
  assert.equal(api.preGameKickoffStale({state:'post',date:'2026-09-25T17:00:00Z'}),false,'a final is not stale (it renders as Last result)');
  assert.equal(api.preGameKickoffStale({state:'in',date:'2026-09-25T17:00:00Z'}),false,'a live game is never discarded');
  assert.equal(api.preGameKickoffStale(null),false,'null is not stale');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
 // Source-level pins: the guard ships in js/api.js + js/home.js, and the two
 // changed scripts bust their cache at the release key.
 const apiSrc=fs.readFileSync(path.join(__dirname,'../js','api.js'),'utf8');
 assert.ok(apiSrc.includes('preGameKickoffStale'),'the stale-pre guard ships in js/api.js');
 const homeSrc=fs.readFileSync(path.join(__dirname,'../js','home.js'),'utf8');
 assert.ok(homeSrc.includes('preGameKickoffStale(game)'),'the hero consults the guard in js/home.js');
 const index=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.ok(index.includes('js/home.js?v=1.195.0'),'index.html busts the home.js cache');
 assert.ok(index.includes('js/api.js?v=1.127.0'),'index.html busts the api.js cache');
});

test('v1.115.0: the week clock stops crowning a stale pre-game scoreboard as gameday NOW',async()=>{
 // The harness pins "now" at 2026-09-26T03:00:00Z. A scoreboard "pre" game
 // whose kickoff was 2026-09-24T17:00:00Z is stale (>6h grace) — before the
 // fix the week clock read it as active GAMEDAY because `hours <= 30` also
 // catches negative hours, and a calm Wednesday showed "gameday NOW vs
 // Minnesota" for a game played two days earlier. Now the stale game is
 // discarded and the schedule's true next game (PHI @ CHI, 2026-09-28T23:15Z
 // in the default schedule fixture -> media phase) drives the clock.
 const stalePre=event('999','MIN','CHI','pre','2026-09-24T17:00:00Z');
 const p=await page('index',{fetch:async(u)=>{
  if(u.pathname.endsWith('/scoreboard')){
   const body={events:[stalePre]};
   return {ok:true,text:async()=>JSON.stringify(body),json:async()=>body};
  }
 }});
 try{
  const w=p.w;await settle(500);
  const pill=w.document.querySelector('#week-clock-pill').textContent;
  const note=w.document.querySelector('#week-clock-note').textContent;
  const gameday=w.document.querySelector('.week-clock-phase[data-phase="gameday"]');
  const media=w.document.querySelector('.week-clock-phase[data-phase="media"]');
  assert.ok(!gameday.classList.contains('is-active'),'the stale scoreboard game no longer lights up the gameday phase');
  assert.ok(media.classList.contains('is-active'),'the schedule next game drives the clock (media week): pill='+pill);
  assert.equal(pill,'media','week-clock pill follows the schedule game: '+pill);
  assert.doesNotMatch(note,/Gameday window/i,'no "gameday window" note for a game played two days ago: '+note);
  assert.doesNotMatch(note,/Minnesota/i,'the stale opponent is gone from the week clock: '+note);
  assert.match(note,/Sep 28/,'the clock points at the schedule next game, not the stale one: '+note);
  assert.ok(!w.document.body.classList.contains('cf-gameday'),'gameday mode stays off on a quiet week');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
 // Source-level pins: the week clock and the odds fallback consult the same
 // stale-pre guard the hero got in v1.114.0, and both changed scripts bust
 // their cache at the release key.
 const homeSrc=fs.readFileSync(path.join(__dirname,'../js','home.js'),'utf8');
 assert.ok(homeSrc.includes('if (CF.API.preGameKickoffStale(game)) game = null;'),'the week clock discards a stale-pre scoreboard game in js/home.js');
 const oddsSrc=fs.readFileSync(path.join(__dirname,'../js','odds.js'),'utf8');
 assert.ok(oddsSrc.includes('!CF.API.preGameKickoffStale(g)'),'the odds fallback skips a stale-pre scoreboard game in js/odds.js');
 const index=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.ok(index.includes('js/home.js?v=1.195.0'),'index.html busts the home.js cache');
 const odds=fs.readFileSync(path.join(__dirname,'..','odds.html'),'utf8');
 assert.ok(odds.includes('js/odds.js?v=1.164.0'),'odds.html busts the odds.js cache');
});

test('v1.116.0: the home wire cards wear story-aware fallback art, not one shared photo',async()=>{
 // Fresh-eyes QA (2026-09-30): the home page's Fresh-off-the-wire cards all
 // fell back to the same soldier-field.webp whenever the feed shipped no
 // images — the wide wire never ships any — so the row read as a wall of
 // identical photos (the exact class v1.106.0 fixed on the news list, whose
 // home.js story() never received). Fallback art is now composed in place
 // with the shared story-aware glyph + tint (injury / game / roster move /
 // brand snowflake, four whisper-quiet tints hashed from the headline), and
 // a 404ing feed image swaps to that composed art via CF.storyArtFallback
 // instead of the one shared photo.
 const articles=[
  {headline:'Bears QB sidelined with concussion, questionable for Sunday',published:'2026-09-25T22:00:00Z',links:{web:{href:'https://www.espn.com/'}},images:[],description:'Limited in practice'},
  {headline:'Bears win overtime thriller over Packers at Soldier Field',published:'2026-09-25T21:00:00Z',links:{web:{href:'https://www.espn.com/'}},images:[],description:'Recap'},
  {headline:'Bears sign veteran lineman to two-year contract extension',published:'2026-09-25T20:00:00Z',links:{web:{href:'https://www.espn.com/'}},images:[],description:'Roster move'},
  {headline:'Bears defense forces three turnovers in rout',published:'2026-09-25T18:00:00Z',links:{web:{href:'https://www.espn.com/'}},images:[{url:'https://example.com/photo.jpg'}],description:'Recap'},
  {headline:'Bears announce winter fan fest on the lakefront',published:'2026-09-25T19:00:00Z',links:{web:{href:'https://www.espn.com/'}},images:[],description:'Community event'}
 ];
 const p=await page('index',{fetch:async(u)=>{
  if(u.pathname.endsWith('/news')){
   const body={articles};
   return {ok:true,text:async()=>JSON.stringify(body),json:async()=>body};
  }
 }});
 try{
  const w=p.w;await settle(400);
  const cards=[...w.document.querySelectorAll('#home-news .story-card')];
  assert.equal(cards.length,4,'the home wire renders four story cards');
  const fallbacks=[...w.document.querySelectorAll('#home-news .story-art-fallback')];
  assert.equal(fallbacks.length,3,'the three image-less stories render composed fallback art');
  const glyphs=fallbacks.map(f=>f.querySelector('.story-art-glyph').textContent);
  assert.ok(glyphs.includes('🩹'),'the injury story carries the bandage glyph: '+glyphs.join(','));
  assert.ok(glyphs.includes('🏈'),'the game story carries the football glyph: '+glyphs.join(','));
  assert.ok(glyphs.includes('📋'),'the roster-move story carries the clipboard glyph: '+glyphs.join(','));
  assert.ok(!glyphs.includes('❄')||glyphs.filter(g=>g==='❄').length<=1,'at most one card falls back to the generic snowflake: '+glyphs.join(','));
  assert.ok(fallbacks.every(f=>/\btf-t[0-3]\b/.test(f.className)),'every fallback carries a tint class');
  assert.ok(fallbacks.every(f=>f.classList.contains('story-art')),'the frost overlay class survives on fallback art');
  assert.ok(fallbacks.every(f=>f.getAttribute('aria-hidden')==='true'),'fallback art is decorative for assistive tech');
  assert.equal(w.document.querySelectorAll('#home-news img[src*="soldier-field"]').length,0,'no card wears the old shared soldier-field photo');
  // A story WITH a feed image keeps its photograph, stamped for the swap.
  const imgs=[...w.document.querySelectorAll('#home-news img.story-image')];
  assert.equal(imgs.length,1,'the story with a feed image keeps its photograph');
  assert.ok(imgs[0].getAttribute('onerror').includes('CF.storyArtFallback'),'the dead-image swap targets the composed art, not the shared photo');
  assert.ok(imgs[0].getAttribute('data-glyph')&&imgs[0].getAttribute('data-tint'),'the photograph carries its glyph+tint for the swap');
  // The dead-image swap lands with the same treatment as no image at all.
  const host=w.document.createElement('span');host.className='story-art';
  const probe=w.document.createElement('img');probe.className='story-image';
  probe.setAttribute('data-glyph','🏈');probe.setAttribute('data-tint','tf-t2');
  host.appendChild(probe);w.document.body.appendChild(host);
  w.CF.storyArtFallback(probe);
  assert.ok(!w.document.body.contains(probe),'the dead image is gone after the swap');
  const swapped=w.document.querySelector('body > .story-art-fallback');
  assert.ok(swapped,'the art slot becomes composed fallback art');
  assert.equal(swapped.querySelector('.story-art-glyph').textContent,'🏈','the swap keeps the story glyph');
  assert.ok(swapped.classList.contains('tf-t2'),'the swap keeps the tint');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
 // The wide wire (Google News) ships no images — its home cards fall back too.
 const q=await page('index',{fetch:async(u)=>{
  if(u.pathname.endsWith('/news')) throw new Error('ESPN news down');
 }});
 try{
  const w=q.w;await settle(400);
  const fallbacks=[...w.document.querySelectorAll('#home-news .story-art-fallback')];
  assert.ok(fallbacks.length>=1,'wide-wire stories render composed fallback art');
  assert.equal(w.document.querySelectorAll('#home-news img[src*="soldier-field"]').length,0,'the wide wire never wears the shared photo');
  assert.deepEqual(q.errors,[]);
 }finally{q.close();}
 // Source-level pins: the glyph/tint logic lives once in common.js, the
 // home swap beside CF.thumbFallback, the art styles in experience.css.
 const common=fs.readFileSync(path.join(__dirname,'..','js','common.js'),'utf8');
 assert.ok(common.includes('CF.thumbGlyph = (n) =>'),'common.js owns the shared CF.thumbGlyph helper');
 assert.ok(common.includes('CF.thumbTint = (n) =>'),'common.js owns the shared CF.thumbTint helper');
 assert.ok(common.includes('CF.storyArtFallback = (img) =>'),'common.js defines the home-card CF.storyArtFallback swap');
 const home=fs.readFileSync(path.join(__dirname,'..','js','home.js'),'utf8');
 assert.ok(home.includes('CF.storyArtFallback(this)'),'home.js wires dead images to the composed-art swap');
 assert.ok(!home.includes("img/soldier-field.webp"),'home.js no longer points wire cards at the single shared photo');
 const news=fs.readFileSync(path.join(__dirname,'..','js','news.js'),'utf8');
 assert.ok(news.includes('return CF.thumbGlyph(n)'),'news.js delegates to the shared glyph helper');
 const css=fs.readFileSync(path.join(__dirname,'..','css','experience.css'),'utf8');
 assert.ok(/\.story-art-fallback\s*\{[^}]*height:\s*164px/.test(css),'fallback art matches the photo slot height');
 assert.ok(/\.story-art-fallback\.tf-t1\s*\{[^}]*255,\s*122,\s*65/.test(css),'fallback art carries the warm orange whisper tint');
 // Cache-bust pins: every changed asset carries the release key everywhere.
 const index=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 for(const key of ['js/home.js?v=1.195.0','js/common.js?v=1.195.0','css/experience.css?v=1.195.0'])
  assert.ok(index.includes(key),'index.html carries the '+key+' cache key');
 const newsHtml=fs.readFileSync(path.join(__dirname,'..','news.html'),'utf8');
 assert.ok(newsHtml.includes('js/news.js?v=1.178.0'),'news.html busts the news.js cache');
 assert.ok(newsHtml.includes('js/common.js?v=1.195.0'),'news.html busts the common.js cache');
});

test('v1.117.0: the hero match-kicker wraps instead of clipping the status pill',()=>{
 const css=fs.readFileSync(path.join(__dirname,'..','css','experience.css'),'utf8');
 assert.match(css,/\.match-kicker\s*\{[^}]*flex-wrap:\s*wrap/s,'the kicker row wraps when the card narrows');
 assert.match(css,/\.match-kicker\s*\{[^}]*row-gap:\s*8px/s,'the wrapped pill keeps breathing room under the label');
 const main=fs.readFileSync(path.join(__dirname,'..','css','main.css'),'utf8');
 assert.match(main,/\.pill\s*\{[^}]*white-space:\s*nowrap/s,'the pill still holds its label on one line');
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.ok(html.includes('css/experience.css?v=1.195.0'),'index.html busts the experience.css cache');
});

test('v1.118.0: the back-to-top button ghosts when parked over a section heading',async()=>{
 const p=await page('index');try{const w=p.w,d=w.document;
  const top=d.querySelector('.cf-top');
  assert.ok(top,'the back-to-top button is injected');
  const css=fs.readFileSync(path.join(__dirname,'..','css','main.css'),'utf8');
  assert.match(css,/\.cf-top\.is-on\.is-dimmed\s*\{[^}]*opacity:\s*0\.38/s,'the parked-over-heading button ghosts');
  assert.match(css,/\.cf-top\.is-on\.is-dimmed:hover[^{]*\{[^}]*opacity:\s*1/s,'hover restores the ghosted button');
  assert.match(css,/\.cf-top:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--orange-hot\)/s,'the button has a visible keyboard focus ring');
  const js=fs.readFileSync(path.join(__dirname,'..','js','common.js'),'utf8');
  assert.ok(js.includes('getBoundingClientRect'),'the scroll chrome measures the button against the headlines');
  assert.ok(js.includes('.section-head h2'),'the dim check targets section headlines');
  const h2=d.querySelector('.section-head h2');
  assert.ok(h2,'index.html has a section headline to collide with');
  // Stub geometry: the fixed button sits at (20,400)-(66,446); the headline
  // rect is scripted per step. jsdom otherwise reports zero rects.
  top.getBoundingClientRect=()=>({left:20,top:400,right:66,bottom:446,width:46,height:46});
  let headRect={left:0,top:0,right:0,bottom:0,width:0,height:0};
  h2.getBoundingClientRect=()=>headRect;
  const realQSA=d.querySelectorAll.bind(d);
  d.querySelectorAll=(sel)=>sel==='.section-head h2'?[h2]:realQSA(sel);
  d.documentElement.scrollTop=700;w.dispatchEvent(new w.Event('scroll'));await settle(60);
  assert.ok(top.classList.contains('is-on'),'the button shows after scrolling down');
  assert.ok(!top.classList.contains('is-dimmed'),'the button stays solid over ordinary content');
  headRect={left:0,top:390,right:200,bottom:430,width:200,height:40};
  w.dispatchEvent(new w.Event('scroll'));await settle(60);
  assert.ok(top.classList.contains('is-dimmed'),'the button ghosts when it covers a section heading');
  headRect={left:0,top:0,right:0,bottom:0,width:0,height:0};
  w.dispatchEvent(new w.Event('scroll'));await settle(60);
  assert.ok(!top.classList.contains('is-dimmed'),'the button goes solid again once clear of the heading');
  d.documentElement.scrollTop=0;w.dispatchEvent(new w.Event('scroll'));await settle(60);
  assert.ok(!top.classList.contains('is-on')&&!top.classList.contains('is-dimmed'),'the button hides and un-dims at the top');
 }finally{p.close();}
});

test('v1.119.0: phones keep the section-head status tag on a composed second row',()=>{
 // Fresh-eyes phone QA (390px) caught the blunt v1.12.0 rule hiding every
 // .section-head .tag under 760px: phone readers lost the feed state
 // ("connecting", "tuning…", the week clock's "practice" phase), and heads
 // like "Fresh off the wire" were left with the "view all" link dangling
 // alone on a wrapped second line. The tag is back; the h2 owns the first
 // row (flex: 1 1 100% guarantees no mid-word squeeze when the tag wraps)
 // and the tag + link share a deliberate second row. The yard-line rule
 // still needs width, so it stays hidden under 760px. Desktop untouched.
 const css=fs.readFileSync(path.join(__dirname,'../css/experience.css'),'utf8');
 const m760=css.match(/@media \(max-width:760px\) \{([\s\S]*?)\n\}/);
 assert.ok(m760,'the 760px media block exists');
 assert.ok(!/\.section-head \.tag\s*\{\s*display:\s*none/.test(m760[1]),'the status tag is no longer hidden on phones');
 assert.match(m760[1],/\.section-head h2\s*\{\s*flex:\s*1 1 100%;\s*\}/,'the phone headline owns the first row');
 assert.match(m760[1],/\.section-head \.rule\s*\{\s*display:\s*none;\s*\}/,'the yard-line rule stays hidden on phones');
 const base=css.slice(0,css.indexOf('@media (max-width:760px)'));
 assert.ok(!/\.section-head h2\s*\{[^}]*flex:\s*1 1 100%/.test(base),'desktop keeps the inline headline composition');
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('css/experience.css?v=1.195.0'),name+'.html carries the v1.120.0 experience.css cache key');
  assert.ok(!/experience\.css\?v=1\.(1(0[012]|1[0-9]|20)|9[0-9]|8[0-9]|7[0-9]|[0-6][0-9])\.0"/.test(html),name+'.html has no stale experience.css key');
 }
 const index=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.ok(index.includes('data-cf-copy="btc"'),'footer tip chip is intact');
});

test('v1.120.0: the hero matchup becomes a real side-by-side duel',async()=>{
 // Fresh-eyes desktop QA caught the hero matchup stacking vertically with
 // the venue floating in the middle and the card's right half dead: the .vs
 // block carried grid-template-columns but no display (lost in the v1.12.0
 // port). It is a real duel now — the family .game-card .vs pattern — with
 // centered sides flanking the shared venue: "NYJ [stadium] SOLDIER FIELD CHI".
 // The venue keeps its centered, tracked, glyph-anchored voice (v1.85.0).
 const css=fs.readFileSync(path.join(__dirname,'../css/experience.css'),'utf8');
 const vs=css.match(/\.match-card \.vs\s*\{[^}]*\}/s);
 assert.ok(vs,'the .match-card .vs block exists');
 assert.ok(/display:\s*grid/.test(vs[0]),'the matchup block is a grid, not a stacked block');
 assert.ok(/grid-template-columns:\s*1fr auto 1fr/.test(vs[0]),'the duel uses the family 1fr auto 1fr columns');
 assert.ok(/align-items:\s*center/.test(vs[0]),'the sides align on the duel axis');
 assert.ok(!/1fr 1\.1fr 1fr/.test(vs[0]),'the dead v1.12.0 column spec is gone');
 assert.match(css,/\.match-card \.vs \.side\s*\{[^}]*text-align:\s*center/s,'the duel sides center their abbreviations');
 assert.match(css,/\.match-card \.vs > \.mid\s*\{[^}]*margin:\s*0/s,'the venue sheds its dead vertical margins in the duel column');
 // The v1.85.0 venue voice survives the duel conversion.
 assert.match(css,/\.match-card \.mid\s*\{[^}]*text-align:\s*center/s,'the venue line still centers');
 assert.match(css,/\.match-card \.mid::before\s*\{[^}]*🏟/s,'the stadium glyph still anchors the venue line');
 // Narrow phones keep the duel with a tighter gap and narrower venue tracking.
 const m440=css.match(/@media \(max-width:440px\) \{([\s\S]*?)\n\}/);
 assert.ok(m440,'the 440px media block exists');
 assert.match(m440[1],/\.match-card \.vs\s*\{[^}]*gap:\s*8px/s,'phones tighten the duel gap');
 // Behavioral: the matchup data still paints into the duel's three columns.
 const p=await page('index');try{
  const d=p.w.document;
  const vsEl=d.querySelector('#next-game .vs');
  assert.ok(vsEl.querySelector('.side .abbr'),'the away column paints');
  assert.ok(vsEl.querySelector('.side.is-bears .abbr'),'the Bears column paints');
  const mid=d.querySelector('#ng-mid');
  assert.equal(mid.textContent,'Soldier Field','the fixture venue still paints into the duel column');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
 // The stylesheet changed, so the fresh key rides everywhere, with branding intact.
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('css/experience.css?v=1.195.0'),name+'.html carries the v1.120.0 experience.css cache key');
  assert.ok(!/experience\.css\?v=1\.(1(0[012]|1[0-9]|20)|9[0-9]|8[0-9]|7[0-9]|[0-6][0-9])\.0"/.test(html),name+'.html has no stale experience.css key');
  assert.ok(html.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
  assert.ok(html.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
 }
 const index=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.ok(index.includes('3GnR…8vZK'),'the BTC tip chip address survives in the footer');
});

test('v1.121.0: the featured highlights poster is never a black void',async()=>{
 // Fresh-eyes QA on the highlights page (thumbnail host unreachable) caught
 // the featured player as a black rectangle with a lone play button: cards
 // have the hlThumbFail frost-glyph fallback, but the poster div painted its
 // background-image straight from the (failed) thumb. The poster now wears a
 // composed ice-steel gradient + frost glyph while the thumb loads or when
 // it can't; a probe paints the thumb and retires the glyph on success, and
 // marks the poster hl-poster-bad (brighter glyph, gentle breathe) on error.
 const css=fs.readFileSync(path.join(__dirname,'../css/highlights.css'),'utf8');
 const poster=css.match(/\.hl-feature \.hl-poster\s*\{[^}]*background-color:[^}]*\}/s);
 assert.ok(poster,'the poster fallback-surface block exists');
 assert.match(poster[0],/background-color:\s*#0c1628/,'the poster has a fallback base color');
 assert.match(poster[0],/background-image:\s*linear-gradient\(135deg,[^)]*#16304e 100%\)/s,'the poster wears an ice-steel gradient while the thumb loads');
 assert.match(css,/\.hl-feature \.hl-poster \.hl-frost\s*\{[^}]*left:\s*50%[^}]*top:\s*50%/s,'the frost glyph centers on the poster');
 assert.match(css,/\.hl-feature \.hl-poster\.hl-poster-bad \.hl-frost\s*\{[^}]*opacity:\s*0\.5/s,'the failed-thumb state brightens the glyph');
 assert.match(css,/@keyframes hl-frost-breathe/,'the failure glyph breathes');
 assert.match(css,/@media \(prefers-reduced-motion: no-preference\) \{\s*\.hl-feature \.hl-poster\.hl-poster-bad \.hl-frost/s,'the breathe animation respects reduced motion');
 const js=fs.readFileSync(path.join(__dirname,'../js/highlights.js'),'utf8');
 assert.ok(js.includes('new Image()'),'the poster probes the thumbnail before painting it');
 assert.ok(/probe\.onload\s*=\s*function\s*\(\)\s*\{[^}]*style\.backgroundImage/.test(js),'probe success paints the real thumbnail');
 assert.ok(/probe\.onload\s*=\s*function\s*\(\)\s*\{[\s\S]*?querySelector\("\.hl-frost"\)[\s\S]*?removeChild/.test(js),'probe success retires the frost glyph');
 assert.ok(/probe\.onerror\s*=\s*function\s*\(\)\s*\{\s*poster\.classList\.add\("hl-poster-bad"\)/.test(js),'probe failure marks the poster instead of leaving a void');
 assert.ok(!/id="hl-poster"[^>]*style="background-image/.test(js),'the poster no longer paints the thumb inline before it is verified');
 // Behavioral (jsdom never resolves the probe — exactly the stuck-loading
 // case): the poster shows the composed surface, not a black void.
 const p=await page('highlights');try{
  const d=p.w.document;
  const el=d.querySelector('#hl-poster');
  assert.ok(el,'the featured poster renders');
  assert.ok(el.querySelector('.hl-frost'),'the frost glyph waits while the thumbnail loads');
  assert.equal(el.style.backgroundImage,'','no unverified thumbnail is painted inline');
  assert.equal(el.getAttribute('role'),'button','the poster stays a keyboard-operable button');
  assert.ok(el.getAttribute('aria-label').startsWith('Play: '),'the play action keeps its accessible name');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
 const html=fs.readFileSync(path.join(__dirname,'..','highlights.html'),'utf8');
 assert.ok(html.includes('css/highlights.css?v=1.187.0'),'highlights.html busts the highlights.css cache');
 assert.ok(html.includes('js/highlights.js?v=1.181.0'),'highlights.html busts the highlights.js cache');
 assert.ok(!/highlights\.(css|js)\?v=1\.110\.0/.test(html),'highlights.html has no stale highlights cache keys');
 assert.ok(html.includes('data-cf-copy="btc"'),'the BTC tip chip survives on highlights.html');
});

test('v1.122.0: recovery-shaped stories wear the injury bandage, not the brand snowflake',async()=>{
 // Behavioral: the live wire once ran "Behind the recovery process that has
 // Chicago Bears LT Ozzy Trapilo on the doorstep of playing" in the generic
 // snowflake even though it is plainly an injury story.
 const q=await page('index');
 try{
  const CF=q.w.CF;
  assert.equal(CF.thumbGlyph({heading:'Behind the recovery process that has Chicago Bears LT Ozzy Trapilo on the doorstep of playing',description:''}),'🩹','recovery story gets the bandage');
  assert.equal(CF.thumbGlyph({heading:'Caleb Williams recovering from his hamstring strain',description:''}),'🩹','recovering story gets the bandage');
  assert.equal(CF.thumbGlyph({heading:'One potential old solution exists to new Chicago Bears injury issue',description:''}),'🩹','plain injury story keeps the bandage');
  assert.equal(CF.thumbGlyph({heading:'Case Keenum found the love with Ben Johnson',description:''}),'❄','non-injury story keeps the brand snowflake');
  assert.deepEqual(q.errors,[]);
 }finally{q.close();}
 // Source-level pins: the news-page injury rail regex stays mirrored with
 // the shared glyph helper so a recovery story lands in the rail AND wears
 // the bandage glyph there too.
 const common=fs.readFileSync(path.join(__dirname,'..','js','common.js'),'utf8');
 const news=fs.readFileSync(path.join(__dirname,'..','js','news.js'),'utf8');
 assert.ok(common.includes('recover(?:y|ies|ing|ed)?'),'common.js glyph regex catches recovery-shaped stories');
 assert.ok(news.includes('recover(?:y|ies|ing|ed)?'),'news.js INJURY_RE stays mirrored with the glyph regex');
 // Cache-bust pins: both changed assets carry the release key everywhere.
 const newsHtml=fs.readFileSync(path.join(__dirname,'..','news.html'),'utf8');
 assert.ok(newsHtml.includes('js/news.js?v=1.178.0'),'news.html busts the news.js cache');
 assert.ok(newsHtml.includes('js/common.js?v=1.195.0'),'news.html busts the common.js cache');
 const index=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.ok(index.includes('js/common.js?v=1.195.0'),'index.html busts the common.js cache');
});

test('v1.123.0: the injury grid stops bleeding past the phone viewport',async()=>{
 // Behavioral: table.tbl carries min-width: 560px by design (it scrolls
 // inside .tbl-wrap), but as a grid item .tbl-wrap's automatic minimum is
 // that min-content width — and a 1fr track is really minmax(auto, 1fr), so
 // the collapsed single column inflated to ~562px on a 390px phone. The
 // report column, the "keep it honest" callout, and the wire rail spilled
 // past the right edge, where body overflow-x: clip cut the text mid-word.
 // The fix zeroes the items' minimum; the table keeps its own scroll.
 // Source pins (jsdom has no layout engine, so the width behavior is
 // pinned at the source level; the actual 390px rendering was verified in
 // headless Chromium: the collapsed track measured 562px before the fix
 // and 358.8px after, with the table still scrolling inside .tbl-wrap).
 const css=fs.readFileSync(path.join(__dirname,'../css/main.css'),'utf8');
 assert.ok(css.includes('#injury-grid > * { min-width: 0; }'),'main.css carries the injury-grid min-width reset');
 assert.ok(/table\.tbl\s*\{[^}]*min-width:\s*560px/s.test(css),'the table keeps its designed 560px floor');
 assert.ok(/\.tbl-wrap\s*\{[^}]*overflow-x:\s*auto/s.test(css),'the wrapper still scrolls the table horizontally');
 const p=await page('injuries',{mobile:true});
 try{
  const d=p.w.document;
  assert.ok(d.getElementById('injury-grid'),'#injury-grid exists on injuries.html');
  assert.ok(d.querySelector('#injury-grid .tbl-wrap table.tbl'),'the report table rides inside .tbl-wrap in the grid');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
 // Cache-bust pin: the stylesheet changed, so all 11 pages carry the key.
 for(const name of ['404','about','games','highlights','index','injuries','news','odds','practice','stats','team']){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'),name+'.html busts the main.css cache');
  assert.ok(!/main\.css\?v=(?!1\.191\.0")1\.[0-9]+\.0"/.test(html),name+'.html has no stale main.css key');
  assert.ok(html.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
  assert.ok(html.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
 }
});

test('v1.169.0: the news grid stops bleeding past small phone viewports',async()=>{
 // Behavioral: #news-grid never got the min-width reset v1.123.0 gave
 // #injury-grid, and its items are grid containers themselves
 // (.news-list is display:grid). The loading panel's max-content
 // (~337px: the .empty-sub copy at its 42ch cap plus panel padding)
 // became the collapsed single track's floor, so under ~376px the
 // wire list and the injury rail stuck out past the right edge and
 // the page scrolled sideways while the wire tuned in. The fix
 // zeroes the items' minimum, same as the injury grid; the desktop
 // 2fr/1fr split is untouched. Source pins (jsdom has no layout
 // engine; the actual rendering was verified in headless Chromium:
 // at 320px the document measured 349px wide before the fix —
 // #news-list 337px inside a 281px wrap, #injury-news reaching
 // right=349 — and exactly the wrap width after, at 320/360/390px,
 // with the 1440px two-column split byte-identical).
 const css=fs.readFileSync(path.join(__dirname,'../css/main.css'),'utf8');
 assert.ok(css.includes('#news-grid > * { min-width: 0; }'),'main.css carries the news-grid min-width reset');
 assert.ok(css.includes('#injury-grid > * { min-width: 0; }'),'the v1.123.0 injury-grid reset survives beside it');
 assert.ok(/#news-grid,\s*#injury-grid\s*\{\s*grid-template-columns:\s*1fr !important/.test(css),'both rail grids still collapse under 860px');
 const p=await page('news',{mobile:true});
 try{
  const d=p.w.document;
  assert.ok(d.getElementById('news-grid'),'#news-grid exists on news.html');
  assert.ok(d.querySelector('#news-grid > #news-list.news-list'),'the wire list rides as a direct grid item');
  assert.ok(d.querySelector('#news-grid > .rail#injury-rail'),'the injury rail keeps its grid slot');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
 // Cache-bust pin: the stylesheet changed, so all 11 pages carry the key.
 for(const name of ['404','about','games','highlights','index','injuries','news','odds','practice','stats','team']){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'),name+'.html busts the main.css cache');
  assert.ok(!/main\.css\?v=(?!1\.191\.0")1\.[0-9]+\.0"/.test(html),name+'.html has no stale main.css key');
  assert.ok(html.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
  assert.ok(html.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
 }
});

test('v1.124.0: pausing snow can never strand entrance animations invisible',async()=>{
 // Behavioral (verified in headless Chromium): the homepage quick-nav grid
 // uses a `backwards` fill with a staggered delay, and snow.js toggles
 // `motion-paused` on <html> whenever snow is off — pausing during the first
 // second of load froze all 9 tiles at the opacity-0 from-frame forever
 // (a 422px dead gap under "YOUR FAN PLAYBOOK"). The same trap applied to
 // every `.cf-enter` family (news, donation, player, highlight, boxscore,
 // stat cards) and to `.whiteout-card` (a `both` fill). The fix snaps every
 // entrance family to its finished state the moment motion is paused.
 // Source pins (jsdom doesn't run animations, so the frozen-fill behavior
 // is pinned at the source level; the 300ms-pause probe was verified in
 // headless Chromium: 9/9 tiles opacity 0 before, all visible after).
 const css=fs.readFileSync(path.join(__dirname,'../css/experience.css'),'utf8');
 const hatch=css.match(/\.motion-paused\s+\.grid\.quick\s+a,\s*\.motion-paused\s+\.cf-enter,\s*\.motion-paused\s+\.whiteout-card\s*\{([^}]*)\}/);
 assert.ok(hatch,'the motion-paused entrance hatch covers the quick grid, every .cf-enter card, and the whiteout card');
 const decls=hatch[1];
 assert.ok(/opacity:\s*1/.test(decls),'the hatch forces full opacity');
 assert.ok(/transform:\s*none/.test(decls),'the hatch clears the entrance translate');
 assert.ok(/filter:\s*none/.test(decls),'the hatch clears the entrance blur');
 assert.ok(/animation:\s*none/.test(decls),'the hatch kills the paused backwards fill entirely');
 // The trigger is real site logic, not a test-only class: snow.js toggles
 // it on <html> whenever snow is off (or the OS prefers reduced motion).
 const snow=fs.readFileSync(path.join(__dirname,'..','js','snow.js'),'utf8');
 assert.ok(/document\.documentElement\.classList\.toggle\("motion-paused"/.test(snow),'snow.js still drives the motion-paused class on <html>');
 // The frozen-fill source is still a backwards fill on the quick grid —
 // that's what made this trap deterministic.
 const main=fs.readFileSync(path.join(__dirname,'../css/main.css'),'utf8');
 assert.ok(/\.grid\.quick\s+a\s*\{\s*animation:\s*cfSnapIn\s+0\.55s[^;]*backwards/.test(main),'the quick grid keeps its staggered backwards entrance (the trap the hatch defuses)');
 // Cache-bust pin: the stylesheet changed, so all 11 pages carry the key.
 for(const name of ['404','about','games','highlights','index','injuries','news','odds','practice','stats','team']){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('css/experience.css?v=1.195.0'),name+'.html busts the experience.css cache');
  assert.ok(!/experience\.css\?v=(?!1.195.0\")1\.[0-9]+\.0"/.test(html),name+'.html has no stale experience.css key');
  assert.ok(html.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
  assert.ok(html.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
 }
});

test('v1.125.0: the back-to-top button hides when parked over the site footer',()=>{
 // On phones the fixed 44px circle sits at the left edge exactly where the
 // footer's "Tip the build · BTC" chip and social links start — headless QA
 // caught it parked on top of the chip (games.html, 390px). The v1.118.0
 // ghost only covers section headings; over the footer the button hides
 // outright (you're at the page bottom — one short scroll brings it back),
 // and visibility keeps it out of the keyboard tab order while hidden.
 const css=fs.readFileSync(path.join(__dirname,'../css/main.css'),'utf8');
 const park=css.match(/\.cf-top\.is-on\.is-parked\s*\{([^}]*)\}/);
 assert.ok(park,'the parked-over-footer rule exists');
 assert.ok(/opacity:\s*0/.test(park[1]),'the parked button fades fully out (no ghost over the tip chip)');
 assert.ok(/visibility:\s*hidden/.test(park[1]),'the parked button leaves the tab order while hidden');
 assert.ok(/pointer-events:\s*none/.test(park[1]),'the parked button cannot be clicked through the footer');
 assert.ok(/transition:[^;]*visibility/.test(css),'the button transition covers visibility so the hide flips after the fade');
 const js=fs.readFileSync(path.join(__dirname,'..','js','common.js'),'utf8');
 assert.ok(js.includes('footer.site-foot'),'the scroll chrome measures against the site footer');
 assert.ok(js.includes('is-parked'),'the scroll chrome toggles the parked state');
 assert.ok(/getBoundingClientRect\(\).*site-foot|site-foot[\s\S]{0,400}?getBoundingClientRect/.test(js.replace(/\n/g,' ') ) || js.includes('fr = foot.getBoundingClientRect()'),'the footer is measured with a real rect intersection');
 // Cache-bust pins: both changed assets carry the release key on all 11
 // pages — a stale key would keep serving the overlapping button.
 for(const name of ['404','about','games','highlights','index','injuries','news','odds','practice','stats','team']){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('js/common.js?v=1.195.0'),name+'.html busts the common.js cache');
  assert.ok(!/common\.js\?v=(?!1.195.0")1\.[0-9]+\.0"/.test(html),name+'.html has no stale common.js key');
  assert.ok(html.includes('css/main.css?v=1.191.0'),name+'.html busts the main.css cache');
  assert.ok(!/main\.css\?v=(?!1\.191\.0")1\.[0-9]+\.0"/.test(html),name+'.html has no stale main.css key');
  assert.ok(html.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
  assert.ok(html.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
 }
});

test('v1.126.0: pausing snow can never hide the homepage hero',async()=>{
 // Behavioral (verified in headless Chromium): the hero entrance family
 // (@keyframes cf-hero-rise, `both` fill, gated on no-preference) freezes at
 // the opacity-0/blurred from-frame whenever `.motion-paused` lands on
 // <html> — which is exactly what snow.js does when a visitor has snow
 // turned off (a persistent localStorage pref). Result: the ENTIRE hero —
 // headline, deck, CTAs, matchup card, season strip, wire ticker — stayed
 // invisible forever for snow-paused visitors at both 1440px and 390px.
 // The v1.124.0 hatch missed this family. The fix extends it, placed AFTER
 // the hero entrance block so it wins the equal-specificity source-order
 // tie with the media-query entrance rules. jsdom doesn't run animations,
 // so the frozen-fill behavior is pinned at the source level plus a cascade
 // check: with .motion-paused present, the hero h1 computes opacity 1 and
 // no animation.
 const css=fs.readFileSync(path.join(__dirname,'../css/experience.css'),'utf8');
 const sel=['.motion-paused .hero-copy .eyebrow','.motion-paused .hero-copy h1',
  '.motion-paused .hero-copy .sub','.motion-paused .hero-actions','.motion-paused .hero-note',
  '.motion-paused .hero-layout .match-card','.motion-paused .season-strip','.motion-paused .wire-ticker'];
 for(const s of sel)assert.ok(css.includes(s),'the hero hatch covers '+s);
 const hatch=css.match(/\.motion-paused\s+\.hero-copy\s+\.eyebrow[\s\S]*?\{([\s\S]*?)\}/);
 assert.ok(hatch,'the hero motion-paused hatch exists');
 assert.ok(/opacity:\s*1/.test(hatch[1]),'the hero hatch forces full opacity');
 assert.ok(/filter:\s*none/.test(hatch[1]),'the hero hatch clears the entrance blur');
 assert.ok(/animation:\s*none/.test(hatch[1]),'the hero hatch kills the paused both-fill entirely');
 // Source order: the hatch must come after the hero entrance rules so it
 // beats the media-query rules on the equal-specificity tie.
 const entranceIdx=css.indexOf('.wire-ticker             { animation: cf-hero-rise');
 const hatchIdx=css.indexOf('.motion-paused .hero-copy .eyebrow');
 assert.ok(entranceIdx>-1&&hatchIdx>entranceIdx,'the hero hatch sits after the hero entrance rules (source order beats the tie)');
 // The trap is real site logic: the hero uses a `both` fill with delays.
 assert.ok(/\.hero-copy\s+h1\s*\{\s*animation:\s*cf-hero-rise[^;]*both/.test(css),'the hero h1 keeps its cf-hero-rise both-fill entrance (the trap the hatch defuses)');
 // Cascade check in jsdom: with .motion-paused on <html>, the hero h1
 // computes visible with no animation, so it can never strand invisible.
 const p=await page('index');try{
  p.w.document.documentElement.classList.add('motion-paused');
  const h1=p.w.document.querySelector('.hero-copy h1');
  assert.ok(h1,'the homepage hero h1 renders');
  const cs=p.w.getComputedStyle(h1);
  assert.equal(cs.opacity,'1','hero h1 computes opacity 1 under motion-paused');
  assert.ok(cs.animationName===''||cs.animationName==='none','hero h1 runs no animation under motion-paused');
 }finally{p.close();}
 // Cache-bust pin: the stylesheet changed, so all 11 pages carry the key.
 for(const name of ['404','about','games','highlights','index','injuries','news','odds','practice','stats','team']){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('css/experience.css?v=1.195.0'),name+'.html busts the experience.css cache');
  assert.ok(!/experience\.css\?v=(?!1.195.0\")1\.[0-9]+\.0"/.test(html),name+'.html has no stale experience.css key');
  assert.ok(html.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
  assert.ok(html.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
 }
});

test('v1.127.0: freshness stamps wear the data\'s own age, not the paint time',async()=>{
 // Fresh-eyes review (2026-09-30): every success pill stamped Date.now() —
 // honest for live feeds, but a saved snapshot harvested days ago still read
 // "1s ago" (season log: "saved snapshot · 17 games · 1s ago" for a 4-day-old
 // file): the same badge meaning two different things. CF.dataEpoch resolves
 // snapshot/cache results to the payload's own harvest time (timestamp,
 // harvestedAt, fetched, or meta.harvestedAt — the snapshot files don't
 // agree on a field name); live stays now; anything unparseable falls back
 // to now. Single-source pills route through it; genuinely-live fetches
 // (API-Sports, Polymarket) and composite pills (hero desk, odds pulse,
 // derived standings) keep the paint time, which is what they describe.
 const p=await page('index');try{const w=p.w,CF=w.CF,now=w.Date.now();
  assert.equal(typeof CF.dataEpoch,'function','CF.dataEpoch is exposed');
  const ts='2026-09-26T04:34:33Z',ms=w.Date.parse(ts);
  assert.equal(CF.dataEpoch({source:'live',data:{timestamp:ts}}),now,'live stays now even with a payload timestamp');
  assert.equal(CF.dataEpoch({source:'snapshot',data:{timestamp:ts}}),ms,'snapshot timestamp wins');
  assert.equal(CF.dataEpoch({source:'snapshot',data:{harvestedAt:ts}}),ms,'harvestedAt is honored');
  assert.equal(CF.dataEpoch({source:'cache',data:{fetched:ts}}),ms,'fetched is honored');
  assert.equal(CF.dataEpoch({source:'snapshot',data:{meta:{harvestedAt:ts}}}),ms,'meta.harvestedAt is honored');
  assert.equal(CF.dataEpoch({source:'snapshot',data:{}}),now,'a snapshot with no harvest time falls back to now');
  assert.equal(CF.dataEpoch({source:'snapshot',data:{timestamp:'not-a-date'}}),now,'a garbage harvest time falls back to now');
  assert.equal(CF.dataEpoch(null),now,'a null result falls back to now');
  assert.equal(CF.dataEpoch({source:'snapshot'}),now,'a missing payload falls back to now');
 }finally{p.close();}
 // The RSS snapshot path stashes its harvest time for the wire pills.
 const api=fs.readFileSync(path.join(__dirname,'../js/api.js'),'utf8');
 assert.ok(/CF\.API\.rssEpoch\s*=\s*Date\.parse\(snap\.harvestedAt\)/.test(api),'getGoogleNews stashes the RSS snapshot harvest time');
 assert.ok(/CF\.API\.rssEpoch\s*=\s*null/.test(api),'the epoch resets so a stale harvest never leaks into a live win');
 // Source-level pin: the single-source pills route through dataEpoch, and
 // the genuinely-live / composite pills still stamp the paint time.
 const counts={games:2,home:2,injuries:3,news:1,odds:1};
 for(const [f,n] of Object.entries(counts)){
  const src=fs.readFileSync(path.join(__dirname,'../js',f+'.js'),'utf8');
  const hits=(src.match(/CF\.dataEpoch\(/g)||[]).length;
  assert.equal(hits,n,f+'.js routes '+n+' single-source pill(s) through CF.dataEpoch');
 }
 const inj=fs.readFileSync(path.join(__dirname,'../js/injuries.js'),'utf8');
 assert.ok(/"live · API-Sports", Date\.now\(\)/.test(inj),'the genuinely-live API-Sports fetch keeps the paint time');
 const od=fs.readFileSync(path.join(__dirname,'../js/odds.js'),'utf8');
 assert.ok(/"Polymarket · live", Date\.now\(\)/.test(od),'the genuinely-live Polymarket fetch keeps the paint time');
 // Cache-bust pin: every changed JS file carries the new key on the pages
 // that include it, with no stale key left behind. common.js moved to
 // v1.128.0 (weather-strip .wrap fix); the rest hold at v1.127.0.
 const pages={common:['404','about','games','highlights','index','injuries','news','odds','practice','stats','team'],
  api:['about','games','highlights','index','injuries','news','odds','practice','stats','team'],
  games:['games'],home:['index'],injuries:['injuries'],news:['news'],odds:['odds']};
 const vers={common:'1.195.0',api:'1.127.0',games:'1.193.0',home:'1.195.0',injuries:'1.177.0',news:'1.178.0',odds:'1.164.0'};
 for(const [f,ns] of Object.entries(pages))for(const name of ns){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  const v=vers[f],ve=v.replace(/\./g,'\\.');
  assert.ok(html.includes('js/'+f+'.js?v='+v),name+'.html busts the '+f+'.js cache');
  assert.ok(!new RegExp('js/'+f+'\\.js\\?v=(?!'+ve+'")1\\.[0-9]+\\.0"').test(html),name+'.html has no stale '+f+'.js key');
  assert.ok(html.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
  assert.ok(html.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
 }
});

test('v1.128.0: the weather strip rides in .wrap so the flex row \u2014 and the mobile swipe row \u2014 actually applies',async()=>{
 // The strip's CSS has always been written for `.weather-strip .wrap`:
 // a flex row with 18px gaps and the CFI gauge docked right via
 // margin-left:auto, collapsing on phones (<=960px) to a single-row
 // horizontal swipe instead of a wrapped stack. But renderWeatherStrip
 // injected its spans straight into the strip \u2014 the selectors never
 // matched, so the row never became a flex container: on phones the
 // items wrapped into a tall stack and the gauge never docked right.
 // The strip content now rides in a .wrap, activating the intended layout.
 const common=fs.readFileSync(path.join(__dirname,'..','js','common.js'),'utf8');
 assert.ok(/<div class="wrap">/.test(common),'renderWeatherStrip wraps the strip content in .wrap');
 const p=await page('index');try{const w=p.w;
  await settle(150);
  const strip=w.document.querySelector('.weather-strip');
  assert.ok(strip,'the weather strip renders');
  const wrap=strip.querySelector(':scope > .wrap');
  assert.ok(wrap,'the strip carries a direct .wrap child, so .weather-strip .wrap selectors match');
  assert.ok(wrap.querySelector('.wx-brand'),'the brand rides inside the wrap');
  assert.ok(wrap.querySelector('#wx-now'),'the now line rides inside the wrap');
  assert.ok(wrap.querySelector('.wx-cfi'),'the Cold Front Index gauge rides inside the wrap');
  assert.equal(strip.querySelectorAll(':scope > span').length,0,'no bare spans remain directly under the strip');
 }finally{p.close();}
});

test('v1.129.0: empty states inside scrolling tables size to the phone scrollport',async()=>{
 // table.tbl carries a 560px min-width inside .tbl-wrap (overflow-x:auto),
 // so a centered .empty panel in a colspan cell would center inside the
 // 560px scroll canvas and get sliced at the phone viewport — practice.html's
 // "Tracker is empty" read "TRACKER IS EMP" at 390px (injuries.html's report
 // table shares the pattern). On <=640px viewports the panel now sizes to the
 // visible scrollport instead; the desktop layout is untouched.
 const css=fs.readFileSync(path.join(__dirname,'..','css','main.css'),'utf8');
 const mq=css.indexOf('@media (max-width: 640px)');
 assert.ok(mq>-1,'the narrow-viewport table fix carries a 640px media query');
 const rule=css.indexOf('.tbl-wrap .tbl td > .empty',mq);
 assert.ok(rule>mq,'the rule targets .empty panels inside .tbl-wrap .tbl cells');
 assert.ok(/width:\s*calc\(100vw - 64px\)/.test(css.slice(rule,rule+200)),'the panel sizes to the scrollport width');
 assert.ok(/max-width:\s*100%/.test(css.slice(rule,rule+200)),'the panel never exceeds its cell');
 assert.ok(/box-sizing:\s*border-box/.test(css.slice(rule,rule+200)),'padding stays inside the panel width');
});

test('v1.131.0: facility-card CTAs pin to one baseline no matter the copy length',async()=>{
 // Fresh-eyes QA (2026-10-01) caught the practice.html facility row with its
 // three CTAs ("Go behind the scenes" / "Official camp information" /
 // "Plan your stadium visit") floating at three different heights — the
 // cards share a row but the buttons sat on no common baseline because the
 // copy blocks are different lengths. The row now carries .facility-cards,
 // whose cards are flex columns with the trailing button on margin-top:auto
 // (align-self:flex-start keeps the natural width, the paragraph keeps the
 // designed 18px gap) so all three CTAs sit on one baseline. The rule is
 // scoped — no other .card row changes shape.
 const css=fs.readFileSync(path.join(__dirname,'..','css','main.css'),'utf8');
 const r=css.indexOf('.facility-cards .card {');
 assert.ok(r>-1,'main.css scopes a flex-column rule to .facility-cards .card');
 const block=css.slice(r,r+260);
 assert.ok(/display:\s*flex/.test(block),'facility cards lay out as flex columns');
 assert.ok(/flex-direction:\s*column/.test(block),'flex direction is column');
 assert.ok(css.includes('.facility-cards .card .btn'),'a scoped rule covers the facility-card CTA');
 assert.ok(/margin-top:\s*auto/.test(css.slice(css.indexOf('.facility-cards .card .btn'),css.indexOf('.facility-cards .card .btn')+160)),'the CTA eats free space with margin-top:auto');
 assert.ok(/align-self:\s*flex-start/.test(css.slice(css.indexOf('.facility-cards .card .btn'),css.indexOf('.facility-cards .card .btn')+160)),'the CTA keeps its natural width (no full-width stretch)');
 const practice=fs.readFileSync(path.join(__dirname,'..','practice.html'),'utf8');
 assert.ok(practice.includes('grid grid-3 facility-cards'),'practice.html marks the facility row with .facility-cards');
 assert.ok(!practice.includes('style="margin-top:18px"'),'no inline button margins fight the margin-top:auto');
 // The CSS changed, so every page that serves it must bust the cache — a
 // stale key would keep showing the drifting CTAs to returning visitors.
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'),name+'.html carries the v1.143.0 main.css cache key');
  assert.ok(!/main\.css\?v=1\.130\.0/.test(html),name+'.html has no stale 1.130.0 main.css key');
 }
});

test('v1.130.0: imageless wire tiles wear composed ghost-glyph art, not broken-image reads',async()=>{
 // A wire story that ships no image used to render a lone glyph floating in
 // a dark void (home cards) or a dashed-bordered box with a tiny glyph
 // (news list) — both read as failed images. Fallback tiles now carry
 // data-glyph so a large faint ghost of the story glyph composes behind
 // the main glyph, and news-list tiles wear the same solid hairline
 // border as real thumbs instead of the dashed placeholder border.
 const exp=fs.readFileSync(path.join(__dirname,'..','css','experience.css'),'utf8');
 const ghost=exp.indexOf('.story-art-fallback::before');
 assert.ok(ghost>-1,'experience.css composes a ghost layer on home fallback tiles');
 assert.ok(/content:\s*attr\(data-glyph\)/.test(exp.slice(ghost,ghost+400)),'the ghost echoes the tile\'s own story glyph');
 assert.ok(/z-index:\s*-1/.test(exp.slice(ghost,ghost+400)),'the ghost sits behind the main glyph');
 const main=fs.readFileSync(path.join(__dirname,'..','css','main.css'),'utf8');
 const tile=main.indexOf('.news-item .thumb-fallback {');
 assert.ok(tile>-1,'main.css styles the news-list fallback tile');
 assert.ok(/border:\s*1px solid var\(--line\)/.test(main.slice(tile,tile+700)),'the list tile wears a solid hairline like real thumbs, not a dashed placeholder border');
 const tileGhost=main.indexOf('.news-item .thumb-fallback::before');
 assert.ok(tileGhost>-1,'main.css composes a ghost layer on news-list tiles');
 assert.ok(/content:\s*attr\(data-glyph\)/.test(main.slice(tileGhost,tileGhost+400)),'the list ghost echoes the tile\'s own story glyph');
 const home=fs.readFileSync(path.join(__dirname,'..','js','home.js'),'utf8');
 assert.ok(/data-glyph=/.test(home),'home.js stamps data-glyph on imageless wire tiles');
 const news=fs.readFileSync(path.join(__dirname,'..','js','news.js'),'utf8');
 assert.ok(/data-glyph=/.test(news),'news.js stamps data-glyph on imageless wire tiles');
 const common=fs.readFileSync(path.join(__dirname,'..','js','common.js'),'utf8');
 assert.ok(/setAttribute\("data-glyph"/.test(common),'the dead-image swaps carry data-glyph through to the composed tile');
 const p=await page('index');try{const w=p.w;
  await settle(150);
  const tileEl=w.document.querySelector('.story-art-fallback');
  assert.ok(tileEl,'an imageless wire story renders a fallback tile');
  assert.ok(tileEl.getAttribute('data-glyph'),'the rendered tile carries its glyph on data-glyph');
  assert.equal(tileEl.getAttribute('data-glyph'),tileEl.querySelector('.story-art-glyph').textContent,'the ghost echoes the visible glyph');
 }finally{p.close();}
 const n=await page('news');try{const w=n.w;
  await settle(150);
  const list=w.document.querySelector('.news-item .thumb-fallback');
  assert.ok(list,'an imageless news-list story renders a fallback tile');
  assert.ok(list.getAttribute('data-glyph'),'the list tile carries its glyph on data-glyph');
 }finally{n.close();}
});

test('v1.132.0: highlights video cards keep their 16/9 thumbs, centered play badge, and visible titles',async()=>{
 // Fresh-eyes QA (2026-10-01) caught the highlights grid broken on the live
 // page: .hl-thumb and .hl-body are <span>s with no display rule, so the
 // 16/9 aspect-ratio was ignored (thumbs painted at the image's own ratio),
 // the play badge's left:50% resolved against the inline box (the badge hung
 // off the card's left edge, half-clipped), and the inline body fell outside
 // the card's flow — overflow:hidden clipped every video title away. Both
 // are display:block now, and a dead YouTube thumb gets a composed frost
 // glyph filling the 16:9 frame instead of an unstyled div.
 const css=fs.readFileSync(path.join(__dirname,'..','css','highlights.css'),'utf8');
 const thumb=css.indexOf('.hl-thumb {');
 assert.ok(thumb>-1,'highlights.css styles .hl-thumb');
 assert.ok(/display:\s*block/.test(css.slice(thumb,thumb+220)),'.hl-thumb is block so aspect-ratio applies');
 const body=css.indexOf('.hl-body {');
 assert.ok(body>-1,'highlights.css styles .hl-body');
 assert.ok(/display:\s*block/.test(css.slice(body,body+120)),'.hl-body is block so titles sit in the card flow');
 const fb=css.indexOf('.hl-thumb .thumb-fallback');
 assert.ok(fb>-1,'a dead thumb gets composed fallback art, not an unstyled div');
 assert.ok(/inset:\s*0/.test(css.slice(fb,fb+400)),'the fallback fills the 16:9 frame');
 assert.ok(/\.hl-thumb \.thumb-fallback ~ \.hl-mini-play\s*\{[^}]*display:\s*none/.test(css),'the play badge retires when the fallback glyph carries the frame');
 const html=fs.readFileSync(path.join(__dirname,'..','highlights.html'),'utf8');
 assert.ok(html.includes('css/highlights.css?v=1.187.0'),'highlights.html busts the highlights.css cache at v1.187.0');
 assert.ok(!/highlights\.css\?v=1\.121\.0/.test(html),'highlights.html has no stale 1.121.0 highlights.css key');
 const p=await page('highlights');try{
  const d=p.w.document;
  const card=d.querySelector('#hl-list .hl-card');
  assert.ok(card,'the feed renders video cards');
  // The body must sit after the thumb in normal flow (a previous regression
  // had it clipped away by overflow:hidden); both are plain in-flow spans.
  const thumbEl=card.querySelector('.hl-thumb'), bodyEl=card.querySelector('.hl-body');
  assert.ok(thumbEl && bodyEl,'the card carries a thumb frame and a body');
  assert.ok(thumbEl.compareDocumentPosition(bodyEl)&p.w.Node.DOCUMENT_POSITION_FOLLOWING,'the body follows the thumb in document order');
  const title=card.querySelector('.hl-title');
  assert.ok(title && title.textContent.trim().length>3,'the card carries a video title');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
});

test('v1.133.0: the phone weather strip composes two rows instead of truncating mid-word',async()=>{
 // Fresh-eyes mobile QA (2026-10-01) caught the weather strip broken on
 // phones: under 960px it became a nowrap hidden-scroll row, the gauge was
 // display:none'd but its .wx-cfi wrapper kept width:100%, so a 390px phone
 // showed "offline — last rear" cut at the viewport edge and a swipe
 // revealed a 300px+ empty ghost zone (the dead gauge's box; with live data
 // the tiny spark pill adrift in it). Now <=760px composes two rows: brand +
 // the Cold Front Index gauge share row one (dial scaled to fit, history
 // spark rests on phones), and the conditions own row two with wrapping
 // allowed — everything readable, nothing swipeable-to-nowhere. The location
 // item stays hidden on phones per the existing rule; desktop untouched.
 // Source pins (jsdom has no layout engine; the 390px rendering was verified
 // in headless Chromium: no horizontal overflow, gauge flush right on row
 // one, conditions fully readable on row two, desktop single row unchanged).
 const css=fs.readFileSync(path.join(__dirname,'../css/experience.css'),'utf8');
 assert.ok(css.includes('v1.133.0'),'experience.css carries the v1.133.0 weather-strip block');
 assert.ok(/\.weather-strip #wx-now\s*\{\s*order:\s*3;\s*flex:\s*1 1 100%;\s*white-space:\s*normal;/.test(css),'the conditions take a full wrapped second row on phones');
 assert.ok(/\.weather-strip \.wx-cfi\s*\{\s*order:\s*2;\s*width:\s*auto;\s*margin-left:\s*auto;/.test(css),'the gauge wrapper drops its 100% ghost width and rides row one');
 assert.ok(/\.weather-strip \.wx-gauge\s*\{\s*display:\s*inline-flex;/.test(css),'the index gauge is visible on phones again');
 assert.ok(/\.weather-strip \.cfi-dial\s*\{\s*width:\s*72px;/.test(css),'the dial scales down to fit beside the brand');
 assert.ok(/\.weather-strip \.cfi-spark-wrap\s*\{\s*display:\s*none;/.test(css),'the history spark rests on phones so row one stays clean');
 assert.ok(/\.weather-strip \.wrap\s*\{\s*flex-wrap:\s*wrap;\s*overflow-x:\s*visible;/.test(css),'the strip wraps instead of hiding a scroll row');
 const p=await page('index',{mobile:true});try{
  const d=p.w.document;
  assert.ok(d.querySelector('[data-cf-weather] .weather-strip, .weather-strip'),'the weather strip renders on the homepage');
  assert.ok(d.getElementById('wx-now'),'the conditions item exists');
  assert.ok(d.getElementById('wx-cfi'),'the gauge wrapper exists');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
 // Cache-bust pin: the stylesheet changed, so all 11 pages carry the key.
 for(const name of ['404','about','games','highlights','index','injuries','news','odds','practice','stats','team']){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('css/experience.css?v=1.195.0'),name+'.html busts the experience.css cache');
  assert.ok(!/experience\.css\?v=(?!1.195.0\")1\.[0-9]+\.0"/.test(html),name+'.html has no stale experience.css key');
  assert.ok(html.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
  assert.ok(html.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
 }
});

test('v1.134.0: the drawer X chip is a composed social CTA, not a dashed empty box',async()=>{
 // Fresh-eyes QA (2026-10-01) caught the mobile drawer's X link as a
 // full-width dashed box holding only a lone "𝕏" glyph — the dashed hairline
 // read as an empty drop-zone placeholder. The chip now wears the family's
 // warm orange-tinted solid hairline (the same chip language as the desktop
 // nav-x) and carries the visible @kshot9000 handle, composing as an
 // intentional follow row. Desktop keeps the glyph-only chip.
 const css=fs.readFileSync(path.join(__dirname,'..','css','main.css'),'utf8');
 assert.ok(css.includes('v1.134.0'),'main.css carries the v1.134.0 drawer X-chip block');
 const drawer=css.indexOf('.nav.open a.nav-x {');
 assert.ok(drawer>-1,'the drawer X chip is recomposed');
 const dblock=css.slice(drawer,drawer+600);
 assert.ok(/display:\s*flex/.test(dblock),'the chip composes as a flex row');
 assert.ok(!/dashed/.test(dblock),'the placeholder-reading dashed border is gone');
 assert.ok(/border:\s*1px solid rgba\(200,\s*56,\s*3/.test(dblock),'it wears the warm orange-tinted solid hairline');
 const label=css.indexOf('.nav.open a.nav-x .nav-x-label {');
 assert.ok(label>-1,'the drawer shows the handle label');
 assert.ok(/display:\s*inline/.test(css.slice(label,label+160)),'the handle is visible in the drawer');
 const desk=css.indexOf('.nav a.nav-x .nav-x-label {');
 assert.ok(desk>-1,'the desktop label rule exists');
 assert.ok(/display:\s*none/.test(css.slice(desk,desk+80)),'desktop keeps the glyph-only chip');
 const p=await page('index',{mobile:true});try{
  const d=p.w.document;
  const x=d.querySelector('nav.nav a[href="https://x.com/kshot9000"]');
  assert.ok(x,'the nav carries the X link');
  assert.equal(x.getAttribute('aria-label'),'My X profile');
  const glyph=x.querySelector('span[aria-hidden="true"]');
  assert.ok(glyph && glyph.textContent.trim()==='𝕏','the glyph is aria-hidden decoration');
  const handle=x.querySelector('.nav-x-label');
  assert.ok(handle,'the chip carries the handle span');
  assert.equal(handle.textContent.trim(),'@kshot9000');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
 // Cache-bust pin: main.css changed, so all 11 pages carry the key.
 for(const name of ['404','about','games','highlights','index','injuries','news','odds','practice','stats','team']){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'),name+'.html busts the main.css cache');
  assert.ok(!/main\.css\?v=(?!1\.191\.0")1\.[0-9]+\.0"/.test(html),name+'.html has no stale main.css key');
  assert.ok(html.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
  assert.ok(html.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
 }
});

test('v1.135.0: the dead META panel tightens into a slim notice instead of a tall empty card',async()=>{
 // Fresh-eyes QA (2026-10-01) caught the about page's #snap-meta card as a
 // tall .card.pad-lg box holding only the one-line dim notice when
 // data/snapshots/META.json is unreachable — it read as a broken panel.
 // about.js now tags the host with .snap-empty in that state and main.css
 // (v1.135.0) collapses it into a slim one-line notice strip; the happy
 // path keeps its composed padding.
 const css=fs.readFileSync(path.join(__dirname,'..','css','main.css'),'utf8');
 assert.ok(css.includes('v1.135.0'),'main.css carries the v1.135.0 snap-meta block');
 const ix=css.indexOf('#snap-meta.snap-empty {');
 assert.ok(ix>-1,'the slim-state rule exists');
 assert.ok(/padding:\s*12px 18px/.test(css.slice(ix,ix+120)),'the empty card tightens its padding');
 const about=fs.readFileSync(path.join(__dirname,'..','js','about.js'),'utf8');
 assert.ok(/catch\s*\(e\)\s*\{\s*el\.classList\.add\('snap-empty'\)/.test(about),'the catch branch tags the host .snap-empty');
 // Dim state (unreachable snapshot): slim notice.
 const p=await page('about',{noSnapshots:true});try{
  const d=p.w.document;
  const host=d.querySelector('#snap-meta');
  assert.ok(host,'the about page carries #snap-meta');
  assert.ok(host.classList.contains('snap-empty'),'the host is tagged in the dim state');
  const note=host.querySelector('.snap-meta.dim');
  assert.ok(note && /Snapshot META unavailable/.test(note.textContent),'the dim notice still renders');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
 // Happy state (snapshot reachable): untouched composition.
 const q=await page('about');try{
  const host=q.w.document.querySelector('#snap-meta');
  assert.ok(host && !host.classList.contains('snap-empty'),'the happy path keeps full padding');
  assert.deepEqual(q.errors,[]);
 }finally{q.close();}
 // Cache-bust pin: main.css changed, so all 11 pages carry the key.
 for(const name of ['404','about','games','highlights','index','injuries','news','odds','practice','stats','team']){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'),name+'.html busts the main.css cache');
  assert.ok(!/main\.css\?v=(?!1\.191\.0")1\.[0-9]+\.0"/.test(html),name+'.html has no stale main.css key');
  assert.ok(html.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
  assert.ok(html.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
 }
});
test('v1.136.0: the Participation Heat empty state is a single panel, not a box-in-a-box',async()=>{
 // Fresh-eyes QA (2026-10-01) caught practice.html's #practice-heat as a
 // chromed .practice-heat.card box wrapping CF.emptyHTML()'s own glass frame
 // + hairline — two nested frames with two stacked orange hairlines. practice.js
 // now tags the host .heat-empty in the empty state and main.css (v1.136.0)
 // sheds the outer chrome so the single .empty panel composes as the section
 // body; the happy path (week strip) is untouched.
 const css=fs.readFileSync(path.join(__dirname,'..','css','main.css'),'utf8');
 assert.ok(css.includes('v1.136.0'),'main.css carries the v1.136.0 heat-empty block');
 const ix=css.indexOf('.practice-heat.heat-empty {');
 assert.ok(ix>-1,'the empty-state rule exists');
 const block=css.slice(ix,ix+280);
 assert.ok(/padding:\s*0/.test(block),'the host sheds its padding');
 assert.ok(/border-color:\s*transparent/.test(block),'the host sheds its border');
 assert.ok(/background:\s*none/.test(block),'the host sheds its background');
 assert.ok(/box-shadow:\s*none/.test(block),'the host sheds its shadow');
 const pr=fs.readFileSync(path.join(__dirname,'..','js','practice.js'),'utf8');
 assert.ok(/classList\.add\(["']heat-empty["']\)/.test(pr),'the empty branch tags the host');
 assert.ok(/classList\.remove\(["']heat-empty["']\)/.test(pr),'the happy path untags the host');
 // Empty state (data/practice.json ships empty rows): single frame.
 const p=await page('practice');try{
  const host=p.w.document.querySelector('#practice-heat');
  assert.ok(host,'the practice page carries #practice-heat');
  assert.ok(host.classList.contains('heat-empty'),'the host is tagged in the empty state');
  assert.ok(host.querySelector('.empty .empty-title'),'the shared empty panel renders');
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
 // Happy state (fixture rows): the week strip paints and the tag comes off.
 const pdata={updated:'2026-09-26',rows:[{date:'Fri',session:'Full practice',focus:'Red zone',media:'Presser',notes:''}]};
 const q=await page('practice',{fetch:async(u)=>u.pathname.endsWith('/practice.json')?{ok:true,json:async()=>pdata}:undefined});try{
  const host=q.w.document.querySelector('#practice-heat');
  assert.ok(host && !host.classList.contains('heat-empty'),'the happy path restores the full chrome');
  assert.ok(host.querySelector('.heat-strip'),'the week strip renders');
  assert.deepEqual(q.errors,[]);
 }finally{q.close();}
 // Cache-bust pin: main.css and practice.js changed, so the keys moved.
 for(const name of ['404','about','games','highlights','index','injuries','news','odds','practice','stats','team']){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'),name+'.html busts the main.css cache');
  assert.ok(!/main\.css\?v=(?!1\.191\.0")1\.[0-9]+\.0"/.test(html),name+'.html has no stale main.css key');
  assert.ok(html.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
  assert.ok(html.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
 }
 const practice=fs.readFileSync(path.join(__dirname,'..','practice.html'),'utf8');
 assert.ok(practice.includes('js/practice.js?v=1.136.0'),'practice.html busts the practice.js cache');
});

test('v1.137.0: the snow pill re-dodges when async content shifts the footer under it',async()=>{
 // Fresh-eyes QA (2026-10-01) caught the desktop "Snow on" pill stranded on
 // the footer "Tip the build · BTC" chip on injuries.html: the v1.104.0 dodge
 // only re-ran on scroll/resize, but wire/snapshot content lands async — a
 // late layout shift slid the footer under the parked pill with no scroll or
 // resize event, burying the chip's Copy label. A ResizeObserver on <body>
 // now re-runs the same geometry check whenever the page height changes.
 // The pill is position:fixed, so the style.bottom writes can't loop the
 // observer. Phones stay exempt (the toggle docks in the header there).
 const snow=fs.readFileSync(path.join(__dirname,'..','js','snow.js'),'utf8');
 assert.ok(snow.includes('v1.137.0'),'snow.js carries the v1.137.0 block');
 assert.ok(/typeof ResizeObserver !== "undefined"/.test(snow),'the observer is feature-guarded (jsdom and old browsers skip it)');
 assert.ok(/new ResizeObserver\(\(\) => dodgeFooter\(\)\)\.observe\(document\.body\)/.test(snow),'body resizes re-run the footer dodge');
 // Behavioral: stub ResizeObserver, re-init snow, and prove a body resize
 // re-runs the dodge — the pill lifts off the footer without any scroll.
 const p=await page('odds');try{
  assert.deepEqual(p.errors,[]);
  const w=p.w;
  w.document.querySelector('.snow-toggle').remove();
  const seen={cb:null,target:null};
  w.ResizeObserver=class{constructor(cb){seen.cb=cb;}observe(t){seen.target=t;}disconnect(){}};
  w.eval(fs.readFileSync(path.join(__dirname,'..','js','snow.js'),'utf8'));
  w.CF.initSnow();
  assert.ok(seen.cb,'initSnow wires a ResizeObserver');
  assert.equal(seen.target,w.document.body,'the observer watches <body> for layout shifts');
  const tgl=w.document.querySelector('.snow-toggle'), foot=w.document.querySelector('.site-foot');
  assert.ok(tgl&&foot,'the toggle and the footer exist after re-init');
  // The footer slides under the parked pill (async content, no scroll event):
  // pill bottom edge at 882, footer top at 700 — 182px of overlap.
  tgl.getBoundingClientRect=()=>({top:836,bottom:882,left:0,right:0,width:0,height:46,x:0,y:836,toJSON(){}});
  foot.getBoundingClientRect=()=>({top:700,bottom:1100,left:0,right:0,width:0,height:400,x:0,y:700,toJSON(){}});
  seen.cb();
  const lifted=parseFloat(tgl.style.bottom);
  assert.ok(lifted>18,'a body resize lifts the pill (bottom:'+tgl.style.bottom+')');
  assert.ok(Math.abs(lifted-(18+182+12))<1,'the lift equals overlap + 12px gap: '+tgl.style.bottom);
  // The footer drifts back out of the parking zone: the pill re-parks.
  foot.getBoundingClientRect=()=>({top:1200,bottom:1600,left:0,right:0,width:0,height:400,x:0,y:1200,toJSON(){}});
  seen.cb();
  assert.equal(tgl.style.bottom,'','the pill re-parks once the footer is out of view');
 }finally{p.close();}
 // Cache-bust pin: snow.js changed, so its key moved on every page.
 for(const name of ['404','about','games','highlights','index','injuries','news','odds','practice','stats','team']){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('js/snow.js?v=1.137.0'),name+'.html busts the snow.js cache');
  assert.ok(!/snow\.js\?v=(?!1\.137\.0")1\.[0-9]+\.0"/.test(html),name+'.html has no stale snow.js key');
  assert.ok(html.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
  assert.ok(html.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
 }
});

test('v1.138.0: the back-to-top button ghosts when parked over the prediction-market legend',async()=>{
 // Fresh-eyes QA (2026-10-01) caught the fixed 46px back-to-top circle parked
 // on the prediction-market legend on odds.html at phone widths — the
 // caption's first line ("fill = implied chance the crowd is right…") was
 // buried behind the button. The v1.118.0 ghost (opacity 0.38, full on
 // hover/focus) now also covers the legend: the caption wears .pm-legend,
 // and the dim check's allowlist grew from ".section-head h2" to
 // ".section-head h2, .pm-legend" — still an explicit list of read-critical
 // text, never "any paragraph".
 const odds=fs.readFileSync(path.join(__dirname,'..','odds.html'),'utf8');
 assert.ok(/class="dim pm-legend"/.test(odds),'the prediction-market legend wears .pm-legend');
 const js=fs.readFileSync(path.join(__dirname,'..','js','common.js'),'utf8');
 assert.ok(js.includes('v1.138.0'),'common.js carries the v1.138.0 block');
 assert.ok(js.includes('.section-head h2, .pm-legend'),'the dim check allowlists the legend alongside headlines');
 // Behavioral: on odds.html, stub the button over the legend rect and prove
 // it ghosts; clear of the legend it goes solid again.
 const p=await page('odds');try{const w=p.w,d=w.document;
  const top=d.querySelector('.cf-top');
  assert.ok(top,'the back-to-top button is injected');
  const legend=d.querySelector('.pm-legend');
  assert.ok(legend,'odds.html has the .pm-legend caption');
  top.getBoundingClientRect=()=>({left:20,top:400,right:66,bottom:446,width:46,height:46});
  let legendRect={left:0,top:0,right:0,bottom:0,width:0,height:0};
  legend.getBoundingClientRect=()=>legendRect;
  const realQSA=d.querySelectorAll.bind(d);
  d.querySelectorAll=(sel)=>sel==='.section-head h2, .pm-legend'?[legend]:realQSA(sel);
  d.documentElement.scrollTop=700;w.dispatchEvent(new w.Event('scroll'));await settle(60);
  assert.ok(top.classList.contains('is-on'),'the button shows after scrolling down');
  assert.ok(!top.classList.contains('is-dimmed'),'the button stays solid over ordinary content');
  legendRect={left:10,top:390,right:350,bottom:420,width:340,height:30};
  w.dispatchEvent(new w.Event('scroll'));await settle(60);
  assert.ok(top.classList.contains('is-dimmed'),'the button ghosts when it covers the legend');
  legendRect={left:0,top:0,right:0,bottom:0,width:0,height:0};
  w.dispatchEvent(new w.Event('scroll'));await settle(60);
  assert.ok(!top.classList.contains('is-dimmed'),'the button goes solid again once clear of the legend');
 }finally{p.close();}
 // Cache-bust pin: common.js changed, so its key moved on every page.
 for(const name of ['404','about','games','highlights','index','injuries','news','odds','practice','stats','team']){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('js/common.js?v=1.195.0'),name+'.html busts the common.js cache');
  assert.ok(!/common\.js\?v=(?!1\.195\.0")1\.[0-9]+\.0"/.test(html),name+'.html has no stale common.js key');
  assert.ok(html.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
  assert.ok(html.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
 }
});

test('v1.139.0: the hero card\'s quiet state collapses the matchup rows instead of freezing skeleton blocks',async()=>{
 // Fresh-eyes QA (2026-10-01) caught the index hero card leaving its
 // frost-skeleton blocks frozen in place when no matchup is on the schedule
 // (quiet schedule or unreachable feed): two dead gray "badge" rectangles
 // sat between the title and the meta line, reading as a broken placeholder.
 // loadMatchup() now tags the card .is-quiet in that state and the matchup
 // rows (the vs duel, the venue line, and the countdown) collapse — the
 // card becomes kicker + title + meta + footer links, a slim intentional
 // quiet panel. The happy path resets the class on every paint.
 const css=fs.readFileSync(path.join(__dirname,'..','css','experience.css'),'utf8');
 assert.ok(css.includes('v1.139.0'),'experience.css carries the v1.139.0 block');
 assert.ok(css.includes('.match-card.is-quiet .vs'),'the quiet state collapses the vs duel');
 assert.ok(css.includes('.match-card.is-quiet #ng-countdown'),'the quiet state collapses the countdown');
 const js=fs.readFileSync(path.join(__dirname,'..','js','home.js'),'utf8');
 assert.ok(js.includes('v1.139.0'),'home.js carries the v1.139.0 block');
 assert.ok(js.includes('classList.add("is-quiet")'),'the quiet branch tags the card');
 assert.ok(js.includes('card.classList.remove("final", "bears-won", "is-quiet")'),'each paint resets the quiet state');
 // Behavioral: offline index (scoreboard + schedule unreachable) lands the
 // card in .is-quiet; the fixture-backed happy path never tags it.
 const q=await page('index',{offline:true,noSnapshots:true});try{const d=q.w.document;
  // readSource's Stage 2 races proxies against a delayed same-origin
  // snapshot (~1.1s), so the quiet branch lands later than the normal paint.
  await settle(2000);
  const card=d.querySelector('#next-game');
  assert.ok(card.classList.contains('is-quiet'),'the card is tagged quiet when no matchup is reachable');
  assert.equal(d.querySelector('#ng-title').textContent,'Waiting for the next Bears matchup');
  assert.ok(d.querySelector('#next-game .vs'),'the matchup row markup still exists for the happy path');
 }finally{q.close();}
 const h=await page('index');try{const d=h.w.document;
  await settle(300);
  const card=d.querySelector('#next-game');
  assert.ok(!card.classList.contains('is-quiet'),'the fixture happy path does not tag the card quiet');
  assert.equal(d.querySelector('#ng-away-abbr').textContent,'CHI');
 }finally{h.close();}
 // Cache-bust pins: experience.css changed on all 11 pages, home.js on index.
 for(const name of ['404','about','games','highlights','index','injuries','news','odds','practice','stats','team']){
  const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
  assert.ok(html.includes('css/experience.css?v=1.195.0'),name+'.html busts the experience.css cache');
  assert.ok(!/experience\.css\?v=(?!1\.195\.0\")1\.[0-9]+\.0"/.test(html),name+'.html has no stale experience.css key');
  assert.ok(html.includes('data-cf-copy="btc"'),'the BTC tip chip survives on '+name+'.html');
  assert.ok(html.includes('@kshot9000'),'the @kshot9000 attribution survives on '+name+'.html');
 }
 const index=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.ok(index.includes('js/home.js?v=1.195.0'),'index.html busts the home.js cache');
 assert.ok(!/home\.js\?v=(?!1\.195\.0\")1\.[0-9]+\.0"/.test(index),'index.html has no stale home.js key');
});

test('v1.140.0: the report column pins beside the wire — no dead air below the table', async () => {
 // Fresh-eyes QA (2026-10-01): on desktop the injury wire rail runs ~3x the
 // report column's height (2179px vs 719px), so scrolling past the report
 // table left ~1460px of bare background in the left two-thirds of the
 // viewport while wire cards flowed on the right — half the page read as
 // missing. The report column (the official, slow-changing league copy)
 // now pins under the sticky header while the live wire flows beside it;
 // when the grid ends it releases into the status-key callout as before.
 const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'main.css'), 'utf8');
 assert.ok(css.includes('v1.140.0'), 'main.css carries the v1.140.0 block');
 const mob = css.match(/@media \(min-width: 861px\)\s*\{([\s\S]*?)\n\}/);
 assert.ok(mob, 'the 861px desktop-min block exists (mirrors the 860px collapse point)');
 const block = mob[1];
 assert.ok(/#injury-grid > \.inj-main\s*\{[^}]*position:\s*sticky/s.test(block),
  'the report column pins in place on desktop');
 assert.ok(/#injury-grid > \.inj-main\s*\{[^}]*top:\s*calc\(var\(--cf-head-h, 64px\) \+ 16px\)/s.test(block),
  'it parks under the sticky header with a breathing gap, never behind it');
 // The sticky rule must NOT leak into the base stylesheet: phones collapse
 // #injury-grid to one stacked column (max-width 860px) and must keep the
 // plain flow with no sticky behavior.
 const base = css.split('@media (min-width: 861px)')[0];
 assert.ok(!/\.inj-main\s*\{[^}]*position:\s*sticky/s.test(base),
  'no sticky positioning outside the desktop block — phones keep the stacked layout');
 // The hook class is on the report column of injuries.html, and the table
 // still rides inside it.
 const ih = fs.readFileSync(path.join(__dirname, '..', 'injuries.html'), 'utf8');
 assert.ok(/<div class="inj-main">/.test(ih), 'the report column carries the .inj-main hook');
 const p = await page('injuries');
 try {
  const d = p.w.document;
  assert.ok(d.querySelector('#injury-grid > .inj-main .tbl-wrap table.tbl'),
   'the report table rides inside .inj-main in the grid');
  assert.ok(d.querySelector('#injury-grid > .rail#wire-rail'), 'the wire rail keeps its grid slot');
  assert.deepEqual(p.errors, []);
 } finally { p.close(); }
 // Cache-bust pins: main.css changed, so all 11 pages carry the fresh key.
 for (const name of ['404', 'about', 'games', 'highlights', 'index', 'injuries', 'news', 'odds', 'practice', 'stats', 'team']) {
  const html = fs.readFileSync(path.join(__dirname, '..', name + '.html'), 'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html busts the main.css cache');
  assert.ok(!/main\.css\?v=(?!1\.191\.0")1\.[0-9]+\.0"/.test(html), name + '.html has no stale main.css key');
  assert.ok(html.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on ' + name + '.html');
  assert.ok(html.includes('@kshot9000'), 'the @kshot9000 attribution survives on ' + name + '.html');
 }
});

test('v1.141.0: the news feed pill wraps on phones instead of clipping', async () => {
 // Fresh-eyes mobile QA (2026-10-01, 390px): the #feed-pill carries the whole
 // provenance string ("wide wire · <outlet> et al. · N stories · <stamp>"),
 // and .pill is globally white-space: nowrap — so on phones the pill bled
 // past the viewport edge and clipped mid-word, even though the badge row
 // wraps. On phones the feed pill alone now relaxes into a two-line status
 // banner; desktop keeps the single-line pill.
 const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'main.css'), 'utf8');
 assert.ok(css.includes('v1.141.0'), 'main.css carries the v1.141.0 block');
 // The wrap rule lives inside the phone media block and targets #feed-pill only.
 const mob = css.match(/@media \(max-width: 700px\)\s*\{([\s\S]*?)\n\}/g) || [];
 const wrap = mob.find(b => /#feed-pill\s*\{[^}]*white-space:\s*normal/s.test(b));
 assert.ok(wrap, '#feed-pill gets white-space: normal inside a max-width: 700px block');
 assert.ok(/max-width:\s*100%/.test(wrap), 'the wrapped pill cannot exceed the viewport width');
 // Desktop base keeps the nowrap pill language untouched.
 assert.ok(/\.pill\s*\{[^}]*white-space:\s*nowrap/s.test(css), 'the base .pill stays nowrap on desktop');
 // The hook is the feed pill on news.html.
 const nh = fs.readFileSync(path.join(__dirname, '..', 'news.html'), 'utf8');
 assert.ok(/<span class="pill[^"]*" id="feed-pill">/.test(nh), 'news.html carries the #feed-pill hook');
 const p = await page('news', { mobile: true });
 try {
  assert.ok(p.w.document.getElementById('feed-pill'), '#feed-pill renders on the news page');
  assert.deepEqual(p.errors, []);
 } finally { p.close(); }
 // Cache-bust pins: main.css changed, so all 11 pages carry the fresh key.
 for (const name of ['404', 'about', 'games', 'highlights', 'index', 'injuries', 'news', 'odds', 'practice', 'stats', 'team']) {
  const html = fs.readFileSync(path.join(__dirname, '..', name + '.html'), 'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html busts the main.css cache');
  assert.ok(html.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on ' + name + '.html');
  assert.ok(html.includes('@kshot9000'), 'the @kshot9000 attribution survives on ' + name + '.html');
 }
});

test('v1.142.0: phone section-head CTAs stop stranding right on their own row', async () => {
 // Fresh-eyes mobile QA (2026-10-01, 390px): v1.119.0 composed the two-line
 // head (h2 on row one; tag + link share row two with margin-left:auto
 // keeping the link right), but long status tags ("Schedule snapshot ·
 // Game-day weather · 1s ago") fill row two alone, so the link wraps to a
 // third row where margin-left:auto still pins it to the right edge — an
 // orphaned "FULL DESK →" floating over empty space on mobile index. On
 // phones every section-head anchor now takes its own full row: .btn CTAs
 // center their labels and plain "view all" links left-align; desktop
 // keeps the margin-left:auto grammar untouched.
 const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'experience.css'), 'utf8');
 assert.ok(css.includes('v1.142.0'), 'experience.css carries the v1.142.0 block');
 // The override lives inside the phone media block and neutralizes the
 // desktop margin-left:auto while giving the anchor its own row.
 const mob = css.match(/@media \(max-width:760px\)\s*\{([\s\S]*?)\n\}/g) || [];
 const fix = mob.find(b => /\.section-head a\s*\{[^}]*margin-left:\s*0/s.test(b));
 assert.ok(fix, '.section-head a gets margin-left: 0 inside a max-width: 760px block');
 assert.ok(/\.section-head a\s*\{[^}]*flex:\s*1 1 100%/s.test(fix), 'the anchor takes its own full row on phones');
 assert.ok(/\.section-head a\.btn\s*\{[^}]*justify-content:\s*center/s.test(fix), '.btn CTAs center their labels on phones');
 // Desktop base keeps the right-pushed CTA grammar untouched.
 assert.ok(/\.section-head a\s*\{[^}]*margin-left:\s*auto/s.test(css), 'the base .section-head a stays margin-left:auto on desktop');
 // Every section head with a CTA keeps its anchor; nothing else moved.
 for (const [name, sel] of [['index', '#sunday-desk-pill'], ['odds', null], ['team', null]]) {
  const p = await page(name, { mobile: true });
  try {
   const heads = Array.from(p.w.document.querySelectorAll('.section-head'));
   assert.ok(heads.length > 0, name + '.html renders section heads');
   for (const h of heads) {
    const a = h.querySelector('a');
    if (a) assert.ok(a.getAttribute('href'), 'section-head CTA on ' + name + '.html keeps its href');
   }
   if (sel) assert.ok(p.w.document.querySelector(sel), sel + ' renders on ' + name + '.html');
   assert.deepEqual(p.errors, []);
  } finally { p.close(); }
 }
 // Cache-bust pins: experience.css changed, so all 11 pages carry the fresh key.
 for (const name of ['404', 'about', 'games', 'highlights', 'index', 'injuries', 'news', 'odds', 'practice', 'stats', 'team']) {
  const html = fs.readFileSync(path.join(__dirname, '..', name + '.html'), 'utf8');
  assert.ok(html.includes('css/experience.css?v=1.195.0'), name + '.html busts the experience.css cache');
  assert.ok(html.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on ' + name + '.html');
  assert.ok(html.includes('@kshot9000'), 'the @kshot9000 attribution survives on ' + name + '.html');
 }
});
test('v1.143.0: the odds wire-empty CTA gets its own row instead of shattering the sentence', async () => {
 // Fresh-eyes mobile QA (2026-10-01, 390px): the odds wire-empty notice
 // carried its "Sportsbooks" button inline-flex inside the sentence, so on
 // phones the copy shattered around it ("…takes any The [SPORTSBOOKS ↗]
 // Odds API key." across three rows). The CTA now wears its own block row
 // under the paragraph; the composed centered panel is untouched on desktop.
 const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'main.css'), 'utf8');
 assert.ok(css.includes('v1.143.0'), 'main.css carries the v1.143.0 block');
 assert.ok(/\.empty-cta\s*\{[^}]*margin-top:\s*16px/s.test(css), '.empty-cta gives the CTA its own row with top margin');
 const odds = fs.readFileSync(path.join(__dirname, '..', 'js', 'odds.js'), 'utf8');
 assert.ok(odds.includes('<div class="empty-cta">'), 'odds.js wraps the wire-empty CTA in .empty-cta');
 assert.ok(!odds.includes('display:inline-flex;margin-top:12px'), 'the inline-flex mid-sentence button is gone');
 // Behavioral: with feeds and snapshots unreachable, the wire line fails and
 // the empty panel renders the CTA on its own row beneath the copy.
 const p = await page('odds', { mobile: true, offline: true, noSnapshots: true });
 try {
  // readSource's proxy race delays the unreachable-wire verdict several
  // seconds; 8s gives it comfortable margin.
  await settle(8000);
  const cta = p.w.document.querySelector('#odds-board .empty-cta');
  assert.ok(cta, 'the wire-empty panel renders .empty-cta when the line is unreachable');
  const btn = cta.querySelector('a.btn.small');
  assert.ok(btn && btn.getAttribute('href').includes('sportsbook'), 'the CTA is the Sportsbooks link');
  assert.ok(btn.textContent.includes('Sportsbooks'), 'the CTA keeps its label');
  assert.deepEqual(p.errors, []);
 } finally { p.close(); }
 // Cache-bust pins: main.css and odds.js changed, so their keys move to 1.143.0.
 for (const name of ['404', 'about', 'games', 'highlights', 'index', 'injuries', 'news', 'odds', 'practice', 'stats', 'team']) {
  const html = fs.readFileSync(path.join(__dirname, '..', name + '.html'), 'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html busts the main.css cache');
  assert.ok(html.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on ' + name + '.html');
  assert.ok(html.includes('@kshot9000'), 'the @kshot9000 attribution survives on ' + name + '.html');
 }
 const ohtml = fs.readFileSync(path.join(__dirname, '..', 'odds.html'), 'utf8');
 assert.ok(ohtml.includes('js/odds.js?v=1.164.0'), 'odds.html busts the odds.js cache');
});

test('v1.144.0: the mobile feed banner reads as one sentence, the age stamp stays whole', async () => {
 // Fresh-eyes mobile QA (2026-10-01, 390px): the v1.141.0 two-line banner
 // kept .pill's inline-flex layout, so the provenance label and the
 // freshness stamp wrapped as two independent flex items — the stamp
 // fractured mid-token ("· 5D" on line one, "AGO" orphaned on line two)
 // and stacked on the right edge. On phones the banner now flows as one
 // sentence (display: block) and the stamp never breaks (nowrap), while
 // desktop keeps the single-line nowrap pill.
 const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'main.css'), 'utf8');
 assert.ok(css.includes('v1.145.0'), 'main.css carries the v1.145.0 block');
 // The sentence-flow rule lives inside a phone media block and targets
 // #feed-pill only.
 const mob = css.match(/@media \(max-width: 700px\)\s*\{([\s\S]*?)\n\}/g) || [];
 const banner = mob.find(b => /#feed-pill\s*\{[^}]*display:\s*block/s.test(b));
 assert.ok(banner, '#feed-pill flows as a block sentence inside a max-width: 700px block');
 const stamp = mob.find(b => /#feed-pill\s+\.fresh-stamp\s*\{[^}]*white-space:\s*nowrap/s.test(b));
 assert.ok(stamp, '#feed-pill .fresh-stamp stays whole inside a max-width: 700px block');
 // The v1.141.0 wrap language survives: white-space normal, full width cap.
 const wrap = mob.find(b => /#feed-pill\s*\{[^}]*white-space:\s*normal/s.test(b));
 assert.ok(wrap, '#feed-pill keeps white-space: normal on phones');
 assert.ok(/max-width:\s*100%/.test(wrap), 'the banner still cannot exceed the viewport width');
 // Desktop base keeps the nowrap pill language untouched.
 assert.ok(/\.pill\s*\{[^}]*white-space:\s*nowrap/s.test(css), 'the base .pill stays nowrap on desktop');
 // The hook is the feed pill on news.html, and only there.
 const nh = fs.readFileSync(path.join(__dirname, '..', 'news.html'), 'utf8');
 assert.ok(/<span class="pill[^"]*" id="feed-pill">/.test(nh), 'news.html carries the #feed-pill hook');
 for (const name of ['index', 'odds', 'team', 'games', 'stats', 'highlights', 'practice', 'about', 'injuries']) {
  const h = fs.readFileSync(path.join(__dirname, '..', name + '.html'), 'utf8');
  assert.ok(!h.includes('id="feed-pill"'), '#feed-pill stays unique to news.html (' + name + ')');
 }
 // Mobile smoke: the pill renders and the page stays error-free.
 const p = await page('news', { mobile: true });
 try {
  const pill = p.w.document.getElementById('feed-pill');
  assert.ok(pill, '#feed-pill renders on the news page');
  assert.deepEqual(p.errors, []);
 } finally { p.close(); }
 // Cache-bust pins: main.css changed, so all 11 pages carry the fresh key.
 for (const name of ['404', 'about', 'games', 'highlights', 'index', 'injuries', 'news', 'odds', 'practice', 'stats', 'team']) {
  const html = fs.readFileSync(path.join(__dirname, '..', name + '.html'), 'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html busts the main.css cache');
  assert.ok(html.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on ' + name + '.html');
  assert.ok(html.includes('@kshot9000'), 'the @kshot9000 attribution survives on ' + name + '.html');
 }
});

test('v1.145.0: backgrounds show the actual Soldier Field field, not the exterior', async () => {
 // The hero rotator, the soldier photo bands, and the soldier city tile used
 // stadium-exterior shots. They now point at real field photography: the
 // gameday field, the Bears huddle, and the stadium + Chicago skyline aerial.
 const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'main.css'), 'utf8');
 assert.ok(css.includes('v1.145.0'), 'main.css carries the v1.145.0 block');
 const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
 const layers = ['hero-field-gameday', 'hero-field-huddle', 'hero-field-skyline'];
 for (const base of layers) {
  for (const f of [`img/${base}-desk.webp`, `img/${base}-mobile.webp`]) {
   assert.ok(fs.existsSync(path.join(__dirname, '..', f)), f + ' ships in img/');
  }
  assert.ok(html.includes(`img/${base}-desk.webp`), 'hero rotator serves ' + base + ' on desktop');
  assert.ok(html.includes(`img/${base}-mobile.webp`), 'hero rotator serves ' + base + ' on mobile');
 }
 assert.ok(!html.includes('hero-soldier-desk.webp'), 'the old exterior hero layer is gone');
 assert.ok(html.includes('img/hero-field-gameday-mobile.webp 900w'), 'the preload imagesrcset tracks the new field art');
 assert.ok(css.includes('url("../img/hero-field-gameday-desk.webp")'), 'soldier photo bands show the gameday field');
 assert.ok(css.includes('url("../img/hero-field-gameday-mobile.webp")'), 'soldier photo bands stay field shots on phones');
 assert.ok(css.includes('url("../img/hero-field-skyline-desk.webp")'), 'the soldier city tile shows the stadium-skyline aerial');
 assert.ok(css.includes('url("../img/hero-field-skyline-mobile.webp")'), 'the soldier city tile stays on-theme on phones');
 assert.ok(!css.includes('soldier-field-dark.webp'), 'the old exterior band art is fully retired from CSS');
 // Attribution: the CC BY-SA 4.0 aerial requires it; the public-domain
 // military shots get credited anyway.
 const attr = fs.readFileSync(path.join(__dirname, '..', 'img', 'ATTRIBUTION.txt'), 'utf8');
 assert.ok(attr.includes('Moses8910'), 'ATTRIBUTION.txt names the CC BY-SA 4.0 photographer');
 assert.ok(attr.includes('creativecommons.org/licenses/by-sa/4.0'), 'ATTRIBUTION.txt links the CC BY-SA 4.0 license');
 const about = fs.readFileSync(path.join(__dirname, '..', 'about.html'), 'utf8');
 assert.ok(about.includes('Moses8910'), 'about.html credits the field photography');
 // The Chicago-night identity survives: hero CSS fallback + lakefront
 // atmosphere + the other city tiles keep their Chicago art.
 assert.ok(css.includes('hero-chicago-night.webp'), 'the hero keeps its Chicago-night CSS fallback');
 assert.ok(css.includes('chicago-winter-lakefront.webp'), 'the lakefront atmosphere stays Chicago');
 // Mobile smoke: the hero renders and the page stays error-free.
 const p = await page('index', { mobile: true });
 try {
  const active = p.w.document.querySelector('.hero-photo .hero-layer.is-active');
  const srcEl = active && active.querySelector('source[media="(max-width: 700px)"]');
  assert.ok(srcEl && srcEl.getAttribute('srcset').includes('hero-field-gameday-mobile.webp'), 'mobile hero serves the field art');
  assert.deepEqual(p.errors, []);
 } finally { p.close(); }
});

test('v1.150.0: native scrollbars go dark with the theme, and the full-board copy reads clean',async()=>{
 // Root color-scheme was "normal", so Chromium rendered native scrollbars
 // (page + phone table-overflow wraps on games/odds) in the light native
 // style — a jarring white sliver on a dark site. :root now declares
 // color-scheme: dark, which also keeps form controls dark-native.
 const css=fs.readFileSync(path.join(__dirname,'../css/main.css'),'utf8');
 assert.match(css,/:root\s*\{[^}]*color-scheme:\s*dark/s,'the :root block declares color-scheme: dark');
 // The full-board card read "Paste a The Odds API key" — broken grammar on
 // the one sentence a fan reads before pasting a key. Now "Paste a key
 // from The Odds API".
 const odds=fs.readFileSync(path.join(__dirname,'../odds.html'),'utf8');
 assert.ok(odds.includes('Paste a key from'),'the full-board copy reads "Paste a key from …"');
 assert.ok(!odds.includes('>The Odds API</a> key ('),'the old "The Odds API key" phrasing is gone');
 // Cache keys moved with the release: main.css on all eleven pages.
 // games.js is unchanged this run, so its key stays at 1.149.0.
 const gh=fs.readFileSync(path.join(__dirname,'../games.html'),'utf8');
 assert.ok(gh.includes('css/main.css?v=1.191.0'),'games.html pins main.css 1.191.0');
 assert.ok(gh.includes('js/games.js?v=1.193.0'),'games.html keeps games.js 1.163.0');
 for(const name of ['index','news','stats','odds','injuries','practice','team','about','highlights','404']){
  const html=fs.readFileSync(path.join(__dirname,'../'+name+'.html'),'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'),name+'.html pins main.css 1.191.0');
 }
 // Footer branding untouched by this release.
 assert.ok(gh.includes('data-cf-copy="btc"'),'the BTC tip chip survives on games.html');
 assert.ok(gh.includes('@kshot9000'),'the @kshot9000 attribution survives on games.html');
});

test('v1.151.0: the hero season strip clears the floating snow pill on desktop',async()=>{
 // The snow pill is fixed bottom-right on desktop (>760px). It parked on the
 // season strip's last tile, covering the tail of the "Season differential ·
 // total" label so the hero's bottom line read truncated on first paint.
 // The strip now reserves pill-width clearance on the right wherever the
 // pill floats; the rule line stays full-width and the grid keeps its rhythm.
 const css=fs.readFileSync(path.join(__dirname,'../css/experience.css'),'utf8');
 assert.match(css,/@media\s*\(min-width:\s*761px\)\s*\{\s*\.season-strip\s*\{\s*padding-right:\s*172px/s,'the desktop season strip reserves pill-width clearance on the right');
 // Phones dock the toggle into the header, so the clearance stays desktop-only.
 assert.ok(!/@media\s*\(max-width:\s*760px\)[\s\S]{0,400}?\.season-strip\s*\{[^}]*padding-right:\s*172px/.test(css),'the clearance does not leak into the phone layout');
 // Cache keys moved with the release: experience.css on all eleven pages.
 for(const name of ['404','about','games','highlights','index','injuries','news','odds','practice','stats','team']){
  const html=fs.readFileSync(path.join(__dirname,'../'+name+'.html'),'utf8');
  assert.ok(html.includes('css/experience.css?v=1.195.0'),name+'.html pins experience.css 1.187.0');
 }
 // Footer branding untouched by this release.
 const index=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.ok(index.includes('data-cf-copy="btc"'),'the BTC tip chip survives on index.html');
 assert.ok(index.includes('@kshot9000'),'the @kshot9000 attribution survives on index.html');
});

test('v1.152.0: narrow phones stop clipping the About page',async()=>{
 // At 320px about.html overflowed sideways (scrollWidth 341): project
 // cards ran off the right edge with GitHub links cut mid-word, and two
 // section-head tags bled past the edge. The card's unbreakable .go URL
 // set a ~330px min-content floor on the 1fr grid track — the card now
 // carries min-width: 0 and the URL wraps (overflow-wrap: anywhere).
 const css=fs.readFileSync(path.join(__dirname,'../css/main.css'),'utf8');
 assert.match(css,/\.proj-card\s*\{\s*min-width:\s*0/s,'the project card can shrink to the phone column');
 assert.match(css,/\.proj-card \.go\s*\{\s*overflow-wrap:\s*anywhere/s,'the project GitHub link wraps instead of clipping');
 // Section-head tags/pills are nowrap; under 380px a long status line
 // ("crypto donations · same wallets as the other sites") now wraps as
 // a two-line banner instead of overflowing — the injuries report pill
 // (reclassed to .pill by JS) was spilling the same way at 320px.
 assert.match(css,/@media\s*\(max-width:\s*380px\)\s*\{\s*\.section-head \.tag,\s*\.section-head \.pill\s*\{\s*white-space:\s*normal;\s*max-width:\s*100%/s,'narrow-phone section-head tags and pills wrap inside the viewport');
 // The wrap is narrow-phone only: the base pill stays single-line.
 assert.match(css,/\.section-head \.tag\s*\{[^}]*white-space:\s*nowrap/s,'the base section-head tag keeps its single-line pill');
 // Cache keys moved with the release: main.css on all eleven pages.
 // experience.css is unchanged this run, so its key sits at 1.157.0.
 for(const name of ['404','about','games','highlights','index','injuries','news','odds','practice','stats','team']){
  const html=fs.readFileSync(path.join(__dirname,'../'+name+'.html'),'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'),name+'.html pins main.css 1.191.0');
  assert.ok(html.includes('css/experience.css?v=1.195.0'),name+'.html keeps experience.css 1.187.0');
 }
 // Footer branding untouched by this release.
 const about=fs.readFileSync(path.join(__dirname,'../about.html'),'utf8');
 assert.ok(about.includes('data-cf-copy="btc"'),'the BTC tip chip survives on about.html');
 assert.ok(about.includes('@kshot9000'),'the @kshot9000 attribution survives on about.html');
});

test('v1.153.0: the rivals track is phone-width from first layout',async()=>{
 // At 320px the "Keep your rivals close" column laid out 354px wide
 // before the section scrolled into view: the standings card's
 // automatic minimum is its min-content, and while the section sits
 // offscreen-skipped, .tbl-wrap's contain-intrinsic-size placeholder
 // (auto 320px) IS that min-content — so the minmax(auto, 1fr) track
 // inflated to 320 + 34px card padding and dragged the matchup cards
 // past the viewport edge (score column amputated by overflow-x:
 // clip) until relevance snapped it back. The layout's items now
 // carry min-width: 0 (the v1.123.0 #injury-grid pattern), so the
 // track is the column width in every state — first layout, feed
 // error, and live.
 const css=fs.readFileSync(path.join(__dirname,'../css/main.css'),'utf8');
 assert.match(css,/\.north-layout > \* \{\s*min-width:\s*0/s,'the rivals layout items can shrink to the phone column');
 // The placeholder rule itself is the site-wide perceived-performance
 // treatment for offscreen table wraps; it stays — the fix lives at
 // the grid items, not in the wrap.
 assert.match(css,/\.tbl-wrap \{\s*content-visibility:\s*auto;\s*contain-intrinsic-size:\s*auto 320px/s,'the offscreen table placeholder rule survives');
 // The standings table keeps its by-design inner scroll container.
 const index=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.ok(index.includes('class="card" id="division"'),'the standings card still anchors the rivals layout');
 assert.ok(index.includes('id="div-table"'),'the division table still renders inside its scroll wrap');
 // Cache keys moved with the release: main.css on all eleven pages.
 // experience.css is unchanged this run, so its key sits at 1.157.0.
 for(const name of ['404','about','games','highlights','index','injuries','news','odds','practice','stats','team']){
  const html=fs.readFileSync(path.join(__dirname,'../'+name+'.html'),'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'),name+'.html pins main.css 1.191.0');
  assert.ok(html.includes('css/experience.css?v=1.195.0'),name+'.html keeps experience.css 1.187.0');
 }
 // Footer branding untouched by this release.
 const idx=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'),'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'),'the @kshot9000 attribution survives on index.html');
});

test('v1.154.0: the stale cache-key guard bites again — one key per asset, and the patterns can match', async () => {
 // A past bulk edit doubled the backslashes in sixteen "has no stale
 // <asset> key" regex literals (main.css, experience.css, common.js,
 // home.js). In a regex literal a doubled escape means a literal
 // backslash, so those patterns could only match text like
 // "main\<any>css" — never a real cache key — and the assertions
 // passed vacuously while five of them quietly drifted releases
 // behind the pins beside them. The literals are single-escaped
 // again and their lookaheads rolled to the current pins. This test
 // is the guard on the guard, in two parts that cannot rot the
 // same way:
 // (1) A plain string scan — no regex escapes to double — proves
 //     every asset carries exactly ONE cache key across all eleven
 //     pages, so a stale key shipped on any single page fails here
 //     no matter what happens to the pattern literals.
 const pages=['404','about','games','highlights','index','injuries','news','odds','practice','stats','team'];
 const keys=new Map();
 const scan=(name,html)=>{
  for(const m of html.matchAll(/(?:css|js)\/[\w.-]+\?v=[\d.]+/g)){
   const ref=m[0], asset=ref.split('?v=')[0], key=ref.split('?v=')[1];
   if(!keys.has(asset)) keys.set(asset,new Map());
   if(!keys.get(asset).has(key)) keys.get(asset).set(key,[]);
   keys.get(asset).get(key).push(name);
  }
 };
 for(const name of pages) scan(name,fs.readFileSync(path.join(__dirname,'../'+name+'.html'),'utf8'));
 assert.ok(keys.size>=10,'the scan finds the versioned assets (found '+keys.size+')');
 for(const [asset,byKey] of keys){
  assert.equal(byKey.size,1,asset+' carries exactly one cache key across all pages (found '+[...byKey.keys()].join(', ')+')');
 }
 //     The scan itself is proven non-vacuous: a planted stale key
 //     on one page must surface as a second key for that asset.
 const planted=new Map();
 const idx=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const staleIdx=idx.replace('css/main.css?v=1.191.0','css/main.css?v=1.148.0');
 assert.notEqual(staleIdx,idx,'the planted stale key actually changes index.html');
 {
  const byAsset=new Map();
  for(const html of [staleIdx,fs.readFileSync(path.join(__dirname,'../about.html'),'utf8')]){
   for(const m of html.matchAll(/(?:css|js)\/[\w.-]+\?v=[\d.]+/g)){
    const asset=m[0].split('?v=')[0], key=m[0].split('?v=')[1];
    if(!byAsset.has(asset)) byAsset.set(asset,new Set());
    byAsset.get(asset).add(key);
   }
  }
  assert.equal(byAsset.get('css/main.css').size,2,'a stale key planted on one page surfaces as a second main.css key');
 }
 // (2) The doubling itself stays gone: the needle is built from
 //     char codes so this source never carries the literal sequence
 //     it hunts. String-built RegExp sources (the per-file JS pin
 //     further up) legitimately use doubled escapes inside strings,
 //     so the hunt is scoped to the four assets whose literals were
 //     doubled.
 const doubled=String.fromCharCode(92,92);
 const selfSrc=fs.readFileSync(__filename,'utf8');
 for(const asset of ['main.css','experience.css','common.js','home.js']){
  assert.ok(!selfSrc.includes(asset.split('.')[0]+doubled+'.'+asset.split('.')[1]),
   'no doubled-backslash '+asset+' pattern remains in the suite');
 }
 // Footer branding untouched by this release.
 assert.ok(idx.includes('data-cf-copy="btc"'),'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'),'the @kshot9000 attribution survives on index.html');
});

test('v1.155.0: footer links are thumb targets where the footer stacks', async () => {
 // Measured on a 390px phone, every footer list link was a 20px-tall
 // inline text box on a 26px pitch (site list + Bears socials, all
 // eleven pages) — a thumb threads between neighbours 6px away, and
 // "Stats" is a 30x20px target. The small-screen block already gives
 // .btn a 40px minimum; the footer never got the same treatment.
 // Where .foot-grid collapses to one column (<=800px) the links now
 // compose as 40px flex rows: the v1.24.0 underline-grow runs the
 // row's full width, and column-gap restores the separation flex
 // collapses inside the social links (icon / name / handle).
 const css = fs.readFileSync(path.join(__dirname, '../css/main.css'), 'utf8');
 const block = css.slice(css.indexOf('v1.155.0'));
 assert.ok(/@media \(max-width: 800px\)/.test(block), 'the thumb rows live at the footer stacking width');
 assert.ok(/\.site-foot \.foot-grid ul \{\s*gap:\s*0/.test(block), 'stacked footer lists tile their rows seamlessly');
 assert.ok(/\.site-foot \.foot-grid ul a \{\s*display:\s*flex;\s*align-items:\s*center;\s*column-gap:\s*0\.38em;\s*min-height:\s*40px/.test(block), 'footer links are 40px flex rows with the flex-collapsed spacing restored');
 // The desktop list is untouched: the base rules still describe
 // inline links on a 6px-gapped grid, outside any media query.
 assert.ok(/\.site-foot ul \{ list-style: none; display: grid; gap: 6px; font-size: 13px; \}/.test(css), 'the base footer list keeps its compact desktop grammar');
 assert.ok(/\.site-foot \.foot-grid ul a \{\s*padding-bottom: 2px/.test(css), 'the base footer link keeps its inline underline treatment');
 // Cache keys moved with the release: main.css on all eleven pages.
 // experience.css is unchanged this run, so its key sits at 1.157.0.
 for (const name of ['404','about','games','highlights','index','injuries','news','odds','practice','stats','team']) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html pins main.css 1.191.0');
  assert.ok(html.includes('css/experience.css?v=1.195.0'), name + '.html keeps experience.css 1.187.0');
 }
 // Footer branding untouched by this release.
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.156.0: the disclosure labels clear AA contrast', async () => {
 // The two labels whose entire job is disclosure were the faintest
 // text on the site: the referral "Partner" badge at ice 0.6 alpha
 // over the card gradient (~3.9:1) and the filled ad slot's
 // "Advertisement" label at ice 0.45 over the navy page (~2.75:1),
 // both under the 4.5:1 small-text line at 10px. This test does not
 // just pin the new alphas — it composites them over the real
 // backgrounds and asserts the resulting contrast, so a future
 // "dim it back down" edit fails here on the actual requirement.
 const css = fs.readFileSync(path.join(__dirname, '../css/main.css'), 'utf8');
 const lum = (rgb) => {
  const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
 };
 const contrast = (fg, bg) => {
  const l1 = lum(fg), l2 = lum(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
 };
 const over = (fg, a, bg) => fg.map((c, i) => c * a + bg[i] * (1 - a));
 const ICE = [159, 184, 204], NAVY = [6, 13, 24];
 const alphaOf = (re, label) => {
  const m = css.match(re);
  assert.ok(m, label + ' declaration is present');
  return Number(m[1]);
 };
 // Partner badge: text over both stops of the .ref-card gradient,
 // each stop itself composited over the navy page.
 const badgeA = alphaOf(/\.ref-badge\s*\{[^}]*color:\s*rgba\(159,\s*184,\s*204,\s*([\d.]+)\)/, 'the Partner badge color');
 assert.ok(badgeA >= 0.85, 'the Partner badge alpha is lifted to 0.85 (found ' + badgeA + ')');
 for (const stop of [[20, 34, 52], [12, 22, 36]]) {
  const cardBg = over(stop, 0.72, NAVY);
  const ratio = contrast(over(ICE, badgeA, cardBg), cardBg);
  assert.ok(ratio >= 4.5, 'the Partner badge clears 4.5:1 on the card gradient (got ' + ratio.toFixed(2) + ':1)');
 }
 assert.ok(/\.ref-badge\s*\{[^}]*border:\s*1px solid rgba\(159,\s*184,\s*204,\s*0\.4\)/.test(css), 'the badge hairline lifts with the text so the pill reads as one unit');
 // Advertisement label: text over the navy page background.
 const adA = alphaOf(/\.ad-slot\.is-live::before\s*\{[^}]*color:\s*rgba\(159,\s*184,\s*204,\s*([\d.]+)\)/, 'the Advertisement label color');
 assert.ok(adA >= 0.75, 'the Advertisement label alpha is lifted to 0.75 (found ' + adA + ')');
 const adRatio = contrast(over(ICE, adA, NAVY), NAVY);
 assert.ok(adRatio >= 4.5, 'the Advertisement label clears 4.5:1 on navy (got ' + adRatio.toFixed(2) + ':1)');
 // The old sub-AA alphas stay gone for these two labels.
 assert.ok(!css.includes('color: rgba(159, 184, 204, 0.6);'), 'the 0.6 badge color is gone');
 assert.ok(!css.includes('color: rgba(159, 184, 204, 0.45);'), 'the 0.45 ad-label color is gone');
 // Cache keys moved with the release: main.css on all eleven pages.
 // experience.css is unchanged this run, so its key sits at 1.157.0.
 for (const name of ['404','about','games','highlights','index','injuries','news','odds','practice','stats','team']) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html pins main.css 1.191.0');
  assert.ok(html.includes('css/experience.css?v=1.195.0'), name + '.html keeps experience.css 1.187.0');
 }
 // Footer branding untouched by this release.
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.157.0: standalone links are thumb targets on phones', async () => {
 // Buttons got a 40px phone minimum long ago and the footer links
 // got theirs in v1.155.0, but a fresh 390px probe measured the
 // standalone links a fan taps mid-page still sitting at text
 // height: section-head links at 17-19px, the hero match card's
 // "Matchup & schedule" link at 17px beside its ~40px toggle,
 // wire-ticker headlines at 27px inside their 44px track,
 // roster "Player profile" links at 15px, and the injury
 // report's profile link as an 11x18px bare glyph. At <=760px
 // each now composes as a 40px target; prose links and the
 // desktop layout are untouched.
 const css = fs.readFileSync(path.join(__dirname, '../css/experience.css'), 'utf8');
 const block = css.slice(css.indexOf('v1.157.0'));
 assert.ok(/@media \(max-width: 760px\)/.test(block), 'the thumb targets live in the phone block');
 assert.ok(/\.section-head a:not\(\.btn\) \{ display: inline-flex; align-items: center; min-height: 40px; \}/.test(block), 'section-head links are 40px targets (buttons already are)');
 assert.ok(/\.match-footer a \{ display: inline-flex; align-items: center; min-height: 40px; \}/.test(block), 'the match-card footer link matches its toggle at 40px');
 assert.ok(/\.wt-item \{ align-items: center; min-height: 40px; \}/.test(block), 'ticker headlines fill their 44px track at 40px');
 assert.ok(/\.player-info \.player-link \{ display: inline-flex; align-items: center; min-height: 40px; \}/.test(block), 'roster profile links are 40px targets');
 assert.ok(/\.profile-link \{ display: inline-flex; align-items: center; justify-content: center; min-width: 40px; min-height: 40px/.test(block), 'the injury profile link is a 40x40 target');
 // The desktop grammar survives outside the phone block: the base
 // rules still describe compact inline links.
 assert.ok(/\.player-info \.player-link \{ font-size: 11px; \}/.test(css), 'the base profile link keeps its compact desktop size');
 assert.ok(/\.wt-item \{ display: inline-flex; align-items: baseline/.test(css), 'the base ticker item keeps its baseline desktop composition');
 // The injury profile link also gains a real accessible name: it
 // was a bare glyph whose only name was a title tooltip.
 const inj = fs.readFileSync(path.join(__dirname, '../js/injuries.js'), 'utf8');
 assert.ok(inj.includes('class="profile-link"'), 'injuries.js stamps the profile-link class');
 assert.ok(inj.includes('aria-label="Player profile: '), 'injuries.js names the profile link for assistive tech');
 // Cache keys moved with the release: experience.css on all
 // eleven pages, injuries.js on injuries.html. main.css is
 // unchanged this run, so its key stays at 1.156.0.
 for (const name of ['404','about','games','highlights','index','injuries','news','odds','practice','stats','team']) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('css/experience.css?v=1.195.0'), name + '.html pins experience.css 1.187.0');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html keeps main.css 1.191.0');
 }
 const injHtml = fs.readFileSync(path.join(__dirname, '../injuries.html'), 'utf8');
 assert.ok(injHtml.includes('js/injuries.js?v=1.177.0'), 'injuries.html pins injuries.js 1.177.0');
 // Footer branding untouched by this release.
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.158.0: every page outline starts at its h1 with no skipped rungs', async () => {
 // A rendered sweep found the heading outline starting with a
 // slogan on eight pages: the photo-band headline was an <h3>
 // before the <h1>, the hero matchup title an <h3> under the
 // home <h1>, the Games desk title and Practice facility names
 // <h3>s with no <h2> above them, the News rail an <h3> before
 // its section <h2>, and every footer an <h4> after <h2>s. The
 // slogans are decoration and are now <p class="band-line">;
 // the real heads carry their true levels. This test walks the
 // static outline of all eleven pages and proves the ladder:
 // first heading is the single <h1>, and no heading ever jumps
 // down more than one level from the previous one.
 const names = ['404','about','games','highlights','index','injuries','news','odds','practice','stats','team'];
 for (const name of names) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map(m => +m[1]);
  assert.equal(levels[0], 1, name + '.html opens its outline with the h1');
  assert.equal(levels.filter(l => l === 1).length, 1, name + '.html has exactly one h1');
  let prev = 1;
  for (const l of levels.slice(1)) {
   assert.ok(l <= prev + 1, name + '.html never skips a heading level (saw h' + prev + ' -> h' + l + ')');
   prev = l;
  }
  assert.ok(!/photo-band-copy">\s*<div class="eyebrow"[^<]*<\/div>\s*<h3/.test(html) && !html.includes('photo-band-copy h3'),
    name + '.html carries no heading inside its photo band');
  assert.ok(!/<h[1-6][^>]*class="band-line"/.test(html), name + '.html band-line is never a heading');
 }
 // The demoted slogans keep their exact look: the band rules and
 // the display-font group were retargeted, and the guards beat
 // the .photo-band-copy p rule a demoted <p> would inherit.
 const main = fs.readFileSync(path.join(__dirname, '../css/main.css'), 'utf8');
 assert.ok((main.match(/\.photo-band \.photo-band-copy \.band-line \{/g) || []).length === 4, 'the three band slogan rules plus the v1.158.0 guard target .band-line');
 assert.ok(!main.includes('.photo-band-copy h3 {'), 'no band rule still targets an h3');
 assert.ok(/h1, h2, h3, h4, \.display, \.band-line \{/.test(main), 'band-line joins the display-font group');
 assert.ok(/\.photo-band \.photo-band-copy \.band-line \{ color: var\(--snow\); max-width: none; \}/.test(main), 'band-line keeps snow colour and the full measure');
 assert.ok(/\.card h2\.card-h \{ font-size: 16px; letter-spacing: 0\.1em; margin-bottom: 12px; \}/.test(main), 'promoted card titles keep the .card h3 metrics');
 assert.ok(/\.rail h2, \.rail h3 \{ font-size: 14px; \}/.test(main), 'the rail head rule covers both true levels');
 assert.ok(!main.includes('.site-foot h4'), 'footer column rules no longer target h4');
 // The promoted heads themselves.
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('<h2 id="ng-title">'), 'the hero matchup title is an h2');
 const exp = fs.readFileSync(path.join(__dirname, '../css/experience.css'), 'utf8');
 assert.ok(/\.match-card h2 \{/.test(exp) && !exp.includes('.match-card h3'), 'match-card title rules target the h2');
 const games = fs.readFileSync(path.join(__dirname, '../games.html'), 'utf8');
 assert.ok(games.includes('<h2 class="card-h" style="margin:0">Sunday desk</h2>'), 'the Sunday desk title is an h2');
 const prac = fs.readFileSync(path.join(__dirname, '../practice.html'), 'utf8');
 assert.equal((prac.match(/<h2 class="card-h">/g) || []).length, 3, 'all three facility names are h2s');
 const news = fs.readFileSync(path.join(__dirname, '../news.html'), 'utf8');
 assert.ok(news.includes('<h2>🩹 Injury wire</h2>'), 'the News rail head is an h2');
 const team = fs.readFileSync(path.join(__dirname, '../team.html'), 'utf8');
 assert.ok(team.includes('<p class="band-line" id="roster-hero-line">'), 'the roster slogan keeps its id on the band-line');
 // Cache keys moved with the release: both stylesheets changed.
 for (const name of names) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html pins main.css 1.191.0');
  assert.ok(html.includes('css/experience.css?v=1.195.0'), name + '.html pins experience.css 1.187.0');
 }
 // Footer branding untouched by this release.
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.159.0: the primary button label clears AA contrast at every gradient stop', async () => {
 // A rendered sweep found the site's main call to action failing
 // the 4.5:1 small-text line: .btn.primary set its snow 13px
 // label on a gradient ending at var(--orange-hot) (#ff5a1f,
 // 2.98:1), hover brightened to #ff7340 (2.58:1), and the hero
 // override in experience.css painted solid #ef571c (3.31:1)
 // with a #ff723b hover (2.59:1). Like the v1.156.0 test, this
 // one computes the real ratios from the declared stops —
 // endpoints and the midpoint blend — so re-brightening the
 // button fails on the requirement itself, not on a pin.
 const lum = (rgb) => {
  const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
 };
 const contrast = (fg, bg) => {
  const l1 = lum(fg), l2 = lum(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
 };
 const SNOW = [247, 250, 252];
 const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
 const main = fs.readFileSync(path.join(__dirname, '../css/main.css'), 'utf8');
 const root = main.match(/:root\s*\{([\s\S]*?)\}/)[1];
 const varOf = (name) => {
  const m = root.match(new RegExp(name.replace(/-/g, '\\-') + ':\\s*(#[0-9a-f]{6})', 'i'));
  assert.ok(m, name + ' is declared in :root');
  return m[1].toLowerCase();
 };
 assert.equal(varOf('--orange'), '#d13a02', 'the brand orange is unchanged');
 assert.equal(varOf('--orange-hot'), '#ff5a1f', '--orange-hot stays bright for text on navy');
 assert.equal(varOf('--snow'), '#f7fafc', 'the button label colour is unchanged');
 const stopsOf = (cssText, label) => {
  const bgDecl = cssText.match(/background:\s*([^;]+)/);
  assert.ok(bgDecl, label + ' declares a background');
  const stops = [];
  const re = /var\(--orange\)|#[0-9a-f]{6}/gi;
  let m;
  while ((m = re.exec(bgDecl[1]))) stops.push(m[0].startsWith('var') ? varOf('--orange') : m[0].toLowerCase());
  assert.ok(stops.length >= 1, label + ' declares at least one background stop');
  return stops.map(hex);
 };
 const assertStopsClearAA = (stops, label) => {
  const pts = stops.slice();
  for (let i = 0; i + 1 < stops.length; i++) pts.push(stops[i].map((c, k) => (c + stops[i + 1][k]) / 2));
  for (const bg of pts) {
   const ratio = contrast(SNOW, bg);
   assert.ok(ratio >= 4.5, label + ' clears 4.5:1 against the snow label (got ' + ratio.toFixed(2) + ':1)');
  }
 };
 const btnBlock = main.match(/\.btn\.primary\s*\{([\s\S]*?)\}/)[1];
 assertStopsClearAA(stopsOf(btnBlock, '.btn.primary'), '.btn.primary');
 const btnHover = main.match(/\.btn\.primary:hover\s*\{([\s\S]*?)\}/)[1];
 assertStopsClearAA(stopsOf(btnHover, '.btn.primary:hover'), '.btn.primary:hover');
 assert.ok(!/orange-hot/.test(btnBlock + btnHover), 'the primary gradient no longer runs to orange-hot');
 assert.ok(!(btnBlock + btnHover).includes('#ff7340'), 'the 2.58:1 hover stop is gone');
 const exp = fs.readFileSync(path.join(__dirname, '../css/experience.css'), 'utf8');
 const heroBlock = exp.match(/\.hero-actions \.primary\s*\{([\s\S]*?)\}/)[1];
 assertStopsClearAA(stopsOf(heroBlock, '.hero-actions .primary'), '.hero-actions .primary');
 const heroHover = exp.match(/\.hero-actions \.primary:hover\s*\{([\s\S]*?)\}/)[1];
 assertStopsClearAA(stopsOf(heroHover, '.hero-actions .primary:hover'), '.hero-actions .primary:hover');
 assert.ok(!(heroBlock + heroHover).includes('#ef571c') && !(heroBlock + heroHover).includes('#ff723b'), 'the sub-AA hero oranges are gone');
 assert.ok(/\.hero-actions \.primary:hover\s*\{[^}]*transform:\s*translateY\(-2px\)/.test(exp), 'the hero hover lift survives');
 // Cache keys moved with the release: both stylesheets changed.
 for (const name of ['404', 'about', 'games', 'highlights', 'index', 'injuries', 'news', 'odds', 'practice', 'stats', 'team']) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html pins main.css 1.191.0');
  assert.ok(html.includes('css/experience.css?v=1.195.0'), name + '.html pins experience.css 1.187.0');
 }
 // Footer branding untouched by this release.
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.160.0: the two remaining buttons are thumb targets on phones', async () => {
 // A rendered 390px sweep found exactly two <button>s still
 // under the site's own 40px phone minimum: the footer BTC
 // tip chip (295x32px, all eleven pages) and the hero card's
 // "Make your call" toggle (35px, beside its 40px sibling
 // link from v1.157.0). Both now carry min-height: 40px in
 // the phone blocks of their own stylesheets; the base rules
 // stay compact so desktop is byte-identical.
 const main = fs.readFileSync(path.join(__dirname, '../css/main.css'), 'utf8');
 const chipBase = main.match(/\.prl-chip\s*\{([\s\S]*?)\}/)[1];
 assert.ok(!/min-height/.test(chipBase), 'the base .prl-chip rule keeps its compact desktop height');
 assert.ok(/padding:\s*8px 14px/.test(chipBase), 'the base .prl-chip padding is unchanged');
 const chipPhone = main.match(/@media \(max-width: 800px\) \{\s*\.prl-chip \{ min-height: 40px; \}/);
 assert.ok(chipPhone, 'at <=800px the tip chip composes 40px tall');
 const exp = fs.readFileSync(path.join(__dirname, '../css/experience.css'), 'utf8');
 const toggleBase = exp.match(/\.text-button\s*\{([\s\S]*?)\}/)[1];
 assert.ok(!/min-height/.test(toggleBase), 'the base .text-button rule keeps its compact desktop height');
 const togglePhone = exp.match(/@media \(max-width: 760px\) \{\s*\.match-footer \.text-button \{ display: inline-flex; align-items: center; min-height: 40px; \}/);
 assert.ok(togglePhone, 'at <=760px the Make your call toggle composes 40px tall beside its sibling link');
 // Cache keys moved with the release: both stylesheets changed.
 for (const name of ['404', 'about', 'games', 'highlights', 'index', 'injuries', 'news', 'odds', 'practice', 'stats', 'team']) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html pins main.css 1.191.0');
  assert.ok(html.includes('css/experience.css?v=1.195.0'), name + '.html pins experience.css 1.187.0');
 }
 // Footer branding untouched by this release.
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.161.0: the form controls are thumb targets on phones', async () => {
 // A rendered sweep found buttons, links and the tip chip all
 // at the site's 40px phone minimum (v1.155.0-v1.160.0) except
 // the text fields: the Games day picker measured 144x36px in
 // its own row between the 40px prev/Today buttons, and the
 // .key-box API-key fields measured 37px (odds.html's board
 // key, about.html's two provider keys) beside taller Save /
 // Load buttons. At <=800px both compose min-height: 40px in
 // main.css; the base rules stay compact so desktop is
 // byte-identical, and the roster controls (already exactly
 // 40px rendered) carry no new rule.
 const main = fs.readFileSync(path.join(__dirname, '../css/main.css'), 'utf8');
 const dateBase = main.match(/input\[type="date"\]\s*\{([\s\S]*?)\}/)[1];
 assert.ok(!/min-height/.test(dateBase), 'the base date rule keeps its compact desktop height');
 assert.ok(/padding:\s*7px 12px/.test(dateBase), 'the base date padding is unchanged');
 const keyBase = main.match(/\.key-box input\s*\{([\s\S]*?)\}/)[1];
 assert.ok(!/min-height/.test(keyBase), 'the base .key-box input rule keeps its compact desktop height');
 assert.ok(/padding:\s*10px 12px/.test(keyBase), 'the base .key-box input padding is unchanged');
 const phone = main.match(/@media \(max-width: 800px\) \{\s*\.key-box input, input\[type="date"\] \{ min-height: 40px; \}\s*\}/);
 assert.ok(phone, 'at <=800px the key fields and the day picker compose 40px tall');
 const rosterBase = main.match(/\.roster-controls input, \.roster-controls select\s*\{([\s\S]*?)\}/)[1];
 assert.ok(!/min-height/.test(rosterBase), 'the roster controls (already 40px rendered) gain no minimum');
 // Cache key moved with the release: main.css changed,
 // experience.css did not.
 for (const name of ['404', 'about', 'games', 'highlights', 'index', 'injuries', 'news', 'odds', 'practice', 'stats', 'team']) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html pins main.css 1.191.0');
  assert.ok(html.includes('css/experience.css?v=1.195.0'), name + '.html keeps experience.css 1.187.0');
 }
 // Footer branding untouched by this release.
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.162.0: every table header names its column for screen readers', async () => {
 // stats.js already stamped scope="col" on its leaders tables,
 // but a sweep found every other header on the site bare: 39
 // static <th> across games (season log + standings), index
 // (standings + injury snapshot), injuries, practice and team,
 // plus 8 built in JS (games.js box-score leaders, odds.js
 // full-board table). Without scope, a screen reader stepping
 // through cells cannot reliably announce which column a value
 // belongs to. Every column header now carries scope="col"
 // (stats.js rowgroup headers keep scope="rowgroup").
 // Source walk: every <th tag in every page and script carries
 // a scope attribute — a new bare header fails here directly.
 const thTags = (text) => {
  const tags = [];
  const re = /<th(?=[\s>\\])/g;
  let m;
  while ((m = re.exec(text))) tags.push(text.slice(m.index, text.indexOf('>', m.index) + 1));
  return tags;
 };
 const pages = ['404','about','games','highlights','index','injuries','news','odds','practice','stats','team'];
 let htmlTh = 0;
 for (const name of pages) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  for (const tag of thTags(html)) {
   htmlTh++;
   assert.ok(tag.includes('scope="col"'), name + '.html header carries scope="col": ' + tag);
  }
 }
 assert.equal(htmlTh, 40, 'the static sweep covers all 40 page headers (39 new + the box-score header already scoped)');
 const scripts = ['about','api','common','games','highlights','home','injuries','news','odds','practice','snow','stats','team'];
 for (const name of scripts) {
  const js = fs.readFileSync(path.join(__dirname, '../js/' + name + '.js'), 'utf8');
  for (const tag of thTags(js)) {
   assert.ok(/scope=/.test(tag), name + '.js header carries a scope: ' + tag);
  }
 }
 const gamesJs = fs.readFileSync(path.join(__dirname, '../js/games.js'), 'utf8');
 assert.ok(gamesJs.includes('<th scope="col">Category</th><th scope="col">Leader</th><th scope="col" class="num">Line</th>'), 'games.js box-score headers carry scope="col"');
 const oddsJs = fs.readFileSync(path.join(__dirname, '../js/odds.js'), 'utf8');
 assert.ok(oddsJs.includes('<th scope=\\"col\\">Book</th>'), 'odds.js full-board headers carry scope="col"');
 assert.ok(!/<th>/.test(oddsJs) && !/<th>/.test(gamesJs), 'no bare <th> survives in the table builders');
 // Rendered: the DOM agrees on the two heaviest static pages.
 for (const name of ['index','games','team']) {
  const p = await page(name);
  try {
   const ths = [...p.w.document.querySelectorAll('th')];
   assert.ok(ths.length > 0, name + '.html renders headers');
   for (const th of ths) assert.equal(th.getAttribute('scope'), 'col', name + '.html rendered header is a column header: ' + th.textContent.trim());
  } finally { p.close(); }
 }
 // Cache keys moved with the release: games.js and odds.js
 // changed, so their keys move to 1.162.0; stylesheets did not.
 const gh = fs.readFileSync(path.join(__dirname, '../games.html'), 'utf8');
 assert.ok(gh.includes('js/games.js?v=1.193.0'), 'games.html pins games.js 1.163.0');
 const oh = fs.readFileSync(path.join(__dirname, '../odds.html'), 'utf8');
 assert.ok(oh.includes('js/odds.js?v=1.164.0'), 'odds.html pins odds.js 1.162.0');
 for (const name of pages) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html keeps main.css 1.191.0');
  assert.ok(html.includes('css/experience.css?v=1.195.0'), name + '.html keeps experience.css 1.187.0');
 }
 // Footer branding untouched by this release.
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.163.0: the season log box-score link is a chip, not a bare fragment', async () => {
 // The one link a fan taps after every game had no CSS rule
 // of its own: a bare inline link in dim ice, 38x18px on
 // desktop, and at 390px the narrow cell wrapped it mid-word
 // into a 23x39px two-line fragment ("box" over the arrow)
 // whose only accessible name was that fragment. It now
 // composes as a chip in the .st pill family (inline-flex,
 // hairline border, 999px radius, nowrap) scoped to
 // #log-table so the day-card "Box score ↓" prose link keeps
 // its plain treatment; hover warms the border to the orange
 // glow, and at <=800px it stands the 40px phone minimum.
 const main = fs.readFileSync(path.join(__dirname, '../css/main.css'), 'utf8');
 const chip = main.match(/#log-table \.boxlink \{([\s\S]*?)\}/)[1];
 assert.ok(/display:\s*inline-flex/.test(chip), 'the log box link composes as an inline-flex chip');
 assert.ok(/white-space:\s*nowrap/.test(chip), 'the chip label never wraps mid-word');
 assert.ok(/border:\s*1px solid var\(--line\)/.test(chip), 'the chip carries the hairline border');
 assert.ok(/border-radius:\s*999px/.test(chip), 'the chip is a pill');
 assert.ok(!/min-height/.test(chip), 'the base chip keeps its compact desktop height');
 const hover = main.match(/#log-table \.boxlink:hover \{([\s\S]*?)\}/)[1];
 assert.ok(/border-color:\s*var\(--orange-glow\)/.test(hover), 'hover warms the chip border to the orange glow');
 const phone = main.match(/@media \(max-width: 800px\) \{\s*#log-table \.boxlink \{ min-height: 40px; padding: 0 12px; \}\s*\}/);
 assert.ok(phone, 'at <=800px the chip stands the 40px phone minimum');
 // The wider chip column must not steal the date cell's
 // width in the auto layout (rendered rows grew 82 -> 124px
 // without this): the date keeps one line and the table's
 // own scroll wrap absorbs the width.
 assert.ok(/#log-table td:first-child \{ white-space: nowrap; \}/.test(main), 'the log date cell never wraps to fund the chip column');
 // games.js: the log link names its destination and reads
 // as a label; the prose day-card link is untouched.
 const gamesJs = fs.readFileSync(path.join(__dirname, '../js/games.js'), 'utf8');
 assert.ok(gamesJs.includes('aria-label="Box score: Bears '), 'the log link carries a full accessible name');
 assert.ok(gamesJs.includes('(g.home ? "vs " : "at ")'), 'the accessible name carries the matchup');
 assert.ok(gamesJs.includes('">Box ↗</a>'), 'the visible label is the capitalized chip text');
 assert.ok(gamesJs.includes('class="boxlink">Box score ↓</a>'), 'the day-card prose link keeps its plain treatment');
 // Cache keys moved with the release: main.css and games.js
 // changed; experience.css and odds.js did not.
 const pages = ['404','about','games','highlights','index','injuries','news','odds','practice','stats','team'];
 for (const name of pages) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html pins main.css 1.191.0');
  assert.ok(html.includes('css/experience.css?v=1.195.0'), name + '.html keeps experience.css 1.187.0');
 }
 const gh = fs.readFileSync(path.join(__dirname, '../games.html'), 'utf8');
 assert.ok(gh.includes('js/games.js?v=1.193.0'), 'games.html pins games.js 1.163.0');
 const oh = fs.readFileSync(path.join(__dirname, '../odds.html'), 'utf8');
 assert.ok(oh.includes('js/odds.js?v=1.164.0'), 'odds.html keeps odds.js 1.162.0');
 // Footer branding untouched by this release.
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.164.0: every table names itself for screen readers', async () => {
 // v1.162.0 gave every column header a scope, but only the
 // stats.js tables carried a <caption>: a screen-reader fan
 // landing on the other nine tables (7 static across index,
 // games, injuries, practice and team, plus the games.js
 // box-score leaders and odds.js full-board builders) heard
 // rows and columns with no statement of what the table IS.
 // Every table now opens with an sr-only caption in the
 // stats.js form, so the table announces its subject before
 // its first cell; visuals are unchanged (the caption is
 // visually hidden by the same .sr-only rule stats uses).
 const pages = ['404','about','games','highlights','index','injuries','news','odds','practice','stats','team'];
 const capRe = /<table[^>]*><caption class="sr-only">[^<]+<\/caption>/g;
 const tableRe = /<table[\s>]/g;
 let staticCaps = 0;
 for (const name of pages) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  const tables = (html.match(tableRe) || []).length;
  const caps = (html.match(capRe) || []).length;
  assert.equal(caps, tables, name + '.html: every table opens with an sr-only caption');
  staticCaps += caps;
 }
 assert.equal(staticCaps, 7, 'the static sweep covers all 7 page tables');
 // Each caption names its own table, not a generic label.
 const byId = (file, id) => {
  const html = fs.readFileSync(path.join(__dirname, '../' + file), 'utf8');
  const m = html.match(new RegExp('id="' + id + '"><caption class="sr-only">([^<]+)</caption>'));
  assert.ok(m, file + ' #' + id + ' carries a caption');
  return m[1];
 };
 assert.equal(byId('index.html', 'div-table'), 'NFC North standings');
 assert.equal(byId('index.html', 'home-injuries'), 'Bears injury snapshot');
 assert.equal(byId('games.html', 'log-table'), 'Bears season log');
 assert.equal(byId('games.html', 'div-table-2'), 'NFC North standings');
 assert.equal(byId('injuries.html', 'report-table'), 'Bears injury report');
 assert.equal(byId('practice.html', 'tracker'), 'Bears practice tracker');
 assert.equal(byId('team.html', 'roster-table'), 'Bears roster');
 // The two JS-built tables join in; stats.js keeps its three.
 const gamesJs = fs.readFileSync(path.join(__dirname, '../js/games.js'), 'utf8');
 assert.ok(gamesJs.includes('<table class="tbl"><caption class="sr-only">Box score leaders by category</caption>'), 'games.js box-score table carries its caption');
 const oddsJs = fs.readFileSync(path.join(__dirname, '../js/odds.js'), 'utf8');
 assert.ok(oddsJs.includes('<caption class="sr-only">Odds by sportsbook</caption>'), 'odds.js full-board table carries its caption');
 const statsJs = fs.readFileSync(path.join(__dirname, '../js/stats.js'), 'utf8');
 assert.equal((statsJs.match(/<caption class="sr-only">/g) || []).length, 3, 'stats.js keeps its three captions');
 // Rendered: the caption is the table's first element and
 // carries real text on the heaviest static pages.
 for (const name of ['index','games','team']) {
  const p = await page(name);
  try {
   const tables = [...p.w.document.querySelectorAll('table')];
   assert.ok(tables.length > 0, name + '.html renders tables');
   for (const t of tables) {
    const c = t.firstElementChild;
    assert.ok(c && c.tagName === 'CAPTION', name + '.html rendered table opens with a caption');
    assert.ok(c.classList.contains('sr-only'), name + '.html caption is screen-reader-only');
    assert.ok(c.textContent.trim().length > 0, name + '.html caption names the table: ' + c.textContent.trim());
   }
  } finally { p.close(); }
 }
 // Cache keys moved with the release: games.js and odds.js
 // changed, so their keys move to 1.164.0; stylesheets did not.
 const gh = fs.readFileSync(path.join(__dirname, '../games.html'), 'utf8');
 assert.ok(gh.includes('js/games.js?v=1.193.0'), 'games.html pins games.js 1.190.0');
 const oh = fs.readFileSync(path.join(__dirname, '../odds.html'), 'utf8');
 assert.ok(oh.includes('js/odds.js?v=1.164.0'), 'odds.html pins odds.js 1.164.0');
 for (const name of pages) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html keeps main.css 1.191.0');
  assert.ok(html.includes('css/experience.css?v=1.195.0'), name + '.html keeps experience.css 1.187.0');
 }
 // Footer branding untouched by this release.
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.165.0: headlines balance their lines instead of stranding a last word', async () => {
 // The declaration itself: the whole display-heading family
 // plus the news wire's headline links (long headlines that are
 // anchors, not headings) compose with balanced wraps.
 const css = fs.readFileSync(path.join(__dirname, '../css/main.css'), 'utf8');
 assert.match(css, /h1, h2, h3, h4, \.display, \.band-line, \.news-item \.headline \{ text-wrap: balance; \}/, 'the v1.165.0 balance rule covers headings and wire headlines');
 // Balance must stay scoped to headline text: body copy keeps
 // its natural wrap (a global text-wrap on * or body would
 // reflow every paragraph on the site).
 assert.ok(!/\*\s*\{[^}]*text-wrap/.test(css), 'no universal text-wrap rule leaks balance into body copy');
 assert.ok(!/body\s*\{[^}]*text-wrap/.test(css), 'body copy is not balanced');
 // Rendered sanity: the pages that carry the measured headings
 // still render their headlines (the rule changes wraps, never
 // content).
 for (const name of ['index', 'news']) {
  const p = await page(name);
  try {
   assert.ok(p.w.document.querySelector('h1'), name + '.html still renders its h1');
   assert.ok(p.w.document.querySelectorAll('h2, h3').length > 0, name + '.html still renders section headings');
  } finally { p.close(); }
 }
 // Cache keys moved with the release: main.css changed, so its
 // key moves to 1.165.0 on every page; nothing else moved.
 const pages = ['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for (const name of pages) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html pins main.css 1.191.0');
  assert.ok(!/main\.css\?v=(?!1\.191\.0")1\.[0-9]+\.0"/.test(html), name + '.html has no stale main.css key');
  assert.ok(html.includes('css/experience.css?v=1.195.0'), name + '.html keeps experience.css 1.187.0');
 }
 const gh = fs.readFileSync(path.join(__dirname, '../games.html'), 'utf8');
 assert.ok(gh.includes('js/games.js?v=1.193.0'), 'games.html keeps games.js 1.190.0');
 const oh = fs.readFileSync(path.join(__dirname, '../odds.html'), 'utf8');
 assert.ok(oh.includes('js/odds.js?v=1.164.0'), 'odds.html keeps odds.js 1.164.0');
 // Footer branding untouched by this release.
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.166.0: the About projects are the five Kyle named, each linking to its live website',async()=>{
 // Kyle (2026-10-02): "update my other projects on the page to show the
 // link to the websites for nightdream, gridironui, and night messenger
 // only" — then "include something for quantus and pearl". The old list
 // linked GitHub repos (NightDream.io, EUTXO.DEX, SPO Tracker) plus an
 // X-profile placeholder (SigmaSwap). The list is now exactly the five
 // named projects, every card pointing at the project's website.
 const common=fs.readFileSync(path.join(__dirname,'..','js','common.js'),'utf8');
 const block=common.match(/projects:\s*\[([\s\S]*?)\n  \],/);
 assert.ok(block,'the projects array exists in common.js');
 const entries=[...block[1].matchAll(/name:\s*"([^"]+)"[\s\S]*?url:\s*"([^"]+)"/g)].map(m=>({name:m[1],url:m[2]}));
 assert.deepEqual(entries,[
  {name:'NightDream',url:'https://nightdream.xyz'},
  {name:'GridIronUI',url:'https://gridironui.xyz'},
  {name:'Night Messenger',url:'https://kshot3000.github.io/Night-Messenger-/'},
  {name:'Quantus Builder',url:'https://kshot3000.github.io/Quantus-Muse-Builder/'},
  {name:'Pearl Builder',url:'https://kshot3000.github.io/Pearl-Muse-24-7-Ai-builder/'},
 ],'exactly the five named projects, each with its website URL');
 assert.ok(!/repo:/.test(block[1]),'no project falls back to a GitHub repo link');
 assert.ok(!/EUTXO|SigmaSwap|Epoch-Tracker/.test(block[1]),'the retired projects are gone');
 // The renderer labels url-cards by their bare host, so the cards read
 // as website links (about.js: label = p.url minus the protocol).
 const about=fs.readFileSync(path.join(__dirname,'..','js','about.js'),'utf8');
 assert.ok(/const href = p\.url \|\|/.test(about),'about.js prefers the project url over the repo fallback');
 assert.ok(/p\.url\.replace\(\/\^https\?:\\\/\\\/\//.test(about),'about.js labels url cards by their bare website host');
 // common.js changed this release, so its cache key moves to 1.166.0
 // on every page; the stylesheets did not move.
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const html=fs.readFileSync(path.join(__dirname,'../'+name+'.html'),'utf8');
  assert.ok(html.includes('js/common.js?v=1.195.0'),name+'.html pins common.js 1.192.0');
  assert.ok(!/common\.js\?v=(?!1\.195\.0")1\.[0-9]+\.0"/.test(html),name+'.html has no stale common.js key');
  assert.ok(html.includes('css/main.css?v=1.191.0'),name+'.html keeps main.css 1.191.0');
 }
 // Rendered: the About grid paints the five website cards.
 const p=await page('about');
 try{
  const cards=[...p.w.document.querySelectorAll('#proj-grid .proj-card')];
  assert.equal(cards.length,5,'five project cards render on about.html');
  assert.deepEqual(cards.map(c=>c.getAttribute('href')),entries.map(e=>e.url),'rendered cards link to the five websites in order');
  assert.ok(cards.every(c=>/↗/.test(c.textContent)),'every card carries its go-label');
 } finally { p.close(); }
 // Footer branding untouched by this release.
 const idx=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'),'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'),'the @kshot9000 attribution survives on index.html');
});

test('v1.167.0: the site is an installable app — manifest, icons, service worker, and a "Get the app" chip',async()=>{
 // Kyle (2026-10-02): "make a downloadable mobile app for this site we
 // could link on the website for mobile users." A static site's honest
 // app form is a PWA: installable to the home screen on Android and
 // iOS, launched standalone with the paw icon, pages network-first so
 // scores are never stale. The link on the website is the footer chip.
 const fsx=require('fs');
 // Manifest: valid JSON, installable shape, relative paths so it works
 // on coldfronthq.com and the github.io mirror alike.
 const man=JSON.parse(fsx.readFileSync(path.join(__dirname,'../manifest.webmanifest'),'utf8'));
 assert.equal(man.short_name,'Cold Front','the installed app is named Cold Front');
 assert.equal(man.display,'standalone','the app opens standalone, not in a browser tab');
 assert.equal(man.start_url,'./index.html','the app starts at the home page');
 assert.equal(man.theme_color,'#060d18','the app chrome matches the site navy');
 const iconSizes=man.icons.map(i=>i.sizes).sort();
 assert.deepEqual(iconSizes,['192x192','512x512','512x512'],'the manifest carries 192 + 512 + maskable icons');
 assert.ok(man.icons.some(i=>i.purpose==='maskable'),'a maskable icon is declared for Android adaptive icons');
 for(const icon of man.icons){
  const p=path.join(__dirname,'..',icon.src);
  assert.ok(fsx.existsSync(p),icon.src+' exists on disk');
  const buf=fsx.readFileSync(p);
  assert.equal(buf.readUInt32BE(16),parseInt(icon.sizes.split('x')[0],10),icon.src+' is really '+icon.sizes+' wide (PNG IHDR)');
 }
 const apple=fsx.readFileSync(path.join(__dirname,'../img/apple-touch-icon.png'));
 assert.equal(apple.readUInt32BE(16),180,'the apple touch icon is 180px');
 // Service worker: present, versioned cache, conservative strategies.
 const sw=fsx.readFileSync(path.join(__dirname,'../sw.js'),'utf8');
 assert.ok(sw.includes('cf-shell-1.167.0'),'the worker cache is versioned with the release');
 assert.ok(/req\.mode === "navigate"/.test(sw),'navigations are handled explicitly');
 assert.ok(/url\.origin !== self\.location\.origin\) return/.test(sw),'cross-origin live APIs bypass the worker untouched');
 assert.ok(/catch\(\(\) => caches\.match/.test(sw),'the cache is only the offline fallback for pages');
 assert.ok(!/polymarket|espn|open-meteo/i.test(sw),'no live API is named or intercepted by the worker');
 // Every page links the manifest + apple icon; both changed assets
 // ride the current release key (1.167.0 at this test's birth).
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const html=fsx.readFileSync(path.join(__dirname,'../'+name+'.html'),'utf8');
  assert.ok(html.includes('<link rel="manifest" href="manifest.webmanifest">'),name+'.html links the manifest');
  assert.ok(html.includes('<link rel="apple-touch-icon" href="img/apple-touch-icon.png">'),name+'.html links the apple touch icon');
  assert.ok(html.includes('js/common.js?v=1.195.0'),name+'.html pins common.js 1.192.0');
  assert.ok(html.includes('css/main.css?v=1.191.0'),name+'.html pins main.css 1.191.0');
 }
 // common.js: parse-time prompt capture, worker registration, chip.
 const common=fsx.readFileSync(path.join(__dirname,'..','js','common.js'),'utf8');
 assert.ok(/window\.addEventListener\("beforeinstallprompt"/.test(common),'the install prompt is captured at parse time');
 assert.ok(/navigator\.serviceWorker\.register\("sw\.js"\)/.test(common),'the service worker registers from common.js');
 assert.ok(/display-mode: standalone/.test(common),'the chip hides inside the installed app');
 assert.ok(/Share/.test(common)&&/Add to Home Screen/.test(common),'the iOS fallback teaches Share → Add to Home Screen');
 // The chip CSS ships with the 40px phone thumb-target rule.
 const css=fsx.readFileSync(path.join(__dirname,'../css/main.css'),'utf8');
 assert.ok(/\.app-chip\s*\{/.test(css),'the app chip is styled');
 assert.ok(/\.app-chip\[hidden\]\s*\{\s*display:\s*none/.test(css),'a hidden app chip never shows');
 assert.ok(/@media \(max-width: 800px\) \{\s*\/\* The site's 40px thumb-target rule applies to the new chip too\. \*\/\s*\.app-chip \{ min-height: 40px; \}/.test(css),'the app chip is a 40px thumb target on phones');
 // Rendered: the chip is injected at the top of the page, in the
 // sticky header (moved there from the footer in v1.168.0), labelled,
 // and hidden until the device can install (jsdom has no install
 // prompt and is not iOS, so hidden is the correct state).
 const p=await page('index');
 try{
  const chip=p.w.document.querySelector('[data-cf-install]');
  assert.ok(chip,'the Get-the-app chip is injected into the page');
  assert.equal(chip.hidden,true,'the chip stays hidden until the device offers an install');
  assert.equal(chip.getAttribute('aria-label'),'Install The Cold Front app on this device','the chip is labelled for screen readers');
  assert.ok(chip.closest('.site-head'),'the chip lives in the site header, not the footer');
  assert.ok(!p.w.document.querySelector('footer [data-cf-install]'),'no install chip remains in the footer');
 } finally { p.close(); }
 // Footer branding untouched by this release.
 const idx=fsx.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'),'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'),'the @kshot9000 attribution survives on index.html');
});

test('v1.168.0: the "Get the app" chip moves to the top of the page — the sticky header',async()=>{
 // Kyle (2026-10-02): "move the get the app to the top of the pages."
 // The v1.167.0 footer chip sat one full scroll away from the mobile
 // fans it was for. The chip now mounts in the sticky header: last in
 // the desktop row, its own full-width row inside the header at the
 // mobile nav breakpoint, and common.js re-measures the header height
 // when it appears so the mobile nav panel still aligns.
 const common=fs.readFileSync(path.join(__dirname,'..','js','common.js'),'utf8');
 assert.ok(/CF\.\$\("\.site-head \.wrap"\)/.test(common),'the chip mounts into the sticky header row');
 assert.ok(/headWrap\.appendChild\(btn\)/.test(common),'the chip is the header row’s last item');
 assert.ok(!/tipChip\.parentNode\.insertBefore\(btn/.test(common),'the footer mount is gone');
 assert.ok(/dispatchEvent\(new Event\("resize"\)\)/.test(common),'showing the chip re-measures the header height for the nav panel');
 // CSS: desktop keeps the pill in the row; ≤960 the header wraps and
 // the chip becomes a centered full-width app bar row.
 const css=fs.readFileSync(path.join(__dirname,'../css/main.css'),'utf8');
 assert.ok(/\.site-head \.app-chip \{ flex: none; \}/.test(css),'the header chip never shrinks in the desktop row');
 const mobile=css.match(/@media \(max-width: 960px\) \{\s*\.site-head \.wrap \{ flex-wrap: wrap; \}[\s\S]*?\.site-head \.app-chip \{\s*order: 99;\s*flex: 1 1 100%;\s*justify-content: center;\s*\}/);
 assert.ok(mobile,'at the nav breakpoint the chip takes its own full-width header row');
 assert.ok(/\.site-head \.wrap:has\(\.app-chip:not\(\[hidden\]\)\) \{ row-gap: 8px; \}/.test(css),'the wrapped header tightens only while a visible chip is in it');
 assert.ok(/\.site-head:has\(\.app-chip:not\(\[hidden\]\)\) \.nav a \{ padding-left: 8px; padding-right: 8px; \}/.test(css),'wide desktops make room: nav padding tightens while the chip shows');
 assert.ok(/\.site-head:has\(\.app-chip:not\(\[hidden\]\)\) \.brand \.name \{ font-size: 16px/.test(css),'the wordmark steps down a size instead of wrapping into a stack');
 assert.ok(/@media \(min-width: 961px\) and \(max-width: 1250px\) \{\s*\.site-head \.wrap:has\(\.app-chip:not\(\[hidden\]\)\) \{ flex-wrap: wrap; \}/.test(css),'mid-width desktops give the chip its own row instead of crushing the wordmark');
 // Rendered on a phone-width page and a desktop page alike: exactly
 // one chip, inside the header, none left in the footer.
 for(const name of ['index','about']){
  const p=await page(name);
  try{
   const chips=p.w.document.querySelectorAll('[data-cf-install]');
   assert.equal(chips.length,1,name+'.html renders exactly one app chip');
   assert.ok(chips[0].closest('.site-head'),name+'.html chip is inside the header');
   assert.ok(!p.w.document.querySelector('footer [data-cf-install]'),name+'.html footer is chip-free');
   assert.ok(p.w.document.querySelector('[data-cf-copy="btc"]'),name+'.html tip chip survives in the footer');
  } finally { p.close(); }
 }
 // common.js + main.css changed, so both keys move to 1.168.0 on
 // every page; the worker and manifest did not change.
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const html=fs.readFileSync(path.join(__dirname,'../'+name+'.html'),'utf8');
  assert.ok(html.includes('js/common.js?v=1.195.0'),name+'.html pins common.js 1.192.0');
  assert.ok(html.includes('css/main.css?v=1.191.0'),name+'.html pins main.css 1.191.0');
  assert.ok(!/common\.js\?v=(?!1\.195\.0")1\.[0-9]+\.0"/.test(html),name+'.html has no stale common.js key');
  assert.ok(!/main\.css\?v=(?!1\.191\.0")1\.[0-9]+\.0"/.test(html),name+'.html has no stale main.css key');
 }
 // Footer branding untouched by this release.
 const idx=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'),'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'),'the @kshot9000 attribution survives on index.html');
});

test('v1.170.0: the fixed background stack carries no scroll-repaint traps — no live filter, no blend modes, no fixed attachment on phones',async()=>{
 // Kyle (2026-10-02, on his phone): "sometimes the background image
 // bugs out while moving up and down the site." The background is the
 // fixed .cf-atmosphere stack (winter-lakefront photo under aurora,
 // bands, noise, skyline, vignette). Three of its ingredients forced
 // the phone GPU to repaint/re-blend the full viewport on every
 // scroll frame: a live blur() filter on the oversized aurora layer
 // (44px desktop, 28px small screens, 40px gameday), mix-blend-mode
 // on the bands and noise, and a will-change holding the bands'
 // paint layer open. Assertions run on comment-stripped CSS so the
 // release notes' prose can't false-trip them.
 const raw=fs.readFileSync(path.join(__dirname,'../css/main.css'),'utf8');
 const css=raw.replace(/\/\*[\s\S]*?\*\//g,'');
 const layer=(name)=>{
  const m=css.match(new RegExp('\\.cf-atmosphere \\.cf-'+name+' \\{[\\s\\S]*?\\}'));
  assert.ok(m,'the '+name+' layer still exists');
  return m[0];
 };
 for(const name of ['aurora','bands','noise']){
  const body=layer(name);
  assert.ok(!/filter:/.test(body),'the '+name+' layer carries no live filter');
  assert.ok(!/mix-blend-mode/.test(body),'the '+name+' layer carries no blend mode');
  assert.ok(!/will-change/.test(body),'the '+name+' layer holds no will-change layer open');
 }
 assert.ok(!/body\.cf-gameday \.cf-atmosphere \.cf-aurora \{[^}]*filter:/.test(css),'the gameday aurora is filter-free too');
 assert.ok(!/\.cf-atmosphere \.cf-aurora \{[^}]*blur/.test(css),'no blur hides in the aurora at any breakpoint');
 // The look survives the diet: aurora still drifts (transform-only),
 // the bands still paint, and the photo itself still ships.
 assert.ok(/\.cf-atmosphere \.cf-aurora \{[\s\S]*?animation: auroraDrift/.test(css),'the aurora still drifts on the compositor');
 assert.ok(/\.cf-atmosphere \.cf-bands \{[\s\S]*?repeating-linear-gradient/.test(css),'the bands still paint their diagonal lines');
 const exp=fs.readFileSync(path.join(__dirname,'../css/experience.css'),'utf8');
 assert.ok(exp.includes('chicago-winter-lakefront.webp'),'the winter-lakefront background photo still paints under everything');
 // Phone reinforcements: the body gradient scrolls instead of fixing
 // at every phone/tablet width, and the bands' per-frame repaint
 // crawl rests on phones.
 assert.ok(/@media \(max-width: 960px\) \{\s*body \{ background-attachment: scroll; \}\s*\.cf-atmosphere \.cf-bands \{ animation: none; \}/.test(css),'phones get scroll attachment and a resting band layer');
 // main.css changed, so its key moves to 1.170.0 on every page;
 // common.js and experience.css did not move.
 const pages=['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for(const name of pages){
  const html=fs.readFileSync(path.join(__dirname,'../'+name+'.html'),'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'),name+'.html pins main.css 1.191.0');
  assert.ok(!/main\.css\?v=(?!1\.191\.0")1\.[0-9]+\.0"/.test(html),name+'.html has no stale main.css key');
 }
 // Footer branding untouched by this release.
 const idx=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'),'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'),'the @kshot9000 attribution survives on index.html');
});

test('v1.171.0: body copy wraps pretty and no sentence strands its final period', async () => {
 // The prose half of v1.165.0: paragraphs compose with
 // text-wrap: pretty so the last line stops stranding a
 // lone word (rendered 390px before this release: the
 // footer note ended 0.11, the Games source note 0.25,
 // the Stats intro 0.18).
 const css = fs.readFileSync(path.join(__dirname, '../css/main.css'), 'utf8');
 assert.match(css, /(?:^|\n)p \{ text-wrap: pretty; \}/, 'paragraphs compose with text-wrap: pretty');
 // Pretty stays scoped to prose: no universal rule, and
 // the heading family keeps v1.165.0's balance — the
 // .band-line <p> still balances because its class rule
 // outranks this element rule.
 assert.ok(!/\*\s*\{[^}]*text-wrap/.test(css), 'no universal text-wrap rule leaks into every element');
 assert.match(css, /h1, h2, h3, h4, \.display, \.band-line, \.news-item \.headline \{ text-wrap: balance; \}/, 'headings keep their v1.165.0 balance');
 // The stranded periods: a closing "." that sits outside
 // its bold run or link can wrap onto a line of its own
 // (Practice measured a ~4px last line). All four
 // sentence-final periods now live inside their runs.
 const practice = fs.readFileSync(path.join(__dirname, '../practice.html'), 'utf8');
 assert.ok(practice.includes('<b>1920 Football Drive, Lake Forest, Illinois.</b>'), 'the Halas Hall period rides inside the bold address');
 assert.ok(practice.includes('<b>1410 Special Olympics Drive, Chicago.</b>'), 'the Soldier Field period rides inside the bold address');
 assert.ok(!/Illinois<\/b>\./.test(practice) && !/Chicago<\/b>\./.test(practice), 'no facility period sits outside its bold run');
 const about = fs.readFileSync(path.join(__dirname, '../about.html'), 'utf8');
 assert.ok(about.includes('>img/ATTRIBUTION.txt.</a>'), 'the photo-credit period rides inside its link');
 assert.ok(about.includes('>@kshot9000.</a>'), 'the contact period rides inside the X link');
 // Rendered sanity: the pages carrying the measured copy
 // still render their paragraphs (the rule changes wraps,
 // never content).
 for (const name of ['index', 'practice', 'about']) {
  const p = await page(name);
  try {
   assert.ok(p.w.document.querySelectorAll('p').length > 3, name + '.html still renders its paragraphs');
   assert.ok(p.w.document.querySelector('.foot-note'), name + '.html still renders the footer note');
  } finally { p.close(); }
 }
 // Cache keys moved with the release: main.css changed,
 // so its key moves to 1.171.0 on every page; the other
 // stylesheets and scripts stay where they were.
 const pages = ['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for (const name of pages) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html pins main.css 1.191.0');
  assert.ok(!/main\.css\?v=(?!1\.191\.0")1\.[0-9]+\.0"/.test(html), name + '.html has no stale main.css key');
  assert.ok(html.includes('css/experience.css?v=1.195.0'), name + '.html keeps experience.css 1.187.0');
 }
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('js/common.js?v=1.195.0'), 'index.html keeps common.js 1.192.0');
 // Footer branding untouched by this release.
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.172.0: the header actually sticks — and every jump target lands clear of it', async () => {
 // Since v1.0.0 the layering rule at the top of main.css listed
 // header.site-head beside main/footer: as an element+class
 // selector it out-specifies .site-head's own rule, so its
 // position: relative silently overrode position: sticky (and
 // z-index: 50) — the header scrolled away with the page while
 // the compaction, the --cf-head-h offsets and thirteen
 // scroll-margins all assumed it sticks.
 const css = fs.readFileSync(path.join(__dirname, '../css/main.css'), 'utf8');
 assert.ok(!/main, header\.site-head,/.test(css), 'the layering rule no longer names header.site-head');
 assert.match(css, /main, footer\.site-foot, \.weather-strip \{ position: relative; z-index: 2; \}/, 'main, footer and the weather strip keep their layer');
 assert.match(css, /\.site-head \{\s*position: sticky;/, 'the header rule still declares sticky');
 // The scroll-margin set is complete: every in-page jump target
 // takes the sticky-header offset, in the v1.5.0 form.
 assert.match(css, /#latest,\s*#log-table,\s*#boxscore,\s*#hl-feature,\s*#data-sources,\s*#main \{\s*scroll-margin-top: calc\(var\(--cf-head-h, 72px\) \+ 12px\);/, 'the six remaining targets carry the header offset');
 // Rendered: the targets exist on their pages (the jsdom
 // harness does not load linked stylesheets, so the cascade
 // itself is asserted from source above and proven in a real
 // browser — before this release Chromium computed the header
 // position: relative, after it: sticky).
 const p = await page('index');
 try {
  assert.ok(p.w.document.querySelector('.site-head'), 'index.html renders the site header');
  assert.ok(p.w.document.querySelector('#latest'), 'index.html renders #latest');
  assert.deepEqual(p.errors, []);
 } finally { p.close(); }
 for (const [name, id] of [['games', '#boxscore'], ['games', '#log-table'], ['highlights', '#hl-feature'], ['about', '#data-sources']]) {
  const q = await page(name);
  try {
   assert.ok(q.w.document.querySelector(id), name + '.html renders ' + id);
  } finally { q.close(); }
 }
 // Cache keys moved with the release: main.css changed, so its
 // key moves to 1.172.0 on every page; the other stylesheets
 // and scripts stay where they were.
 const pages = ['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for (const name of pages) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html pins main.css 1.191.0');
  assert.ok(!/main\.css\?v=(?!1\.191\.0")1\.[0-9]+\.0"/.test(html), name + '.html has no stale main.css key');
  assert.ok(html.includes('css/experience.css?v=1.195.0'), name + '.html keeps experience.css 1.187.0');
 }
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('js/common.js?v=1.195.0'), 'index.html keeps common.js 1.192.0');
 // Footer branding untouched by this release.
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.173.0: the share card resolves straight off coldfronthq.com — no redirect hop, no old address baked in', async () => {
 // Every page pointed og:image / twitter:image at the github.io
 // project URL, which answers with a 301 to coldfronthq.com —
 // X's card crawler can fail on a redirected og:image, so shares
 // rendered badly or with no card at all. The card art itself
 // still carried kshot3000.github.io/ColdFront baked into its
 // corner. Both now resolve directly on the custom domain and
 // the refreshed 1200x630 card reads coldfronthq.com.
 const pages = ['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for (const name of pages) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('<meta property="og:image" content="https://coldfronthq.com/img/og-image.png">'), name + '.html og:image is the direct coldfronthq.com URL');
  assert.ok(html.includes('<meta name="twitter:image" content="https://coldfronthq.com/img/og-image.png">'), name + '.html twitter:image is the direct coldfronthq.com URL');
  assert.ok(!html.includes('kshot3000.github.io/ColdFront/img/og-image.png'), name + '.html no longer points the share card at github.io');
  const url = html.match(/<meta property="og:url" content="([^"]+)"/);
  assert.ok(url && url[1].startsWith('https://coldfronthq.com/'), name + '.html og:url lives on coldfronthq.com');
  assert.ok(html.includes('<meta property="og:image:width" content="1200">'), name + '.html keeps og:image:width 1200');
  assert.ok(html.includes('<meta property="og:image:height" content="630">'), name + '.html keeps og:image:height 630');
  assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image">'), name + '.html keeps the large-image card');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html pins main.css 1.191.0');
 }
 // The card on disk really is a 1200x630 PNG (IHDR width/height).
 const png = fs.readFileSync(path.join(__dirname, '../img/og-image.png'));
 assert.equal(png.toString('ascii', 1, 4), 'PNG', 'og-image.png is a PNG');
 assert.equal(png.readUInt32BE(16), 1200, 'og-image.png is 1200 wide');
 assert.equal(png.readUInt32BE(20), 630, 'og-image.png is 630 tall');
 // Footer branding untouched by this release.
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.174.0: the glyph-only profile links are real targets at every width', async () => {
 // Exactly two links on the site are a bare "↗" glyph: the injury
 // report's .profile-link and the roster table's player link. A
 // rendered sweep measured both at 11.3x18px — the injury one only
 // on desktop (the v1.157.0 phone block already gives it 40px at
 // <=760px), the roster one at every width, because team.js never
 // stamped the class at all. 11px wide is under the WCAG 2.5.8 AA
 // floor of 24x24 even for a mouse, and the glyph is the only
 // route to a player's profile from either table.
 const raw = fs.readFileSync(path.join(__dirname, '../css/experience.css'), 'utf8');
 const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');
 const base = css.match(/\.profile-link \{([\s\S]*?)\}/);
 assert.ok(base, 'a base .profile-link rule exists outside any media query');
 assert.ok(/display: inline-flex/.test(base[1]), 'the base rule composes the glyph as a flex target');
 assert.ok(/min-width: 24px/.test(base[1]), 'the base target is at least 24px wide');
 assert.ok(/min-height: 24px/.test(base[1]), 'the base target is at least 24px tall');
 assert.ok(/\.profile-link:hover \{[^}]*background: rgba\(255, 90, 31, 0\.14\)/.test(css), 'hover warms the target with the chip-family orange wash');
 // The phone block still raises the same class to the site's 40px
 // minimum, and it comes after the base rule so it wins at <=760px.
 const phoneRule = '.profile-link { display: inline-flex; align-items: center; justify-content: center; min-width: 40px; min-height: 40px; vertical-align: middle; }';
 assert.ok(css.includes(phoneRule), 'the <=760px block still raises .profile-link to 40px');
 assert.ok(css.indexOf('.profile-link {') < css.indexOf(phoneRule), 'the base rule precedes the phone rule');
 assert.ok(css.indexOf('@media (max-width: 760px)', css.indexOf('.profile-link {')) < css.indexOf(phoneRule), 'the 40px rule lives inside the <=760px block');
 // Both tables stamp the one class, and both keep their labels.
 const inj = fs.readFileSync(path.join(__dirname, '../js/injuries.js'), 'utf8');
 assert.ok(inj.includes('<a class="profile-link"'), 'injuries.js stamps the profile-link class');
 assert.ok(inj.includes('aria-label="Player profile: '), 'injuries.js keeps its per-player aria-label');
 const team = fs.readFileSync(path.join(__dirname, '../js/team.js'), 'utf8');
 assert.ok(team.includes('<a class="profile-link" href='), 'team.js table rows now stamp the profile-link class');
 assert.ok(team.includes("aria-label=\"' + CF.esc(p.name + ' profile') + '\""), 'team.js keeps its per-player aria-label');
 // Rendered: the roster table's glyph link carries the class.
 const t = await page('team');
 try {
  const links = [...t.w.document.querySelectorAll('#roster-table tbody a.profile-link')];
  assert.ok(links.length >= 1, 'the rendered roster table has profile-link glyphs');
  assert.equal(links[0].getAttribute('aria-label'), 'Test Bears QB profile', 'the rendered glyph names its player');
 } finally { t.close(); }
 // experience.css and team.js changed, so their keys move to
 // 1.174.0; main.css stays at 1.173.0.
 const pages = ['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for (const name of pages) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('css/experience.css?v=1.195.0'), name + '.html pins experience.css 1.187.0');
  assert.ok(!html.includes('css/experience.css?v=1.160.0'), name + '.html has no stale experience.css key');
 }
 const teamHtml = fs.readFileSync(path.join(__dirname, '../team.html'), 'utf8');
 assert.ok(teamHtml.includes('js/team.js?v=1.174.0'), 'team.html pins team.js 1.174.0');
 // Footer branding untouched by this release.
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.176.0: the site prints like a gameday handout — dark ink on white, tables whole', async () => {
 // There was no print stylesheet anywhere (@media print = 0), and a
 // print-emulated probe measured the failure: body text computed
 // rgb(208,220,232) and headings rgb(247,250,252) — near-white ink
 // on white paper once the navy background is dropped — while
 // .tbl-wrap kept overflow:auto around a 560px min-width table, so
 // printed rosters and season logs clipped their right columns.
 const raw = fs.readFileSync(path.join(__dirname, '../css/main.css'), 'utf8');
 const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');
 const printStart = css.indexOf('@media print {');
 assert.ok(printStart > -1, 'a @media print block exists in main.css');
 const print = css.slice(printStart);
 assert.ok(css.includes('@page { margin: 13mm 12mm; }'), 'the page box carries handout margins');
 assert.ok(/color-scheme: light/.test(print), 'print flips the color scheme to light');
 assert.ok(/\*, \*::before, \*::after \{[^}]*color: #1c2a38 !important/.test(print), 'print forces dark slate ink over every screen color');
 assert.ok(/\*, \*::before, \*::after \{[^}]*background: transparent !important/.test(print), 'print drops the navy backgrounds and glows');
 assert.ok(/h1, h2, h3, h4, \.display, \.band-line \{ color: #081827 !important; \}/.test(print), 'headings print near-black, not snow');
 assert.ok(/a \{ color: #8a2b00 !important;/.test(print), 'links keep the Bears orange in a paper-legible burn');
 assert.ok(/\.site-head,/.test(print) && /\.wire-ticker,/.test(print) && /\.ad-slot,/.test(print), 'header, marquee and ad slots stay off the sheet');
 assert.ok(/\.cf-atmosphere, #snow,/.test(print), 'atmosphere and snow stay off the sheet');
 assert.ok(/\.btn, button, form, input, select, textarea,/.test(print), 'interactive controls stay off the sheet');
 assert.ok(/\.reveal, \.cf-reveal \{ opacity: 1 !important; transform: none !important; \}/.test(print), 'scroll-reveal content prints visible even below the fold');
 assert.ok(/\.tbl-wrap \{ overflow: visible !important;/.test(print), 'the table scroller unwraps for print');
 assert.ok(/table\.tbl \{ min-width: 0 !important;/.test(print), 'the 560px screen min-width is lifted for print');
 assert.ok(/\.tbl thead \{ display: table-header-group; \}/.test(print), 'table headers repeat on every printed page');
 assert.ok(/\.tbl tr \{ break-inside: avoid; \}/.test(print), 'table rows never split across a break');
 // The print rules must not leak onto screen: exactly one @media
 // print block, and the screen theme variables are untouched.
 assert.equal((css.match(/@media print \{/g) || []).length, 1, 'exactly one @media print block');
 assert.ok(css.includes('--text: #d0dce8;'), 'the screen text color is untouched');
 assert.ok(css.includes('--snow: #f7fafc;'), 'the screen heading color is untouched');
 // Rendered: the elements the print block manages exist to manage.
 const t = await page('team');
 try {
  assert.ok(t.w.document.querySelector('header.site-head'), 'team.html renders the header print hides');
  assert.ok(t.w.document.querySelector('.tbl-wrap table.tbl'), 'team.html renders the roster table print unwraps');
  assert.ok(t.w.document.querySelector('footer.site-foot .foot-note'), 'team.html keeps the footer disclaimer print preserves');
 } finally { t.close(); }
 // main.css changed, so its key moves to 1.176.0 on every page;
 // the other stylesheets stay where they were.
 const pages = ['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for (const name of pages) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html pins main.css 1.191.0');
  assert.ok(!/main\.css\?v=(?!1\.191\.0")1\.[0-9]+\.0"/.test(html), name + '.html has no stale main.css key');
  assert.ok(html.includes('css/experience.css?v=1.195.0'), name + '.html keeps experience.css 1.187.0');
 }
 // Footer branding untouched by this release.
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.177.0: the injury wire refresh button says what it does — and admits when it is working', async () => {
 // A rendered audit of every button, link, input and select on all
 // ten pages found exactly one control whose entire name — visible
 // and accessible — was a single glyph: the injury wire's refresh,
 // a bare "↻" at 37×44px with no aria-label and no title. Every
 // sibling refresh spells itself out ("↻ Refresh" on Odds,
 // "↻ Refresh now" on News and Highlights), and the Odds button
 // has carried the v1.95.0 busy treatment for ages; this one never
 // got either. A screen-reader fan heard a lone symbol, and a
 // sighted fan got no word for what the button refreshes.
 const injHtml = fs.readFileSync(path.join(__dirname, '../injuries.html'), 'utf8');
 assert.ok(injHtml.includes('id="wire-refresh" type="button" aria-label="Refresh the injury wire">↻ Refresh</button>'), 'the wire refresh carries its word and names the wire it refreshes');
 assert.ok(!injHtml.includes('id="wire-refresh" type="button">↻</button>'), 'the bare-glyph button is gone');
 // The busy treatment mirrors odds.js: one funnel for the first
 // load, manual clicks and the 5-minute auto-beat, so overlapping
 // refreshes stand down and the button always wakes.
 const inj = fs.readFileSync(path.join(__dirname, '../js/injuries.js'), 'utf8');
 assert.ok(inj.includes('function setWireBusy(busy)'), 'injuries.js carries the busy-state switch');
 assert.ok(inj.includes('async function refreshWire()'), 'injuries.js funnels refreshes through refreshWire');
 assert.ok(inj.includes('if (wireBusy) return;'), 'an overlapping refresh stands down');
 assert.ok(inj.includes('btn.setAttribute("aria-busy"'), 'the busy state is announced to assistive tech');
 assert.ok(inj.includes('CF.refresh.register(refreshWire, 5 * 60e3)'), 'the 5-minute auto-beat funnels through the same guard');
 assert.ok(!inj.includes('CF.refresh.register(loadWire,'), 'the auto-beat no longer calls loadWire directly');
 // The glyph spins on the shared keyframes, static under reduced motion.
 const rawCss = fs.readFileSync(path.join(__dirname, '../css/main.css'), 'utf8');
 const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, '');
 assert.ok(/#wire-refresh \.cf-spin \{[^}]*animation: cfBusySpin/.test(css), 'the wire refresh glyph spins while busy');
 assert.ok(/prefers-reduced-motion: reduce\) \{\s*#wire-refresh \.cf-spin \{ animation: none; \}/.test(css), 'reduced motion gets the static label');
 // Behavioral: hold the league injuries feed for 400ms so the
 // refresh is observably in flight (page() settles 50ms after
 // DOMContentLoaded, and the first load already funnels through
 // refreshWire).
 const wait = 400;
 const p = await page('injuries', { fetch: async u => {
  if (u.pathname.endsWith('/injuries')) {
   await settle(wait);
   const body = JSON.stringify({ injuries: [{ displayName: 'Chicago Bears', injuries: [{ athlete: { displayName: 'Test Bears LB', position: { abbreviation: 'LB' } }, status: 'Questionable', date: '2026-09-25', shortComment: 'Limited practice' }] }] });
   return { ok: true, json: async () => JSON.parse(body), text: async () => body };
  }
 } });
 try {
  const btn = p.w.document.querySelector('#wire-refresh');
  assert.equal(btn.getAttribute('aria-label'), 'Refresh the injury wire', 'the rendered button names the wire it refreshes');
  assert.equal(btn.disabled, true, 'the button disables while the wire is in flight');
  assert.equal(btn.getAttribute('aria-busy'), 'true', 'aria-busy is set in flight');
  assert.ok(/Checking/.test(btn.textContent), 'the button reads Checking… in flight: ' + btn.textContent);
  assert.ok(btn.querySelector('.cf-spin'), 'the spinning glyph rides inside the busy label');
  await settle(wait + 400);
  assert.equal(btn.disabled, false, 'the button wakes when the wire settles');
  assert.equal(btn.getAttribute('aria-busy'), 'false', 'aria-busy clears after the refresh');
  assert.equal(btn.textContent.trim(), '↻ Refresh', 'the label restores after the refresh: ' + btn.textContent);
  // A manual click re-enters the busy state and releases again.
  btn.click();
  await settle(50);
  assert.equal(btn.disabled, true, 'a manual refresh disables the button while in flight');
  await settle(wait + 400);
  assert.equal(btn.disabled, false, 'the manual refresh releases the button');
 } finally { p.close(); }
 // main.css and injuries.js changed, so their keys move to 1.177.0;
 // experience.css stays at 1.174.0.
 const pages = ['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for (const name of pages) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html pins main.css 1.191.0');
  assert.ok(!/main\.css\?v=(?!1\.191\.0")1\.[0-9]+\.0"/.test(html), name + '.html has no stale main.css key');
  assert.ok(html.includes('css/experience.css?v=1.195.0'), name + '.html keeps experience.css 1.187.0');
 }
 assert.ok(injHtml.includes('js/injuries.js?v=1.177.0'), 'injuries.html pins injuries.js 1.177.0');
 // Footer branding untouched by this release.
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.178.0: the last two refresh buttons admit when they are working — News and Highlights join the busy family', async () => {
 // v1.95.0 gave Odds a busy refresh and v1.177.0 gave the injury
 // wire one, but News and Highlights still fired their feeds with
 // no sign of life on the button itself: a click on News started
 // both wires while the button sat unchanged and clickable, so a
 // slow feed read as a dead button and a second click doubled the
 // work; Highlights was the same. Both now funnel through a busy
 // guard in the family form — disable, spinning "Checking…",
 // aria-busy announced, overlaps stand down, label restores.
 const news = fs.readFileSync(path.join(__dirname, '../js/news.js'), 'utf8');
 assert.ok(news.includes('function setWireBusy(busy)'), 'news.js carries the busy-state switch');
 assert.ok(news.includes('function refreshWire(manual)'), 'news.js funnels refreshes through refreshWire');
 assert.ok(news.includes('Promise.allSettled([load(), loadGoogle()])'), 'both wires settle before the button wakes');
 assert.ok(news.includes('if (wireBusy) return;'), 'an overlapping news refresh stands down');
 assert.ok(news.includes('btn.setAttribute("aria-busy"'), 'the news busy state is announced to assistive tech');
 assert.ok(news.includes('CF.refresh.register(() => refreshWire(false), 5 * 60e3'), 'the 5-minute auto-beat funnels through the same guard');
 assert.ok(!news.includes('CF.refresh.register(load,'), 'the auto-beat no longer calls load directly');
 assert.ok(!news.includes('CF.refresh.register(loadGoogle,'), 'the wide wire no longer runs its own unguarded beat');
 const hl = fs.readFileSync(path.join(__dirname, '../js/highlights.js'), 'utf8');
 assert.ok(hl.includes('function setHlBusy(busy)'), 'highlights.js carries the busy-state switch');
 assert.ok(hl.includes('async function refreshHl()'), 'highlights.js funnels refreshes through refreshHl');
 assert.ok(hl.includes('if (hlBusy) return;'), 'an overlapping highlights refresh stands down');
 assert.ok(hl.includes('btn.setAttribute("aria-busy"'), 'the highlights busy state is announced to assistive tech');
 assert.ok(hl.includes('btn.addEventListener("click", refreshHl)'), 'the highlights button clicks through the guard');
 assert.ok(!hl.includes('addEventListener("click", load)'), 'the highlights button no longer fires load raw');
 // Both buttons keep their spelled-out labels in the markup.
 const newsHtml = fs.readFileSync(path.join(__dirname, '../news.html'), 'utf8');
 assert.ok(newsHtml.includes('id="refresh" type="button">↻ Refresh now</button>'), 'the news refresh keeps its label');
 const hlHtml = fs.readFileSync(path.join(__dirname, '../highlights.html'), 'utf8');
 assert.ok(hlHtml.includes('id="hl-refresh" type="button">↻ Refresh now</button>'), 'the highlights refresh keeps its label');
 // The glyphs spin on the shared keyframes, static under reduced motion;
 // the v1.95.0 odds and v1.177.0 wire rules are untouched.
 const rawCss = fs.readFileSync(path.join(__dirname, '../css/main.css'), 'utf8');
 const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, '');
 assert.ok(/#refresh \.cf-spin, #hl-refresh \.cf-spin \{[^}]*animation: cfBusySpin/.test(css), 'both refresh glyphs spin while busy');
 assert.ok(/prefers-reduced-motion: reduce\) \{\s*#refresh \.cf-spin, #hl-refresh \.cf-spin \{ animation: none; \}/.test(css), 'reduced motion gets the static label');
 assert.ok(/#odds-refresh \.cf-spin \{/.test(css) && /#wire-refresh \.cf-spin \{/.test(css), 'the odds and injury-wire spin rules survive');
 // Behavioral (news): hold the league news feed for 400ms so the
 // refresh is observably in flight (page() settles 50ms after
 // DOMContentLoaded, and the first load already funnels through
 // refreshWire).
 const wait = 400;
 const p = await page('news', { fetch: async u => {
  if (u.pathname.endsWith('/news')) {
   await settle(wait);
   const body = JSON.stringify({ articles: [{ headline: 'Bears prepare for Monday night', published: '2026-09-25T22:00:00Z', links: { web: { href: 'https://www.espn.com/' } }, images: [] }] });
   return { ok: true, json: async () => JSON.parse(body), text: async () => body };
  }
 } });
 try {
  const btn = p.w.document.querySelector('#refresh');
  assert.equal(btn.disabled, true, 'the news button disables while the wires are in flight');
  assert.equal(btn.getAttribute('aria-busy'), 'true', 'aria-busy is set in flight');
  assert.ok(/Checking/.test(btn.textContent), 'the news button reads Checking… in flight: ' + btn.textContent);
  assert.ok(btn.querySelector('.cf-spin'), 'the spinning glyph rides inside the busy label');
  await settle(wait + 400);
  assert.equal(btn.disabled, false, 'the news button wakes when both wires settle');
  assert.equal(btn.getAttribute('aria-busy'), 'false', 'aria-busy clears after the refresh');
  assert.equal(btn.textContent.trim(), '↻ Refresh now', 'the news label restores after the refresh: ' + btn.textContent);
  btn.click();
  await settle(50);
  assert.equal(btn.disabled, true, 'a manual news refresh disables the button while in flight');
  await settle(wait + 400);
  assert.equal(btn.disabled, false, 'the manual news refresh releases the button');
 } finally { p.close(); }
 // Behavioral (highlights): hold the game-reel shelf snapshot so
 // the first load is observably in flight.
 const q = await page('highlights', { fetch: async u => {
  if (u.pathname.endsWith('data/snapshots/highlights.json')) {
   await settle(wait);
   const body = JSON.stringify({ fetched: '2026-09-29T00:00:00Z', items: [] });
   return { ok: true, json: async () => JSON.parse(body), text: async () => body };
  }
 } });
 try {
  const btn = q.w.document.querySelector('#hl-refresh');
  assert.equal(btn.disabled, true, 'the highlights button disables while the feeds are in flight');
  assert.equal(btn.getAttribute('aria-busy'), 'true', 'aria-busy is set in flight');
  assert.ok(/Checking/.test(btn.textContent), 'the highlights button reads Checking… in flight: ' + btn.textContent);
  assert.ok(btn.querySelector('.cf-spin'), 'the spinning glyph rides inside the busy label');
  await settle(wait + 600);
  assert.equal(btn.disabled, false, 'the highlights button wakes when the feeds settle');
  assert.equal(btn.getAttribute('aria-busy'), 'false', 'aria-busy clears after the refresh');
  assert.equal(btn.textContent.trim(), '↻ Refresh now', 'the highlights label restores after the refresh: ' + btn.textContent);
 } finally { q.close(); }
 // main.css, news.js and highlights.js changed, so their keys move
 // to 1.178.0; injuries.js stays at 1.177.0.
 const pages = ['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for (const name of pages) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html pins main.css 1.191.0');
  assert.ok(!/main\.css\?v=(?!1\.191\.0")1\.[0-9]+\.0"/.test(html), name + '.html has no stale main.css key');
 }
 assert.ok(newsHtml.includes('js/news.js?v=1.178.0'), 'news.html pins news.js 1.178.0');
 assert.ok(hlHtml.includes('js/highlights.js?v=1.181.0'), 'highlights.html pins highlights.js 1.181.0');
 const injHtml = fs.readFileSync(path.join(__dirname, '../injuries.html'), 'utf8');
 assert.ok(injHtml.includes('js/injuries.js?v=1.177.0'), 'injuries.html keeps injuries.js 1.177.0');
 // Footer branding untouched by this release.
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.179.0: wide tables become keyboard-scrollable regions — named by their caption, only while they overflow', async () => {
 // A rendered 390px sweep measured the failure: table.tbl's 560px
 // min-width inside .tbl-wrap's overflow-x:auto leaves the games
 // season log (602px of table in a 343px wrap), the injury report
 // and the practice tracker scrolling sideways on phones, and none
 // of the wraps was focusable — the practice tracker contains
 // nothing focusable at all, so a keyboard fan had no way to reach
 // its right-hand columns. An overflowing wrap now becomes a named
 // region (tabindex 0, role "region", aria-label from the table's
 // own caption); a wrap that fits stays out of the tab order.
 const common = fs.readFileSync(path.join(__dirname, '../js/common.js'), 'utf8');
 assert.ok(common.includes('CF.initScrollableTables'), 'common.js carries the scrollable-table enhancer');
 assert.ok(common.includes('CF.initScrollableTables();'), 'initChrome runs the enhancer on every page');
 assert.ok(common.includes('el.scrollWidth > el.clientWidth + 1'), 'the region state is gated on real overflow');
 assert.ok(common.includes('cap.textContent.trim()'), 'the region name comes from the table caption');
 assert.ok(common.includes('new MutationObserver(queue)'), 'wraps built after first paint join the treatment');
 const css = fs.readFileSync(path.join(__dirname, '../css/main.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
 assert.ok(/\.tbl-wrap:focus-visible \{[^}]*outline: 2px solid var\(--orange-hot\)[^}]*border-radius: var\(--radius\)/.test(css), 'a focused table region shows the family ring at the wrap radius');
 // Behavioral: jsdom reports zero layout, so stub the geometry the
 // enhancer reads, then drive CF.syncScrollableTables directly.
 const p = await page('practice');
 try {
  const wrap = p.w.document.querySelector('.tbl-wrap');
  assert.ok(wrap, 'the practice tracker rides in a .tbl-wrap');
  assert.equal(wrap.getAttribute('tabindex'), null, 'no tabindex before any overflow is measured');
  Object.defineProperty(wrap, 'clientWidth', { value: 343, configurable: true });
  Object.defineProperty(wrap, 'scrollWidth', { value: 560, configurable: true });
  p.w.CF.syncScrollableTables();
  assert.equal(wrap.getAttribute('tabindex'), '0', 'an overflowing wrap becomes focusable');
  assert.equal(wrap.getAttribute('role'), 'region', 'an overflowing wrap becomes a region');
  assert.equal(wrap.getAttribute('aria-label'), 'Bears practice tracker', 'the region is named by the table caption');
  Object.defineProperty(wrap, 'scrollWidth', { value: 343, configurable: true });
  p.w.CF.syncScrollableTables();
  assert.equal(wrap.getAttribute('tabindex'), null, 'a wrap that fits leaves the tab order again');
  assert.equal(wrap.getAttribute('role'), null, 'the region role comes off when the wrap fits');
  assert.equal(wrap.getAttribute('aria-label'), null, 'the region label comes off when the wrap fits');
 } finally { p.close(); }
 // common.js and main.css changed, so their keys move to 1.188.0 on
 // every page; news.js and highlights.js stay at 1.178.0.
 const pages = ['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for (const name of pages) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html pins main.css 1.191.0');
  assert.ok(html.includes('js/common.js?v=1.195.0'), name + '.html pins common.js 1.192.0');
  assert.ok(!/main\.css\?v=(?!1\.191\.0")1\.[0-9]+\.0"/.test(html), name + '.html has no stale main.css key');
  assert.ok(!/common\.js\?v=(?!1\.195\.0")1\.[0-9]+\.0"/.test(html), name + '.html has no stale common.js key');
 }
 const newsHtml = fs.readFileSync(path.join(__dirname, '../news.html'), 'utf8');
 assert.ok(newsHtml.includes('js/news.js?v=1.178.0'), 'news.html keeps news.js 1.178.0');
 // Footer branding untouched by this release.
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.180.0: field hints speak in the site\u2019s own ice \u2014 placeholder text clears AA in every engine', async () => {
 // No ::placeholder rule existed anywhere, so every field hint fell
 // back to the browser's default grey: a rendered Chromium probe
 // measured rgb(117,117,117) on the fields' near-black ground,
 // 4.20:1 \u2014 under the 4.5:1 AA line \u2014 and Firefox's UA stylesheet
 // fades placeholders to 54% opacity on top of that (~2:1), so the
 // roster search's only instruction all but vanished there. The
 // hints now take var(--text-dim) at full opacity (7.46:1 measured
 // on the same ground); typed text stays var(--snow).
 const css = fs.readFileSync(path.join(__dirname, '../css/main.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
 assert.ok(/input::placeholder\s*\{[^}]*color:\s*var\(--text-dim\)[^}]*opacity:\s*1\s*;?[^}]*\}/.test(css), 'placeholders take the dim-ice tone at full opacity');
 assert.ok(!/input::placeholder\s*\{[^}]*color:\s*(#757575|grey|gray)/.test(css), 'the browser default grey is gone');
 // The four hinted fields the one rule serves.
 const team = fs.readFileSync(path.join(__dirname, '../team.html'), 'utf8');
 assert.ok(team.includes('id="roster-q"') && team.includes('placeholder="Search players'), 'the roster search keeps its hint');
 const odds = fs.readFileSync(path.join(__dirname, '../odds.html'), 'utf8');
 assert.ok(odds.includes('id="odds-key"') && odds.includes('placeholder="your the-odds-api key"'), 'the Odds API key keeps its hint');
 const about = fs.readFileSync(path.join(__dirname, '../about.html'), 'utf8');
 assert.ok(about.includes('placeholder="Paste your API-Sports key\u2026"'), 'the API-Sports key keeps its hint');
 assert.ok(about.includes('placeholder="Paste your TheSportsDB key\u2026"'), 'the TheSportsDB key keeps its hint');
 // main.css changed, so its key moves to 1.180.0 on every page;
 // common.js stands at 1.192.0.
 const pages = ['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for (const name of pages) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html pins main.css 1.191.0');
  assert.ok(!/main\.css\?v=(?!1\.191\.0")1\.[0-9]+\.0"/.test(html), name + '.html has no stale main.css key');
  assert.ok(html.includes('js/common.js?v=1.195.0'), name + '.html keeps common.js 1.192.0');
 }
 // Footer branding untouched by this release.
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.181.0: the now-playing highlights card says so — a badge and aria-current, not just a border', async () => {
 // The playing card was marked only by .is-active (a 1px orange
 // border): a probe measured aria-current null on every card and no
 // "Now playing" text anywhere in the grid, before and after a swap,
 // so the state was a colour a scanning fan could miss and a
 // screen-reader fan could not perceive at all. The active card now
 // carries the site's third current-state spelling (nav: "page",
 // week clock: "step", this grid: "true"/"false") plus a solid
 // badge in its meta row; featureVideo moves all three together.
 const hjs = fs.readFileSync(path.join(__dirname, '../js/highlights.js'), 'utf8');
 assert.ok(hjs.includes('aria-current="\' + (active ? "true" : "false")'), 'cardHTML stamps aria-current from the active flag');
 assert.ok(hjs.includes('class="hl-playing">Now playing</span>'), 'cardHTML renders the badge on the active card');
 assert.ok(hjs.includes('c.setAttribute("aria-current", on ? "true" : "false")'), 'featureVideo keeps aria-current in sync on swap');
 assert.ok(hjs.includes('badge.className = "hl-playing"'), 'featureVideo creates the badge on the newly active card');
 assert.ok(hjs.includes('badge.parentNode.removeChild(badge)'), 'featureVideo retires the badge from the old card');
 const css = fs.readFileSync(path.join(__dirname, '../css/highlights.css'), 'utf8');
 assert.ok(/\.hl-playing\s*\{[^}]*color:\s*#fff[^}]*background:\s*var\(--orange\)/s.test(css), 'the badge is the solid chip: white on the deep brand orange');
 assert.ok(/\.hl-meta\s*\{[^}]*flex-wrap:\s*wrap/s.test(css), 'the meta row wraps so the badge folds instead of clipping on narrow cards');
 // Behavioral: exactly one card is current and badged on first
 // paint; a click moves class, attribute and badge together; a
 // filter re-render (fresh cardHTML) keeps the state.
 const p = await page('highlights'); try {
  const d = p.w.document;
  let cards = [...d.querySelectorAll('#hl-list .hl-card')];
  assert.ok(cards.length >= 2, 'the feed renders video cards');
  assert.equal(cards.filter(c => c.getAttribute('aria-current') === 'true').length, 1, 'exactly one card is current on first paint');
  assert.equal(cards.filter(c => c.querySelector('.hl-playing')).length, 1, 'exactly one card wears the badge on first paint');
  assert.ok(cards.every(c => c.classList.contains('is-active') === (c.getAttribute('aria-current') === 'true')), 'class and aria-current agree on every card');
  assert.ok(cards.every(c => c.classList.contains('is-active') === Boolean(c.querySelector('.hl-playing'))), 'class and badge agree on every card');
  assert.equal(cards.find(c => c.classList.contains('is-active')).querySelector('.hl-playing').textContent, 'Now playing', 'the badge names the state');
  const second = cards.find(c => !c.classList.contains('is-active'));
  const secondVid = second.getAttribute('data-vid');
  second.click(); await settle();
  cards = [...d.querySelectorAll('#hl-list .hl-card')];
  const now = cards.find(c => c.getAttribute('data-vid') === secondVid);
  assert.ok(now.classList.contains('is-active'), 'the clicked card takes the active border');
  assert.equal(now.getAttribute('aria-current'), 'true', 'the clicked card takes aria-current');
  assert.equal(now.querySelector('.hl-playing').textContent, 'Now playing', 'the clicked card takes the badge');
  assert.equal(cards.filter(c => c.getAttribute('aria-current') === 'true').length, 1, 'still exactly one current card after the swap');
  assert.equal(cards.filter(c => c.querySelector('.hl-playing')).length, 1, 'still exactly one badge after the swap');
  d.querySelector('.hl-filters [data-filter="highlight"]').click(); await settle();
  const filtered = [...d.querySelectorAll('#hl-list .hl-card')];
  assert.ok(filtered.length >= 1, 'the highlights-only filter still renders footage');
  assert.ok(filtered.every(c => c.getAttribute('aria-current') === (c.classList.contains('is-active') ? 'true' : 'false')), 'filter re-renders restamp aria-current from the active flag');
  assert.ok(filtered.every(c => Boolean(c.querySelector('.hl-playing')) === c.classList.contains('is-active')), 'filter re-renders keep badge and class together');
  assert.deepEqual(p.errors, []);
 } finally { p.close(); }
 // highlights.js and highlights.css changed, so their keys move to
 // 1.181.0 on highlights.html; main.css and common.js are untouched.
 const hlHtml = fs.readFileSync(path.join(__dirname, '../highlights.html'), 'utf8');
 assert.ok(hlHtml.includes('js/highlights.js?v=1.181.0'), 'highlights.html pins highlights.js 1.181.0');
 assert.ok(hlHtml.includes('css/highlights.css?v=1.187.0'), 'highlights.html pins highlights.css 1.181.0');
 assert.ok(!/highlights\.js\?v=(?!1\.181\.0")1\.[0-9]+\.0"/.test(hlHtml), 'highlights.html has no stale highlights.js key');
 assert.ok(!/highlights\.css\?v=(?!1\.187\.0")1\.[0-9]+\.0"/.test(hlHtml), 'highlights.html has no stale highlights.css key');
 assert.ok(hlHtml.includes('css/main.css?v=1.191.0'), 'highlights.html keeps main.css 1.191.0');
 assert.ok(hlHtml.includes('js/common.js?v=1.195.0'), 'highlights.html keeps common.js 1.192.0');
 // Footer branding untouched by this release.
 assert.ok(hlHtml.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on highlights.html');
 assert.ok(hlHtml.includes('@kshot9000'), 'the @kshot9000 attribution survives on highlights.html');
});

test('v1.182.0: prose links wear an underline, not just a tint — a link in a paragraph is findable without hovering', async () => {
 // Links inside paragraphs were identifiable by colour alone:
 // var(--ice) #a8c0d4 sits 1.35:1 from the body text #d0dce8 and
 // 1.38:1 from the .dim tone of the notes they live in — under
 // the 3:1 a colour-only cue needs — and the global rule strips
 // underlines, so a rendered sweep measured text-decoration-line:
 // none on every prose link ("Google ad settings", "The Odds
 // API", the About data-source names). Paragraph links now carry
 // a persistent warm underline at a 3px offset, deepening to
 // full orange-hot on hover / focus; structural links (nav,
 // footer lists, cards, buttons) are not <p> links and keep
 // their own grammar.
 const css = fs.readFileSync(path.join(__dirname, '../css/main.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
 assert.ok(/p a\s*\{[^}]*text-decoration:\s*underline[^}]*text-decoration-color:\s*rgba\(255, 90, 31, 0\.55\)[^}]*text-underline-offset:\s*3px/.test(css), 'paragraph links carry the persistent warm underline at a 3px offset');
 assert.ok(/p a:hover, p a:focus-visible\s*\{[^}]*text-decoration-color:\s*var\(--orange-hot\)/.test(css), 'hover and keyboard focus deepen the underline to full orange-hot');
 assert.ok(!/p a\s*\{[^}]*text-decoration:\s*none/.test(css), 'no paragraph rule strips the underline back off');
 // The surfaces the rule serves: prose links exist inside
 // paragraphs on the pages a fan reads, and no button-styled
 // link lives inside a paragraph (the underline must never
 // strike through a button).
 const about = fs.readFileSync(path.join(__dirname, '../about.html'), 'utf8');
 assert.ok(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?<a[^>]*href="https:\/\/myaccount\.google\.com\/data-and-privacy"/.test(about), 'the About privacy prose link is a paragraph link');
 const odds = fs.readFileSync(path.join(__dirname, '../odds.html'), 'utf8');
 assert.ok(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?<a[^>]*href="https:\/\/the-odds-api\.com"/.test(odds), 'the Odds explainer prose link is a paragraph link');
 const pages = ['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for (const name of pages) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(!/<p[^>]*>(?:(?!<\/p>)[\s\S])*?<a[^>]*class="btn/.test(html), name + '.html has no button link inside a paragraph');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html pins main.css 1.191.0');
  assert.ok(!/main\.css\?v=(?!1\.191\.0")1\.[0-9]+\.0"/.test(html), name + '.html has no stale main.css key');
  assert.ok(html.includes('js/common.js?v=1.195.0'), name + '.html keeps common.js 1.192.0');
 }
 // Rendered DOM: the About page's prose links are in the DOM as
 // paragraph links, and the page still initializes clean.
 const p = await page('about'); try {
  const links = [...p.w.document.querySelectorAll('p a')];
  assert.ok(links.length >= 5, 'the About page renders its prose links inside paragraphs: ' + links.length);
  assert.ok(links.some(a => /Google ad settings/.test(a.textContent)), 'the ad-settings prose link renders');
  assert.deepEqual(p.errors, []);
 } finally { p.close(); }
 // Footer branding untouched by this release.
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.183.0: the back-to-top button leaves the tab order while it is hidden — no invisible focus stop', async () => {
 // At rest .cf-top was opacity 0 + pointer-events: none but
 // visibility: visible, so it kept tabIndex 0 and a rendered
 // Chromium probe at the top of the page could focus() it: a
 // keyboard fan tabbing down the page landed on a button no eye
 // could see, ring and all (the :focus-visible outline renders at
 // the button's opacity 0). v1.125.0 hid the parked-over-footer
 // state with visibility: hidden for exactly this reason, and the
 // base rule's transition has listed visibility all along — the
 // base hidden state just never set it. It does now; .is-on
 // restores visibility: visible so the 0.25s fade still plays,
 // and the parked rule (higher specificity) still wins parked.
 const css = fs.readFileSync(path.join(__dirname, '../css/main.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
 const base = css.match(/\.cf-top\s*\{([^}]*)\}/);
 assert.ok(base, 'the base .cf-top rule exists');
 assert.ok(/opacity:\s*0/.test(base[1]), 'the button still fades fully out at rest');
 assert.ok(/visibility:\s*hidden/.test(base[1]), 'the hidden button leaves the tab order (visibility: hidden)');
 assert.ok(/pointer-events:\s*none/.test(base[1]), 'the hidden button still cannot be clicked');
 assert.ok(/transition:[^;]*visibility/.test(base[1]), 'the base transition covers visibility so the fade still sequences');
 const on = css.match(/\.cf-top\.is-on\s*\{([^}]*)\}/);
 assert.ok(on, 'the .cf-top.is-on rule exists');
 assert.ok(/opacity:\s*1/.test(on[1]), 'the shown button is fully opaque');
 assert.ok(/visibility:\s*visible/.test(on[1]), 'the shown button returns to the tab order');
 assert.ok(/pointer-events:\s*auto/.test(on[1]), 'the shown button takes clicks again');
 const park = css.match(/\.cf-top\.is-on\.is-parked\s*\{([^}]*)\}/);
 assert.ok(park && /visibility:\s*hidden/.test(park[1]), 'the parked-over-footer hide still wins (its selector out-specifies .is-on)');
 assert.ok(/\.cf-top:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--orange-hot\)/s.test(css), 'the shown button keeps its visible keyboard focus ring');
 // Behavioral: the injected button still runs its show/hide class
 // cycle — hidden at the top of the page, on after scrolling,
 // hidden again back at the top (the states the CSS keys off).
 const p = await page('index'); try {
  const w = p.w, d = w.document;
  const top = d.querySelector('.cf-top');
  assert.ok(top, 'the back-to-top button is injected');
  assert.ok(!top.classList.contains('is-on'), 'the button starts in its hidden state at the top');
  d.documentElement.scrollTop = 700; w.dispatchEvent(new w.Event('scroll')); await settle(60);
  assert.ok(top.classList.contains('is-on'), 'the button shows after scrolling down');
  d.documentElement.scrollTop = 0; w.dispatchEvent(new w.Event('scroll')); await settle(60);
  assert.ok(!top.classList.contains('is-on'), 'the button hides again back at the top');
  assert.deepEqual(p.errors, []);
 } finally { p.close(); }
 // Cache-bust pins: main.css changed, so its key moves to 1.183.0
 // on all 11 pages; common.js is byte-untouched at 1.192.0.
 const pages = ['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for (const name of pages) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html pins main.css 1.191.0');
  assert.ok(!/main\.css\?v=(?!1\.191\.0")1\.[0-9]+\.0"/.test(html), name + '.html has no stale main.css key');
  assert.ok(html.includes('js/common.js?v=1.195.0'), name + '.html keeps common.js 1.192.0');
 }
 // Footer branding untouched by this release.
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.184.0: a tap answers back in the site\u2019s own orange — branded tap highlight and real pressed states', async () => {
 // A rendered probe measured the gaps against the live
 // stylesheets: every tappable element computed the UA default
 // tap highlight rgba(0, 0, 0, 0.18) — a muddy black blink that
 // belongs to no part of the orange/ice identity — and a forced
 // :active on the Odds refresh button computed styles identical
 // to rest (the only :active rules in the codebase settled two
 // chips' hover lift). The highlight now flashes the family
 // orange, and buttons/nav/chips gain a real pressed state:
 // the hover lift settles, the steel deepens, the orange holds.
 const css = fs.readFileSync(path.join(__dirname, '../css/main.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
 assert.ok(/\*\s*\{\s*-webkit-tap-highlight-color:\s*rgba\(255,\s*90,\s*31,\s*0\.16\)/.test(css), 'the tap highlight flashes the family orange, not the UA black');
 const press = css.match(/\.btn:active:not\(:disabled\):not\(\[disabled\]\)\s*\{([^}]*)\}/);
 assert.ok(press, 'the .btn pressed rule exists, disabled buttons excluded twice over');
 assert.ok(/transform:\s*translateY\(0\)/.test(press[1]), 'the press settles the hover lift back to the ground');
 assert.ok(/background:\s*rgba\(92,\s*122,\s*153,\s*0\.42\)/.test(press[1]), 'the press deepens the steel');
 assert.ok(/border-color:\s*rgba\(255,\s*90,\s*31,\s*0\.65\)/.test(press[1]), 'the press holds the orange border');
 const prim = css.match(/\.btn\.primary:active:not\(:disabled\):not\(\[disabled\]\)\s*\{([^}]*)\}/);
 assert.ok(prim && /linear-gradient\(135deg,\s*#a82c00/.test(prim[1]), 'the primary button presses into a deeper burn of its gradient');
 assert.ok(/\.btn:disabled,\s*\.btn\[disabled\]\s*\{[^}]*opacity:\s*0\.55/s.test(css), 'the v1.92.0 disabled flattening still stands (a dead button never pretends)');
 assert.ok(/\.nav a:active\s*\{[^}]*background:\s*rgba\(92,\s*122,\s*153,\s*0\.3\)/.test(css), 'nav links press with a deeper wash of their hover steel');
 assert.ok(/\.btn\s*\{[^}]*transition:[^;]*transform/s.test(css), 'the button transition already covers transform, so the press animates on the family ease');
 const hl = fs.readFileSync(path.join(__dirname, '../css/highlights.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
 const chip = hl.match(/\.chip:active\s*\{([^}]*)\}/);
 assert.ok(chip && /background:\s*rgba\(92,\s*122,\s*153,\s*0\.32\)/.test(chip[1]), 'an unselected highlights chip presses with the family steel');
 const chipOn = hl.match(/\.chip\[aria-pressed="true"\]:active\s*\{([^}]*)\}/);
 assert.ok(chipOn && /background:\s*rgba\(255,\s*90,\s*31,\s*0\.28\)/.test(chipOn[1]), 'the selected chip presses deeper into its own orange wash');
 assert.ok(/\.chip\[aria-pressed="true"\]\s*\{[^}]*background:\s*rgba\(255,\s*90,\s*31,\s*0\.16\)/.test(hl), 'the selected chip\u2019s resting wash is untouched');
 // Rendered surface: the Odds page\u2019s refresh button (the very
 // control the probe forced :active on) still renders clean.
 const p = await page('odds'); try {
  const d = p.w.document;
  const btn = d.querySelector('#odds-refresh.btn, .btn#odds-refresh, #odds-refresh');
  assert.ok(btn, 'the odds refresh button renders');
  assert.deepEqual(p.errors, []);
 } finally { p.close(); }
 // Cache-bust pins: main.css moves to 1.189.0 on all 11 pages,
 // highlights.css keeps 1.187.0 on highlights.html; every script
 // is byte-untouched (common.js 1.192.0, highlights.js 1.181.0).
 const pages = ['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for (const name of pages) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html pins main.css 1.191.0');
  assert.ok(!/main\.css\?v=(?!1\.191\.0")1\.[0-9]+\.0"/.test(html), name + '.html has no stale main.css key');
  assert.ok(html.includes('js/common.js?v=1.195.0'), name + '.html keeps common.js 1.192.0');
 }
 const hlHtml = fs.readFileSync(path.join(__dirname, '../highlights.html'), 'utf8');
 assert.ok(hlHtml.includes('css/highlights.css?v=1.187.0'), 'highlights.html pins highlights.css 1.187.0');
 assert.ok(hlHtml.includes('js/highlights.js?v=1.181.0'), 'highlights.html keeps highlights.js 1.181.0');
 // Footer branding untouched by this release.
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.185.0: stories a fan has already read recede — visited headlines settle into dim ice', async () => {
 // No :visited rule existed anywhere, so a story link painted
 // the same snow whether the fan had opened it an hour ago or
 // never, and a returning fan had to re-read every headline on
 // the News wire and the home story row to find the new ones.
 // Read headlines now recede to var(--text-dim) (the meta row's
 // own tone, 7.46:1 on this ground per v1.180.0), and hover /
 // focus re-warms them to orange-hot, outranking the recede.
 // A rendered Chromium probe confirmed both rules paint —
 // after the two "read" links were followed, snow-toned
 // pixels fell 17,547 -> 8,824 and dim-ice pixels rose
 // 24,642 -> 33,263, while the fresh links stayed snow.
 const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
 const main = strip(fs.readFileSync(path.join(__dirname, '../css/main.css'), 'utf8'));
 const visited = main.match(/\.news-item \.headline:visited\s*\{([^}]*)\}/);
 assert.ok(visited, 'the News headline visited rule exists');
 assert.ok(/color:\s*var\(--text-dim\)/.test(visited[1]), 'a read headline recedes to dim ice');
 assert.ok(/\.news-item:hover \.headline:visited,\s*\.news-item:focus-within \.headline:visited,\s*\.news-item \.headline:visited:hover\s*\{[^}]*color:\s*var\(--orange-hot\)/.test(main), 'hover and focus re-warm a read headline to orange-hot');
 assert.ok(!/(^|\s)a:visited/.test(main), 'no global a:visited rule — structural links keep their grammar');
 const exp = strip(fs.readFileSync(path.join(__dirname, '../css/experience.css'), 'utf8'));
 const card = exp.match(/\.story-card:visited \.story-copy h3\s*\{([^}]*)\}/);
 assert.ok(card && /color:\s*var\(--text-dim\)/.test(card[1]), 'a read home story card headline recedes to the same dim ice');
 assert.ok(/\.story-card:visited:hover \.story-copy h3,\s*\.story-card:visited:focus-within \.story-copy h3\s*\{[^}]*color:\s*var\(--orange-hot\)/.test(exp), 'hover and focus re-warm a read story card headline');
 // The surfaces the rules dress still render their story links.
 const newsJs = fs.readFileSync(path.join(__dirname, '../js/news.js'), 'utf8');
 assert.ok(newsJs.includes('class="headline"'), 'news.js still stamps headline links');
 const homeJs = fs.readFileSync(path.join(__dirname, '../js/home.js'), 'utf8');
 assert.ok(homeJs.includes('class="story-card"'), 'home.js still stamps story cards');
 const p = await page('news'); try {
  assert.deepEqual(p.errors, []);
 } finally { p.close(); }
 // Cache-bust pins: main.css moves to 1.189.0 on all 11
 // pages; experience.css keeps 1.187.0, every script is
 // byte-untouched (common.js 1.192.0) and highlights.css
 // keeps 1.187.0.
 const pages = ['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for (const name of pages) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html pins main.css 1.191.0');
  assert.ok(!/main\.css\?v=(?!1\.191\.0")1\.[0-9]+\.0"/.test(html), name + '.html has no stale main.css key');
  assert.ok(html.includes('css/experience.css?v=1.195.0'), name + '.html pins experience.css 1.187.0');
  assert.ok(!/experience\.css\?v=(?!1\.195\.0")1\.[0-9]+\.0"/.test(html), name + '.html has no stale experience.css key');
  assert.ok(html.includes('js/common.js?v=1.195.0'), name + '.html keeps common.js 1.192.0');
 }
 const hlHtml = fs.readFileSync(path.join(__dirname, '../highlights.html'), 'utf8');
 assert.ok(hlHtml.includes('css/highlights.css?v=1.187.0'), 'highlights.html keeps highlights.css 1.187.0');
 // Footer branding untouched by this release.
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.186.0: forced-colors fans keep their cues — status pills, field focus, pressed chip', async () => {
 // No @media (forced-colors) rule existed anywhere, and a
 // Chromium probe under forced-colors emulation (focus
 // emulation on, so :focus really matches) measured the
 // cost for a Windows High Contrast fan: the injury wire's
 // .st pills are background tints with no border, stripped
 // to bare words in the mode; the .key-box / .roster /
 // date fields suppress their outline for a border-and-
 // shadow ring that the mode forces away (focused field
 // computed outline none); and a pressed Highlights chip's
 // orange border and wash force to the same system tones
 // as an unpressed chip. The block restores each cue in
 // the mode's own grammar, system colours only.
 const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
 const main = strip(fs.readFileSync(path.join(__dirname, '../css/main.css'), 'utf8'));
 const fcAt = main.indexOf('@media (forced-colors: active)');
 assert.ok(fcAt >= 0, 'a forced-colors block exists');
 const fc = main.slice(fcAt);
 assert.ok(/\.st\s*\{\s*border:\s*1px solid currentColor/.test(fc), 'status pills gain a currentColor border inside forced-colors');
 assert.ok(/\.key-box input:focus,\s*\.roster-controls input:focus,\s*\.roster-controls select:focus,\s*input\[type="date"\]:focus\s*\{\s*outline:\s*2px solid Highlight;\s*outline-offset:\s*2px/.test(fc), 'focused fields take a Highlight outline inside forced-colors');
 assert.ok(/\.chip\[aria-pressed="true"\]\s*\{\s*outline:\s*2px solid Highlight/.test(fc), 'a pressed filter chip takes a Highlight outline inside forced-colors');
 // Nothing leaks outside the mode: the base .st pill stays
 // borderless and Highlight appears nowhere before the block.
 const base = main.match(/\.st\s*\{([^}]*)\}/);
 assert.ok(base && !/border\s*:/.test(base[1]), 'the base status pill stays borderless outside forced-colors');
 assert.ok(!/Highlight/.test(main.slice(0, fcAt)), 'Highlight is used only inside the forced-colors block');
 // The dressed surfaces still render clean.
 const p = await page('injuries'); try {
  assert.deepEqual(p.errors, []);
 } finally { p.close(); }
 // Cache-bust pins: main.css moves to 1.189.0 on all 11
 // pages; experience.css keeps 1.187.0, highlights.css
 // keeps 1.187.0 and every script is byte-untouched.
 const pages = ['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for (const name of pages) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html pins main.css 1.191.0');
  assert.ok(!/main\.css\?v=(?!1\.191\.0")1\.[0-9]+\.0"/.test(html), name + '.html has no stale main.css key');
  assert.ok(html.includes('css/experience.css?v=1.195.0'), name + '.html keeps experience.css 1.187.0');
  assert.ok(html.includes('js/common.js?v=1.195.0'), name + '.html keeps common.js 1.192.0');
 }
 const hlHtml = fs.readFileSync(path.join(__dirname, '../highlights.html'), 'utf8');
 assert.ok(hlHtml.includes('css/highlights.css?v=1.187.0'), 'highlights.html keeps highlights.css 1.187.0');
 // Footer branding untouched by this release.
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.187.0: reduced-transparency fans get solid panels — tokens resolve solid, glass surfaces drop their blur', async () => {
 // No prefers-reduced-transparency rule existed anywhere,
 // and a Chromium probe under the emulated preference
 // measured the glass unchanged: --glass computed
 // rgba(8,18,34,0.68), the sticky header kept
 // backdrop-filter blur(20px) over an 0.88-alpha ground,
 // the weather strip kept blur(12px), and the Highlights
 // card kept 0.72 alpha under blur(14px) — the hardest
 // build of the site to read, served to exactly the fans
 // who asked their OS for solid panels. The fix lives in
 // one media block per stylesheet.
 const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
 const main = strip(fs.readFileSync(path.join(__dirname, '../css/main.css'), 'utf8'));
 const rtAt = main.indexOf('@media (prefers-reduced-transparency: reduce)');
 assert.ok(rtAt >= 0, 'a reduced-transparency block exists in main.css');
 const rt = main.slice(rtAt);
 assert.ok(/:root\s*\{\s*--card:\s*var\(--card-solid\);?\s*--glass:\s*#0a1524;?\s*--glass-deep:\s*#040a14/.test(rt), 'the glass tokens resolve to their solid twins inside the block');
 assert.ok(/\.site-head\s*\{\s*background:\s*#02060e;\s*backdrop-filter:\s*none/.test(rt), 'the sticky header goes solid and drops its blur');
 assert.ok(/\.weather-strip\s*\{\s*background:\s*#0a1524;\s*backdrop-filter:\s*none/.test(rt), 'the weather strip goes solid and drops its blur');
 assert.ok(/\.nav-backdrop\s*\{[^}]*backdrop-filter:\s*none/.test(rt), 'the drawer backdrop drops its blur');
 // Nothing leaks outside the mode: the base tokens stay
 // translucent and the header keeps its blur.
 assert.ok(/--glass:\s*rgba\(8, 18, 34, 0\.68\)/.test(main.slice(0, rtAt)), 'the base --glass token stays translucent outside the block');
 assert.ok(/\.site-head\s*\{[^}]*backdrop-filter:\s*blur\(20px\)/.test(main.slice(0, rtAt)), 'the base header keeps its blur outside the block');
 const exp = strip(fs.readFileSync(path.join(__dirname, '../css/experience.css'), 'utf8'));
 const expRt = exp.slice(exp.indexOf('@media (prefers-reduced-transparency: reduce)'));
 assert.ok(/\.bx-card\s*\{\s*backdrop-filter:\s*none/.test(expRt), 'the box-score card drops its blur in experience.css');
 assert.ok(/\.snow-toggle\s*\{\s*backdrop-filter:\s*none/.test(expRt), 'the snow toggle drops its blur in experience.css');
 const hl = strip(fs.readFileSync(path.join(__dirname, '../css/highlights.css'), 'utf8'));
 const hlRt = hl.slice(hl.indexOf('@media (prefers-reduced-transparency: reduce)'));
 assert.ok(/\.hl-card\s*\{\s*background:\s*#0a1524;\s*backdrop-filter:\s*none/.test(hlRt), 'the highlight card goes solid and drops its blur');
 assert.ok(/\.hl-thumb \.hl-mini-play\s*\{[^}]*background:\s*rgba\(4, 10, 20, 0\.92\)/.test(hlRt), 'the mini play badge firms up to 0.92');
 // The dressed surfaces still render clean.
 const p = await page('index'); try {
  assert.deepEqual(p.errors, []);
 } finally { p.close(); }
 // Cache-bust pins: main.css moves to 1.189.0; experience.css
 // and highlights.css keep 1.187.0; every script is
 // byte-untouched.
 const pages = ['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for (const name of pages) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html pins main.css 1.191.0');
  assert.ok(html.includes('css/experience.css?v=1.195.0'), name + '.html pins experience.css 1.187.0');
  assert.ok(html.includes('js/common.js?v=1.195.0'), name + '.html keeps common.js 1.192.0');
 }
 const hlHtml = fs.readFileSync(path.join(__dirname, '../highlights.html'), 'utf8');
 assert.ok(hlHtml.includes('css/highlights.css?v=1.187.0'), 'highlights.html pins highlights.css 1.187.0');
 // Footer branding untouched by this release.
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.188.0: wide tables confess they scroll sideways \u2014 the enhancer paints edge state, the mask fades the open edge', async () => {
 // A rendered 390px probe measured the season log at 680px
 // of table in a 343px wrap and the standings at 560px in
 // 343px, the columns past the border clipping with no hint
 // they existed. The v1.179.0 enhancer now paints edge
 // state onto each overflowing wrap (cf-scroll-x while it
 // overflows, cf-scrolled once it has moved, cf-at-end at
 // the far end) and main.css masks the table's own content
 // out at exactly the edge with more table beyond it.
 const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, '');
 const main = strip(fs.readFileSync(path.join(__dirname, '../css/main.css'), 'utf8'));
 const common = fs.readFileSync(path.join(__dirname, '../js/common.js'), 'utf8');
 // The enhancer paints and maintains the state.
 assert.ok(common.includes('classList.toggle("cf-scroll-x", over)'), 'the enhancer marks an overflowing wrap cf-scroll-x');
 assert.ok(common.includes('classList.toggle("cf-scrolled", over && el.scrollLeft > 2)'), 'the enhancer marks a moved wrap cf-scrolled');
 assert.ok(common.includes('classList.toggle("cf-at-end", over && el.scrollLeft > 2 && max - el.scrollLeft <= 2)'), 'the enhancer marks a wrap at its far end cf-at-end');
 assert.ok(common.includes('document.addEventListener("scroll"'), 'a scroll listener keeps the edge state honest');
 assert.ok(common.includes('t.classList.contains("tbl-wrap")'), 'the scroll listener paints only table wraps');
 assert.ok(common.includes('new IntersectionObserver'), 'an IntersectionObserver re-measures wraps as they near the viewport');
 assert.ok(common.includes('en.isIntersecting') && common.includes('io.observe(el)'), 'the observer re-syncs and registers every wrap');
 assert.ok(common.includes('checkVisibility({ contentVisibilityAuto: true })'), 'a sync that catches a wrap mid-skip defers instead of stripping state');
 // The mask rules fade the open edge only.
 assert.ok(/\.tbl-wrap\.cf-scroll-x\s*\{[^}]*mask-image:\s*linear-gradient\(90deg, #000 calc\(100% - 28px\), transparent\)/.test(main), 'at rest only the right edge fades');
 assert.ok(/\.tbl-wrap\.cf-scroll-x\.cf-scrolled\s*\{[^}]*mask-image:\s*linear-gradient\(90deg, transparent, #000 28px, #000 calc\(100% - 28px\), transparent\)/.test(main), 'mid-scroll both edges fade');
 assert.ok(/\.tbl-wrap\.cf-scroll-x\.cf-at-end\s*\{[^}]*mask-image:\s*linear-gradient\(90deg, transparent, #000 28px\)/.test(main), 'at the end only the left edge fades');
 assert.ok(/\.tbl-wrap\.cf-scroll-x:focus-visible\s*\{[^}]*mask-image:\s*none/.test(main), 'keyboard focus lifts the fade so the region ring reads whole');
 assert.ok(/\.tbl-wrap\.cf-scroll-x\s*\{\s*-webkit-mask-image:\s*none !important;\s*mask-image:\s*none !important/.test(main.slice(main.indexOf('@media print'))), 'the print block strips the fade');
 // No leak: the base wrap carries no mask, so a table
 // that fits renders exactly as before.
 const baseRule = main.match(/\.tbl-wrap\s*\{([^}]*)\}/);
 assert.ok(baseRule && !/mask-image/.test(baseRule[1]), 'the base .tbl-wrap rule carries no mask');
 // Behavioral: jsdom reports zero layout, so stub the
 // geometry and drive the enhancer through its states.
 const p = await page('practice'); try {
  const wrap = p.w.document.querySelector('.tbl-wrap');
  assert.ok(wrap, 'the practice tracker rides in a .tbl-wrap');
  assert.ok(!wrap.classList.contains('cf-scroll-x'), 'no fade state before any overflow is measured');
  Object.defineProperty(wrap, 'clientWidth', { value: 343, configurable: true });
  Object.defineProperty(wrap, 'scrollWidth', { value: 560, configurable: true });
  Object.defineProperty(wrap, 'scrollLeft', { value: 0, configurable: true, writable: true });
  p.w.CF.syncScrollableTables();
  assert.ok(wrap.classList.contains('cf-scroll-x'), 'an overflowing wrap takes the fade state');
  assert.ok(!wrap.classList.contains('cf-scrolled') && !wrap.classList.contains('cf-at-end'), 'at rest neither moved nor at the end');
  wrap.scrollLeft = 100;
  p.w.CF.syncScrollableTables();
  assert.ok(wrap.classList.contains('cf-scrolled') && !wrap.classList.contains('cf-at-end'), 'mid-scroll reads as scrolled, not at the end');
  wrap.scrollLeft = 217;
  p.w.CF.syncScrollableTables();
  assert.ok(wrap.classList.contains('cf-at-end'), 'at the far end the state flips to cf-at-end');
  Object.defineProperty(wrap, 'scrollWidth', { value: 343, configurable: true });
  p.w.CF.syncScrollableTables();
  assert.ok(!wrap.classList.contains('cf-scroll-x') && !wrap.classList.contains('cf-scrolled') && !wrap.classList.contains('cf-at-end'), 'a wrap that fits sheds every fade state');
  assert.deepEqual(p.errors, []);
 } finally { p.close(); }
 // Cache-bust pins: main.css moves to 1.189.0 on all 11
 // pages and common.js stands at 1.192.0; experience.css
 // and highlights.css keep 1.187.0, other scripts untouched.
 const pages = ['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for (const name of pages) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html pins main.css 1.191.0');
  assert.ok(!/main\.css\?v=(?!1\.191\.0")1\.[0-9]+\.0"/.test(html), name + '.html has no stale main.css key');
  assert.ok(html.includes('js/common.js?v=1.195.0'), name + '.html pins common.js 1.192.0');
  assert.ok(!/common\.js\?v=(?!1\.195\.0")1\.[0-9]+\.0"/.test(html), name + '.html has no stale common.js key');
  assert.ok(html.includes('css/experience.css?v=1.195.0'), name + '.html keeps experience.css 1.187.0');
 }
 const hlHtml = fs.readFileSync(path.join(__dirname, '../highlights.html'), 'utf8');
 assert.ok(hlHtml.includes('css/highlights.css?v=1.187.0'), 'highlights.html keeps highlights.css 1.187.0');
 // Footer branding untouched by this release.
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.189.0: the small orange kicker labels take the text orange — deep fill orange never sets small type', async () => {
 // A rendered contrast sweep flagged the Sunday-desk
 // kicker at 4.0:1: the desk / film / heat / injury-
 // movement kickers and the practice heat map's 9px
 // .heat-today tag were the last small text set in
 // var(--orange) #d13a02, the deep fill orange — 4.00:1
 // on the page ground #060d18, 3.77 / 3.52 / 3.25:1 on
 // the #0a1524 / card-solid #0e1c30 / #12233a card tones,
 // under AA for their 9–11px type. They now read in
 // var(--orange-hot) #ff5a1f, the text orange (.eyebrow,
 // .orange, .wt-src): 6.24 / 5.88 / 5.49 / 5.07:1 on the
 // same grounds.
 const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, '');
 const main = strip(fs.readFileSync(path.join(__dirname, '../css/main.css'), 'utf8'));
 const hot = /color:\s*var\(--orange-hot, #ff5a1f\)/;
 assert.ok(/\.desk-title \.k\s*\{[^}]*color:\s*var\(--orange-hot, #ff5a1f\)/.test(main), 'the Sunday-desk title kicker reads in the text orange');
 assert.ok(/\.film-kicker \.k,\s*\.desk-kicker \.k,\s*\.heat-head \.k\s*\{[^}]*color:\s*var\(--orange-hot, #ff5a1f\)/.test(main), 'the film / desk / heat kickers read in the text orange');
 assert.ok(/\.inj-move-head \.k\s*\{[^}]*color:\s*var\(--orange-hot, #ff5a1f\)/.test(main), 'the injury-movement kicker reads in the text orange');
 assert.ok(/\.heat-today\s*\{[^}]*color:\s*var\(--orange-hot, #ff5a1f\)/.test(main), 'the 9px today tag reads in the text orange');
 assert.ok(hot.test(main), 'the text orange is in use');
 // No leak: the deep fill orange sets no text colour
 // anywhere in main.css, while its fill roles survive —
 // the token itself, the ::selection ground (white on
 // #d13a02 is the v1.159.0-verified 4.64:1 pairing) and
 // the primary button gradient stops.
 assert.ok(!/color:\s*var\(--orange, #E8541E\)/.test(main), 'no rule sets text in the deep fill orange');
 assert.ok(!/color:\s*#d13a02/i.test(main), 'no rule sets text in the deep orange literal');
 assert.ok(/--orange:\s*#d13a02/.test(main), 'the deep orange token itself is untouched');
 assert.ok(/::selection\s*\{[^}]*background:\s*var\(--orange\)/.test(main), 'the selection ground keeps the deep orange fill');
 // The labelled surfaces still render their kickers.
 const games = fs.readFileSync(path.join(__dirname, '../js/games.js'), 'utf8');
 const home = fs.readFileSync(path.join(__dirname, '../js/home.js'), 'utf8');
 const practice = fs.readFileSync(path.join(__dirname, '../js/practice.js'), 'utf8');
 const common = fs.readFileSync(path.join(__dirname, '../js/common.js'), 'utf8');
 assert.ok(games.includes('desk-title"><span class="k">Sunday desk</span>'), 'the games desk still wears its kicker');
 assert.ok(home.includes('desk-kicker"><span class="k">Next kickoff</span>'), 'the home desk still wears its kicker');
 assert.ok(home.includes('film-kicker"><span class="k">Film room</span>'), 'the film room still wears its kicker');
 assert.ok(practice.includes('heat-head"><span class="k">Week intensity</span>'), 'the practice heat still wears its kicker');
 assert.ok(practice.includes('heat-today'), 'the practice heat still tags today');
 assert.ok(common.includes('inj-move-head"><span class="k">Report movement</span>'), 'the injury movement head still wears its kicker');
 // Cache-bust pins: main.css moves to 1.189.0 on all 11
 // pages; every other asset is byte-untouched (common.js
 // 1.192.0, experience.css and highlights.css 1.187.0).
 const pages = ['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for (const name of pages) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html pins main.css 1.191.0');
  assert.ok(!/main\.css\?v=(?!1\.191\.0")1\.[0-9]+\.0"/.test(html), name + '.html has no stale main.css key');
  assert.ok(html.includes('js/common.js?v=1.195.0'), name + '.html keeps common.js 1.192.0');
  assert.ok(html.includes('css/experience.css?v=1.195.0'), name + '.html keeps experience.css 1.187.0');
 }
 const hlHtml = fs.readFileSync(path.join(__dirname, '../highlights.html'), 'utf8');
 assert.ok(hlHtml.includes('css/highlights.css?v=1.187.0'), 'highlights.html keeps highlights.css 1.187.0');
 // Footer branding untouched by this release.
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.190.0: the tab keeps score — a live Bears game and today\'s final ride the browser tab title', async () => {
 // No page ever wrote document.title: a fan with the game
 // on TV and the site parked in another tab had to switch
 // back to learn the score. CF.syncLiveTitle (common.js)
 // now puts the score in the tab while the Bears are live
 // — and after a final played today — off the normalized
 // game the home hero and the games board already resolve
 // on every paint/refresh beat. Anything else restores
 // the page's own title, so a stale snapshot can never
 // bill an old final as today's.
 const common = fs.readFileSync(path.join(__dirname, '../js/common.js'), 'utf8');
 const home = fs.readFileSync(path.join(__dirname, '../js/home.js'), 'utf8');
 const games = fs.readFileSync(path.join(__dirname, '../js/games.js'), 'utf8');
 assert.ok(common.includes('CF.syncLiveTitle = (game) =>'), 'common.js owns the tab-title sync');
 assert.ok(common.includes('"🔴 LIVE · "'), 'a live game leads the tab with the live marker');
 assert.ok(common.includes('"BEARS WIN · Final · "'), 'a winning final says so in the tab');
 assert.ok(common.includes('CF._baseTitle = document.title'), 'the page\'s own title is captured for restore');
 assert.ok(home.includes('CF.syncLiveTitle(game);'), 'the home hero syncs the tab on every paint');
 assert.ok(home.includes('CF.syncLiveTitle(null);'), 'the home quiet state restores the tab');
 assert.ok(games.includes('CF.syncLiveTitle(selectedDay === isoDate(0)'), 'the games board syncs only off today\'s board');
 assert.ok(games.includes('CF.API.gameFromEvent(bearsEvent)'), 'the board syncs the normalized Bears game');
 // Behavioral: drive the helper through its states.
 const p = await page('index'); try {
  const w = p.w, base = w.document.title;
  assert.ok(base.includes('THE COLD FRONT'), 'the base title is the page\'s own: ' + base);
  const liveEv = event('900','CHI','GB','in','2026-09-26T01:00:00Z',24,17);
  liveEv.status.type.shortDetail = 'Q4 1:32';
  w.CF.syncLiveTitle(w.CF.API.gameFromEvent(liveEv));
  assert.equal(w.document.title, '🔴 LIVE · GB 17 @ CHI 24 · Q4 1:32 — The Cold Front', 'a live game rides the tab with its clock');
  w.CF.syncLiveTitle(w.CF.API.gameFromEvent(event('901','CHI','GB','post','2026-09-26T00:30:00Z',24,17)));
  assert.equal(w.document.title, 'BEARS WIN · Final · GB 17 @ CHI 24 — The Cold Front', 'today\'s winning final rides the tab');
  w.CF.syncLiveTitle(w.CF.API.gameFromEvent(event('902','CHI','GB','post','2026-09-26T00:30:00Z',17,24)));
  assert.equal(w.document.title, 'Final · GB 24 @ CHI 17 — The Cold Front', 'today\'s losing final rides the tab without the win banner');
  w.CF.syncLiveTitle(w.CF.API.gameFromEvent(event('903','CHI','GB','post','2026-09-20T17:00:00Z',24,17)));
  assert.equal(w.document.title, base, 'a final from another day restores the page title');
  w.CF.syncLiveTitle(w.CF.API.gameFromEvent(liveEv));
  w.CF.syncLiveTitle(w.CF.API.gameFromEvent(event('904','CHI','GB','pre','2026-09-28T23:15:00Z')));
  assert.equal(w.document.title, base, 'a pre-game state restores the page title');
  w.CF.syncLiveTitle(w.CF.API.gameFromEvent(liveEv));
  w.CF.syncLiveTitle(null);
  assert.equal(w.document.title, base, 'no game restores the page title');
  w.CF.syncLiveTitle({ state: 'in', date: '2026-09-26T01:00:00Z', display: 'Q4 1:32', home: { abbr: 'CHI', score: '—' }, away: { abbr: 'GB', score: '—' } });
  assert.equal(w.document.title, base, 'placeholder scores never reach the tab');
  assert.deepEqual(p.errors, []);
 } finally { p.close(); }
 // End to end: a live board paints the live tab on the
 // home hero and on today's games board alike.
 const liveBoard = async (u) => {
  if (!u.pathname.includes('/scoreboard')) return undefined;
  const ev = event('900','CHI','GB','in','2026-09-26T01:00:00Z',24,17);
  ev.status.type.shortDetail = 'Q4 1:32';
  const data = { events: [ev] };
  return { ok: true, json: async () => data, text: async () => JSON.stringify(data) };
 };
 const hp = await page('index', { fetch: liveBoard }); try {
  await settle(300);
  assert.equal(hp.w.document.title, '🔴 LIVE · GB 17 @ CHI 24 · Q4 1:32 — The Cold Front', 'the home hero puts the live score in the tab');
  assert.deepEqual(hp.errors, []);
 } finally { hp.close(); }
 const gp = await page('games', { fetch: liveBoard }); try {
  await settle(300);
  assert.equal(gp.w.document.title, '🔴 LIVE · GB 17 @ CHI 24 · Q4 1:32 — The Cold Front', 'today\'s games board puts the live score in the tab');
  assert.deepEqual(gp.errors, []);
 } finally { gp.close(); }
 // Cache-bust pins: common.js, home.js and games.js move
 // to 1.190.0; every other asset is byte-untouched
 // (main.css 1.189.0, odds.js 1.164.0, experience.css
 // and highlights.css 1.187.0).
 const pages = ['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for (const name of pages) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('js/common.js?v=1.195.0'), name + '.html pins common.js 1.192.0');
  assert.ok(!/common\.js\?v=(?!1\.195\.0")1\.[0-9]+\.0"/.test(html), name + '.html has no stale common.js key');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html keeps main.css 1.191.0');
 }
 const idxHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idxHtml.includes('js/home.js?v=1.195.0'), 'index.html pins home.js 1.190.0');
 const gamesHtml = fs.readFileSync(path.join(__dirname, '../games.html'), 'utf8');
 assert.ok(gamesHtml.includes('js/games.js?v=1.193.0'), 'games.html pins games.js 1.190.0');
 const oddsHtml = fs.readFileSync(path.join(__dirname, '../odds.html'), 'utf8');
 assert.ok(oddsHtml.includes('js/odds.js?v=1.164.0'), 'odds.html keeps odds.js 1.164.0');
 // Footer branding untouched by this release.
 assert.ok(idxHtml.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idxHtml.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.191.0: the kickoff banner dismiss becomes a thumb target on phones — 40px where the site stacks, 30px desktop chip untouched', async () => {
 // A rendered 390px sweep on a gameday — the only state in
 // which the kickoff banner exists — measured its × dismiss
 // at 30×30px: the one standalone button still under the
 // 40px phone minimum every other control took in
 // v1.155.0–v1.163.0. The banner renders only inside the
 // kickoff / gameday window, which is why the earlier phone
 // sweeps never saw it. At ≤800px (the site's thumb-target
 // breakpoint) it now composes 40×40; desktop keeps the
 // compact 30px chip, byte for byte.
 const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
 const main = strip(fs.readFileSync(path.join(__dirname, '../css/main.css'), 'utf8'));
 // The base rule keeps the compact desktop chip.
 const base = main.match(/\.cf-kickoff-dismiss\s*\{([^}]*)\}/);
 assert.ok(base && /width:\s*30px/.test(base[1]) && /height:\s*30px/.test(base[1]), 'the base dismiss rule keeps the compact 30px chip');
 // The phone rule exists, carries exactly the 40px square,
 // inside a max-width 800px block that lands after the base
 // rule, so the cascade honours it where the site stacks.
 const mqRule = main.match(/@media \(max-width: 800px\)\s*\{\s*\.cf-kickoff-dismiss\s*\{\s*width:\s*40px;\s*height:\s*40px;\s*\}\s*\}/);
 assert.ok(mqRule, 'the dismiss composes 40x40 inside a max-width 800px block');
 assert.ok(main.indexOf(mqRule[0]) > main.indexOf('.cf-kickoff-dismiss'), 'the phone block lands after the base dismiss rule');
 // No other width rides along: exactly two dismiss rules.
 assert.equal((main.match(/\.cf-kickoff-dismiss\s*\{/g) || []).length, 2, 'exactly the base and phone dismiss rules exist');
 assert.equal((main.match(/\.cf-kickoff-dismiss:hover/g) || []).length, 1, 'the hover warmth rule is untouched');
 // The emitter still stamps the labelled button.
 const common = fs.readFileSync(path.join(__dirname, '../js/common.js'), 'utf8');
 assert.ok(common.includes('class="cf-kickoff-dismiss"'), 'common.js still emits the dismiss button');
 assert.ok(common.includes('aria-label="Dismiss gameday banner"'), 'the dismiss keeps its accessible name');
 // The dressed page still renders clean.
 const p = await page('index'); try {
  assert.deepEqual(p.errors, []);
 } finally { p.close(); }
 // Cache-bust pins: main.css moves to 1.191.0 on all 11
 // pages; every other asset is byte-untouched (common.js
 // 1.192.0, experience.css and highlights.css 1.187.0).
 const pages = ['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for (const name of pages) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html pins main.css 1.191.0');
  assert.ok(!/main\.css\?v=(?!1\.191\.0")1\.[0-9]+\.0"/.test(html), name + '.html has no stale main.css key');
  assert.ok(html.includes('js/common.js?v=1.195.0'), name + '.html keeps common.js 1.192.0');
  assert.ok(html.includes('css/experience.css?v=1.195.0'), name + '.html keeps experience.css 1.187.0');
 }
 const hlHtml = fs.readFileSync(path.join(__dirname, '../highlights.html'), 'utf8');
 assert.ok(hlHtml.includes('css/highlights.css?v=1.187.0'), 'highlights.html keeps highlights.css 1.187.0');
 // Footer branding untouched by this release.
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.192.0: the tab icon turns live — the paw wears a red badge dot only while the Bears are live', async () => {
 // v1.190.0 put the score in the tab title, but a title has
 // to be read — and on a pinned tab it is not shown at all.
 // The favicon is the glanceable part of a parked tab. While
 // the Bears are live, CF.syncLiveTitle now also swaps
 // link[rel="icon"] to img/favicon-live.svg — the same paw
 // with a broadcast-red badge dot — and restores the plain
 // paw the moment the game leaves the live state, so the dot
 // never lingers on a finished game. The apple-touch-icon is
 // never touched.
 const common = fs.readFileSync(path.join(__dirname, '../js/common.js'), 'utf8');
 assert.ok(common.includes('CF._syncLiveIcon = (live) =>'), 'common.js owns the live icon sync');
 assert.ok(common.includes('CF._syncLiveIcon(!!(title && game && game.state === "in"))'), 'the icon sync rides the live state only');
 assert.ok(common.includes('favicon-live.svg'), 'the live icon is the badged twin asset');
 assert.ok(common.includes('CF._baseIcon = link.getAttribute("href")'), 'the page icon is captured for restore');
 assert.ok(!common.slice(common.indexOf('CF._syncLiveIcon = (live)'), common.indexOf('CF.syncLiveTitle = (game)')).includes('apple-touch'), 'the icon sync never reaches for the touch icon');
 // The twin asset is the same paw plus exactly one badge dot.
 const liveSvg = fs.readFileSync(path.join(__dirname, '../img/favicon-live.svg'), 'utf8');
 const baseSvg = fs.readFileSync(path.join(__dirname, '../img/favicon.svg'), 'utf8');
 assert.ok(!baseSvg.includes('<circle'), 'the base paw carries no badge');
 assert.equal((liveSvg.match(/<circle/g) || []).length, 1, 'the live paw carries exactly one badge dot');
 assert.ok(/<circle cx="37\.5" cy="10\.5" r="7" fill="#ff3b30" stroke="#ffffff"/.test(liveSvg), 'the badge is a white-ringed broadcast-red dot in the top-right corner');
 assert.ok(liveSvg.includes('<ellipse cx="24" cy="29.5" rx="7.6" ry="6.1"/>'), 'the live paw keeps the base paw print');
 assert.ok(liveSvg.includes('viewBox="0 0 48 48"'), 'the live paw keeps the base tile geometry');
 // Behavioral: drive the helper through its states.
 const p = await page('index'); try {
  const w = p.w;
  const icon = () => w.document.querySelector('link[rel="icon"]').getAttribute('href');
  const touch = () => w.document.querySelector('link[rel="apple-touch-icon"]').getAttribute('href');
  const touchBase = touch();
  assert.equal(icon(), 'img/favicon.svg', 'the tab starts on the plain paw');
  const liveEv = event('900','CHI','GB','in','2026-09-26T01:00:00Z',24,17);
  liveEv.status.type.shortDetail = 'Q4 1:32';
  w.CF.syncLiveTitle(w.CF.API.gameFromEvent(liveEv));
  assert.equal(icon(), 'img/favicon-live.svg', 'a live game badges the tab icon');
  assert.equal(w.document.title, '🔴 LIVE · GB 17 @ CHI 24 · Q4 1:32 — The Cold Front', 'the live title still rides along');
  w.CF.syncLiveTitle(w.CF.API.gameFromEvent(event('901','CHI','GB','post','2026-09-26T00:30:00Z',24,17)));
  assert.equal(icon(), 'img/favicon.svg', 'a final restores the plain paw — the game is over');
  assert.ok(w.document.title.startsWith('BEARS WIN · Final ·'), 'the final keeps its title line');
  w.CF.syncLiveTitle(w.CF.API.gameFromEvent(liveEv));
  assert.equal(icon(), 'img/favicon-live.svg', 'going live again re-badges the icon');
  w.CF.syncLiveTitle(null);
  assert.equal(icon(), 'img/favicon.svg', 'no game restores the plain paw');
  w.CF.syncLiveTitle(w.CF.API.gameFromEvent(event('904','CHI','GB','pre','2026-09-28T23:15:00Z')));
  assert.equal(icon(), 'img/favicon.svg', 'a pre-game state never badges the icon');
  assert.equal(touch(), touchBase, 'the apple-touch-icon is untouched throughout');
  assert.deepEqual(p.errors, []);
 } finally { p.close(); }
 // End to end: a live board badges the home tab on its own.
 const liveBoard = async (u) => {
  if (!u.pathname.includes('/scoreboard')) return undefined;
  const ev = event('900','CHI','GB','in','2026-09-26T01:00:00Z',24,17);
  ev.status.type.shortDetail = 'Q4 1:32';
  const data = { events: [ev] };
  return { ok: true, json: async () => data, text: async () => JSON.stringify(data) };
 };
 const hp = await page('index', { fetch: liveBoard }); try {
  await settle(300);
  assert.equal(hp.w.document.querySelector('link[rel="icon"]').getAttribute('href'), 'img/favicon-live.svg', 'the home hero badges the tab while the Bears are live');
  assert.deepEqual(hp.errors, []);
 } finally { hp.close(); }
 // Cache-bust pins: common.js moves to 1.192.0 on all 11
 // pages; every other asset is byte-untouched (main.css
 // 1.191.0, home.js and games.js 1.190.0).
 const pages = ['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for (const name of pages) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('js/common.js?v=1.195.0'), name + '.html pins common.js 1.192.0');
  assert.ok(!/common\.js\?v=(?!1\.195\.0")1\.[0-9]+\.0"/.test(html), name + '.html has no stale common.js key');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html keeps main.css 1.191.0');
  assert.ok(html.includes('href="img/favicon.svg"'), name + '.html still declares the plain paw as its icon');
 }
 const idxHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idxHtml.includes('js/home.js?v=1.195.0'), 'index.html keeps home.js 1.190.0');
 const gamesHtml = fs.readFileSync(path.join(__dirname, '../games.html'), 'utf8');
 assert.ok(gamesHtml.includes('js/games.js?v=1.193.0'), 'games.html keeps games.js 1.190.0');
 // Footer branding untouched by this release.
 assert.ok(idxHtml.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idxHtml.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.193.0: the board\'s no-games day offers the next Bears game — one tap to that board, and aria-busy finally clears', async () => {
 // Four-plus days a week have no NFL games, and the games
 // board's empty state for those days named the problem and
 // offered nothing: reaching the Bears' next game took four
 // taps on day-next (or a date-picker hunt), though the
 // Sunday desk on the same page already resolves that game.
 // The empty state now carries a one-tap jump button to the
 // next Bears game's board, painted either by the board (desk
 // resolved first) or by the desk (board painted first), and
 // the branch clears aria-busy like its sibling branches —
 // a game-free day used to leave the board announced as
 // loading forever.
 const games = fs.readFileSync(path.join(__dirname, '../js/games.js'), 'utf8');
 assert.ok(games.includes('const jumpHTML = (viewedDay) =>'), 'games.js owns the jump button builder');
 assert.ok(games.includes('data-cf-jump-next'), 'the jump is a real button in the empty state');
 assert.ok(games.includes('class="board-jump-host"'), 'the empty state carries a host the desk can paint into');
 assert.ok(games.includes('nextGame = g || null;'), 'the Sunday desk shares its resolved game with the board');
 assert.ok(games.includes('paintBoardJump();'), 'the desk repaints the jump when it resolves after the board');
 assert.ok(games.includes('target === viewedDay'), 'no jump is offered to the day already on screen');
 // The no-games branch clears aria-busy, in branch order.
 const emptyBranch = games.slice(games.indexOf('if (!events.length)'), games.indexOf('// Bears game first.'));
 assert.ok(emptyBranch.includes('CF.emptyHTML({'), 'the no-games state takes the shared empty-state shape');
 assert.ok(emptyBranch.includes('box.setAttribute("aria-busy", "false");'), 'the no-games branch clears aria-busy');
 assert.ok(emptyBranch.includes('jumpHTML(selectedDay)'), 'the board paints the jump when the desk resolved first');
 // Behavioral: the fixture week is a Saturday (2026-09-26
 // 03:00Z) whose Chicago "today" (Sep 25) scoreboard is
 // empty and whose next Bears game is PHI hosting CHI on Mon
 // Sep 28 — the default board paints the dead end, then
 // the desk's resolution must land the jump in it.
 const p = await page('games'); try {
  const w = p.w, d = w.document;
  await settle(300);
  const board = d.querySelector('#board');
  assert.equal(board.getAttribute('aria-busy'), 'false', 'the game-free board is not announced as loading');
  assert.ok(board.textContent.includes('No NFL games scheduled for this date'), 'the no-games title still reads plain');
  const btn = board.querySelector('[data-cf-jump-next]');
  assert.ok(btn, 'the empty state offers the next Bears game');
  assert.ok(btn.textContent.includes('Bears at PHI'), 'the jump names the matchup: ' + btn.textContent);
  assert.ok(btn.textContent.includes('Sep 28'), 'the jump names the day: ' + btn.textContent);
  btn.click();
  await settle(300);
  assert.equal(d.querySelector('#day-pick').value, '2026-09-28', 'one tap lands the date picker on the Bears game day');
  assert.ok(d.querySelector('#board').textContent.includes('Philadelphia Eagles'), 'the board now shows the Bears game');
  assert.ok(!d.querySelector('#board [data-cf-jump-next]'), 'a board with games carries no jump');
  assert.deepEqual(p.errors, []);
 } finally { p.close(); }
 // No next game on the schedule: the empty state stays a
 // plain dead end — no button promising a game that is not
 // there — but aria-busy still clears.
 const noNext = async (u) => {
  if (u.pathname.includes('/schedule')) { const data = { season: { displayName: '2026', type: 2 }, events: [event('100','CHI','MIN','post','2026-09-20T17:00:00Z',24,17)] }; return { ok: true, json: async () => data, text: async () => JSON.stringify(data) }; }
  if (u.pathname.includes('/scoreboard')) { const data = { events: [] }; return { ok: true, json: async () => data, text: async () => JSON.stringify(data) }; }
  return undefined;
 };
 const q = await page('games', { fetch: noNext }); try {
  await settle(300);
  const board = q.w.document.querySelector('#board');
  assert.ok(board.textContent.includes('No NFL games scheduled for this date'), 'the no-games state still paints');
  assert.ok(!board.querySelector('[data-cf-jump-next]'), 'no next game, no jump button');
  assert.equal(board.getAttribute('aria-busy'), 'false', 'aria-busy clears with no next game too');
  assert.deepEqual(q.errors, []);
 } finally { q.close(); }
 // Cache-bust pins: games.js moves to 1.193.0 on
 // games.html; every other asset is byte-untouched
 // (common.js 1.192.0, main.css 1.191.0, home.js 1.190.0).
 const gamesHtml = fs.readFileSync(path.join(__dirname, '../games.html'), 'utf8');
 assert.ok(gamesHtml.includes('js/games.js?v=1.193.0'), 'games.html pins games.js 1.193.0');
 assert.ok(!/games\.js\?v=(?!1\.193\.0")1\.[0-9]+\.0"/.test(gamesHtml), 'games.html has no stale games.js key');
 assert.ok(gamesHtml.includes('js/common.js?v=1.195.0'), 'games.html keeps common.js 1.192.0');
 assert.ok(gamesHtml.includes('css/main.css?v=1.191.0'), 'games.html keeps main.css 1.191.0');
 const idxHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idxHtml.includes('js/home.js?v=1.195.0'), 'index.html keeps home.js 1.190.0');
 // Footer branding untouched by this release.
 assert.ok(idxHtml.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idxHtml.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.194.0: the next game joins your calendar — the hero offers a real .ics for a real kickoff, and nothing otherwise', async () => {
 // Every surface resolved the next Bears game and counted
 // down to it, but nothing let a fan put kickoff where their
 // week actually lives — their calendar. The hero match
 // footer's new "Add to calendar" link downloads an RFC 5545
 // .ics built by common.js from the resolved game, and it only
 // exists while there is a future kickoff worth saving: a
 // pre-game whose kickoff time the feed actually confirms.
 const common = fs.readFileSync(path.join(__dirname, '../js/common.js'), 'utf8');
 assert.ok(common.includes('CF.icsForGame = (game, now) =>'), 'common.js owns the ICS builder');
 assert.ok(common.includes('CF.calendarHref = (game) =>'), 'common.js owns the calendar href');
 assert.ok(common.includes('"DURATION:PT3H30M"'), 'the event runs a regulation 3h30m via DURATION');
 assert.ok(common.includes('data:text/calendar;charset=utf-8,'), 'the href is a downloadable calendar data URI');
 assert.ok(common.includes('game.timeValid === false'), 'the builder refuses flex-placeholder kickoff times');
 const home = fs.readFileSync(path.join(__dirname, '../js/home.js'), 'utf8');
 assert.ok(home.includes('game.state === "pre" ? CF.calendarHref(game) : ""'), 'home.js offers the link only before kickoff');
 assert.ok(home.includes('cal194.hidden = !calHref194;'), 'home.js hides the link when no event is offered');
 assert.ok(home.includes('CF.$("#ng-cal").hidden = true;'), 'the quiet state hides the link too');
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('<a id="ng-cal" href="#" download hidden>'), 'index.html carries the hidden calendar link in the match footer');
 assert.ok(idx.includes('<span aria-hidden="true">📅</span> Add to calendar'), 'the link reads plainly, emoji decorative');
 // The hidden guard: the ≤800px .match-footer a display rule
 // must never outrank the link's hidden state.
 const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
 const exp = strip(fs.readFileSync(path.join(__dirname, '../css/experience.css'), 'utf8'));
 assert.ok(/\.match-footer a\[hidden\]\s*\{\s*display:\s*none;\s*\}/.test(exp), 'experience.css keeps a hidden footer link hidden at every width');
 // Unit: the builder's RFC 5545 shape, escaping, and refusals.
 const p = await page('index'); try {
  const CF = p.w.CF;
  const g = { id: '200', name: 'Chicago Bears at Philadelphia Eagles', date: '2026-09-28T23:15:00Z', timeValid: true, venue: 'Soldier Field', city: 'Chicago', tv: 'ESPN' };
  const ics = CF.icsForGame(g, '2026-09-26T03:00:00Z');
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'), 'the calendar opens per RFC 5545 with CRLF lines');
  assert.ok(ics.includes('DTSTAMP:20260926T030000Z\r\n'), 'the stamp is the supplied instant in UTC basic format');
  assert.ok(ics.includes('DTSTART:20260928T231500Z\r\n'), 'kickoff is stored in UTC');
  assert.ok(ics.includes('DURATION:PT3H30M\r\n'), 'the duration rides along');
  assert.ok(ics.includes('SUMMARY:Chicago Bears at Philadelphia Eagles\r\n'), 'the summary names the matchup');
  assert.ok(ics.includes('LOCATION:Soldier Field\\, Chicago\r\n'), 'venue and city ride as the escaped location');
  assert.ok(ics.includes('TV: ESPN'), 'the TV network rides in the notes');
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'), 'the calendar closes');
  assert.ok(ics.split('\r\n').every((l) => l.length <= 75), 'no logical line exceeds 75 octets');
  assert.equal(CF.icsForGame({ ...g, timeValid: false }), '', 'a TBD kickoff plants no event');
  assert.equal(CF.icsForGame({ ...g, date: 'not a date' }), '', 'an unparseable date plants no event');
  assert.equal(CF.icsForGame(null), '', 'no game, no event');
  assert.equal(CF.calendarHref({ ...g, timeValid: false }), '', 'no event, no href');
  assert.ok(CF.calendarHref(g).startsWith('data:text/calendar;charset=utf-8,'), 'a real game yields the download href');
  assert.deepEqual(p.errors, []);
 } finally { p.close(); }
 // Behavioral: the fixture next game (Bears at PHI, Mon Sep
 // 28, ESPN) resolves pre-game, so the hero link appears,
 // named for the matchup, downloading bears-2026-09-28.ics.
 const q = await page('index'); try {
  await settle(300);
  const cal = q.w.document.querySelector('#ng-cal');
  assert.ok(cal, 'the calendar link exists in the hero');
  assert.equal(cal.hidden, false, 'a confirmed upcoming kickoff shows the link');
  assert.equal(cal.getAttribute('download'), 'bears-2026-09-28.ics', 'the download is named for the game day');
  assert.ok(cal.getAttribute('aria-label').includes('Chicago Bears at Philadelphia Eagles'), 'the accessible name names the matchup');
  const decoded = decodeURIComponent(cal.getAttribute('href').split(',')[1]);
  assert.ok(decoded.includes('DTSTART:20260928T231500Z'), 'the downloaded event is the fixture kickoff');
  assert.ok(decoded.includes('SUMMARY:Chicago Bears at Philadelphia Eagles'), 'the downloaded event names the fixture game');
  assert.deepEqual(q.errors, []);
 } finally { q.close(); }
 // No upcoming game (empty board, schedule all finals): the
 // quiet hero keeps the link hidden — no dead "#" download.
 const quiet = async (u) => {
  if (u.pathname.includes('/schedule')) { const data = { season: { displayName: '2026', type: 2 }, events: [event('100','CHI','MIN','post','2026-09-20T17:00:00Z',24,17)] }; return { ok: true, json: async () => data, text: async () => JSON.stringify(data) }; }
  if (u.pathname.includes('/scoreboard')) { const data = { events: [] }; return { ok: true, json: async () => data, text: async () => JSON.stringify(data) }; }
  return undefined;
 };
 const r = await page('index', { fetch: quiet }); try {
  await settle(300);
  assert.equal(r.w.document.querySelector('#ng-cal').hidden, true, 'the quiet state keeps the calendar link hidden');
  assert.deepEqual(r.errors, []);
 } finally { r.close(); }
 // Cache-bust pins: common.js, home.js and experience.css
 // move to 1.194.0; every other asset is byte-untouched
 // (main.css 1.191.0, games.js 1.193.0, highlights.css 1.187.0).
 const pages = ['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for (const name of pages) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('js/common.js?v=1.195.0'), name + '.html pins common.js 1.195.0');
  assert.ok(!/common\.js\?v=(?!1\.195\.0")1\.[0-9]+\.0"/.test(html), name + '.html has no stale common.js key');
  assert.ok(html.includes('css/experience.css?v=1.195.0'), name + '.html pins experience.css 1.195.0');
  assert.ok(!/experience\.css\?v=(?!1\.195\.0")1\.[0-9]+\.0"/.test(html), name + '.html has no stale experience.css key');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html keeps main.css 1.191.0');
 }
 assert.ok(idx.includes('js/home.js?v=1.195.0'), 'index.html pins home.js 1.195.0');
 assert.ok(!/home\.js\?v=(?!1\.195\.0")1\.[0-9]+\.0"/.test(idx), 'index.html has no stale home.js key');
 const gamesHtml = fs.readFileSync(path.join(__dirname, '../games.html'), 'utf8');
 assert.ok(gamesHtml.includes('js/games.js?v=1.193.0'), 'games.html keeps games.js 1.193.0');
 // Footer branding untouched by this release.
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});

test('v1.195.0: the game leaves with the fan — the hero Share button sends a factual game line via the share sheet or the clipboard, and nothing otherwise', async () => {
 // Every surface resolved the Bears game, and the tab, the
 // favicon and the calendar already carry it further — but a
 // fan who wanted to send the matchup or the score to a friend
 // still had to copy the URL and type the details. The hero
 // match footer's new Share button sends one factual line in
 // the tab title's own voice via CF.shareGame (Web Share API
 // first, clipboard fallback), and it only exists while a
 // resolved game can be described honestly.
 const common = fs.readFileSync(path.join(__dirname, '../js/common.js'), 'utf8');
 assert.ok(common.includes('CF.shareTextForGame = (game) =>'), 'common.js owns the share text');
 assert.ok(common.includes('CF.shareGame = async (game) =>'), 'common.js owns the share action');
 assert.ok(common.includes('navigator.share'), 'the Web Share API is the first path');
 assert.ok(common.includes('AbortError'), 'a dismissed share sheet reads as cancelled, not failure');
 assert.ok(common.includes('navigator.clipboard.writeText'), 'the clipboard is the fallback path');
 assert.ok(common.includes('"https://coldfronthq.com/"'), 'the shared link is the canonical site');
 const home = fs.readFileSync(path.join(__dirname, '../js/home.js'), 'utf8');
 assert.ok(home.includes('share195.hidden = !shareText195;'), 'home.js shows Share only when a share line exists');
 assert.ok(home.includes('CF.$("#ng-share").hidden = true;'), 'the quiet state hides Share too');
 assert.ok(home.includes('await CF.shareGame(shareGame195)'), 'the click sends the game the card is showing');
 const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
 assert.ok(idx.includes('<button class="text-button" id="ng-share" type="button" hidden>'), 'index.html carries the hidden Share button in the match footer');
 assert.ok(idx.includes('<span aria-hidden="true">↗</span> Share'), 'the button reads plainly, glyph decorative');
 // The hidden guard: the ≤760px .match-footer .text-button
 // display rule must never outrank the button's hidden state.
 const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
 const exp = strip(fs.readFileSync(path.join(__dirname, '../css/experience.css'), 'utf8'));
 assert.ok(/\.match-footer button\[hidden\]\s*\{\s*display:\s*none;\s*\}/.test(exp), 'experience.css keeps a hidden footer button hidden at every width');
 assert.ok(/\.match-footer a\[hidden\]\s*\{\s*display:\s*none;\s*\}/.test(exp), 'the v1.194.0 link guard survives beside it');
 // Unit: the share line's voice, and its refusals.
 const p = await page('index'); try {
  const CF = p.w.CF;
  const pre = { id: '300', name: 'Chicago Bears at Green Bay Packers', date: '2026-10-11T20:25:00Z', timeValid: true, tv: 'FOX', state: 'pre', home: { abbr: 'GB' }, away: { abbr: 'CHI' } };
  const preText = CF.shareTextForGame(pre);
  assert.ok(preText.includes('Chicago Bears at Green Bay Packers'), 'a pre-game share names the matchup');
  assert.ok(preText.includes('Sun, Oct 11'), 'a pre-game share names the day');
  assert.ok(preText.includes('FOX'), 'a pre-game share names the network');
  assert.ok(preText.endsWith('— via The Cold Front'), 'a pre-game share signs the site');
  assert.ok(CF.shareTextForGame({ ...pre, timeValid: false }).includes('Time TBD'), 'an unconfirmed kickoff shares as Time TBD, never an invented time');
  const live = { name: 'New York Jets at Chicago Bears', state: 'in', display: 'Q4 1:32', date: '2026-09-26T01:00:00Z', home: { abbr: 'CHI', score: 24 }, away: { abbr: 'NYJ', score: 17 } };
  assert.equal(CF.shareTextForGame(live), '🔴 LIVE · NYJ 17 @ CHI 24 · Q4 1:32 — The Cold Front', 'a live share carries score and clock in the tab voice');
  assert.equal(CF.shareTextForGame({ ...live, state: 'post', display: 'Final' }), 'BEARS WIN · Final · NYJ 17 @ CHI 24 — The Cold Front', 'a winning final leads with BEARS WIN');
  assert.equal(CF.shareTextForGame({ ...live, state: 'post', display: 'Final', home: { abbr: 'CHI', score: 17 }, away: { abbr: 'NYJ', score: 24 } }), 'Final · NYJ 24 @ CHI 17 — The Cold Front', 'a losing final stays plain Final');
  assert.equal(CF.shareTextForGame({ ...live, home: { abbr: 'CHI', score: '' }, away: { abbr: 'NYJ', score: '' } }), '', 'placeholder scores share nothing — no invented score');
  assert.equal(CF.shareTextForGame({ ...live, home: { abbr: 'GB', score: 24 }, away: { abbr: 'NYJ', score: 17 } }), '', 'a game without the Bears shares nothing');
  assert.equal(CF.shareTextForGame(null), '', 'no game, no share line');
  // The action's paths: unavailable, clipboard, sheet, cancel.
  assert.equal(await CF.shareGame(pre), 'unavailable', 'with neither API the share reports unavailable');
  let copied = '';
  Object.defineProperty(p.w.navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { copied = t; } } });
  assert.equal(await CF.shareGame(pre), 'copied', 'the clipboard answers where no sheet exists');
  assert.ok(copied.includes('Chicago Bears at Green Bay Packers') && copied.endsWith('https://coldfronthq.com/'), 'the clipboard carries the line plus the link');
  Object.defineProperty(p.w.navigator, 'share', { configurable: true, value: async () => {} });
  assert.equal(await CF.shareGame(pre), 'shared', 'the sheet answers where one exists');
  const abort = new Error('dismissed'); abort.name = 'AbortError';
  Object.defineProperty(p.w.navigator, 'share', { configurable: true, value: async () => { throw abort; } });
  copied = '';
  assert.equal(await CF.shareGame(pre), 'cancelled', 'a dismissed sheet is a cancellation');
  assert.equal(copied, '', 'a cancellation never falls through to the clipboard');
  assert.deepEqual(p.errors, []);
 } finally { p.close(); }
 // Behavioral: the fixture next game (Bears at PHI, Mon Sep
 // 28, ESPN) resolves pre-game, so Share appears in the hero,
 // named for the matchup — and a click with only a clipboard
 // available answers "Link copied" in the label.
 const q = await page('index'); try {
  await settle(300);
  const btn = q.w.document.querySelector('#ng-share');
  assert.ok(btn, 'the Share button exists in the hero');
  assert.equal(btn.hidden, false, 'a resolved upcoming game shows Share');
  assert.ok(btn.getAttribute('aria-label').includes('Chicago Bears at Philadelphia Eagles'), 'the accessible name names the matchup');
  let copied = '';
  Object.defineProperty(q.w.navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { copied = t; } } });
  btn.click();
  await settle(120);
  assert.ok(copied.includes('Chicago Bears at Philadelphia Eagles'), 'the click copies the fixture game line');
  assert.ok(btn.textContent.includes('Link copied'), 'the label answers the copy');
  assert.deepEqual(q.errors, []);
 } finally { q.close(); }
 // No game at all (empty board, schedule all finals): the
 // quiet hero keeps Share hidden — no dead button.
 const quiet = async (u) => {
  if (u.pathname.includes('/schedule')) { const data = { season: { displayName: '2026', type: 2 }, events: [event('100','CHI','MIN','post','2026-09-20T17:00:00Z',24,17)] }; return { ok: true, json: async () => data, text: async () => JSON.stringify(data) }; }
  if (u.pathname.includes('/scoreboard')) { const data = { events: [] }; return { ok: true, json: async () => data, text: async () => JSON.stringify(data) }; }
  return undefined;
 };
 const r = await page('index', { fetch: quiet }); try {
  await settle(300);
  assert.equal(r.w.document.querySelector('#ng-share').hidden, true, 'the quiet state keeps Share hidden');
  assert.deepEqual(r.errors, []);
 } finally { r.close(); }
 // Cache-bust pins: common.js, home.js and experience.css
 // move to 1.195.0; every other asset is byte-untouched
 // (main.css 1.191.0, games.js 1.193.0, highlights.css 1.187.0).
 const pages = ['index','odds','games','news','injuries','stats','team','highlights','practice','about','404'];
 for (const name of pages) {
  const html = fs.readFileSync(path.join(__dirname, '../' + name + '.html'), 'utf8');
  assert.ok(html.includes('js/common.js?v=1.195.0'), name + '.html pins common.js 1.195.0');
  assert.ok(!/common\.js\?v=(?!1\.195\.0")1\.[0-9]+\.0"/.test(html), name + '.html has no stale common.js key');
  assert.ok(html.includes('css/experience.css?v=1.195.0'), name + '.html pins experience.css 1.195.0');
  assert.ok(!/experience\.css\?v=(?!1\.195\.0")1\.[0-9]+\.0"/.test(html), name + '.html has no stale experience.css key');
  assert.ok(html.includes('css/main.css?v=1.191.0'), name + '.html keeps main.css 1.191.0');
 }
 assert.ok(idx.includes('js/home.js?v=1.195.0'), 'index.html pins home.js 1.195.0');
 assert.ok(!/home\.js\?v=(?!1\.195\.0")1\.[0-9]+\.0"/.test(idx), 'index.html has no stale home.js key');
 const gamesHtml = fs.readFileSync(path.join(__dirname, '../games.html'), 'utf8');
 assert.ok(gamesHtml.includes('js/games.js?v=1.193.0'), 'games.html keeps games.js 1.193.0');
 // Footer branding untouched by this release.
 assert.ok(idx.includes('data-cf-copy="btc"'), 'the BTC tip chip survives on index.html');
 assert.ok(idx.includes('@kshot9000'), 'the @kshot9000 attribution survives on index.html');
});
