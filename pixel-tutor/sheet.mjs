import { chromium } from '/home/manas/Documents/vortexa/whiteboard/node_modules/playwright-core/index.mjs'
const names = process.argv.slice(2)
const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] })
const p = await b.newPage({ viewport: { width: 1344, height: 612 * Math.ceil(names.length / 2) } })
const errs = []; p.on('pageerror', (e) => errs.push(String(e)))
const tiles = []
for (const k of names) {
	await p.goto('file:///home/manas/Documents/vortexa/Vortexa-3.0_CodeCrafts_LearnLoop/pixel-tutor/pip.html?pose=' + encodeURIComponent(k) + (k === 'talk' ? '&talk=1' : '') + (k.startsWith('e:') ? '' : ''))
	await p.waitForTimeout(900)
	tiles.push(await p.evaluate(() => document.getElementById('cv').toDataURL()))
}
await p.setContent(`<body style="margin:0;background:#0d0f14;display:grid;grid-template-columns:672px 672px">${tiles.map((t) => `<img src="${t}" width="672" height="612" style="image-rendering:pixelated;display:block">`).join('')}</body>`)
await p.screenshot({ path: 'poses.png' }); console.log('errors', errs); await b.close()
