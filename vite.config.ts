import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {fileURLToPath} from "node:url";
const path=process.env.SITE_BASE_PATH||"/";
const base=`/${path.split("/").filter(Boolean).join("/")}${path.split("/").filter(Boolean).length?"/":""}`;
export default defineConfig({base,plugins:[react()],resolve:{alias:{"@":fileURLToPath(new URL(".",import.meta.url))}},build:{outDir:"dist",emptyOutDir:true},server:{hmr:false,watch:{useFsEvents:false,usePolling:true}}});
