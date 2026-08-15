'use client';

import { useActionState } from 'react';
import { loginAction, type LoginState } from './actions';

const INITIAL: LoginState = { error: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, INITIAL);

  return (
    <form action={action} className="mt-8 space-y-4">
      <label className="block text-xs text-ink-60" htmlFor="password">رمز عبور</label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        dir="ltr"
        className="w-full border border-cream-200 bg-transparent px-4 py-3 text-sm focus:border-ink focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-ink py-3 text-sm text-cream hover:bg-sand-dark disabled:opacity-50"
      >
        {pending ? 'در حال ورود…' : 'ورود'}
      </button>
      {state.error && <p role="alert" className="text-xs text-clay">{state.error}</p>}
    </form>
  );
}
