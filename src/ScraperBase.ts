import { ScrapeFile } from "./types/ScrapeFile";
import { ScrapeResult } from "./types/ScrapeResults";
import { ScraperDetails } from "./types/ScraperDetails";
import {
  BaseCrawlWorkItem,
  BaseScrapeWorkItem,
  HealthCheckWorkItem,
  StreamWorkItem,
  WorkItem,
  isHealthCheckWorkItem,
  isScrapeWorkItem,
  isStreamWorkItem,
} from "./types/WorkItem";
import { isCrawlWorkItem, isNoopWorkItem } from "./types/WorkItem";
import { match } from "ts-pattern";

// If noop work item is received, the scraper will wait for N seconds before asking for the next work item
const NOOP_TIMEOUT = 3000;

// The scraper will report the progress of the work item every N seconds
const WORK_ITEM_PROGRESS_INTERVAL = 60_000;

const ENDPOINTS = {
  WORK_ITEM_PROGRESS: "workItemProgress",
  WORK_ITEM_FAILED: "workItemFailed",
  WORK_ITEM_COMPLETED: "workItemCompleted",
  SEND_EMAIL: "sendEmail",
  RECIEVE_SCRAPING_ERRORS: "receiveScrapingErrors",
  RECIEVE_SCRAPER_TARGETS: "receiveScraperTargets",
  RECIEVE_SCRAPER_RECORDS: "receiveScraperRecords",
  RECIEVE_HEALTH_CHECK_INFO: "receiveHealthcheckInfo",
  RECIEVE_FILE: "receiveFile",
  FILE_EXISTS: "fileExists",
  REGISTER: "register",
  FILE: "file",
  NEXT_WORK_ITEM: "getNextWorkItem",
} as const;
const BE_URL = "https://scraper-scraper-main.kube.agrp.dev/rest/v2/control/";

export class ScraperBuilder<T extends BaseScraper> {
  private _constructor: new () => T;
  private apiKey: string = "";
  private customId: string = "";

  constructor(constructor: new () => T) {
    this._constructor = constructor;
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
    return this;
  }

  setCustomId(customId: string) {
    this.customId = customId;
    return this;
  }

  private async registerScraper() {
    const response = await fetch(
      `${BE_URL}${ENDPOINTS.REGISTER}?customId=${this.customId}`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        method: "GET",
      }
    );
    if (response.status !== 200) {
      console.error("Failed to register scraper", await response.json());
      throw new Error("Failed to register scraper");
    }
    return await response.json();
  }

  async build() {
    const data = await this.registerScraper();
    const instance = new this._constructor();
    await instance.configure(
      this.apiKey,
      this.customId,
      data.scraper,
      data.configured
    );
    return instance;
  }
}

export class BaseScraper {
  customId: string = "";
  apiKey: string = "";
  details = {} as ScraperDetails;
  instanceId = crypto.getRandomValues(new Uint32Array(1))[0];
  configured = false;

  constructor() {}

  async configure(
    apiKey: string,
    customId: string,
    details: ScraperDetails,
    configured: boolean
  ) {
    this.apiKey = apiKey;
    this.customId = customId;
    this.details = details;
    this.configured = configured;
  }

  async processCrawlItem(_: BaseCrawlWorkItem<unknown>) {
    throw new Error("not implemented");
  }

  async processScrapeItem(_: BaseScrapeWorkItem<unknown>) {
    throw new Error("not implemented");
  }

  async processStreamItem(_: StreamWorkItem) {
    throw new Error("not implemented");
  }

  async processHealthCheckItem(_: HealthCheckWorkItem) {
    throw new Error("not implemented");
  }

  async processWorkItems() {
    if (!this.configured) {
      console.error("Scraper not configured");
      return;
    }
    while (true) {
      await this.getNextWorkItem();
    }
  }

  async getNextWorkItem() {
    const response = await this.fetch({
      endpoint: "NEXT_WORK_ITEM",
      queryParams: {
        scraperId: this.details.id,
        instanceId: this.instanceId.toString(),
      },
      errorMessage: "Failed to get next work item",
    });

    const workItem = await response.json();
    const interval = await this.workItemProgress(workItem);

    await match(workItem)
      .when(
        isNoopWorkItem,
        async () =>
          await new Promise((resolve) => setTimeout(resolve, NOOP_TIMEOUT))
      )
      .when(
        isScrapeWorkItem,
        async () =>
          await this.processScrapeItem(workItem as BaseScrapeWorkItem<unknown>)
      )
      .when(
        isCrawlWorkItem,
        async () =>
          await this.processCrawlItem(workItem as BaseCrawlWorkItem<unknown>)
      )
      .when(
        isStreamWorkItem,
        async () => await this.processStreamItem(workItem as StreamWorkItem)
      )
      .when(
        isHealthCheckWorkItem,
        async () =>
          await this.processHealthCheckItem(workItem as HealthCheckWorkItem)
      )
      .otherwise(() => console.error("Unsupported work item type", workItem));

    clearInterval(interval);
  }

  private async fetch({
    endpoint,
    path = "",
    queryParams,
    method = "GET",
    body,
    errorMessage,
  }: {
    endpoint: keyof typeof ENDPOINTS;
    path?: string;
    queryParams?: Record<string, string>;
    method?: "GET" | "POST";
    body?: unknown;
    errorMessage: string;
  }) {
    let url = `${BE_URL}${ENDPOINTS[endpoint]}`;
    if (path) url += "/" + path;
    if (queryParams) url += "?" + new URLSearchParams(queryParams).toString();

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status !== 200) {
      const data = await response.json();
      console.error(errorMessage, data, { body });
    }
    return response;
  }

  async sendScrapeTargets(metadataList: unknown[]) {
    return await this.fetch({
      endpoint: "RECIEVE_SCRAPER_TARGETS",
      method: "POST",
      body: metadataList.map((metadata) => ({
        sourceId: this.details.id,
        metadata,
      })),
      errorMessage: "Failed to send scrape targets",
    });
  }

  async sendScrapeRecords(records: ScrapeResult[]) {
    return await this.fetch({
      endpoint: "RECIEVE_SCRAPER_RECORDS",
      queryParams: {
        scraperId: this.details.id,
      },
      method: "POST",
      body: records,
      errorMessage: "Failed to send scrape records",
    });
  }

  async workItemCompleted(workItem: WorkItem) {
    return await this.fetch({
      endpoint: "WORK_ITEM_COMPLETED",
      queryParams: {
        instanceId: this.instanceId.toString(),
        workItemId: workItem.id,
      },
      method: "POST",
      errorMessage: "Failed to report work item completion",
    });
  }

  async workItemFailed(workItem: WorkItem, error: Error) {
    return await this.fetch({
      endpoint: "WORK_ITEM_FAILED",
      queryParams: {
        instanceId: this.instanceId.toString(),
      },
      method: "POST",
      body: {
        workItemId: workItem.id,
        msgs: [
          {
            msg: error.message,
            stacktrace: error.stack,
          },
        ],
      },
      errorMessage: "Failed to report work item failure",
    });
  }

  async workItemProgress(workItem: WorkItem) {
    return setInterval(
      async () =>
        this.fetch({
          endpoint: "WORK_ITEM_PROGRESS",
          queryParams: {
            instanceId: this.instanceId.toString(),
            workItemId: workItem.id,
          },
          method: "POST",
          errorMessage: "Failed to report work item progress",
        }),
      WORK_ITEM_PROGRESS_INTERVAL
    );
  }

  async sendEmail(reciever: string, subject: string, content: string) {
    return await this.fetch({
      endpoint: "SEND_EMAIL",
      method: "POST",
      body: {
        emailAddressesTo: [reciever],
        subject,
        content,
      },
      errorMessage: "Failed to send email",
    });
  }

  async getFile(fileName: string) {
    const response = await this.fetch({
      endpoint: "FILE",
      path: this.details.id,
      queryParams: {
        fileName,
      },
      errorMessage: "Failed to get file",
    });
    return await response.blob();
  }

  async fileExists(fileName: string) {
    const response = await this.fetch({
      endpoint: "FILE_EXISTS",
      path: `/${this.details.id}`,
      queryParams: {
        fileName,
      },
      errorMessage: "Failed to get file",
    });
    return (await response.json()) as boolean;
  }

  async sendFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(
      `${BE_URL}${ENDPOINTS.RECIEVE_FILE}?fileStoreId=${this.details.id}`,
      {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      }
    );
    if (response.status !== 200) {
      const data = await response.json();
      console.error("Failed to send file", data);
    }
    return response;
  }

  async sendScrapingErrors(
    errors: {
      id: string;
      workAssigmentsId: string;
      metadata: unknown;
      files: ScrapeFile[];
    }[]
  ) {
    return await this.fetch({
      endpoint: "RECIEVE_SCRAPING_ERRORS",
      method: "POST",
      body: errors,
      errorMessage: "Failed to receive scraping errors",
    });
  }

  async sendHealthCheckInfo(
    state: "GREEN" | "AMBER" | "RED" | "GREY",
    message: string
  ) {
    return await this.fetch({
      endpoint: "RECIEVE_HEALTH_CHECK_INFO",
      method: "POST",
      body: {
        scraperId: this.details.id,
        metadata: {
          message,
        },
        state,
      },
      errorMessage: "Failed to receive scraping errors",
    });
  }
}
