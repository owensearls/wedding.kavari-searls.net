import { ZodError, type ZodSchema } from 'zod'

export function jsonError(status: number, message: string, details?: unknown) {
  return Response.json({ error: message, details }, { status })
}

export async function parseJson<T>(
  request: Request,
  schema: ZodSchema<T>,
): Promise<{ data: T } | { error: Response }> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return { error: jsonError(400, 'Invalid JSON body') }
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return {
      error: jsonError(400, 'Validation failed', formatZodError(parsed.error)),
    }
  }
  return { data: parsed.data }
}

export function formatZodError(error: ZodError) {
  return error.issues.map((i) => ({
    path: i.path.join('.'),
    message: i.message,
  }))
}
