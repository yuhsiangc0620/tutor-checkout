// Download trusted root certificates from the certificate authorities themselves.
import { writeFile } from 'node:fs/promises';
const urls=['https://letsencrypt.org/certs/isrgrootx1.pem','https://pki.goog/repo/certs/gtsr1.pem','https://pki.goog/repo/certs/gtsr4.pem'];
const roots=[];
for(const url of urls){const r=await fetch(url);if(!r.ok)throw new Error(`Certificate download: ${r.status}`);const pem=await r.text();if(!pem.includes('BEGIN CERTIFICATE'))throw new Error('Invalid certificate');roots.push(pem.trim());}
await writeFile('firmware/CheckoutDevice/root_ca.h',`#pragma once\n// Trusted roots from Let's Encrypt and Google Trust Services. Never disable TLS validation.\nstatic const char ROOT_CA[] PROGMEM = R"PEM(\n${roots.join('\n')}\n)PEM";\n`);
console.log('Firmware trust roots updated.');
