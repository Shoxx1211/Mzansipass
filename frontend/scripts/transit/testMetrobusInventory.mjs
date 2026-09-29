import assert from 'node:assert/strict';
import { decodeHtml, parseOfficialMetrobusInventory } from './ingestMetrobusInventory.mjs';

const html = `<!DOCTYPE html><html><head><title>Metro Bus - City of Johannesburg</title></head><body>
<h1>Metro Bus - City of Johannesburg</h1><table>
<thead><tr><th>ROUTE NUMBER</th><th>ROUTE</th><th>VIA</th><th>DISTANCE</th></tr></thead>
<tbody>
<tr><td>42</td><td>Braamfontein to Elands Park</td><td>Elands Park</td><td>12,2 KMs - 15 minutes.</td></tr>
<tr><td>45</td><td>Braamfontein to Marist Brothers via Linmeyer</td><td>Marist Brothers</td><td>12,2 KMs - 18 minutes.</td></tr>
<tr><td>421D</td><td>Bellevue East to Sunninghill</td><td>Sunninghill</td><td>21,4 KMs - 27 minutes.</td></tr>
<tr><td>91A</td><td>Kliptown To Denver</td><td></td><td>43 KMs - 8,38 minutes.</td></tr>
</tbody></table><table><tr><td>90</td><td>Not route content</td><td>Footer</td><td>2 KMs</td></tr></table>
</body></html>`;

assert.equal(decodeHtml('A &amp; B &nbsp; &#x27;'), "A & B   '");
const parsed = parseOfficialMetrobusInventory(html, { minRows: 4 });
assert.equal(parsed.routes.length, 4, 'must ignore footer table');
assert.deepEqual(parsed.routes.map((r) => r.routeNumber), ['42', '45', '421D', '91A']);
assert.equal(parsed.routes[0].publishedDistanceKm, 12.2);
assert.equal(parsed.routes[0].publishedMinutesText, '15 minutes');
assert.equal(parsed.routes[3].publishedMinutesText, '8,38 minutes');
assert.equal(parsed.routes[3].operatingStatus, 'unverified');
assert.equal(parsed.quality.publishedTimeWarnings.length, 1);
assert.equal(parsed.quality.passengerRoutingEnabled, false);
assert.throws(() => parseOfficialMetrobusInventory(html.replace('91A', '42'), { minRows: 4 }), /Duplicate route numbers/);
assert.throws(() => parseOfficialMetrobusInventory('<html>broken</html>'), /unexpectedly small/);
console.log('PASS: 11 Metrobus inventory parser/QA assertions');
