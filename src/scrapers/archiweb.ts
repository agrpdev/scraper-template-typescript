import { Page, chromium } from "playwright";
import { BaseScraper, ScraperBuilder } from "../ScraperBase";
import { BaseCrawlWorkItem, BaseScrapeWorkItem } from "../types/WorkItem";
import "dotenv/config";

require("dotenv").config();

const API_KEY = process.env.API_KEY;

/*
  This is example of scraper definition for Archiweb.cz website
  It contains two sections: zpravy and architekti
  For each section, the scraper crawls the website and scrapes the articles
*/

// Define custom settings for the scraper, these could be anything you want. Don't forget to set them via the scraper UI or API
type CustomSettings = {
  baseDomain: string;
  crawlSections: {
    zpravy: string;
  };
};

type Section = "zpravy" | "architekti";

// Define types for the crawl tasks
type CrawlTask = {
  sections: Section[];
  rescrape: boolean;
};

// Define types for the scrape tasks
type ScrapeTask = {
  section: Section;
  url: string;
  title: string;
  date: string;
  commentCount: number;
};

// Define types for the work items based on the tasks
type CrawlWorkItem = BaseCrawlWorkItem<CrawlTask>;
type ScrapeWorkItem = BaseScrapeWorkItem<ScrapeTask>;

// We extend the BaseScraper, which wraps the API calls
class ArchiwebScraper extends BaseScraper {
  // Crawling
  async processCrawlItem(workItem: CrawlWorkItem) {
    for (const section of workItem.task.sections) {
      const browser = await chromium.launch();
      const page = await browser.newPage();

      try {
        if (section === "zpravy") {
          await this.crawlZpravy(page);
        } else if (section === "architekti") {
          await this.crawlArchitekti(page);
        }
      } catch (error) {
        console.error("Error during scraping:", error);
        this.workItemFailed(workItem, error as Error);
      } finally {
        this.workItemCompleted(workItem);
        await browser.close();
      }
    }
  }

  // Implementation of the crawling logic using Playwright
  async crawlZpravy(page: Page) {
    const { crawlSections, baseDomain } = this.details
      .customSettings as CustomSettings;
    const seenHrefs = new Set();

    while (true) {
      await page.goto(crawlSections.zpravy);
      await page.click(".load_more");
      await page.waitForLoadState("networkidle");

      const links = await page.$$eval(".row.newsList a[href]", (links) =>
        links.map((link) => ({
          href: link.getAttribute("href"),
          date: link.querySelector("span.date")?.textContent?.trim() ?? "",
          title: link.querySelector("span.title")?.textContent?.trim() ?? "",
          commentCount: parseInt(
            link.querySelector("span.discuss")?.textContent?.trim() ?? "0"
          ),
        }))
      );

      const newLinks = links.filter(
        (link) => link.href && !seenHrefs.has(link.href)
      );

      const metadataList: ScrapeTask[] = newLinks.map(
        ({ href, commentCount, date, title }) => ({
          url: baseDomain + href,
          date,
          title,
          commentCount,
          section: "zpravy",
        })
      );

      newLinks.forEach((link) => {
        seenHrefs.add(link.href);
      });

      this.sendScrapeTargets(metadataList);
    }
  }

  async crawlArchitekti(page: Page) {
    // Crawl architekti logic (similar to crawlZpravy)...
  }

  // Scraping
  async processScrapeItem(workItem: ScrapeWorkItem) {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    try {
      if (workItem.task.section === "zpravy") {
        await this.scrapeZpravy(workItem, page);
      } else if (workItem.task.section === "architekti") {
        await this.scrapeArchitekti(workItem, page);
      } else {
        throw new Error("Unknown content type");
      }
    } catch (error) {
      console.error("Error during scraping:", error);
      this.workItemFailed(workItem, error as Error);
    } finally {
      this.workItemCompleted(workItem);
      await browser.close();
    }
  }

  async scrapeZpravy(workItem: ScrapeWorkItem, page: Page) {
    await page.goto(workItem.task.url);

    const title = await page.$eval(
      'div.medium-12.columns.bottom > h1[itemprop="name"]',
      (el) => el.textContent
    );
    const content = await page.$eval(
      'section.sec_text2 > div[itemprop="description"]',
      (el) => el.textContent
    );
    const articleInfo = await page.$eval("div.details", (el) => el.textContent);
    const articleInfoSplit = articleInfo
      ?.replace(/\s+/g, " ")
      .trim()
      .split(" ");
    const datetime =
      articleInfoSplit?.at(0) === "Pořadatel"
        ? undefined
        : articleInfoSplit?.slice(-2).join(" ");

    this.sendScrapeRecords([
      {
        id: workItem.task.url,
        metadata: {
          title,
          content,
          datetime,
          commentCount: workItem.task.commentCount,
          linkTitle: workItem.task.title,
          linkDate: workItem.task.date,
        },
        createdOn: new Date().toISOString(),
        files: [],
      },
    ]);
  }

  async scrapeArchitekti(workItem: ScrapeWorkItem, page: Page) {
    // Scrape architekti logic (similar to scrapeZpravy)...
  }
}

// Run the scraper instance. If you want parallel proccesion of work items, we recommend to run multiple instances of the scraper
async function runInstance() {
  if (!API_KEY) {
    console.error("Api key is required");
    return;
  }

  const builder = new ScraperBuilder(ArchiwebScraper)
    .setApiKey(API_KEY)
    .setCustomId("archiweb");

  const instance = await builder.build();

  instance.processWorkItems();
}

runInstance();
