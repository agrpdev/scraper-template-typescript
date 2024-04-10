# TypeScript Scraper Template

This is a TypeScript scraper template designed to help you quickly set up a web scraper using Playwright and interacting with a RESTful API for controlling scraping tasks.

## Prerequisites

Before using this scraper template, ensure you have the following installed:
- Node.js
- npm or yarn
## Installation 
1. Clone this repository to your local machine:

```bash
git clone https://github.com/agrpdev/scraper-template-typescript
``` 
2. Install dependencies:

```bash
cd scraper-template-typescript
npm install
``` 
3. Set up environment variables: 
- Create a `.env` file in the root of the project. 
- Add your API key to the `.env` file:

```makefile
API_KEY=your-api-key
```
## Usage

1. Create your own scraper in /scrapers based on archiweb.ts example.

2. Run the scraper
```bash
npm run dev
```