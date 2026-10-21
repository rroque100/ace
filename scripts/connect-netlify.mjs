#!/usr/bin/env node
// Script para conectar GitHub con Netlify desde la CLI
// Requiere: NETLIFY_AUTH_TOKEN (https://app.netlify.com/user/applications)

import { execSync } from "child_process";

const REPO = "rafaelroque412-cell/iag";
const SITE_NAME = "ace-360";
const TOKEN = process.env.NETLIFY_AUTH_TOKEN;

if (!TOKEN) {
  console.error("ERROR: NETLIFY_AUTH_TOKEN no configurado");
  console.log("Genera uno en: https://app.netlify.com/user/applications#personal-access-tokens");
  process.exit(1);
}

async function api(path, options = {}) {
  const url = `https://api.netlify.com/api/v1${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status}: ${text}`);
  }

  return response.json();
}

async function main() {
  console.log("1. Creando sitio en Netlify...");
  const site = await api("/sites", {
    method: "POST",
    body: JSON.stringify({
      name: SITE_NAME,
      repo: {
        provider: "github",
        repo: REPO,
        branch: "main",
      },
      build_settings: {
        provider: "nextjs",
      },
    }),
  });

  console.log(`Sitio creado: ${site.name} (${site.id})`);
  console.log(`URL: ${site.ssl_url || site.url}`);
  console.log("");
  console.log("2. Configurando variables de entorno...");
  console.log("   Ve a: https://app.netlify.com/sites/" + site.name + "/configuration/env");
  console.log("   Y agrega las variables listadas en docs/DEPLOY-NETLIFY.md");
  console.log("");
  console.log("3. El deploy automatico se ejecutara en el proximo push a main");
  console.log("   O trigger manual: https://app.netlify.com/sites/" + site.name + "/deploys");
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
