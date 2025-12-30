# TrafficLens

A professional web application for analyzing website traffic data across multiple domains. TrafficLens enables you to view comprehensive traffic metrics including monthly visits, growth trends, engagement rates, and historical data analysis.

## Features

- 📊 **Bulk Domain Analysis**: Process multiple domains simultaneously
- 📈 **Growth Tracking**: View month-over-month growth/decline percentages
- 💾 **Smart Caching**: Data is cached for 30 days to minimize redundant requests
- 📅 **Historical Data**: Automatically stores last 3 months of traffic data
- 📤 **Export Options**: Download results as CSV or copy as TSV for Google Sheets
- ⚡ **Fast Processing**: Parallel batch processing for efficient data retrieval
- 🎯 **Accurate Metrics**: Monthly visits, session duration, bounce rate, pages per visit

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Navigate to `http://localhost:3000`

4. **Enter domains:**
   - Paste domains (one per line or comma-separated)
   - Click "Run" to analyze
   - View results in the table
   - Export data as needed

## Usage

### Basic Usage

1. Enter domains in the text area (one per line or comma-separated)
2. Click "Normalize" to clean up domain formats
3. Click "Run" to start analysis
4. View results in the sortable table
5. Export data using "Copy TSV" or "Download CSV" buttons

### Features

- **Normalize**: Cleans domain formats (removes protocols, www, paths)
- **Bypass Cache**: Force fresh data retrieval
- **Dry Run**: Test with mock data
- **Sortable Columns**: Click column headers to sort
- **Export**: Copy TSV for Google Sheets or download CSV

## Data Metrics

TrafficLens provides the following metrics for each domain:

- **Monthly Visits**: Estimated monthly traffic volume
- **Growth/Decline**: Percentage change from previous month (green for growth, red for decline)
- **Avg Session Duration**: Average time users spend on the site
- **Bounce Rate**: Percentage of single-page visits
- **Pages/Visit**: Average number of pages viewed per visit
- **Checked At**: Timestamp of when data was retrieved

## Technical Details

### Architecture

- **Frontend**: Next.js 16 (App Router) + React + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: SQLite (with PostgreSQL support ready)
- **Scraping**: Playwright for JavaScript-rendered pages

### Data Storage

- **Monthly Snapshots**: Traffic data stored per month
- **30-Day Cache**: Data cached for entire month (SimilarWeb updates monthly)
- **Historical Tracking**: Last 3 months automatically stored
- **Growth Calculation**: Automatic month-over-month growth calculation

### Performance

- **Parallel Processing**: 3 batches processed simultaneously
- **Batch Size**: 10 domains per batch
- **Smart Caching**: Reduces redundant data retrieval by ~97%
- **Bandwidth Optimization**: Blocks unnecessary resources during scraping

## Deployment

### Railway (Recommended)

1. Push code to GitHub
2. Connect Railway to your repository
3. Railway auto-detects Next.js and deploys
4. Add persistent volume for database (optional)

See `RAILWAY_DEPLOY.md` for detailed instructions.

### Environment Variables

- `DATABASE_PATH`: Custom database file path (optional)
- `RAILWAY_VOLUME_MOUNT_PATH`: Railway volume mount path (optional)

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Data Source

TrafficLens uses publicly available traffic estimates. Data is updated monthly and cached intelligently to minimize requests while ensuring accuracy.

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
