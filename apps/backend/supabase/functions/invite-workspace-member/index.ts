import { getExceptionMessage } from '@first2apply/core';

import { CORS_HEADERS } from '../_shared/cors.ts';
import { getEdgeFunctionContext } from '../_shared/edgeFunctions.ts';
import { createLoggerWithMeta } from '../_shared/logger.ts';
import { createAppMailer } from '../_shared/emails/mailer.ts';
import { EmailTemplateType } from '../_shared/emails/emailTemplates.ts';

type InvitePayload = { email?: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const logger = createLoggerWithMeta({ function: 'invite-workspace-member' });
  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const context = await getEdgeFunctionContext({ logger, req, checkAuthorization: true });
    const { data: isOwner, error: ownerError } = await context.supabaseClient.rpc('is_workspace_owner');
    if (ownerError) throw ownerError;
    if (!isOwner) return json({ error: 'Only the workspace owner can send invitations.' }, 403);

    const email = String(((await req.json()) as InvitePayload).email ?? '').trim().toLowerCase();
    if (!email || !email.includes('@')) return json({ error: 'A valid helper email is required.' }, 400);
    if (email === context.user.email?.toLowerCase()) return json({ error: 'The owner cannot invite itself.' }, 400);

    let memberUserId: string | null = null;
    let status: 'pending' | 'accepted' = 'pending';
    let existingUserMagicLink: string | null = null;
    const webAppUrl = Deno.env.get('WEBAPP_URL') || 'https://apply.pritk.com';
    const redirectTo = `${webAppUrl}/auth/callback?next=/team`;
    const existingUser = await findUserByEmail(context.supabaseAdminClient, email);
    if (existingUser) {
      memberUserId = existingUser.id;
      status = 'accepted';
      const { data, error } = await context.supabaseAdminClient.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo },
      });
      if (error) throw error;
      existingUserMagicLink = data.properties?.action_link ?? null;
    } else {
      const { data, error } = await context.supabaseAdminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo,
      });
      if (error) throw error;
      memberUserId = data.user?.id ?? null;
    }
    if (!memberUserId) throw new Error('Supabase did not return the invited user id.');

    const { error: membershipError } = await context.supabaseAdminClient
      .from('workspace_memberships')
      .upsert({ workspace_owner_id: context.user.id, member_user_id: memberUserId, member_email: email, role: 'helper' }, {
        onConflict: 'workspace_owner_id,member_user_id',
      });
    if (membershipError) throw membershipError;

    const { data: previousInvitation } = await context.supabaseAdminClient
      .from('workspace_invitations')
      .select('id')
      .eq('workspace_owner_id', context.user.id)
      .ilike('email', email)
      .maybeSingle();
    const invitationQuery = previousInvitation
      ? context.supabaseAdminClient.from('workspace_invitations').update({ member_user_id: memberUserId, status }).eq('id', previousInvitation.id)
      : context.supabaseAdminClient.from('workspace_invitations').insert({ workspace_owner_id: context.user.id, email, member_user_id: memberUserId, status });
    const { error: invitationError } = await invitationQuery;
    if (invitationError) throw invitationError;

    if (existingUserMagicLink) {
      const mailer = createAppMailer(context.env);
      await mailer.sendEmail({
        logger,
        to: email,
        template: {
          type: EmailTemplateType.workspaceInvitation,
          payload: {
            ownerEmail: context.user.email ?? 'Your workspace owner',
            appUrl: webAppUrl,
            magicLink: existingUserMagicLink,
          },
        },
      });
    }

    return json({ status });
  } catch (error) {
    logger.error(getExceptionMessage(error));
    return json({ error: getExceptionMessage(error, true) }, 500);
  }
});

async function findUserByEmail(client: any, email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((candidate: { email?: string }) => candidate.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 1000) break;
  }
  return null;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
