import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const base=process.env.VERIFY_SITE_URL||'http://127.0.0.1:5173';
const research=JSON.parse(await fs.readFile('content/research.json','utf8'));
const figures=JSON.parse(await fs.readFile('content/figures.json','utf8'));
const profile=JSON.parse(await fs.readFile('content/profile.json','utf8'));
const routes=['/','/research','/games','/teaching','/about','/cv','/research-with-me','/privacy',...research.map(p=>`/research/${p.id}`)];
const results=[];const failures=[];const ids=new Set();
for(const p of research){if(ids.has(p.id))failures.push(`Duplicate paper ID: ${p.id}`);ids.add(p.id);if(!p.title||!p.authors.length)failures.push(`Incomplete paper: ${p.id}`);}
const decode=s=>s.replace(/&amp;/g,'&').replace(/&#x27;|&#39;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
let next=0;
await Promise.all(Array.from({length:4},async()=>{while(next<routes.length){const route=routes[next++];try{const r=await fetch(base+route);const html=await r.text();const headings=[...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map(x=>decode(x[1].replace(/<[^>]+>/g,'')));const paper=research.find(p=>route===`/research/${p.id}`);if(r.status!==200)failures.push(`${route}: HTTP ${r.status}`);if(headings.length!==1)failures.push(`${route}: ${headings.length} h1 headings`);if(paper&&headings[0]!==paper.title)failures.push(`${route}: wrong paper title`);if(/Starter Project|lorem ipsum|TODO:|>\s*PLACEHOLDER[<\s]/i.test(html))failures.push(`${route}: placeholder content`);results.push({route,status:r.status,title:headings[0]});}catch(e){failures.push(`${route}: ${e.message}`)}}}));
const assets=new Set([...figures.map(f=>f.src),...research.flatMap(p=>p.links.filter(l=>l.url.startsWith('/papers/')).map(l=>l.url.split('#')[0])),profile.headshot.src,...profile.games.map(g=>g.image),'/papers/cantay-caliskan-cv.pdf','/fonts/newsreader-regular.ttf','/fonts/newsreader-italic.ttf','/fonts/dm-sans-regular.ttf','/fonts/dm-sans-medium.ttf']);
for(const path of assets){try{const data=await fs.readFile('public'+path);if(!data.byteLength)failures.push(`Empty asset: ${path}`);}catch{failures.push(`Missing asset: ${path}`)}}
for(const figure of figures){if(!ids.has(figure.paperId))failures.push(`Figure missing paper: ${figure.id}`)}
const config=await(await fetch(base+'/api/site-config')).json();if(config.measurementId!==null&&!/^G-[A-Z0-9]+$/.test(config.measurementId))failures.push('Invalid Analytics configuration');
const unauth=await fetch(base+'/api/content',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(unauth.status!==401&&unauth.status!==503)failures.push(`Unprotected writer: ${unauth.status}`);
const source=await fetch(base+'/api/resume-source');let sourceReport={status:source.status};if(source.ok){const bytes=Buffer.from(await source.arrayBuffer());const hash=crypto.createHash('sha256').update(bytes).digest('hex');sourceReport={status:source.status,validPdf:bytes.subarray(0,5).toString()==='%PDF-',checksumMatchesHeader:hash===source.headers.get('x-resume-sha256')};if(!sourceReport.validPdf||!sourceReport.checksumMatchesHeader)failures.push('Invalid canonical Drive PDF');}
const report={checkedAt:new Date().toISOString(),base,routes:results.sort((a,b)=>a.route.localeCompare(b.route)),catalogEntries:research.length,ssrnEntries:research.filter(p=>p.ssrnListingVerified).length,fullTextsReviewed:research.filter(p=>p.fullTextReviewed).length,figureCount:figures.length,assetCount:assets.size,analyticsConfigured:Boolean(config.measurementId),writerUnauthorizedStatus:unauth.status,driveSource:sourceReport,failures};
await fs.mkdir('docs/verification',{recursive:true});await fs.writeFile('docs/verification/routes.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({routes:results.length,entries:research.length,assets:assets.size,figures:figures.length,failures,driveSource:sourceReport},null,2));if(failures.length)process.exitCode=1;
