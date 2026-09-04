# Privacy, in plain language

This is what the college-application agent stores, what it can and cannot do on your behalf, and how to leave.

## What we store

- **Who you are**: name, phone number, school, graduation year, timezone, quiet hours, and how often you want to be nudged.
- **Your academics and activities**: GPA, test scores, courses, and your activities list (in Common App's format), plus any transcript or resume you upload.
- **Your story**: the notes and summary from the intake interview (themes, stories, values, how you talk). You can edit or redo it any time.
- **Your schools and checklist**: the schools on your list, each deadline, every requirement we track, and what we last saw in your Common App.
- **Your essays**: the drafts you write in the dashboard or paste in, every version, and the feedback the agent gave. The agent never writes essay text for you.
- **Your recommenders**: names, roles, emails you enter, and the invite/submit status we read from Common App.
- **Your conversation**: every text between you and the agent, and every dashboard message, so the agent remembers context.
- **Your Common App login**: your email and password, encrypted with AES-256-GCM. The key is not in the database. The password is decrypted only inside the worker, only at the moment a browser job logs in for you.
- **A record of everything the agent did**: each sync, each message, each thing it filled, and a link to the browser session replay.

## What the agent can do

- Read your Common App (via a cloud browser) to see which sections and supplements are complete, which recommendations are in, and what is left.
- Fill in fields with data you already gave us (activities, profile facts, or essay text you wrote), but only after you say yes to a specific proposal.
- Text you when something needs attention, within your quiet hours and nudge settings.
- Give feedback on essays, ask you questions, and draft reminder messages for *you* to send.

## What the agent cannot do

- It never clicks Submit, never pays a fee, and never sends anything to a teacher, counselor, or admissions office.
- It never writes, rewrites, or polishes essay sentences, and never puts text into an essay field that you did not write.
- It never changes something irreversible without an explicit yes from you.
- It never stores the verification codes Common App texts you; they are used once and discarded.

## What we do not share

Your data is used only to run the agent for you. It is sent to the AI model provider to generate replies and extract information from your documents, and to the browser provider to log in to Common App. It is not sold or used to train models.

## How to leave

- **Disconnect Common App** (Settings → Connected accounts): your login is deleted immediately and any queued browser jobs are cancelled.
- **Export your data** (Settings → Data): a JSON file with everything above.
- **Delete your account** (Settings → Delete account): everything, including uploads, messages, essays, and credentials, is permanently deleted in one job. You will get a confirmation text.
