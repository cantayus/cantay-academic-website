import {env} from "cloudflare:workers";
export const dynamic="force-dynamic";
export function GET(){const raw=(env as Cloudflare.Env & {GA4_MEASUREMENT_ID?:string}).GA4_MEASUREMENT_ID||"";return Response.json({measurementId:/^G-[A-Z0-9]+$/.test(raw)?raw:null},{headers:{"Cache-Control":"no-store"}})}
