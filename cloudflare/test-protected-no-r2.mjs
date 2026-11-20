// Pruebas offline de la ruta de carga de fotos con R2 eliminado.
// No autentica personas ni modifica D1: el actor admin es una simulación local.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source=await readFile(new URL("./protected-routes.js", import.meta.url),"utf8");
assert.equal((source.match(/^import \{[^}]+\} from "[^"]+";/gm)||[]).length,1);
const pure=source.replace(/^import \{[^}]+\} from "[^"]+";\r?\n/gm,"");
const stub=String.raw