import type { JobFilters, JobListResponse } from '@occ/shared'
import { JobListResponseSchema } from '@occ/shared'

import { get } from './api'

// `get(path, schema, auth?)` only accepts a pre-built path string (no
// query-object overload), so the querystring is assembled here, local to the
// jobs domain. Only defined/non-empty values are serialized — `undefined`
// filter fields (and empty strings) are skipped rather than being turned
// into literal `"undefined"` query params.
function buildQueryString(filters: Partial<JobFilters>): string {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue
    params.append(key, String(value))
  }

  const query = params.toString()
  return query === '' ? '' : `?${query}`
}

export function list(filters: Partial<JobFilters>): Promise<JobListResponse> {
  return get(`/jobs${buildQueryString(filters)}`, JobListResponseSchema, false)
}
