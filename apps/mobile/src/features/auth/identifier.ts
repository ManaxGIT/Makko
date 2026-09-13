export type AuthIdentifier = { email: string } | { phone: string };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseAuthIdentifier(value: string): AuthIdentifier | null {
  const input = value.trim().toLowerCase();

  if (!input) return null;

  if (input.includes('@')) {
    return emailPattern.test(input) ? { email: input } : null;
  }

  const looksLikePhoneNumber = /^[+\d\s().-]+$/.test(input);

  if (looksLikePhoneNumber) {
    const digits = input.replace(/\D/g, '');
    const vietnameseNumber = digits.startsWith('84') ? digits.slice(2) : digits.replace(/^0/, '');

    return vietnameseNumber.length === 9 || vietnameseNumber.length === 10
      ? { phone: `+84${vietnameseNumber}` }
      : null;
  }

  const gmailAddress = `${input}@gmail.com`;
  return emailPattern.test(gmailAddress) ? { email: gmailAddress } : null;
}
