#!/usr/bin/env tsx
/**
 * Environment Variable Validator
 * Checks for required environment variables and reports missing ones
 */

const requiredEnvVars: Record<string, string[]> = {
  web: [
    'DATABASE_URL',
    'REDIS_URL',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
    'OPENAI_API_KEY',
    'NEXT_PUBLIC_USE_LOCALHOST',
    'NEXT_PUBLIC_MONAD_CHAIN_ID',
    'NEXT_PUBLIC_MONAD_RPC_URL',
  ],
  worker: [
    'DATABASE_URL',
    'REDIS_URL',
    'OPENAI_API_KEY',
  ],
  'discord-bot': [
    'DISCORD_BOT_TOKEN',
    'DISCORD_CLIENT_ID',
    'DISCORD_GUILD_ID',
    'DATABASE_URL',
    'OPENAI_API_KEY',
  ],
};

const optionalEnvVars: Record<string, string[]> = {
  web: [
    'ELIZA_URL',
    'ELIZA_API_KEY',
    'FARCASTER_SIGNER_KEY',
    'NEXT_PUBLIC_FEE_RECIPIENT_ADDRESS',
    'NEXT_PUBLIC_PRICING_SIGNER_ADDRESS',
  ],
  worker: [
    'ELIZA_URL',
    'ELIZA_API_KEY',
  ],
  'discord-bot': [
    'ELIZA_URL',
    'ELIZA_API_KEY',
    'DISCORD_API_BASE_URL',
  ],
};

function validateEnv(service: 'web' | 'worker' | 'discord-bot'): boolean {
  const required = requiredEnvVars[service] || [];
  const optional = optionalEnvVars[service] || [];
  const missing: string[] = [];
  const present: string[] = [];
  const warnings: string[] = [];

  console.log(`\n🔍 Validating environment variables for: ${service}`);
  console.log('='.repeat(60));

  // Check required vars
  for (const varName of required) {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      missing.push(varName);
      console.log(`❌ MISSING (REQUIRED): ${varName}`);
    } else {
      // Special validation for NEXTAUTH_URL
      if (varName === 'NEXTAUTH_URL' && (value.includes('127.0.0.1') || value.includes('localhost') || value === 'http://127.0.0.1:3000')) {
        console.log(`⚠️  ${varName} is set to localhost - update to your Render URL after deployment`);
      }

      // Special validation for NEXTAUTH_SECRET
      if (varName === 'NEXTAUTH_SECRET' && (value === 'replace-me-with-random-string' || value.length < 32)) {
        console.log(`⚠️  ${varName} should be a random string (32+ chars) - generate with: openssl rand -base64 32`);
      }

      present.push(varName);
      // Mask sensitive values
      const masked = varName.includes('KEY') || varName.includes('TOKEN') || varName.includes('SECRET') || varName.includes('PASSWORD')
        ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
        : value;
      console.log(`✅ ${varName}=${masked}`);
    }
  }

  // Check optional vars
  for (const varName of optional) {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      warnings.push(varName);
      console.log(`⚠️  MISSING (OPTIONAL): ${varName}`);
    } else {
      const masked = varName.includes('KEY') || varName.includes('TOKEN') || varName.includes('SECRET')
        ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
        : value;
      console.log(`✅ ${varName}=${masked} (optional)`);
    }
  }

  console.log('='.repeat(60));
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Present: ${present.length}/${required.length} required`);
  console.log(`   ❌ Missing: ${missing.length} required`);
  console.log(`   ⚠️  Optional: ${warnings.length} missing`);

  if (missing.length > 0) {
    console.log(`\n❌ BUILD FAILED: Missing required environment variables:`);
    missing.forEach(v => console.log(`   - ${v}`));
    console.log(`\n💡 Set these in Render dashboard: Service → Environment → Add variable`);
    console.log(`   Or add them to your .env file for local development.\n`);
    return false;
  }

  if (warnings.length > 0) {
    console.log(`\n⚠️  WARNING: Some optional variables are missing (build will continue):`);
    warnings.forEach(v => console.log(`   - ${v}`));
  }

  console.log(`\n✅ All required environment variables are present!\n`);
  return true;
}

// Get service type from command line or environment
const service = (process.argv[2] || process.env.RENDER_SERVICE_TYPE || 'web') as 'web' | 'worker' | 'discord-bot';

if (!['web', 'worker', 'discord-bot'].includes(service)) {
  console.error(`❌ Invalid service type: ${service}`);
  console.error(`   Valid options: web, worker, discord-bot`);
  process.exit(1);
}

const isValid = validateEnv(service);
process.exit(isValid ? 0 : 1);
