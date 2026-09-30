import { Schema } from "effect";

export const UrlString = Schema.String.pipe(
  Schema.filter((value) => URL.canParse(value), { message: () => "Invalid URL" }),
);

function validDate(value) {
  const date = value.slice(0, 10);
  return Number.isFinite(Date.parse(value)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
}
export const UtcDateTimeString = Schema.String.pipe(
  Schema.pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u),
  Schema.filter(validDate),
);
export const DateTimeString = Schema.String.pipe(
  Schema.pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/u),
  Schema.filter(validDate),
);
