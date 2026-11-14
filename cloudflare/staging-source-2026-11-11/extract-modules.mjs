import {readFile, writeFile, mkdir, copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = JSON.parse(await readFile(path.join(here, 'modules.json'), 'utf8'));
const target = path.join(here, 'recovered-src');
await mkdir(target, {recursive: true});
let count = 0;
for (const [name, content] of Object.entries(source.modules || {})) {
  if (!/^[a-z][a-z0-9-]*\.js$/.test(name) || typeof content !== 'string') {
    throw new Error('Módulo inválido en la copia: ' + name);
  }
  await writeFile(path.join(target, name), content, 'utf8');
  count++;
}
for (const name of ['mirror-snapshot.js', 'preview-jsqr-lib.js']) {
  await copyFile(path.join(here, name), path.join(target, name));
  count++;
}
if (count !== 17) throw new Error('Se esperaban 17 módulos, hay ' + count);
console.log('Se han recuperado 17 módulos de código de staging.');
console.log('No se ha desplegado nada ni se han accedido datos personales.');
