import Site from "./site";
import {getLiveContent} from "@/lib/live-content";
import type {SiteData} from "@/lib/types";
export async function RouteShell({route="home",slug}:{route?:string;slug?:string}){const content=await getLiveContent();return <Site route={route} slug={slug} data={content as SiteData}/>}
