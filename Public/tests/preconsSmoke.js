const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

(async () => {
  const url = process.argv[2] || 'http://localhost:8080/index.html';
  const outDir = path.resolve(__dirname);
  const resultsPath = path.join(outDir, 'precons-smoke-results.json');
  const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  const logs = [];
  page.on('console', m => logs.push({type: m.type(), text: m.text()}));
  try {
    await page.goto(url, {waitUntil: 'networkidle2', timeout: 30000});
    // Ensure PRECONS_CONFIG can be set before module loads
    await page.evaluate(() => { window.PRECONS_CONFIG = window.PRECONS_CONFIG || { mode: 'auto', mtgjsonUrl: null }; });
    // Click Precons nav to load the module
    await page.waitForSelector('#nav-precons', {timeout: 5000});
    await page.click('#nav-precons');
    // Wait for either content or no-message
    await page.waitForFunction(() => {
      const c = document.getElementById('precons-content');
      const nm = document.getElementById('no-precons-msg');
      if (!c || !nm) return false;
      return c.children.length > 0 || !nm.classList.contains('hidden');
    }, { timeout: 10000 });

    // Clear cache and ensure refresh populates cache key
    const key = `preconsIndex_v1_${(await page.evaluate(() => window.__app_id || 'default'))}`;
    await page.evaluate(k => localStorage.removeItem(k), key);
    // Force a refresh via the refresh button
    await page.click('#refresh-precons-btn');
    // Wait for cache to appear
    await page.waitForFunction(k => !!localStorage.getItem(k), { timeout: 10000 }, key);
    const cached = await page.evaluate(k => {
      try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; }
    }, key);

    const cacheTs = cached && cached.fetchedAt ? new Date(cached.fetchedAt).toISOString() : null;
    const hasItems = await page.evaluate(() => {
      const c = document.getElementById('precons-content');
      return !!(c && c.children && c.children.length > 0);
    });

    const cacheUi = await page.evaluate(() => {
      const el = document.getElementById('precons-cache-ts');
      return el ? el.textContent || '' : '';
    });

    const results = { url, ok: true, hasItems, cacheTs, cacheUi, logs };
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log('PRECONS_SMOKE_OK', JSON.stringify(results));
  } catch (err) {
    const res = { url, ok: false, error: err && err.message, logs };
    fs.writeFileSync(resultsPath, JSON.stringify(res, null, 2));
    console.error('PRECONS_SMOKE_ERROR', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
