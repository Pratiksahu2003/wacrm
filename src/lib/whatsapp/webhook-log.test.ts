import { describe, expect, it } from 'vitest'
import { maskId, summarizeWebhookBody } from './webhook-log'

describe('maskId', () => {
  it('masks to last 4 characters', () => {
    expect(maskId('100234567890123')).toBe('…0123')
  })

  it('returns null for empty input', () => {
    expect(maskId(null)).toBeNull()
  })
})

describe('summarizeWebhookBody', () => {
  it('summarizes message and status counts without PII', () => {
    const summary = summarizeWebhookBody({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '15550001111',
                  phone_number_id: '100234567890123',
                },
                contacts: [{ profile: { name: 'Alice' }, wa_id: '15551234567' }],
                messages: [
                  { id: 'wamid.abc', from: '15551234567', timestamp: '1', type: 'text' },
                ],
              },
            },
          ],
        },
      ],
    })

    expect(summary.entry_count).toBe(1)
    expect(summary.message_count).toBe(1)
    expect(summary.phone_number_ids).toEqual(['…0123'])
    expect(summary).not.toHaveProperty('contacts')
  })
})
