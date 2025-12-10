#!/usr/bin/env tsx
/**
 * Environment Variable Validator
 * Checks for required environment variables and reports missing ones
 * Also checks for .env file in Render secret files location
 */

import * as fs from 'fs';
import * as path from 'path';

// Load .env file if it exists (Render Secret Files or local development)
function loadEnvFile(): void {
  console.log('Current working directory:', process.cwd());

  // Check if we're in Render
  const isRender = process.env.RENDER === 'true' || process.env.RENDER_SERVICE_NAME;

  if (isRender) {
    console.log('🌐 Running on Render - checking for .env file from environment variable group secret files');

    // FIRST: Check what's actually in /etc/secrets directory
    try {
      if (fs.existsSync('/etc/secrets')) {
        const secrets = fs.readdirSync('/etc/secrets');
        console.log(`📁 Contents of /etc/secrets: ${secrets.length > 0 ? secrets.join(', ') : 'empty'}`);

        // Look for .env file (could be .env or env or any variation)
        for (const file of secrets) {
          const filePath = `/etc/secrets/${file}`;
          console.log(`   Checking: ${filePath}`);

          if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            if (stats.isFile()) {
              console.log(`   ✅ Found file: ${file} (${stats.size} bytes)`);

              // Try to read it as .env
              try {
                const content = fs.readFileSync(filePath, 'utf8');
                console.log(`   📄 Reading file: ${filePath}`);
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
                console.log(`✅ Loaded ${loadedCount} environment variables from ${filePath}`);
                return;
              } catch (readError) {
                console.log(`   ⚠️  Error reading ${filePath}: ${readError instanceof Error ? readError.message : String(readError)}`);
              }
            }
          }
        }
      } else {
        console.log(`   ⚠️  /etc/secrets directory does not exist`);
      }
    } catch (e) {
      console.log(`   ⚠️  Error checking /etc/secrets: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Try other potential paths
  const envPaths: string[] = [];

  if (isRender) {
    // Render secret files from environment variable groups (already checked /etc/secrets above)
    envPaths.push('/opt/render/.secrets/.env');
    if (process.env.RENDER_PROJECT_ROOT) {
      envPaths.push(path.join(process.env.RENDER_PROJECT_ROOT, '.secrets', '.env'));
    }
  }

  // Local development paths
  envPaths.push(path.join(process.cwd(), '.env')); // App root
  envPaths.push(path.join(__dirname, '../.env')); // Script relative
  envPaths.push(path.join(process.cwd(), '..', '.env')); // Parent directory

  for (const envPath of envPaths) {
    try {
      console.log(`   Checking: ${envPath}`);
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
      console.log(`   ⚠️  Error checking ${envPath}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
  }

  if (isRender) {
    console.log(`⚠️  No .env file found in any expected locations`);
    console.log(`\n📌 IMPORTANT: According to Render documentation:`);
    console.log(`   Secret files are available at RUNTIME, NOT during builds.`);
    console.log(`   If you have a .env file as a secret file in your environment group,`);
    console.log(`   it will NOT be available during the build phase.`);
    console.log(`\n✅ SOLUTION: Add environment variables directly to the environment group:`);
    console.log(`   1. Go to Environment Groups in Render dashboard`);
    console.log(`   2. Edit your "TavernKeeper" group`);
    console.log(`   3. Add each variable as an Environment Variable (not a secret file)`);
    console.log(`   4. Or use "Add from .env" to bulk-add from your .env file`);
    console.log(`\n   See: https://render.com/docs/configure-environment-variables#environment-groups`);
  } else {
    console.log(`⚠️  No .env file found in expected locations`);
  }
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

  // Debug: Check if we're on Render and show available env vars (masked)
  const isRender = process.env.RENDER === 'true' || process.env.RENDER_SERVICE_NAME;
  if (isRender) {
    console.log(`\n🌐 Running on Render (Service: ${process.env.RENDER_SERVICE_NAME || 'unknown'})`);
    const allEnvKeys = Object.keys(process.env).sort();
    console.log(`📋 Found ${allEnvKeys.length} environment variables in process.env`);

    // Show all non-sensitive env var names for debugging
    const nonSensitiveKeys = allEnvKeys.filter(k =>
      !k.includes('SECRET') &&
      !k.includes('KEY') &&
      !k.includes('TOKEN') &&
      !k.includes('PASSWORD') &&
      !k.includes('PRIVATE')
    );
    console.log(`   Non-sensitive variables found: ${nonSensitiveKeys.length > 0 ? nonSensitiveKeys.join(', ') : 'none'}`);

    // Check for specific variables we're looking for
    const lookingFor = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL', 'OPENAI_API_KEY',
                        'NEXT_PUBLIC_MONAD_CHAIN_ID', 'NEXT_PUBLIC_MONAD_RPC_URL',
                        'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_PROJECT_URL',
                        'NEXT_PUBLIC_SUPABASE_PROJECT_URL', 'SUPABASE_ANON_KEY',
                        'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
    const foundLookingFor = lookingFor.filter(k => process.env[k]);
    const missingLookingFor = lookingFor.filter(k => !process.env[k]);

    if (foundLookingFor.length > 0) {
      console.log(`   ✅ Found some target variables: ${foundLookingFor.join(', ')}`);
    }
    if (missingLookingFor.length > 0) {
      console.log(`   ❌ Missing target variables: ${missingLookingFor.join(', ')}`);
    }

    if (allEnvKeys.length < 10) {
      console.log(`\n⚠️  Very few environment variables found during build phase`);
      console.log(`   This might mean environment variable groups are only available at runtime, not during builds`);
      console.log(`   Consider: 1) Attaching the group to the service, 2) Adding variables directly to the service, or 3) Using Render Secret Files`);
    }
  }

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

    if (isRender) {
      // Check if we're in a build context (buildCommand) vs runtime
      const isBuildPhase = process.env.RENDER_BUILD_COMMAND || !process.env.RENDER_EXTERNAL_URL;

      console.log(`\n💡 To fix this on Render:`);

      if (isBuildPhase) {
        console.log(`   ⚠️  You're in the BUILD phase - environment variable groups may not be available yet`);
        console.log(`   Solutions:`);
        console.log(`   1. Add variables DIRECTLY to the service (not just in the group):`);
        console.log(`      - Go to service → Environment tab`);
        console.log(`      - Click "Add Environment Variable"`);
        console.log(`      - Add each missing variable above`);
        console.log(`   2. OR use Render Secret Files for build-time variables`);
        console.log(`   3. OR ensure the environment variable group is properly attached:`);
        console.log(`      - Go to service → Environment tab`);
        console.log(`      - Check that your env var group is listed under "Environment Variable Groups"`);
        console.log(`      - If not, click "Link Environment Variable Group" and select your group`);
      } else {
        console.log(`   1. Go to your service in Render dashboard`);
        console.log(`   2. Click "Environment" tab`);
        console.log(`   3. If using an Environment Variable Group:`);
        console.log(`      - Make sure the group is attached to this service`);
        console.log(`      - Verify all required variables are in the group`);
        console.log(`   4. If not using a group, add variables directly:`);
        console.log(`      - Click "Add Environment Variable"`);
        console.log(`      - Add each missing variable above`);
      }
    } else {
      console.log(`\n💡 Add these to your .env file for local development`);
    }
    console.log(``);
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
