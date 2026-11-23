'use client';

import {useState} from 'react';
import type {ResearchFigure} from '@/lib/types';
import rawFigures from '@/content/figures.json';

type Project = {
  id:string; name:string; kind?:string; description:string; features?:string[];
  url?:string; links?:{label:string;url:string}[]; install?:string; paperId?:string;
  figureId?:string; example?:Record<string,any>; packageName?:string;
  packageDescription?:string; collaborators?:string[]; images?:Record<string,any>;
  collection?:{places:number;games:number;depictions:number};affiliation?:string;
};
type Props = {profile:Record<string,any>;open:(figure:ResearchFigure)=>void};
const projects=(profile:Record<string,any>)=>(profile.software||[]) as Project[];

function InstallCommand({command}:{command:string}){
  const [copied,setCopied]=useState(false);
  async function copy(){
    try{await navigator.clipboard.writeText(command);setCopied(true);setTimeout(()=>setCopied(false),2200);}catch{setCopied(false);}
  }
  return <div className="install-command"><code>{command}</code><button onClick={copy} aria-label={copied?'Installation command copied':'Copy installation command'}>{copied?'Copied':'Copy'}</button></div>;
}

function ProjectExample({project,open}:{project:Project;open:Props['open']}){
  const example=project.example;
  const figure:ResearchFigure|undefined=example?{
    id:`${project.id}-example`,paperId:project.paperId||project.id,
    title:example.title,caption:example.caption,alt:example.alt,src:example.src,
    width:example.width,height:example.height,figure:'Repository example',
    paperUrl:example.sourceUrl,credit:example.credit,sourceLabel:'View repository example',
  }:(rawFigures as ResearchFigure[]).find(f=>f.id===project.figureId);
  if(!figure)return null;
  return <figure className={`software-example ${figure.width<600?'small-example':''}`}>
    <button className="software-example-image" onClick={()=>open(figure)} aria-label={`Enlarge ${project.name} example`}>
      <img src={figure.src} alt={figure.alt} width={figure.width} height={figure.height} loading="lazy" decoding="async"/>
      <span>Enlarge</span>
    </button>
    <figcaption><strong>{figure.title}</strong><p>{figure.caption}</p>
      <a href={figure.paperUrl} target="_blank" rel="noreferrer">{example?'Repository example':'Source paper'}</a>
      {figure.credit&&<small>{figure.credit}{figure.licenseUrl&&<> · <a href={figure.licenseUrl} target="_blank" rel="noreferrer">License</a></>}</small>}
    </figcaption>
  </figure>;
}

export function PlayablePastFeature({profile,compact=false}:{profile:Props['profile'];compact?:boolean}){
  const project=projects(profile).find(p=>p.id==='software-playable-past');
  if(!project?.images)return null;
  const images=project.images;
  const collection=project.collection;
  const collaborators=project.collaborators?.filter(name=>name!==profile.name).join(' and ');
  const Heading=compact?'h3':'h2';
  return <section className={`playable-past-feature ${compact?'compact':''}`} aria-labelledby={compact?'home-playable-past':'software-playable-past'}>
    <div className="heritage-visual">
      <a className="heritage-images" href={images.placeUrl} target="_blank" rel="noreferrer" aria-label="Compare Notre-Dame photographs and game depictions in Playable Past">
        <figure><img src={images.photo} width={images.photoWidth} height={images.photoHeight} alt="Photograph of Notre-Dame de Paris" loading="lazy" decoding="async"/><figcaption>Photograph</figcaption></figure>
        <figure><img src={images.game} width={images.gameWidth} height={images.gameHeight} alt="Notre-Dame de Paris depicted in Assassin’s Creed Unity" loading="lazy" decoding="async"/><figcaption>In-game depiction</figcaption></figure>
      </a>
      <p className="heritage-credit"><a href={images.photoSource} target="_blank" rel="noreferrer">Photograph: {images.photoCredit}</a> · <a href={images.photoLicense} target="_blank" rel="noreferrer">License</a><br/><a href={images.gameSource} target="_blank" rel="noreferrer">{images.gameCredit}</a></p>
    </div>
    <div className="heritage-copy"><span className="eyebrow">Digital heritage</span><Heading id={compact?'home-playable-past':'software-playable-past'}>Playable Past</Heading>
      <p>{project.description}</p>{collection&&<p className="heritage-collection">The collection links {collection.places.toLocaleString('en-US')} places across {collection.games.toLocaleString('en-US')} games, with {collection.depictions.toLocaleString('en-US')} in-game depictions and their source records.</p>}
      <a className="button button-green" href={project.url||'https://playablepast.com/'} target="_blank" rel="noreferrer">Explore PlayablePast.com</a>
      {!compact&&<><p className="heritage-collaboration">Created with {collaborators} at the {project.affiliation}. The catalog includes automatically matched records, with sources attached for inspection.</p>
        <div className="heritage-package"><h3>{project.packageName}</h3><p>{project.packageDescription}</p>{project.install&&<InstallCommand command={project.install}/>}<div className="software-links"><a href="https://github.com/cantayus/gameheritage" target="_blank" rel="noreferrer">Python package</a><a href="https://github.com/cantayus/video-game-digital-heritage" target="_blank" rel="noreferrer">Explorer source</a><a href="/research/playable-past">Related research</a></div></div>
      </>}
    </div>
  </section>;
}

export function HomeSoftwareSection({profile}:{profile:Props['profile']}){
  const featured=projects(profile).filter(p=>['software-whospoke','software-lumos','software-devise'].includes(p.id));
  return <section className="section page-width home-software"><div className="section-heading"><div><h2>Research software</h2></div><div className="section-heading-side"><p>Python tools for visual data, speech, video, and the web.</p><a className="text-link" href="/software">All software</a></div></div>
    <div className="home-software-index">{featured.map(project=><article key={project.id}><h3><a href={`/software#${project.id}`}>{project.name}</a></h3><p>{project.description}</p></article>)}</div>
    <PlayablePastFeature profile={profile} compact/>
  </section>;
}

export function SoftwarePage({profile,open}:Props){
  const packages=projects(profile).filter(p=>p.id!=='software-playable-past');
  return <main id="main-content" className="page-width software-page"><div className="page-heading"><h1>Research software</h1><p>{profile.writing?.softwareIntro}</p></div>
    <PlayablePastFeature profile={profile}/>
    <section className="software-catalog" aria-labelledby="python-tools"><div className="section-heading"><div><h2 id="python-tools">Python tools</h2></div></div>
      <nav className="software-jump-links" aria-label="Software projects">{packages.map(p=><a key={p.id} href={`#${p.id}`}>{p.name}</a>)}</nav>
      <div className="software-catalog-grid">{packages.map(project=><article className="software-entry" id={project.id} key={project.id}>
        <span className="eyebrow">{project.kind}</span><h3>{project.name}</h3><p className="software-description">{project.description}</p>
        {!!project.features?.length&&<ul>{project.features.map(f=><li key={f}>{f}</li>)}</ul>}
        {project.install&&<InstallCommand command={project.install}/>}
        <div className="software-links">{project.links?.map(link=><a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label}</a>)}{project.paperId&&<a href={`/research/${project.paperId}`}>Related research</a>}</div>
        <ProjectExample project={project} open={open}/>
      </article>)}</div>
    </section>
  </main>;
}
