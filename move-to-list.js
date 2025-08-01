// Puppeteer automation script using stealth mode with DOM refresh and cart-to-saved functionality
// Requirements:
// 1. npm install puppeteer-extra puppeteer-extra-plugin-stealth dotenv

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const fs = require('fs');
const path = require('path');
const { format } = require('date-fns');
require('dotenv').config();

const TARGET_LIST_NAME = "Cart and Save For Later";
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
const timestamp = format(new Date(), 'yyyyMMdd-HHmmss');
const cartAsins = [];
const savedAsins = [];
const addedAsins = [];
const deletedAsins = [];
const failedRetries = [];

(async () => {
  try {
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      userDataDir: './amazon-profile'
    });

    const [page] = await browser.pages();
    await page.bringToFront();

    await page.goto('https://www.amazon.com/gp/cart/view.html');
    console.log('🛑 Please log in and make sure your saved and cart items are visible. Press ENTER in the terminal to continue...');

    process.stdin.setEncoding('utf8');
    await new Promise(resolve => {
      process.stdin.once('data', () => {
        resolve();
      });
    });

    // Extract and log ASINs from cart and saved for later
    const allAsins = await page.$$eval('[data-asin]', els => els.map(el => el.getAttribute('data-asin')).filter(Boolean));
    const asinFile = path.join(logDir, `initial-asins-${timestamp}.json`);
    fs.writeFileSync(asinFile, JSON.stringify(allAsins, null, 2));

    // Step 1: Move cart items to Saved for Later by reloading button list each time
    let moved = 0;
    while (true) {
      const cartSaveLinks = await page.$$('input[name^="submit.save-for-later"]');
      if (cartSaveLinks.length === 0) break;

      const link = cartSaveLinks[0];
      try {
        const container = await link.evaluateHandle(el => el.closest('[data-asin]'));
        const asin = await container.evaluate(el => el.getAttribute('data-asin'));
        cartAsins.push(asin);
        await link.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        await new Promise(res => setTimeout(res, 100));
        await link.evaluate(el => el.click());
        console.log(`📥 Moved cart item to Saved for Later: ${asin}`);
        moved++;
        await new Promise(res => setTimeout(res, 300));
      } catch (err) {
        console.warn(`⚠️ Failed to move cart item:`, err.message);
        break;
      }
    }

    // Step 2: Add saved items to list and delete
    let success = 0;
    while (true) {
      const addButtons = await page.$$('input[name^="submit.add-to-list-popover"]');
      if (addButtons.length === 0) break;

      try {
        const btn = addButtons[0];
        const containerHandle = await btn.evaluateHandle(b => b.closest(".sc-list-item"));
        const asin = await containerHandle.evaluate(el => el.getAttribute('data-asin'));
        savedAsins.push(asin);

        await btn.evaluate(b => b.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        await btn.click();

        const popupAppeared = await page.waitForSelector('a.a-dropdown-link span.cldd-list-name', { visible: true, timeout: 7000 }).catch(() => null);
        if (!popupAppeared) throw new Error('List popup did not appear');

        const listOptions = await page.$$('a.a-dropdown-link');
        let matched = false;

        for (const option of listOptions) {
          const label = await option.$eval('span.cldd-list-name', el => el.textContent.trim());
          if (label === TARGET_LIST_NAME) {
            await option.evaluate(el => {
              ['mousedown', 'mouseup', 'click'].forEach(type => {
                el.dispatchEvent(new MouseEvent(type, {
                  bubbles: true,
                  cancelable: true,
                  view: window
                }));
              });
            });
            matched = true;
            success++;
            addedAsins.push(asin);
            break;
          }
        }

        if (!matched) {
          console.warn('❌ List not found in popup.');
          failedRetries.push({ asin, reason: 'No matching list' });
        } else {
          let deleted = false;
          for (let attempt = 0; attempt < 3 && !deleted; attempt++) {
            const deleteButtonHandle = await containerHandle.evaluateHandle(c => c.querySelector('input[type="submit"][name^="submit.delete-saved."]'));
            if (deleteButtonHandle && deleteButtonHandle.asElement()) {
              await deleteButtonHandle.evaluate(b => b.scrollIntoView({ behavior: 'smooth', block: 'center' }));
              await deleteButtonHandle.evaluate(b => b.click());
              console.log(`🗑️ Deleted item after adding to list: ${asin}`);
              deleted = true;
              deletedAsins.push(asin);
              break;
            } else {
              await new Promise(res => setTimeout(res, 300));
            }
          }

          if (!deleted) {
            console.warn(`❌ Failed to delete item after 3 attempts.`);
            failedRetries.push({ asin, reason: 'Could not delete' });
          }
        }
        await new Promise(res => setTimeout(res, 300));
      } catch (err) {
        console.error(`⚠️ Error processing item:`, err.message);
      }
    }

    // Export summary logs
    fs.writeFileSync(path.join(logDir, `summary-${timestamp}.json`), JSON.stringify({
      cartAsins,
      savedAsins,
      addedAsins,
      deletedAsins,
      failedRetries
    }, null, 2));

    console.log(`✅ Done. ${success} item(s) moved to "${TARGET_LIST_NAME}".`);
    console.log('🟢 Browser will remain open. Press Ctrl+C to exit.');
    await new Promise(() => {});
  } catch (err) {
    console.error('💥 Script failed:', err.message);
  }
})();
