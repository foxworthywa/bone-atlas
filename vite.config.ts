import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import {fileURLToPath} from 'node:url';
export default defineConfig({base:'./',build:{outDir:'docs'},plugins:[react()],resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url))}},css:{postcss:{plugins:[tailwindcss()]}},server:{watch:{usePolling:true}}});
