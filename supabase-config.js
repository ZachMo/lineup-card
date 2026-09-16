// Your Supabase project.
//
// Both values are meant to be public. The publishable key only lets a visitor ask
// the database questions; the rules in schema.sql decide what comes back, and they
// let each coach touch only their own rows.
//
// Two keys look alike, and only one belongs here:
//   sb_publishable_...  (older projects: "anon public")  -> safe, use this one
//   sb_secret_...       (older projects: "service_role")  -> never put it here
// The secret key ignores every rule, and this file ships to every browser.
window.LINEUP_CONFIG = {
  url: 'https://cvzdpghpssscgmnwjoen.supabase.co',
  publishableKey: 'sb_publishable_2zpScWoB2-hm8hEnPLQlrg_BDfiYolj',
};
