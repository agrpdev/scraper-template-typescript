import { z } from 'zod'

export enum WorkItemType {
  CRAWL = 'CRAWL',
  NOOP = 'NOOP',
  SCRAPE = 'SCRAPE',
  STREAM = 'STREAM',
  HEALTHCHECK = 'HEALTHCHECK',
}

const WorkItemSchema = z.object({
  id: z.string(),
  scraperId: z.string(),
  workItemType: z.nativeEnum(WorkItemType),
  createdOn: z.string(),
  validFrom: z.string(),
  validTo: z.string(),
  priority: z.number(),
  task: z.unknown(),
})

const NoopWorkItemSchema = z
  .object({
    id: z.string(),
    scraperId: z.string(),
    workItemType: z.nativeEnum(WorkItemType),
    createdOn: z.string(),
    noopForSeconds: z.number(),
  })
  .refine((data) => data.workItemType === WorkItemType.NOOP)

const CrawlWorkItemSchema = WorkItemSchema.refine(
  (data) => data.workItemType === WorkItemType.CRAWL,
)

const ScrapeWorkItemSchema = WorkItemSchema.refine(
  (data) => data.workItemType === WorkItemType.SCRAPE,
)

const StreamWorkItemSchema = WorkItemSchema.extend({
  task: z.object({
    _reason: z.unknown(),
    dataFileName: z.string(),
  }),
}).refine((data) => data.workItemType === WorkItemType.STREAM)

const HealthCheckWorkItemSchema = WorkItemSchema.refine(
  (data) => data.workItemType === WorkItemType.HEALTHCHECK,
)

export const isNoopWorkItem = (
  workItem: unknown,
): workItem is z.infer<typeof NoopWorkItemSchema> =>
  NoopWorkItemSchema.safeParse(workItem).success

export const isScrapeWorkItem = (
  workItem: unknown,
): workItem is z.infer<typeof ScrapeWorkItemSchema> =>
  ScrapeWorkItemSchema.safeParse(workItem).success

export const isCrawlWorkItem = (
  workItem: unknown,
): workItem is z.infer<typeof CrawlWorkItemSchema> =>
  CrawlWorkItemSchema.safeParse(workItem).success

export const isStreamWorkItem = (
  workItem: unknown,
): workItem is z.infer<typeof StreamWorkItemSchema> =>
  StreamWorkItemSchema.safeParse(workItem).success

export const isHealthCheckWorkItem = (
  workItem: unknown,
): workItem is z.infer<typeof HealthCheckWorkItemSchema> =>
  HealthCheckWorkItemSchema.safeParse(workItem).success

export type NoopWorkItem = z.infer<typeof NoopWorkItemSchema>

export type BaseScrapeWorkItem<T> = z.infer<typeof ScrapeWorkItemSchema> & {
  task: T
}

export type BaseCrawlWorkItem<T> = z.infer<typeof CrawlWorkItemSchema> & {
  task: T
}

export type StreamWorkItem = z.infer<typeof StreamWorkItemSchema>

export type WorkItem = z.infer<typeof WorkItemSchema>

export type HealthCheckWorkItem = z.infer<typeof HealthCheckWorkItemSchema>
