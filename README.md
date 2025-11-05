# 🤖 Recoversy Finder Bot - Enhanced Version

An advanced automated data extraction bot for [search.recoversy.in](https://search.recoversy.in/) with robust error handling, screenshot capabilities, and real-time CSV output.

## 🚀 Features

✅ **Smart Table Detection** - Multiple fallback selectors for different table structures  
✅ **Automatic Screenshots** - Captures debugging screenshots on errors  
✅ **Real-time CSV Output** - Crash-safe data writing with immediate saves  
✅ **Progress Tracking** - Visual progress indicators and completion percentage  
✅ **Enhanced Error Handling** - Retry mechanisms and graceful error recovery  
✅ **Price Extraction with Retry** - Multiple attempts to extract price data  
✅ **Manual CAPTCHA Support** - 60-second wait for manual CAPTCHA solving  
✅ **Rate Limiting** - Built-in delays to avoid being blocked  

## 📁 Project Structure

```
recoversy-finder-bot/
├── src/
│   └── index.js           # Main bot script (enhanced)
├── screenshots/           # Auto-generated error screenshots
├── tests/
│   └── example.spec.js    # Playwright test files
├── package.json           # Dependencies and scripts
├── playwright.config.js   # Playwright configuration
└── output.csv            # Generated results file
```

## 🛠️ Installation

1. **Clone/Download** the project
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Install Playwright browsers** (if needed):
   ```bash
   npx playwright install chromium
   ```

## 🎯 Usage

### Quick Start
```bash
npm start
```

### Alternative Methods
```bash
# Using npm run
npm run dev

# Direct node execution
node src/index.js
```

## 🔧 How It Works

### **Stage 1: Setup & Navigation**
1. Opens Chromium browser (non-headless mode)
2. Navigates to `https://search.recoversy.in/`
3. Auto-fills search form: 
   - First Name: "kumar"
   - Last Name: "kumar" 
   - State: "Bihar"
4. **Waits 60 seconds** for manual CAPTCHA solving
5. Clicks search and waits for results

### **Stage 2: Smart Table Detection**
- Uses multiple selector fallbacks:
  - `table tbody tr`
  - `table.result-table tbody tr`
  - `table tr`
  - `.result-table tr`
- Automatically filters out header rows
- Takes debugging screenshots if no data found

### **Stage 3: Data Extraction**
For each result row:
1. Extracts basic data (Name, Father Name, Address, etc.)
2. Clicks "Value" link to open detail page
3. **Enhanced Price Extraction:**
   - Multiple selector attempts
   - 3 retry attempts per price
   - Automatic screenshot on failure
4. Saves data to CSV immediately (real-time)

### **Stage 4: Error Recovery**
- Screenshots saved to `screenshots/` folder
- Graceful error handling with detailed logging
- Progress indicators show completion percentage
- Safe browser cleanup on exit

## 📊 Output Format

Generated `output.csv` contains:
| Full Name | Father Name | Address | Country | State | City | Price | Action URL |
|-----------|-------------|---------|---------|-------|------|-------|------------|
| AWADHESH KUMAR MISHRA | KUMAR MISHRA | SHANTI NIKETA... | INDIA | BIHAR | DARBHANGA | ₹18625 | https://search... |

## 🔧 Configuration

### Search Parameters (Customizable)
Edit the search parameters in `src/index.js`:
```javascript
// ---- STAGE 1: Fill Search Form ----
await page.locator(xp.firstName).fill("your_first_name");
await page.locator(xp.lastName).fill("your_last_name");
await page.locator(xp.stateDropdown).selectOption({ label: "Your_State" });
```

### Enhanced Selectors
The bot uses multiple fallback selectors for reliability:
```javascript
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
```

## 🚨 Troubleshooting

### Common Issues

**1. "No data rows found"**
- Check screenshots in `screenshots/` folder
- Verify CAPTCHA was solved correctly
- Ensure search results loaded properly

**2. "Price extraction failed"**
- Bot automatically retries 3 times
- Check individual screenshot files for debugging
- Price shows as 'N/A' if extraction fails

**3. "npm: not found" (WSL users)**
- Install Node.js in WSL: `sudo apt install nodejs npm`
- Or use PowerShell instead of WSL

**4. Browser doesn't open**
- Run: `npx playwright install chromium`
- Check if Playwright dependencies are installed

## 📸 Screenshot Debugging

Auto-generated screenshots are saved with descriptive names:
- `TIMESTAMP_no-data-rows_debug.png` - No results found
- `TIMESTAMP_price-not-found-NAME_error.png` - Price extraction failed
- `TIMESTAMP_failed-link-NAME_error.png` - Link clicking failed
- `TIMESTAMP_critical-error_error.png` - Critical system error

## ⚡ Performance Features

- **Real-time CSV writing** - No data loss on crashes
- **Smart rate limiting** - 1.5s delay between rows
- **Memory efficient** - Processes rows individually
- **Crash recovery** - Graceful error handling
- **Progress tracking** - Live completion percentage

## 🛡️ Safety Features

- **Screenshot evidence** - Visual debugging for failures
- **Graceful shutdown** - Proper browser cleanup
- **Error logging** - Detailed console output
- **Retry mechanisms** - Multiple attempts for critical operations
- **Safe evaluation** - Prevents crashes on missing elements

## 📋 Requirements

- **Node.js** 16+ 
- **npm** or **yarn**
- **Windows/Linux/macOS** compatible
- **Chromium** browser (auto-installed via Playwright)

## 🎛️ Advanced Usage

### Custom CAPTCHA Wait Time
```javascript
// Change from 60 seconds to custom time
await page.waitForTimeout(120000); // 2 minutes
```

### Different Search Parameters
```javascript
await page.locator(xp.stateDropdown).selectOption({ label: "Maharashtra" });
```

### Screenshot Quality Settings
```javascript
await page.screenshot({ 
  path: screenshotPath, 
  fullPage: true,
  quality: 90 // For JPEG screenshots
});
```

## 📞 Support

If you encounter issues:

1. Check the `screenshots/` folder for visual debugging
2. Review console output for error messages  
3. Ensure all dependencies are installed correctly
4. Verify CAPTCHA is solved within the time limit

---

**🎯 Ready to extract recovery data efficiently!** Run `npm start` and let the bot do the work.