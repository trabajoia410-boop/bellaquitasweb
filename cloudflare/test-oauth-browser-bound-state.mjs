#!/usr/bin/env node
/**
 * Verificación sintética del bloqueo OAuth login CSRF de Bellaquitas.
 * No se conecta a Google, Cloudflare ni usuarios reales.
 * Los callbacks sin cookie se rechazan ANTES de consultar D1 y de la red.
 */
import assert from 'node:assert/strict';
import {authRoute} from './auth-routes.js';
const base='https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev';
const env={
 PUBLIC_ORIGIN:base,
 GOOGLE_CLIENT_ID:'fictitious-client-id.test',
 GOOGLE_CLIENT_SECRET:'fictitious-secret',
 DB:{
  executed:[],
  prepare(sql){
   const record={sql,values:[]};
   this.executed.push(record);
   return {
    bind(...args){record.values=args;return this;},
    async run(){return {success:true};},
    async first(){return null;}
   };
  }
 }
};
const start=await authRoute(new Request(base+'/v1/auth/google/start?return=admin'),env);
assert.equal(start.status,302);
const redirect=new URL(start.headers.get('Location'));
assert.equal(redirect.origin,'https://accounts.google.com');
assert.equal(redirect.searchParams.get('redirect_uri'),base+'/v1/auth/google/callback');
const state=redirect.searchParams.get('state');
assert.match(state,/^A[A-Za-z0-9_-]{42}$/);
const setCookie=start.headers.get('Set-Cookie');
assert.match(setCookie,new RegExp('^__Host-bf_oauth='+state+'; Path=/; Max-Age=600; Secure; HttpOnly; SameSite=Lax$'));
assert.ok(env.DB.executed.some(x=>x.sql.includes('INSERT INTO auth_oauth_states')));
const callback=base+'/v1/auth/google/callback?code=fictional-test-code&state='+encodeURIComponent(state);
const preparedBefore=env.DB.executed.length;
const noCookie=await authRoute(new Request(callback),env);
assert.equal(noCookie.status,403,'state robado sin cookie no debe aceptarse');
assert.equal(env.DB.executed.length,preparedBefore,'state ajeno no consulta ni consume D1');
const wrongCookie=await authRoute(new Request(callback,{
 headers:{Cookie:'__Host-bf_oauth=A'+'x'.repeat(42)}
}),env);
assert.equal(wrongCookie.status,403,'state de otro navegador debe rechazarse');
assert.equal(env.DB.executed.length,preparedBefore,'cookie ajena no consume state');
const correctCookie=await authRoute(new Request(callback,{headers:{
 Cookie:setCookie.split(';')[0]
}}),env);
assert.equal(correctCookie.status,401,'state correcto llega a consulta pero se rechaza si no existe en D1');
assert.equal(env.DB.executed.length,preparedBefore+1,'state con cookie válida consulta D1');
assert.ok(env.DB.executed.at(-1).sql.includes('DELETE FROM auth_oauth_states'));
console.log('OK: Google OAuth con state ligado a cookie de navegador, TTL 600, SameSite=Lax, callback ajeno bloqueado sin llamadas a Google ni D1.');
