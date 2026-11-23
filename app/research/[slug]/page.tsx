import type {Metadata} from "next";
import {notFound,permanentRedirect} from "next/navigation";
import {getLiveContent} from "@/lib/live-content";
import Site from "@/app/site";
import type {SiteData} from "@/lib/types";
export const dynamic="force-dynamic";
type Props={params:Promise<{slug:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{const{slug}=await params;const{research}=await getLiveContent();const p=research.find(x=>x.id===slug||(Array.isArray(x.legacyIds)&&x.legacyIds.includes(slug)));return p?{title:p.title,description:p.summary,openGraph:{title:p.title,description:p.summary,type:"article"}}:{title:"Research not found"}}
export default async function Page({params}:Props){const{slug}=await params;const data=await getLiveContent();const p=data.research.find(x=>x.id===slug);if(!p){const current=data.research.find(x=>Array.isArray(x.legacyIds)&&x.legacyIds.includes(slug));if(current)permanentRedirect(`/research/${current.id}`);notFound();}const json={"@context":"https://schema.org","@type":p.status==="Published"?"ScholarlyArticle":"CreativeWork",name:p.title,author:p.authors.map(name=>({"@type":"Person",name})),description:p.summary,...(p.year?{datePublished:String(p.year)}:{})};return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(json).replace(/</g,"\u003c")}}/><Site route="research" slug={slug} data={data as SiteData}/></>}
