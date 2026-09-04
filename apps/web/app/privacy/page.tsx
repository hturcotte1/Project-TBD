import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: 'Privacy' };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3 text-sm leading-6 text-muted-foreground">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <div className="space-y-2 pb-8">
        <p className="text-sm font-medium text-primary">Privacy, in plain language</p>
        <h1 className="text-2xl font-semibold tracking-tight">What we store, what the agent can do, and how to leave</h1>
        <p className="text-sm text-muted-foreground">
          This page describes how the product actually works. If anything here seems off, that&rsquo;s a bug — tell us.
        </p>
      </div>

      <div className="space-y-10">
        <Section title="What is stored">
          <p>We keep only what your application needs:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Your profile — name, school, grad year, GPA, test scores, activities, goals, and anything you tell the intangibles interview.</li>
            <li>Your Common App state — a normalized snapshot of what&rsquo;s filled in, in progress, or missing, captured each time we sync.</li>
            <li>Your school list, deadlines, checklist items, essays and drafts, and recommender status.</li>
            <li>Every message between you and the agent, on iMessage and on this dashboard — one shared conversation.</li>
            <li>A record of what the agent did and why: every tool call, every browser session, every approval you answered.</li>
          </ul>
          <p>
            Your Common App password is encrypted at rest (AES-256-GCM) and decrypted only inside the background worker, only for the
            few seconds it takes to run a sync or a fill — never in a request you can see, never logged. If Common App ever asks for a
            text-message verification code, that code passes through a short-lived queue and is never written to our database.
          </p>
        </Section>

        <Section title="What the agent can do">
          <p>
            The agent reads your real Common App account, compares it against what colleges actually require, and figures out what to
            do next. With your data, and only your data, it can:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Draft answers, activity descriptions, and reminders for you to review.</li>
            <li>Fill in a section of Common App — but only after you say yes to the exact text it plans to type, field by field.</li>
            <li>Text you proactively about deadlines, a recommender who hasn&rsquo;t submitted, or a stale draft — never during your quiet hours, and never more than your chosen intensity allows.</li>
            <li>Give feedback on your essays — structure, clarity, whether it answers the prompt — without ever writing or rewriting a sentence for you.</li>
          </ul>
        </Section>

        <Section title="What the agent can&rsquo;t do">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>It never submits an application. A hard, always-on guard blocks any submit or payment action, independent of what any model decides.</li>
            <li>It never writes essay text on your behalf — feedback comes back as structured notes and questions, never suggested prose.</li>
            <li>It never fills anything without your explicit approval of that exact content.</li>
            <li>It never sees another student&rsquo;s data — every request is scoped to your account and checked in code, not just by convention.</li>
            <li>It treats anything it reads off a web page, a document, or a photo as data, never as an instruction — a page can&rsquo;t talk it into doing something you didn&rsquo;t ask for.</li>
          </ul>
        </Section>

        <Section title="Who can see this">
          <p>
            You, and the small team operating this product for support and debugging. We don&rsquo;t sell data, and we don&rsquo;t use it
            to train models beyond the run that answers your own request.
          </p>
        </Section>

        <Section title="Disconnecting Common App">
          <p>
            Disconnect from <Link href="/settings" className="text-primary underline underline-offset-2">Settings</Link> at any time.
            That deletes your stored credentials immediately and cancels any browser jobs already queued. Nothing already synced is
            deleted — only your saved password and any future ability to log back in on your behalf.
          </p>
        </Section>

        <Section title="Deleting your account">
          <p>
            Deleting your account from Settings permanently removes every row tied to you — profile, activities, essays, messages,
            approvals, audit history, uploaded documents, and any stored credentials — along with everything in object storage. This
            runs as a single job and cannot be undone. You can also export a copy of your data first from the same page.
          </p>
        </Section>
      </div>
    </main>
  );
}
