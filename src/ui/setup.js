/** Friendly setup screen when Supabase isn't configured. */

export function renderSetupScreen(root) {
  root.innerHTML = `
    <section class="setup-card" aria-labelledby="setup-title">
      <div class="setup-icons">
        <img src="${import.meta.env.BASE_URL}assets/strawberry.svg" alt="" width="48" height="56" />
        <img src="${import.meta.env.BASE_URL}assets/corgi.svg" alt="" width="48" height="42" />
      </div>
      <h2 id="setup-title">Almost ready to nom!</h2>
      <p class="setup-lead">
        Supabase isn't configured yet — no crashing, just a tiny bit of kitchen setup
        so parents can plan together in realtime.
      </p>
      <ol class="setup-steps">
        <li>Create a free Supabase project.</li>
        <li>In the SQL editor, run <code>supabase/schema.sql</code> from this repo (creates tables, RLS, seed meals, realtime).</li>
        <li>Copy the project URL + anon key from <strong>Settings → API</strong>.</li>
        <li>Either:
          <ul>
            <li>Add a <code>.env</code> with <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then rebuild, <em>or</em></li>
            <li>Copy <code>public/config.json.example</code> → <code>public/config.json</code> (or <code>dist/config.json</code> on Pages) and fill in the values — no rebuild needed.</li>
          </ul>
        </li>
        <li>Fixed household id (v1 couple-app): <code>c0ffee00-5a1a-4000-8000-00000000cafe</code></li>
      </ol>
      <p class="setup-note">
        This is a simple shared-household model with anon read/write for that one UUID —
        perfect for two parents, not multi-tenant SaaS security.
      </p>
      <p class="setup-paw">Made with crumbs, kisses &amp; corgi energy 🐾🍓</p>
    </section>
  `;
}
