/**
 * Sanitize phone number for Meta WhatsApp API.
 * Meta requires digits only — no + prefix, no spaces, no dashes.
 * e.g. "+370 63949836" → "37063949836"
 */
export function sanitizePhoneForMeta(phone: string): string {
  if (!phone) return ''
  return phone.replace(/\D/g, '')
}

/**
 * Normalize phone number by removing all non-digit characters.
 * Used for comparing phone numbers in different formats.
 */
export function normalizePhone(phone: string): string {
  if (!phone) return ''
  return phone.replace(/\D/g, '')
}

/**
 * Compare two phone numbers accounting for trunk prefix differences.
 * e.g. "370063949836" (with trunk 0) matches "37063949836" (without trunk 0)
 * by comparing the last 8 digits.
 */
export function phonesMatch(phone1: string, phone2: string): boolean {
  const n1 = normalizePhone(phone1)
  const n2 = normalizePhone(phone2)
  if (n1 === n2) return true
  if (n1.length >= 8 && n2.length >= 8) {
    return n1.slice(-8) === n2.slice(-8)
  }
  return false
}

/**
 * Validate phone number is E.164-like format (7-15 digits starting with non-zero).
 * Accepts with or without + prefix.
 */
export function isValidE164(phone: string): boolean {
  return /^\+?[1-9]\d{6,14}$/.test(phone)
}

/**
 * Common ITU country calling codes, longest first so greedy matching
 * prefers 370 over 37 over 3. Used only to parse Meta display numbers
 * which are always proper international format.
 */
const COUNTRY_CALLING_CODES = [
  '880', '886', '960', '961', '962', '963', '964', '965', '966', '967',
  '968', '970', '971', '972', '973', '974', '975', '976', '977', '992',
  '993', '994', '995', '996', '998', '351', '352', '353', '354', '355',
  '356', '357', '358', '359', '370', '371', '372', '373', '374', '375',
  '376', '377', '378', '380', '381', '382', '383', '385', '386', '387',
  '389', '420', '421', '423', '500', '501', '502', '503', '504', '505',
  '506', '507', '508', '509', '590', '591', '592', '593', '594', '595',
  '596', '597', '598', '599', '670', '672', '673', '674', '675', '676',
  '677', '678', '679', '680', '681', '682', '683', '685', '686', '687',
  '688', '689', '690', '691', '692', '850', '852', '853', '855', '856',
  '870', '878', '880', '881', '882', '883', '886', '888', '20', '27',
  '30', '31', '32', '33', '34', '36', '39', '40', '41', '43', '44',
  '45', '46', '47', '48', '49', '51', '52', '53', '54', '55', '56',
  '57', '58', '60', '61', '62', '63', '64', '65', '66', '81', '82',
  '84', '86', '90', '91', '92', '93', '94', '95', '98', '1', '7',
] as const

/**
 * Extract the country calling code from a display phone number that is
 * already in international form (e.g. Meta's display_phone_number).
 */
export function extractCountryCallingCode(displayPhone: string): string | null {
  const digits = sanitizePhoneForMeta(displayPhone)
  if (!digits || !isValidE164(digits)) return null

  for (const cc of COUNTRY_CALLING_CODES) {
    if (digits.startsWith(cc)) {
      const rest = digits.slice(cc.length)
      if (rest.length >= 6 && rest.length <= 14) return cc
    }
  }
  return null
}

/**
 * Normalize a phone number to digits-only international (E.164 without +).
 *
 * Handles common domestic formats:
 *   - Leading 0 trunk prefix (e.g. Thai 08356864658 → 668356864658)
 *   - 00 international dial prefix
 *   - Numbers missing a country code when `defaultCountryCode` is known
 *
 * @param phone - raw phone string from a contact or CSV
 * @param defaultCountryCode - digits-only CC from the connected WA number
 */
export function normalizeToInternational(
  phone: string,
  defaultCountryCode?: string,
): string {
  let digits = sanitizePhoneForMeta(phone)
  if (!digits) return ''

  if (digits.startsWith('00')) {
    digits = digits.slice(2)
  }

  const cc = defaultCountryCode
    ? sanitizePhoneForMeta(defaultCountryCode)
    : ''

  if (isValidE164(digits)) {
    // Short digit strings can satisfy the E.164 regex without a real
    // country code (e.g. Thai 8356864658). When we know the account's
    // CC, treat <=10-digit "valid" numbers as local and prepend.
    if (cc && digits.length <= 10 && !digits.startsWith(cc)) {
      const intl = cc + digits
      if (isValidE164(intl)) return intl
    }
    return digits
  }

  if (cc && digits.startsWith('0')) {
    const national = digits.replace(/^0+/, '')
    const candidate = cc + national
    if (isValidE164(candidate)) return candidate
  }

  if (cc && !digits.startsWith(cc)) {
    const candidate = cc + digits
    if (isValidE164(candidate)) return candidate
  }

  return digits
}

/**
 * Generate plausible phone number variants for retry when Meta's
 * sandbox rejects a number with error #131030 ("not in allowed list").
 *
 * Many countries use a "trunk prefix" 0 for domestic dialing that is
 * meant to be dropped in international format (e.g. Lithuanian
 * "+370 063 949 836" domestically → "+370 63 949 836" international).
 * But some sandboxes register the number with the trunk 0 included,
 * causing sends to the correct international format to fail.
 *
 * This helper yields up to 3 variants:
 *   1. The original sanitized number (first attempt)
 *   2. With a trunk 0 inserted after the country code
 *   3. With a trunk 0 removed after the country code
 *
 * Country-code lengths of 1, 2, and 3 digits are tried because we
 * don't know the user's country ahead of time.
 *
 * @param sanitized - digits-only phone number (from sanitizePhoneForMeta)
 * @returns deduplicated list of variants, original first
 */
export function phoneVariants(sanitized: string): string[] {
  if (!sanitized) return []
  const seen = new Set<string>()
  const push = (v: string) => {
    if (v && !seen.has(v)) seen.add(v)
  }

  // 1. Original
  push(sanitized)

  // 2. Insert a 0 after each plausible country-code length
  for (const ccLen of [1, 2, 3]) {
    if (sanitized.length <= ccLen) continue
    const cc = sanitized.slice(0, ccLen)
    const rest = sanitized.slice(ccLen)
    if (!rest.startsWith('0')) {
      push(cc + '0' + rest)
    }
  }

  // 3. Remove a leading 0 after each plausible country-code length
  for (const ccLen of [1, 2, 3]) {
    if (sanitized.length <= ccLen + 1) continue
    const cc = sanitized.slice(0, ccLen)
    const rest = sanitized.slice(ccLen)
    if (rest.startsWith('0')) {
      push(cc + rest.slice(1))
    }
  }

  return [...seen]
}

/**
 * Returns true when the Meta API error indicates the recipient
 * phone number isn't in the allowed list (sandbox restriction).
 * Detected via error code 131030 or the standard error text.
 */
export function isRecipientNotAllowedError(message: string): boolean {
  return /131030|not in allowed list|not in the allowed list/i.test(message)
}
