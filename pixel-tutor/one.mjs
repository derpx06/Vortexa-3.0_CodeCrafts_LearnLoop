import { chromium } from '/home/manas/Documents/vortexa/whiteboard/node_modules/playwright-core/index.mjs'
const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] })
const p = await b.newPage({ viewport: { width: 1344, height: 820 } })
const errs = []; p.on('pageerror', (e) => errs.push(String(e)))
const tiles = []
for (const k of ['idle', 'nod', 'sleep']) { await p.goto('file:///home/manas/Documents/vortexa/pixel-tutor/pip.html?pose=' + k); await p.waitForTimeout(800); tiles.push(await p.evaluate(() => document.getElementById('cv').toDataURL())) }
// motion check: switch idle -> point and capture the in-between frames
await p.goto('file:///home/manas/Documents/vortexa/pixel-tutor/pip.html?pose=idle'); await p.waitForTimeout(600)
await p.evaluate(() => pip.act('point')); const seq = []
for (let i = 0; i < 3; i++) { await p.waitForTimeout(110); seq.push(await p.evaluate(() => document.getElementById('cv').toDataURL())) }
await p.setContent(`<body style="margin:0;background:#0d0f14;display:grid;grid-template-columns:repeat(3,448px)">${[...tiles, ...seq].map((t) => `<img src="${t}" width="448" height="408" style="image-rendering:pixelated">`).join('')}</body>`)
await p.screenshot({ path: 'one.png' }); console.log('errors', errs); await b.close()
