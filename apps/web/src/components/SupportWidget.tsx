'use client';

// FAQ-based support chat. Answers come from support content edited in the
// admin panel (admin/support) and passed down as props from layout.tsx — no
// model call, no client-side network request, so it costs nothing beyond
// keyword matching over an already-fetched array.
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { findAnswer, type SupportContent } from '@/lib/faq';

type Message = { role: 'user' | 'bot'; text: string };

export function SupportWidget({ content }: { content: SupportContent }) {
  const { title, greeting, fallback, faqs } = content;
  const suggestions = faqs.slice(0, 4);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ role: 'bot', text: greeting }]);
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  function ask(question: string) {
    const q = question.trim();
    if (!q) return;
    const match = findAnswer(q, faqs);
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: q },
      { role: 'bot', text: match?.answer ?? fallback },
    ]);
    setInput('');
  }

  return (
    <div className="fixed bottom-4 left-4 z-50">
      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="پشتیبانی روایت"
          className="mb-3 flex h-[28rem] w-[20rem] flex-col border border-cream-200 bg-cream shadow-[0_4px_24px_rgba(19,17,16,0.15)] sm:w-[22rem]"
        >
          <div className="flex items-center justify-between border-b border-cream-200 bg-ink px-4 py-3">
            <p className="text-sm text-cream">{title}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="بستن گفتگو"
              className="text-lg leading-none text-cream hover:opacity-70"
            >
              ×
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m, i) => (
              <p
                key={i}
                className={`max-w-[85%] px-3 py-2 text-xs leading-6 ${
                  m.role === 'user'
                    ? 'mr-auto bg-ink text-cream'
                    : 'ml-auto bg-cream-100 text-ink'
                }`}
              >
                {m.text}
              </p>
            ))}
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => ask(s.question)}
                    className="border border-cream-200 px-2 py-1 text-[11px] text-ink-60 hover:border-ink hover:text-ink"
                  >
                    {s.question}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex gap-2 border-t border-cream-200 p-3"
          >
            <label className="sr-only" htmlFor="support-input">پیام شما</label>
            <input
              id="support-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="سؤال خود را بنویسید…"
              className="flex-1 border border-cream-200 bg-transparent px-3 py-2 text-xs focus:border-ink focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="bg-ink px-3 py-2 text-xs text-cream disabled:opacity-40"
            >
              ارسال
            </button>
          </form>
          <p className="border-t border-cream-200 px-4 py-2 text-center text-[10px] text-ink-60">
            برای پرسش‌های پیچیده‌تر، <Link href="/pages/contact" className="underline hover:text-ink">تماس با ما</Link>
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'بستن پشتیبانی' : 'باز کردن پشتیبانی'}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-cream shadow-[0_4px_16px_rgba(19,17,16,0.25)] transition-transform hover:scale-105"
      >
        {open ? '×' : '؟'}
      </button>
    </div>
  );
}
