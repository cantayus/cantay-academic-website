import {hydrateRoot} from "react-dom/client";
import App from "./App";
import "@/app/globals.css";
const root=document.getElementById("root")!;
hydrateRoot(root,<App route={root.dataset.route||"home"} slug={root.dataset.slug||undefined}/>);
