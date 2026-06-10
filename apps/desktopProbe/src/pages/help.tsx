import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@first2apply/ui';

import { CompactPageHeader, CompactPanel } from '@/components/compact/compactLayout';
import { DefaultLayout } from './defaultLayout';

export function HelpPage() {
  return (
    <DefaultLayout className="flex flex-col space-y-3">
      <CompactPageHeader title="FAQs" />

      <CompactPanel title="Common Questions">
        <Accordion type="single" collapsible className="w-full px-2">
          <AccordionItem value="item-1" className="py-1">
            <AccordionTrigger className="text-sm font-medium hover:text-primary hover:no-underline">
              Why is this a desktop app and not a website?
            </AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground">
              To maintain affordability for our users, the app is designed to utilize your device to refresh your saved
              job searches. This method helps us avoid the higher costs associated with using our own servers for this
              task.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-2" className="py-1">
            <AccordionTrigger className="text-sm font-medium hover:text-primary hover:no-underline">
              Does the app automatically apply to jobs for me?
            </AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground">
              No - the app does not apply to jobs on your behalf ... yet. We are planning to add this feature in the
              future, but for now, the app is designed to help you find more job opportunities.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-3" className="py-1">
            <AccordionTrigger className="text-sm font-medium hover:text-primary hover:no-underline">
              Can it filter out jobs that I'm not interested in?
            </AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground">
              Yes! LinkedIn can sometimes show you jobs that are not relevant to your search (even with the filters you
              set). With <b>Advanced Matching</b> the app allows you to filter out jobs based on keywords in job titles,
              companies or even the job description.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-4" className="py-1">
            <AccordionTrigger className="text-sm font-medium hover:text-primary hover:no-underline">
              What happens if I close my computer?
            </AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground">
              If you close your computer, the app will temporarily pause its job search operations. It will
              automatically reactivate and continue searching for new jobs once you power on your computer again. For
              uninterrupted service, we've included a setting in the app that can keep your computer awake while the app
              is in use.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-5" className="py-1">
            <AccordionTrigger className="text-sm font-medium hover:text-primary hover:no-underline">
              How will I see new job alerts when I'm not in front on my computer?
            </AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground">
              The app is designed to send you email notifications for new found jobs. This way you can apply to jobs
              even when you are not in front of your computer. You can disable the email notifications in the app
              settings.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-6" className="border-b-0 py-1">
            <AccordionTrigger className="text-sm font-medium hover:text-primary hover:no-underline">
              Can I navigate the app using my keyboard?
            </AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground">
              Yes! The app is designed to be fully accessible using your keyboard.
              <ul className="mt-1 pl-5 text-[11px]" style={{ listStyleType: 'initial' }}>
                <li>
                  <b>Left/Right arrows</b>: switch between job tabs
                </li>
                <li>
                  <b>Up/Down arrows</b>: navigate through job listings
                </li>
                <li>
                  <b>Cmd+a / Ctrl+a</b>: archive selected job
                </li>
                <li>
                  <b>Cmd+d / Ctrl+d</b>: delete selected job
                </li>
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CompactPanel>

      <p className="text-xs text-muted-foreground">
        Didn&apos;t find what you need? Email us at{' '}
        <a href="mailto:contact@first2apply.com" className="text-primary underline">
          contact@first2apply.com
        </a>
      </p>
    </DefaultLayout>
  );
}
