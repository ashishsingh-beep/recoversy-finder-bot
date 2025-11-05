const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const csvWriter = require('csv-write-stream');

const xp = {
  firstName: '//input[@id="first_name"]',
  lastName: '//input[@id="last_name"]',
  stateDropdown: '//select[@name="state" and @class="select_field"]',
  searchButton:
    '//*[@id="post-9"]/div/div/section[1]/div/div/div/div[6]/div/div/form/table/tbody/tr[4]/td/center/input',
};

// Enhanced selectors for better reliability
const tableSelectors = [
  'table tbody tr',
  'table.result-table tbody tr',
  'table tr',
  '.result-table tr'
];

const priceSelectors = [
  'b.pulse',
  '.pulse',
  'b:contains("₹")',
  '*:contains("Approx")'
];

// Create screenshots directory if it doesn't exist
const screenshotsDir = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Enhanced utility functions
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function takeScreenshot(page, name, reason = 'error') {
  try {
    if (page && typeof page.isClosed === 'function' && page.isClosed()) {
      console.warn(`⚠️ Skipping screenshot for ${name} — page is already closed.`);
      return null;
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}_${name}_${reason}.png`;
    const screenshotPath = path.join(screenshotsDir, filename);
    await page.screenshot({ 
      path: screenshotPath, 
      fullPage: true 
    });
    console.log(`📸 Screenshot saved: ${filename}`);
    return screenshotPath;
  } catch (e) {
    console.warn(`⚠️ Failed to take screenshot: ${e.message}`);
    return null;
  }
}

async function waitForAnySelector(page, selectors, timeout = 30000) {
  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: timeout / selectors.length });
      console.log(`✅ Found table with selector: ${selector}`);
      return selector;
    } catch (e) {
      console.log(`⏳ Trying next selector after ${selector} failed...`);
    }
  }
  throw new Error(`❌ None of the selectors found: ${selectors.join(', ')}`);
}

function extractPriceFromUrl(url) {
  try {
    // Extract ID parameter from URL
    const urlObj = new URL(url);
    const idParam = urlObj.searchParams.get('ID');
    
    if (idParam) {
      // Decode the base64 ID parameter
      const decodedData = Buffer.from(idParam, 'base64').toString('utf-8');
      console.log(`🔍 Decoded URL data: ${decodedData}`);
      
      // Parse the JSON data
      const data = JSON.parse(decodedData);
      
      // Check if recovery_values exists
      if (data.recovery_values) {
        console.log(`💰 Price found in URL: ₹${data.recovery_values}`);
        return `₹${data.recovery_values}`;
      }
    }
  } catch (e) {
    console.log(`⏳ Could not extract price from URL: ${e.message}`);
  }
  return 'N/A';
}

async function extractPriceWithRetry(newPage, fullName, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`💰 Attempt ${attempt}/${maxRetries} to get price for: ${fullName}`);
      console.log(`🔗 Page URL: ${newPage.url()}`);
      
      // Wait for page to load completely - increased timeout
      await newPage.waitForLoadState('domcontentloaded', { timeout: 15000 });
      
      // Additional wait for dynamic content
      await newPage.waitForTimeout(2000);
      
      // Try multiple price selectors with more comprehensive search
      const enhancedPriceSelectors = [
        'b.pulse',
        '.pulse', 
        'b:has-text("₹")',
        'b:has-text("Approx")',
        '*:has-text("₹")',
        'span:has-text("₹")',
        'div:has-text("Approx")',
        'td:has-text("₹")',
        'p:has-text("₹")'
      ];
      
      for (const selector of enhancedPriceSelectors) {
        try {
          await newPage.waitForSelector(selector, { timeout: 5000 });
          const elements = await newPage.$$(selector);
          
          for (const element of elements) {
            const priceText = await element.innerText();
            console.log(`🔍 Found text: "${priceText}" with selector: ${selector}`);
            
            // Extract price from text (₹18625, Approx ₹18625, etc.)
            const priceMatch = priceText.match(/₹?\s*(\d+(?:,\d+)*)/);
            if (priceMatch) {
              const price = priceMatch[1].replace(/,/g, '');
              if (price && price !== '') {
                console.log(`💰 Price extracted: ₹${price}`);
                return `₹${price}`;
              }
            }
          }
        } catch (e) {
          console.log(`⏳ Price selector '${selector}' not found, trying next...`);
        }
      }
      
      // If no price found, take screenshot for debugging
      if (attempt === maxRetries) {
        console.log(`📸 Taking screenshot for debugging - no price found`);
        await takeScreenshot(newPage, `price-not-found-${fullName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}`);
        
        // Also log page content for debugging
        const pageContent = await newPage.content();
        console.log(`📄 Page contains "₹": ${pageContent.includes('₹')}`);
        console.log(`📄 Page contains "Approx": ${pageContent.includes('Approx')}`);
      }
      
    } catch (e) {
      console.warn(`⚠️ Price extraction attempt ${attempt} failed: ${e.message}`);
      if (attempt === maxRetries) {
        await takeScreenshot(newPage, `price-error-${fullName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}`);
      }
      
      // Wait before retry
      await newPage.waitForTimeout(1000);
    }
  }
  return 'N/A';
}

// CSV setup
const outputFile = path.join(__dirname, 'output.csv');
let writer;
if (!fs.existsSync(outputFile)) {
  writer = csvWriter({ headers: ['Full Name', 'Father Name', 'Address', 'Country', 'State', 'City', 'Price'] });
  writer.pipe(fs.createWriteStream(outputFile));
} else {
  writer = csvWriter({ sendHeaders: false });
  writer.pipe(fs.createWriteStream(outputFile, { flags: 'a' }));
}

async function setupPage(page) {
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
  await page.setViewportSize({ width: 1920, height: 1080 });
}

(async () => {
  let browser;
  try {
    console.log("🚀 Starting Recoversy Finder Bot...");
    
    browser = await chromium.launch({
      headless: false,
      args: [
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--js-flags=--expose-gc'
      ]
    });
    let context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
      locale: "en-US",
    });

    const page = await context.newPage();
    await setupPage(page);

    console.log("🌐 Opening Recoversy search page...");
    await page.goto("https://search.recoversy.in/", { waitUntil: 'domcontentloaded' });

  // ---- STAGE 1: Fill Search Form ----
  await page.locator(xp.firstName).fill("kumar");
  await page.locator(xp.lastName).fill("kumar");
  await page.locator(xp.stateDropdown).selectOption({ label: "Bihar" });

  console.log("🧩 Waiting 30 seconds for you to solve CAPTCHA manually...");
  await page.waitForTimeout(30000);

  console.log("🔍 Clicking Search button...");
  const [resultsPage] = await Promise.all([
    context.waitForEvent('page').catch(() => null),
    page.locator(xp.searchButton).click({ force: true }),
  ]);

  let targetPage = resultsPage || page;
  let lastKnownURL = '';
  if (resultsPage) {
    console.log("🆕 New tab opened — waiting up to 60 seconds to load...");
    await targetPage.waitForLoadState('domcontentloaded', { timeout: 60000 });
  } else {
    console.log("🌀 No new tab — using same page for results.");
  }
  lastKnownURL = targetPage.url();

    // Utility to ensure browser/context/page are alive and recover if needed
    const ensureAlive = async () => {
      const isTargetOpen = targetPage && typeof targetPage.isClosed === 'function' && !targetPage.isClosed();
      if (browser && context && isTargetOpen) return;
      console.warn('♻️ Reinitializing browser context...');
      try { if (browser) await browser.close(); } catch {}
      browser = await chromium.launch({
        headless: true,
        args: ['--disable-gpu','--no-sandbox','--disable-dev-shm-usage','--js-flags=--expose-gc']
      });
      context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 720 },
        locale: 'en-US'
      });
      targetPage = await context.newPage();
      if (lastKnownURL) {
        await targetPage.goto(lastKnownURL, { waitUntil: 'domcontentloaded' });
      } else {
        await targetPage.goto('https://search.recoversy.in/', { waitUntil: 'domcontentloaded' });
        console.warn('⚠️ No lastKnownURL available. You may need to rerun the search manually due to CAPTCHA.');
      }
    };

    // ---- STAGE 2: Scrape Table ----
    console.log("⏳ Waiting for results table (fast mode)...");
    let foundSelector;
    try {
      await targetPage.waitForSelector('table tbody tr:nth-child(5)', { timeout: 20000 });
      console.log('✅ Found table (fast mode)');
      foundSelector = 'table tbody tr';
    } catch {
      console.log('⏳ Fast wait failed, falling back to robust detection...');
      foundSelector = await waitForAnySelector(targetPage, tableSelectors, 90000);
    }
    // Use Locator API for robustness and to avoid stale element handles
    const rowsLocator = targetPage.locator(foundSelector).filter({ has: targetPage.locator('td') });
    const totalRows = await rowsLocator.count();

    console.log(`✅ Found ${totalRows} data rows to process.`);

    if (totalRows === 0) {
      console.log("⚠️ No data rows found, taking screenshot for debugging...");
      await takeScreenshot(targetPage, 'no-data-rows', 'debug');
      throw new Error("No data rows found in results table");
    }

  // Limit rows during test runs to reduce load; adjust/remove later
  const limit = Math.min(totalRows, 100);
  for (let i = 0; i < limit; i++) {
    try {
      // Recover if the page/context was closed between iterations
      if (!targetPage || (typeof targetPage.isClosed === 'function' && targetPage.isClosed())) {
        await ensureAlive();
      }
      console.log(`🔹 Scraping row ${i + 1} of ${totalRows}... (${Math.round((i/totalRows)*100)}% complete)`);
      const row = rowsLocator.nth(i);
      await row.scrollIntoViewIfNeeded().catch(() => {});
      console.log("scrolled into view working or not!");
      await targetPage.waitForTimeout(500);

    // Try to extract safely (avoid crashes)
    const safeText = async (selector, fallback = 'N/A') => {
      try {
        return (await row.locator(selector).first().innerText()).trim();
      } catch {
        return fallback;
      }
    };
    const safeHref = async (selector, fallback = 'N/A') => {
      try {
        const href = await row.locator(selector).first().getAttribute('href');
        return href || fallback;
      } catch {
        return fallback;
      }
    };

    const actionUrl = await safeHref('td:nth-child(1) a');
    const fullName = await safeText('td:nth-child(2)');
    const fatherName = await safeText('td:nth-child(3)');
    const address = await safeText('td:nth-child(4)');
    const country = await safeText('td:nth-child(5)');
    const state = await safeText('td:nth-child(6)');
    const city = await safeText('td:nth-child(7)');

    // ---- STAGE 3: Click "Value" link to open detail ----
    let price = 'N/A';
    if (actionUrl && actionUrl.includes('result')) {
      try {
        console.log(`🔗 Opening detail page for: ${fullName}`);

        const valueLink = row.locator('a:has-text("Value")');
        if (!(await valueLink.count())) {
          console.warn(`⚠️ "Value" link not found for ${fullName}`);
        } else {
          // Scroll into view manually — safer on huge tables
          await valueLink.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
          await sleep(1000);

          // Force open in a new tab by setting target and then clicking
          await valueLink.evaluate(el => el.setAttribute('target', '_blank'));
          const [newPage] = await Promise.all([
            context.waitForEvent('page').catch(() => null),
            valueLink.click({ force: true, timeout: 5000 }),
          ]);

          let detailPage = newPage;
          if (!detailPage) {
            console.warn('⚠️ New tab did not open automatically, opening manually...');
            if (actionUrl && actionUrl.startsWith('http')) {
              detailPage = await context.newPage();
              await detailPage.goto(actionUrl, { waitUntil: 'domcontentloaded' });
            } else {
              // Fallback to same page if URL invalid
              detailPage = targetPage;
            }
          }
          console.log(detailPage === targetPage ? '↪️ Detail loaded in same tab' : '🆕 Detail opened in new tab');

          try {
            await detailPage.waitForLoadState('domcontentloaded', { timeout: 60000 });
            // Wait for any “₹” text to appear
            await detailPage.waitForSelector('b.pulse, text=₹', { timeout: 90000 });
          } catch (e) {
            console.warn(`⚠️ Slow load for ${fullName}: ${e.message}`);
          }

          // Extract price from element or URL
          try {
            const priceEl = detailPage.locator('b.pulse, text=₹').first();
            const text = await priceEl.innerText();
            const match = text.match(/₹?\s*([\d,]+)/);
            if (match) {
              price = `₹${match[1].replace(/,/g, '')}`;
            } else {
              price = extractPriceFromUrl(detailPage.url()) || 'N/A';
            }
            console.log(`💰 Price for ${fullName}: ${price}`);
          } catch {
            console.warn(`⚠️ Price not found for ${fullName}`);
            await takeScreenshot(detailPage, `price-missing-${i + 1}`, 'missing');
          }

          if (detailPage && detailPage !== targetPage && !detailPage.isClosed()) await detailPage.close({ runBeforeUnload: true });
          // If same-tab navigation occurred, navigate back to results
          if (detailPage === targetPage) {
            try {
              await targetPage.goBack({ waitUntil: 'domcontentloaded' });
            } catch {
              if (lastKnownURL) {
                await targetPage.goto(lastKnownURL, { waitUntil: 'domcontentloaded' });
              }
            }
          }
          await sleep(300);
        }
      } catch (e) {
        console.warn(`⚠️ Error fetching price for ${fullName}: ${e.message}`);
        await takeScreenshot(targetPage, `row-${i + 1}-click-error`, 'error');
      }
    }

    // Save to CSV immediately (real-time)
    writer.write({
      'Full Name': fullName,
      'Father Name': fatherName,
      'Address': address,
      'Country': country,
      'State': state,
      'City': city,
      'Price': price
    });

    // Periodic backoff to reduce load
    if ((i + 1) % 10 === 0) {
      console.log(`🕒 Processed ${i + 1} rows, pausing for 5s to prevent overload...`);
      await sleep(5000);
    }

  // Small delay between rows to avoid rate limiting
  await sleep(1500);
      
    } catch (rowError) {
      console.error(` Error processing row ${i + 1}: ${rowError.message}`);
      // Continue with next row even if this one fails
      await takeScreenshot(targetPage, `row-error-${i + 1}`, 'error');
      // If the error indicates closed page/context, try to recover before next iteration
      if (/has been closed/i.test(rowError.message || '')) {
        await ensureAlive();
      }
    }
    }

    writer.end();
    console.log("✅ Scraping completed successfully! Data saved to output.csv");

  } catch (error) {
    console.error("❌ Critical error during scraping:", error.message);
    if (typeof targetPage !== 'undefined' && !(targetPage && targetPage.isClosed && targetPage.isClosed())) {
      await takeScreenshot(targetPage, 'critical-error', 'error');
    }
    writer.end();
  } finally {
    if (browser) {
      await browser.close();
      console.log("🚪 Browser closed.");
    }
  }
})();
