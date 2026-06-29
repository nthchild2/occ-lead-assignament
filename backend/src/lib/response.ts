import type { Response } from 'express'

export const success = <T>(res: Response, data: T, status = 200): Response => {
  return res.status(status).json({ data })
}

export const fail = (
  res: Response,
  status: number,
  code: string,
  message: string,
): Response => {
  return res.status(status).json({ error: { code, message } })
}
