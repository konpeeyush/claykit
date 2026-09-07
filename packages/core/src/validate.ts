// validateAvatarDefinition is the only supported way to turn `unknown` JSON into a trusted
// AvatarDefinition — every other function in this package assumes its input already passed here.

import Ajv, { type ErrorObject } from 'ajv'
import { avatarDefinitionSchema } from './schema.js'
import type { AvatarDefinition } from './types.js'

const ajv = new Ajv({ allErrors: true, strict: true })
const validateFn = ajv.compile(avatarDefinitionSchema)

export type ValidationIssue = { message: string; path?: string }

export type ValidateResult =
  | { ok: true; value: AvatarDefinition }
  | { ok: false; errors: ValidationIssue[] }

const toIssue = (error: ErrorObject): ValidationIssue => ({
  message: error.message ?? 'Invalid value',
  path: error.instancePath || undefined,
})

export const validateAvatarDefinition = (data: unknown): ValidateResult => {
  if (validateFn(data)) return { ok: true, value: data as AvatarDefinition }
  return { ok: false, errors: (validateFn.errors ?? []).map(toIssue) }
}
