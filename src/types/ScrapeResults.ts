import { ScrapeFile } from './ScrapeFile'

export type ScrapeResult = {
  id: string
  metadata: any
  createdOn: string
  files: ScrapeFile[]
}
