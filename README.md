# Clean Up Amazon Cart and Saved For Later

Automate your Amazon shopping cart and Saved for Later cleanup using Puppeteer.

## Features

- Move all cart items to the Saved for Later list
- Move all Saved for Later items to a wishlist
- Delete Saved for Later items after adding them to the list
- Automatically retries failed attempts
- Logs ASINs from:
  - Shopping cart
  - Saved for Later
  - Successfully added
  - Successfully deleted
  - Failed retries
- Outputs logs into timestamped JSON files in `/logs`

## Setup

1. Install dependencies:

```bash
npm install puppeteer-extra puppeteer-extra-plugin-stealth dotenv date-fns
```

2. Run:

```bash
node move-to-list.js
```

3. Follow prompts in the terminal to log in and view your Amazon cart.

## Output

- Logs are saved to `/logs/initial-asins-<timestamp>.json` and `/logs/summary-<timestamp>.json`.

## Disclaimer

This script simulates user interaction with Amazon's frontend. Use responsibly and do not violate Amazon's terms of service.
