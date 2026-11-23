import Site from "@/app/site";
import profile from "@/content/profile.json";
import research from "@/content/research.json";
import {withBasePaths} from "@/lib/paths";
import type {SiteData} from "@/lib/types";
export default function App({route="home",slug}:{route?:string;slug?:string}) {return <Site route={route} slug={slug} data={withBasePaths({profile,research}) as SiteData}/>;}
