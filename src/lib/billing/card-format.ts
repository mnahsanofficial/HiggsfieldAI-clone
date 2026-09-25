// Card-form helpers for the demo checkout. Format checks only: there is no payment processor,
// and nothing here sends card details anywhere. They run in the browser and are discarded.

export const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// A well-known test number: passes the Luhn check, belongs to no one, and reads as fake.
export const TEST_CARD = { number: "4242 4242 4242 4242", expiry: "12/34", cvc: "123", name: "Demo Tester" };

export type Card = typeof TEST_CARD;
export type CardErrors = Partial<Record<keyof Card, string>>;

function luhn(digits: string) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
    sum += d;
  }
  return sum % 10 === 0;
}

export function validateCard(card: Card, now = new Date()): CardErrors {
  const errors: CardErrors = {};
  const digits = card.number.replace(/\s/g, "");
  if (!/^\d{13,19}$/.test(digits) || !luhn(digits)) errors.number = "Enter a valid card number.";
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(card.expiry.trim());
  const month = m ? Number(m[1]) : 0;
  if (!m || month < 1 || month > 12) errors.expiry = "Use MM/YY.";
  else if (new Date(2000 + Number(m[2]), month) <= now) errors.expiry = "This card has expired.";
  if (!/^\d{3,4}$/.test(card.cvc.trim())) errors.cvc = "3 or 4 digits.";
  if (card.name.trim().length < 2) errors.name = "Enter the name on the card.";
  return errors;
}

export const groupDigits = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");

export const formatExpiry = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};
