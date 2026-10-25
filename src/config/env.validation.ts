const REQUIRED = ['DATABASE_URL', 'JWT_SECRET'] as const;

/** Fails fast on startup when a required env variable is missing. */
export function validateEnv(config: Record<string, unknown>) {
  const missing = REQUIRED.filter((key) => !config[key]);
  if (missing.length) {
    throw new Error(
      `Missing env variables: ${missing.join(', ')}. Copy .env.example to .env and fill them in.`,
    );
  }
  return config;
}
