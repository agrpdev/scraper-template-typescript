# Scraper Template

This repository contains a template for building scrapers using TypeScript. It includes basic functionalities for crawling and scraping web pages, along with API communication for managing work items and reporting progress.

## Installation

To run this scraper, make sure you have Node.js and npm installed on your machine. Then, clone this repository and install dependencies using the following commands:

```bash
git clone <repository-url>
cd scraper-template
npm install
```

## Usage

To run the scraper, use the following command:

```bash
npm run dev
```

This will start the TypeScript compiler in watch mode and execute the `src/scrapers/archiweb.ts` file.

## Project Structure

- **src/**
- **scrapers/** : Contains scraper implementations.
- **archiweb.ts** : Example scraper for the Archiweb.cz website.
- **types/** : Contains type definitions used throughout the project.
- **ScraperBase.ts** : Base class for scrapers, handling API communication and common functionalities.
- **index.ts** : Entry point of the application.

## Customization

- **ScraperBase.ts** : Modify this file to customize API endpoints, authentication, and other common functionalities shared across scrapers.
- **scrapers/** : Add or modify scraper implementations in separate files within this directory.

## Dependencies

- [dotenv](https://www.npmjs.com/package/dotenv) : Loads environment variables from a `.env` file.
- [playwright](https://www.npmjs.com/package/playwright) : Automation library for web browsers.
- [ts-node](https://www.npmjs.com/package/ts-node) : TypeScript execution environment for Node.js.
- [ts-pattern](https://www.npmjs.com/package/ts-pattern) : Pattern matching for TypeScript.
- [zod](https://www.npmjs.com/package/zod) : TypeScript-first schema declaration and validation.

## License

Feel free to customize and extend this template for your specific scraping needs. If you have any questions or suggestions, please open an issue or pull request on GitHub. Happy scraping! 🚀
