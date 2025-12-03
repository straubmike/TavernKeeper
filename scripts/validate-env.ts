#!/usr/bin/env tsx
/**
 * Environment Variable Validator
 * Checks for required environment variables and reports missing ones
 * Also checks for .env file in Render secret files location
 */

import * as fs from 'fs';
import * as path from 'path';

// Load .env file if it exists (Render Secret Files)
function loadEnvFile(): void {
  const envPaths = [
    '/etc/secrets/.env', // Render secret files location
    path.join(process.cwd(), '.env'), // App root
    path.join(__dirname, '../.env'), // Script relative
    path.join(process.cwd(), '..', '.env'), // Parent directory
  ];

  for (const envPath of envPaths) {
    try {
      if (fs.existsSync(envPath)) {
        console.log(`📄 Found .env file at: ${envPath}`);
        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split('\n');
        let loadedCount = 0;

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const [key, ...valueParts] = trimmed.split('=');
            const value = valueParts.join('=').trim().replace(/^["']|["']$/g, ''); // Remove quotes
            if (key && value && !process.env[key]) {
              process.env[key] = value;
              loadedCount++;
            }
          }
        }
        console.log(`✅ Loaded ${loadedCount} environment variables from .env file`);
        return;
      }
    } catch (error) {
      // Continue to next path if this one fails
      continue;
    }
  }
  console.log(`⚠️  No .env file found in expected locations`);
}

// Load .env file before validation
loadEnvFile();

// Helper function to check if any of the alternative env var names exist
function hasAnyEnvVar(alternatives: string[]): { found: boolean; name: string; value: string } {
  for (const varName of alternatives) {
    const value = process.env[varName];
    if (value && value.trim() !== '') {
      return { found: true, name: varName, value };
    }
  }
  return { found: false, name: alternatives[0], value: '' };
}

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
    // Supabase URL - accepts multiple alternatives
    'SUPABASE_URL_OR_PROJECT_URL',
    // Supabase Key - accepts multiple alternatives
    'SUPABASE_ANON_KEY_OR_API_KEY',
  ],
  worker: [
    'DATABASE_URL',
    'REDIS_URL',
    'OPENAI_API_KEY',
    // Supabase URL - accepts multiple alternatives
    'SUPABASE_URL_OR_PROJECT_URL',
    // Supabase Key - accepts multiple alternatives
    'SUPABASE_ANON_KEY_OR_API_KEY',
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
    'NEXT_PUBLIC_PRIVY_APP_ID',
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
    // Special handling for Supabase variables that accept alternatives
    if (varName === 'SUPABASE_URL_OR_PROJECT_URL') {
      const alternatives = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'SUPABASE_URL',
        'SUPABASE_PROJECT_URL',
        'NEXT_PUBLIC_SUPABASE_PROJECT_URL',
      ];
      const result = hasAnyEnvVar(alternatives);
      if (!result.found) {
        missing.push('SUPABASE_URL (or any alternative)');
        console.log(`❌ MISSING (REQUIRED): SUPABASE_URL (checked: ${alternatives.join(', ')})`);
      } else {
        present.push(result.name);
        const masked = result.value.substring(0, 20) + '...';
        console.log(`✅ ${result.name}=${masked}`);
      }
      continue;
    }

    if (varName === 'SUPABASE_ANON_KEY_OR_API_KEY') {
      const alternatives = [
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_ANON_KEY',
        'SUPABASE_API_KEY',
        'NEXT_PUBLIC_SUPABASE_KEY',
        'NEXT_PUBLIC_SUPABASE_API_KEY',
      ];
      const result = hasAnyEnvVar(alternatives);
      if (!result.found) {
        missing.push('SUPABASE_ANON_KEY (or any alternative)');
        console.log(`❌ MISSING (REQUIRED): SUPABASE_ANON_KEY (checked: ${alternatives.join(', ')})`);
      } else {
        present.push(result.name);
        const masked = result.value.substring(0, 4) + '...' + result.value.substring(result.value.length - 4);
        console.log(`✅ ${result.name}=${masked}`);
      }
      continue;
    }

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
