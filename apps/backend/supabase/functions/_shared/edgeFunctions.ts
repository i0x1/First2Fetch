import { First2ApplyBackendEnv, parseEnv } from './env.ts';

import { DbSchema, User } from '@first2apply/core';
import { createClient } from '@supabase/supabasefork';

import { ILogger } from './logger.ts';

// Function overloads for type safety based on checkAuthorization
export type EdgeFunctionAnonymousContext = {
  logger: ILogger;
  user: null; // always null when checkAuthorization is false
  supabaseClient: ReturnType<typeof createClient<DbSchema>>;
  supabaseAdminClient: ReturnType<typeof createClient<DbSchema>>;
  env: First2ApplyBackendEnv;
};
export type EdgeFunctionAuthorizedContext = Omit<EdgeFunctionAnonymousContext, 'user'> & {
  user: User; // non-optional when checkAuthorization is true
};

/**
 * Infrastructure function to get the context for an edge function,
 * including logger, supabase clients, and user info if authorized.
 */
export async function getEdgeFunctionContext({
  logger,
  req,
  checkAuthorization,
}: {
  logger: ILogger;
  req: Request;
  checkAuthorization: false;
}): Promise<EdgeFunctionAnonymousContext>;
export async function getEdgeFunctionContext({
  logger,
  req,
  checkAuthorization,
}: {
  logger: ILogger;
  req: Request;
  checkAuthorization: true;
}): Promise<EdgeFunctionAuthorizedContext>;

// actual implementation
export async function getEdgeFunctionContext({
  logger,
  req,
  checkAuthorization,
}: {
  logger: ILogger;
  req: Request;
  checkAuthorization: boolean;
}) {
  const env = parseEnv();
  const requestId = crypto.randomUUID();
  logger.addMeta('request_id', requestId);

  const supabaseAdminClient = createClient<DbSchema>(env.supabaseUrl, env.supabaseServiceRoleKey);
  let supabaseClient = supabaseAdminClient;
  let user: User | null = null;
  if (checkAuthorization) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      logger.error('Missing Authorization header');
      throw new Error('Missing Authorization header');
    }

    logger.info(`Authorization header present, length: ${authHeader.length}`);

    // Create admin client for database operations (uses service role key)
    // But create a separate client for auth verification (uses anon key with user's JWT)
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? env.supabaseServiceRoleKey;
    const authClient = createClient<DbSchema>(env.supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: getUserError } = await authClient.auth.getUser();
    if (getUserError) {
      logger.error(`getUser error: ${getUserError.message}`, { error: getUserError });
      throw new Error(getUserError.message);
    }

    if (!userData?.user) {
      logger.error('getUser returned no user data', { userData });
      throw new Error('Invalid authentication token');
    }

    user = {
      id: userData?.user?.id ?? '',
      email: userData?.user?.email ?? '',
    };
    logger.addMeta('user_id', user?.id ?? '');
    logger.addMeta('user_email', user?.email ?? '');
    logger.info(`User authenticated successfully: ${user.id}`);
    
    // Keep a user-scoped client for regular DB operations so auth.uid() and RLS work as expected.
    // Use supabaseAdminClient explicitly only where elevated privileges are required.
    supabaseClient = authClient;
  }

  return {
    logger,
    user,
    supabaseClient,
    supabaseAdminClient,
    env,
  };
}
