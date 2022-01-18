# bulk-covid-tests

Command-line tool to bulk order free covid tests from [covidtests.gov](https://www.covidtests.gov/) using addresses from a spreadsheet. 
Does some light address validation but not much.

## Usage

```
npx bulk-covid-tests ./addresses.csv
```

Your CSV file should have [this format](https://github.com/contolini/bulk-covid-tests/blob/main/addresses.csv).

## Development

```
npm install
npm start addresses.csv
```

Uses [Playwright](https://playwright.dev/) for browser automation.

💉
