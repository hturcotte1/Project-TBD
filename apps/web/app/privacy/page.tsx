import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PageTitle, Prose, TextLink } from '@/components/system';

export const metadata: Metadata = { title: 'Privacy' };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-17 font-semibold">{title}</h2>
      <Prose>{children}</Prose>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-8 px-4 py-8 lg:px-8 lg:py-12">
      {/* Warms the Bricolage font file, unused elsewhere on this page. */}
      <VisuallyHidden>
        <span className="font-count">0</span>
      </VisuallyHidden>
      <div className="flex flex-col gap-2">
        <PageTitle>Privacy</PageTitle>
        <p className="max-w-measure text-14 text-fg-2">
          This page describes how the product actually works. If anything here seems off, that is a bug. Tell us.
        </p>
      </div>

      <div className="flex flex-col gap-8">
        <Section title="What is stored">
          <p>We keep only what your application needs:</p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>Your profile: name, school, grad year, GPA, test scores, activities, goals, and anything you tell the intangibles interview.</li>
            <li>Your Common App state: a normalized snapshot of what is filled in, in progress, or missing, captured each time we sync.</li>
            <li>Your school list, deadlines, checklist items, essays and drafts, and recommender status.</li>
            <li>Every message between you and the agent, on iMessage and on this dashboard, one shared conversation.</li>
            <li>A record of what the agent did and why: every tool call, every browser session, every approval you answered.</li>
          </ul>
          <p>
            Your Common App password is encrypted at rest (AES-256-GCM) and decrypted only inside the background worker, only for the
            few seconds it takes to run a sync or a fill, never in a request you can see and never logged. If Common App ever asks for a
            text-message verification code, that code passes through a short-lived queue and is never written to our database.
          </p>
        </Section>

        <Section title="What the agent can do">
          <p>
            The agent reads your real Common App account, compares it against what colleges actually require, and figures out what to
            do next. With your data, and only your data, it can:
          </p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>Draft answers, activity descriptions, and reminders for you to review.</li>
            <li>Fill in a section of Common App, but only after you say yes to the exact text it plans to type, field by field.</li>
            <li>
              Text you proactively about deadlines, a recommender who has not submitted, or a stale draft, never during your quiet
              hours, and never more than your chosen intensity allows.
            </li>
            <li>Give feedback on your essays (structure, clarity, whether it answers the prompt) without ever writing or rewriting a sentence for you.</li>
          </ul>
        </Section>

        <Section title="What the agent cannot do">
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>It never submits an application. A hard, always-on guard blocks any submit or payment action, independent of what any model decides.</li>
            <li>It never writes essay text on your behalf; feedback comes back as structured notes and questions, never suggested prose.</li>
            <li>It never fills anything without your explicit approval of that exact content.</li>
            <li>It never sees another student&rsquo;s data; every request is scoped to your account and checked in code, not just by convention.</li>
            <li>It treats anything it reads off a web page, a document, or a photo as data, never as an instruction, so a page cannot talk it into doing something you did not ask for.</li>
          </ul>
        </Section>

        <Section title="Who can see this">
          <p>
            You, and the small team operating this product for support and debugging. We do not sell data, and we do not use it to
            train models beyond the run that answers your own request.
          </p>
        </Section>

        <Section title="Disconnecting Common App">
          <p>
            Disconnect from <TextLink href="/settings">Settings</TextLink> at any time. That deletes your stored credentials
            immediately and cancels any browser jobs already queued. Nothing already synced is deleted, only your saved password and
            any future ability to log back in on your behalf.
          </p>
        </Section>

        <Section title="Deleting your account">
          <p>
            Deleting your account from Settings permanently removes every row tied to you (profile, activities, essays, messages,
            approvals, audit history, uploaded documents, and any stored credentials) along with everything in object storage. This
            runs as a single job and cannot be undone. You can also export a copy of your data first from the same page.
          </p>
        </Section>
      </div>
    </main>
  );
}
