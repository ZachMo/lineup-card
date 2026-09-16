# Setup

What you do once, in order. Budget about 30 minutes.

The page works with no setup at all: open `index.html` and everything saves in the
browser. The steps below add accounts, so a coach can open the same team anywhere.

## 1. Create the Supabase project

1. Go to <https://supabase.com> and sign up. The free tier is enough.
2. Press **New project**.
3. Name it `lineup-card`.
4. Pick the region closest to your coaches. `East US (North Virginia)` for Texas.
5. Supabase generates a database password. Save it in your password manager. You
   will not need it for this site, but you cannot see it again later.
6. Press **Create new project** and wait about two minutes.

## 2. Create the tables

1. In the left sidebar, open **SQL Editor**.
2. Press **New query**.
3. Open `schema.sql` from this repo, copy all of it, and paste it in.
4. Press **Run**. You should see "Success. No rows returned".

This makes two tables and the rules that keep each coach's rows private. Check it
worked: open **Table Editor** and you should see `teams` and `lineups`, each with a
green **RLS enabled** label. If either says RLS is off, stop and rerun the script.

## 3. Turn on email sign-in

1. Open **Authentication > Sign In / Providers**.
2. **Email** should be on. Leave **Confirm email** on.
3. Turn **off** "Allow anonymous sign-ins" if you see it.

## 4. Set the redirect addresses

Supabase only sends people back to addresses you list.

1. Open **Authentication > URL Configuration**.
2. **Site URL**: your live address, such as `https://lineup-card.pages.dev`.
3. **Redirect URLs**: add both of these, one per line:
   - `https://lineup-card.pages.dev/**`
   - `http://localhost:8000/**`

The second one lets you test on your own machine.

## 5. Deploy to Cloudflare Pages

1. Go to <https://dash.cloudflare.com> and sign up.
2. **Workers & Pages > Create > Pages > Connect to Git**.
3. Pick the `lineup-card` repo.
4. Framework preset: **None**. Build command: leave empty. Output directory: `/`.
5. Press **Save and Deploy**. You get a `lineup-card.pages.dev` address.

A custom domain comes later: buy the name, then **Custom domains > Set up a domain**.

## 6. Paste your keys

1. In Supabase, open **Project Settings > API keys**.
2. Copy the **Project URL** and the **anon public** key.
3. Put them in `supabase-config.js` in this repo, commit, and push. Cloudflare
   redeploys on its own.

Never copy the **service_role** key into this repo. That key ignores every access
rule, and this code runs in the browser where anyone can read it.

## 7. Test it

1. Open your `pages.dev` address.
2. Type your email and press **Email me a link**.
3. Open the email, click the link, and you land back on the page, signed in.
4. Press **Save this team**, then open the same address on your phone and sign in
   with the same email. Your team is in the picker.

## Two limits to know about

**Email sending.** Supabase's built-in email is for testing only, at a few messages
an hour. Before real coaches use this, add your own sender: create a free
[Resend](https://resend.com) account, then in Supabase open **Authentication >
Emails > SMTP Settings** and paste the Resend details. This also stops sign-in
emails landing in spam.

**Sleeping projects.** A free Supabase project pauses after 7 days with no
activity, and the first visit after that fails. Once you have real users this stops
happening. During a quiet off-season, open the dashboard now and then, or move to
the $25 a month plan.
