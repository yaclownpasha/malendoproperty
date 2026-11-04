// Pure Node VM harness; never opens a browser or makes HTTP/collect requests.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source = fs.readFileSync(new URL('../../wp-content/themes/malendo-recovery/analytics.js', import.meta.url), 'utf8');
function page({choice='', qa=false, host='malendo-property.com', receipt=null}={}) {
  const listeners = {}, nodes = {}, scripts = [];
  for (const id of ['malendo-consent','malendo-consent-allow','malendo-consent-deny','malendo-analytics-preferences']) {
    nodes[id] = {hidden:true, addEventListener(type, fn){this[type]=fn;}, focus(){}};
  }
  nodes['malendo-analytics-config'] = {textContent: JSON.stringify({measurementId:'G-D99Y7TY0LC',qa,locale:'en',receipt})};
  const document = {cookie:choice?`malendo_analytics_choice=${choice}`:'', referrer:'https://example.invalid/ref?private=value#secret',
    getElementById(id){return nodes[id];}, createElement(){return {};}, head:{appendChild(node){scripts.push(node);}},
    addEventListener(type,fn){listeners[type]=fn;}};
  const window = {};
  vm.runInNewContext(source, {document,window,location:{hostname:host,origin:`https://${host}`,pathname:'/contact/',search:'?client=private',hash:'#secret'}}, {timeout:1000});
  return {nodes, scripts, window, listeners, events:()=>Array.from(window.dataLayer||[], args=>Array.from(args)).filter(a=>a[0]==='event')};
}
const results = {};
function test(name, fn){try{fn();results[name]='PASS';}catch(e){results[name]=`FAIL: ${e.message}`;}}
for (const options of [{},{choice:'deny'},{choice:'allow',qa:true},{choice:'allow',host:'example.invalid'}]) {
  test(`no_tag_${JSON.stringify(options)}`,()=>{const p=page(options);assert.equal(p.scripts.length,0);assert.equal(p.events().length,0);});
}
test('allow_one_tag_and_page_view',()=>{const p=page({choice:'allow'});assert.equal(p.scripts.length,1);assert.equal(p.events().filter(x=>x[1]==='page_view').length,1);p.nodes['malendo-consent-allow'].click();assert.equal(p.scripts.length,1);assert.equal(p.events().length,1);});
test('saved_receipt_once_even_repeated_allow',()=>{const p=page({choice:'allow',receipt:{service:'rental',locale:'en'}});p.nodes['malendo-consent-allow'].click();assert.equal(p.events().filter(x=>x[1]==='malendo_enquiry_saved').length,1);});
test('no_receipt_no_conversion',()=>{const p=page({choice:'allow'});assert.equal(p.events().filter(x=>x[1]==='malendo_enquiry_saved').length,0);});
test('query_hash_referrer_pii_removed',()=>{const p=page({choice:'allow',receipt:{service:'rental',locale:'en'}});const all=JSON.stringify(p.window.dataLayer);assert.ok(!all.includes('private')&&!all.includes('secret'));assert.ok(all.includes('https://malendo-property.com/contact/'));});
test('deny_then_allow_and_withdraw',()=>{const p=page({choice:'deny'});assert.equal(p.scripts.length,0);p.nodes['malendo-consent-allow'].click();assert.equal(p.scripts.length,1);p.nodes['malendo-consent-deny'].click();assert.equal(p.window['ga-disable-G-D99Y7TY0LC'],true);});
test('form_start_deduplicated_and_contacts_whitelisted',()=>{const p=page({choice:'allow'});p.listeners.focusin({target:{closest:()=>true}});p.listeners.focusin({target:{closest:()=>true}});assert.equal(p.events().filter(x=>x[1]==='malendo_form_start').length,1);p.listeners.click({target:{closest:()=>({href:'mailto:public@example.invalid'})}});assert.equal(p.events().filter(x=>x[1]==='malendo_contact_click').length,1);assert.ok(!JSON.stringify(p.window.dataLayer).includes('public@example.invalid'));});
console.log(JSON.stringify({runtime:process.version,tests:results,passed:Object.values(results).filter(x=>x==='PASS').length,total:Object.keys(results).length,network_requests:0},null,2));
process.exitCode=Object.values(results).every(x=>x==='PASS')?0:1;
