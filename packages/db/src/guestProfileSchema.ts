import type { NotesJsonSchema } from './notesSchema'

export const GUEST_PROFILE_NOTES_SCHEMA: NotesJsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  additionalProperties: false,
  'x-fieldOrder': ['dietary_restrictions', 'song_request'],
  properties: {
    dietary_restrictions: {
      title: 'Dietary restrictions or allergies',
      type: 'string',
      maxLength: 500,
    },
    song_request: {
      title: 'Song request',
      type: 'string',
      maxLength: 500,
    },
  },
}
