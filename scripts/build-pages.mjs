import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'vite';
import {pathToFileURL} from 'node:url';

const base='/' + (process.env.SITE_BASE_PATH||'/').split('/').filter(Boolean).join('/') + '/';
const basePath=base==='//'?'/':base;
const canonicalOrigin=new URL(process.env.SITE_ORIGIN||'https://www.cantaycaliskan.net');
canonicalOrigin.protocol='https:';
const origin=canonicalOrigin.origin;
const siteUrl=new URL(basePath,origin).href;
const research=JSON.parse(await fs.readFile('content/research.json','utf8'));
const description='Cantay Caliskan studies politics, places, and human behavior using AI, computer vision, and network analysis. Research, teaching, software, and educational games.';
const names={home:'Cantay Caliskan',research:'Research',software:'Software',games:'Games',teaching:'Teaching',about:'About',cv:'Curriculum vitae','research-with-me':'Research opportunities',privacy:'Privacy & analytics'};
const routes=Object.entries(names).map(([route,title])=>({route,title,url:route==='home'?'':`${route}/`}));
for(const paper of research)routes.push({route:'research',slug:paper.id,title:paper.title,url:`research/${paper.id}/`,description:paper.summary,paper});
const escape=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const json=s=>JSON.stringify(s).replace(/</g,'\\u003c');
await build();
const template=await fs.readFile('dist/index.html','utf8');
await build({build:{ssr:'src/render.tsx',outDir:'.prerender',emptyOutDir:true}});
{
 const {render}=await import(pathToFileURL(path.resolve('.prerender/render.js')).href);
 async function page(entry,{noindex=false}={}){
   const title=entry.route==='home'?entry.title:`${entry.title} | Cantay Caliskan`;
   const url=new URL(entry.url,siteUrl).href;
   const desc=entry.description||description;
   const graph=entry.paper?{'@context':'https://schema.org','@type':entry.paper.status==='Published'?'ScholarlyArticle':'CreativeWork',name:entry.paper.title,author:entry.paper.authors.map(name=>({'@type':'Person',name})),description:desc,...(entry.paper.year?{datePublished:String(entry.paper.year)}:{})}:{'@context':'https://schema.org','@type':'Person',name:'Cantay Caliskan',url:siteUrl};
   const head=`<meta name="description" content="${escape(desc)}"/><link rel="canonical" href="${escape(url)}"/><meta name="robots" content="${noindex?'noindex,follow':'index,follow'}"/><meta property="og:title" content="${escape(title)}"/><meta property="og:description" content="${escape(desc)}"/><meta property="og:url" content="${escape(url)}"/><meta property="og:type" content="${entry.paper?'article':'website'}"/><meta property="og:image" content="${escape(new URL(basePath+'people/cantay-portrait.png',origin).href)}"/><meta name="twitter:card" content="summary_large_image"/><script type="application/ld+json">${json(graph)}</script>`;
   return template.replace('<title>Cantay Caliskan</title>',`<title>${escape(title)}</title>`).replace('<!--page-head-->',head).replace('data-route="home" data-slug=""',`data-route="${escape(entry.route)}" data-slug="${escape(entry.slug||'')}"`).replace('<!--app-html-->',render(entry.route,entry.slug));
 }
 for(const entry of routes){const file=path.join('dist',entry.url,'index.html');await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,await page(entry));}
 const aliases=[];
 for(const p of research)for(const old of p.legacyIds||[]){const target=new URL(`research/${p.id}/`,siteUrl).href;const file=`dist/research/${old}/index.html`;await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,`<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>${escape(p.title)} | Cantay Caliskan</title><link rel="canonical" href="${escape(target)}"/><meta name="robots" content="noindex,follow"/><meta http-equiv="refresh" content="0;url=${escape(target)}"/><script>location.replace(${json(target)}+location.search+location.hash)</script></head><body><a href="${escape(target)}">${escape(p.title)}</a></body></html>`);aliases.push({from:old,to:p.id});}
 for(const [from,to] of [['book-project','research/algorithmic-emotions-book/'],['curriculum-vitae','cv/']]){const target=new URL(to,siteUrl).href;const file=`dist/${from}/index.html`;await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,`<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>Cantay Caliskan</title><link rel="canonical" href="${escape(target)}"/><meta name="robots" content="noindex,follow"/><meta http-equiv="refresh" content="0;url=${escape(target)}"/><script>location.replace(${json(target)}+location.search+location.hash)</script></head><body><a href="${escape(target)}">Continue to Cantay Caliskan’s website</a></body></html>`);aliases.push({from,to});}
 await fs.writeFile('dist/404.html',await page({route:'not-found',title:'Page not found',url:'404.html'},{noindex:true}));
 await fs.writeFile('dist/.nojekyll','');
 await fs.writeFile('dist/robots.txt',`User-agent: *\nAllow: /\nSitemap: ${siteUrl}sitemap.xml\n`);
 await fs.writeFile('dist/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(r=>`<url><loc>${escape(new URL(r.url,siteUrl).href)}</loc></url>`).join('')}</urlset>\n`);
 await fs.writeFile('dist/build-info.json',JSON.stringify({basePath,siteUrl,routes:routes.map(({url,title})=>({url,title})),aliases},null,2)+'\n');
 console.log(`Prerendered ${routes.length} pages + ${aliases.length} legacy redirects at ${siteUrl}`);
}
await fs.rm('.prerender',{recursive:true,force:true});
