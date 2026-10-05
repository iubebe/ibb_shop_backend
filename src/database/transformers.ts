import type { ValueTransformer } from 'typeorm';

/** Postgres returns `numeric` as string; expose it as a JS number. */
export const numericTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value === null || value === undefined ? value : Number(value),
};
