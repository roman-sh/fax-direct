export type FaxSessionDocument = {
  objectKey: string
  originalName: string
  pageCount: number
  sizeBytes: number
}

export type FaxSessionData = {
  document: FaxSessionDocument | null
  quote: null
  recipient: null
}

export const EMPTY_FAX_SESSION_DATA: FaxSessionData = {
  document: null,
  quote: null,
  recipient: null,
}
