// usage: node grid.mjs out.png a b c ...   (prefix e: for expressions). 4 columns at half size.
import { chromium } from '/home/manas/Documents/vortexa/whiteboard/node_modules/playwright-core/index.mjs'
const [out, ...names] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] })
const p = await b.newPage({ viewport: { width: 1344, height: 408 * Math.ceil(names.length / 3) } })
const errs = []; p.on('pageerror', (e) => errs.push(String(e)))
const tiles = []
for (const k of names) {
	await p.goto('file:///home/manas/Documents/vortexa/pixel-tutor/pip.html?' + (k.startsWith('e:') ? 'expr=' + k.slice(2) : 'pose=' + encodeURIComponent(k)) + (process.env.CHAR ? '&char=' + process.env.CHAR : ''))
	await p.waitForTimeout(700)
	tiles.push([k, await p.evaluate(() => document.getElementById('cv').toDataURL())])
}
await p.setContent(`<body style="margin:0;background:#0d0f14;display:grid;grid-template-columns:repeat(3,448px);font:600 13px system-ui;color:#8b93a7">${tiles.map(([k, t]) => `<div style="position:relative"><img src="${t}" width="448" height="408" style="image-rendering:pixelated;display:block"><span style="position:absolute;left:8px;top:6px">${k}</span></div>`).join('')}</body>`)
await p.screenshot({ path: out }); console.log('errors', errs); await b.close()
