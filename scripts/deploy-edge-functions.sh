#!/bin/sh
set -e
cd "$(dirname "$0")/.."
npx supabase functions deploy password-account --no-verify-jwt
npx supabase functions deploy send-auth-code --no-verify-jwt
npx supabase functions deploy plaid --no-verify-jwt
