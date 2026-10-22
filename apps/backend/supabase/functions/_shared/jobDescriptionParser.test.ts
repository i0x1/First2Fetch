import { SiteProvider } from '@first2apply/core';
import { parseJobDescriptionUpdates } from './jobDescriptionParser.ts';

Deno.test('Indeed falls back to visible description when embedded data is not JSON', async () => {
  const result = await parseJobDescriptionUpdates({
    site: { provider: SiteProvider.indeed } as never,
    job: {} as never,
    user: {} as never,
    logger: {} as never,
    supabaseAdminClient: {} as never,
    html: `<script>window._initialData = {bad: 'javascript object'};</script>
      <div id="jobDescriptionText"><p>Visible job description</p></div>`,
  });

  if (!result.description?.includes('Visible job description')) {
    throw new Error(`Expected visible description, got ${result.description}`);
  }
});

Deno.test('Indeed reads the description from current view-job page data', async () => {
  const result = await parseJobDescriptionUpdates({
    site: { provider: SiteProvider.indeed } as never,
    job: {} as never,
    user: {} as never,
    logger: {} as never,
    supabaseAdminClient: {} as never,
    html: `<script>window._rootProps = {"preloadedVJData":{"sanitizedJobDescription":"\\u003Cdiv>\\u003Cp>Current Indeed description\\u003C\\u002Fp>\\u003C\\u002Fdiv>"}};
      window._initialData = {viewJobClientSideModel: window._rootProps.preloadedVJData};</script>`,
  });

  if (result.description !== 'Current Indeed description') {
    throw new Error(`Expected the embedded description, got ${result.description}`);
  }
});
