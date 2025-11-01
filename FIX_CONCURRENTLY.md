# Fix: 'concurrently' is not recognized

## Solution

Run this command to install concurrently:

```bash
cd D:\dowl\beta_17\Beta-17-main
npm install --save-dev concurrently
```

## Verify Installation

After installation, verify it works:

```bash
npx concurrently --version
```

Should show version number like: `8.2.2` or similar

## Then Run

```bash
npm run dev
```

## Alternative: If npm install doesn't work

Try installing globally:

```bash
npm install -g concurrently
```

Then run:

```bash
npm run dev
```

## Check Installation Status

```bash
npm list concurrently
```

If you see errors, make sure you're in the project directory:
```bash
cd D:\dowl\beta_17\Beta-17-main
```

