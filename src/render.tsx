import {renderToString} from "react-dom/server";
import App from "./App";
export function render(route:string,slug?:string){return renderToString(<App route={route} slug={slug}/>);}
