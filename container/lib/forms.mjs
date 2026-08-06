// Replacement for the Netlify Forms handler.
//
// On Netlify, a POST of URL-encoded fields to any path is intercepted by the
// platform: it stores the submission, applies the honeypot, and then invokes
// netlify/functions/submission-created.mts by filename convention. None of that
// exists off-platform, and because the storefront's contact form posts to "/"
// and only checks response.ok, its failure mode there is silent — the form
// appears to work and the message goes nowhere.
//
// This reproduces the platform behaviour: honeypot check, then a call into the
// same submission-created handler with the same `{ payload }` envelope it
// receives on Netlify, so that function is unchanged and still writes the
// message to the contact_messages table.

const FORM_CONTENT_TYPES = [
  'application/x-www-form-urlencoded',
  'multipart/form-data',
]

/** True when this looks like a Netlify Forms submission rather than an API call. */
export function isFormSubmission(request, contentType) {
  if (request.method !== 'POST') return false
  return FORM_CONTENT_TYPES.some((type) => contentType.startsWith(type))
}

/**
 * Mirrors netlify-honeypot="bot-field" on the contact form: a bot that fills
 * the hidden field gets a success response and nothing is stored, so it has no
 * signal that it was rejected.
 */
function isBot(fields) {
  const honeypot = fields['bot-field']
  return typeof honeypot === 'string' && honeypot.trim() !== ''
}

export function createFormHandler(submissionHandler) {
  return async function handleForm(request) {
    let fields
    try {
      const form = await request.formData()
      fields = Object.fromEntries(
        [...form.entries()].map(([key, value]) => [
          key,
          typeof value === 'string' ? value : value.name,
        ]),
      )
    } catch {
      return new Response('Could not parse form submission', { status: 400 })
    }

    const formName = fields['form-name']
    if (!formName) {
      // Not a Netlify Forms post after all — let the caller fall through to
      // normal routing rather than swallowing someone's API request.
      return null
    }

    if (isBot(fields)) return new Response('OK', { status: 200 })

    const { 'form-name': _name, 'bot-field': _bot, ...data } = fields

    if (!submissionHandler) {
      console.warn(`form "${formName}" submitted but submission-created is not loaded`)
      return new Response('OK', { status: 200 })
    }

    const payload = {
      payload: {
        form_name: formName,
        data,
        created_at: new Date().toISOString(),
      },
    }

    try {
      const response = await submissionHandler(
        new Request(request.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        }),
        {},
      )
      // The submission handler deliberately returns success even when its
      // database write fails, so the visitor is never shown an error for a
      // problem they cannot act on. Preserve that.
      return response ?? new Response('OK', { status: 200 })
    } catch (error) {
      console.error(`form "${formName}": handler threw —`, error.message)
      return new Response('OK', { status: 200 })
    }
  }
}
