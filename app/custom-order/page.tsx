import Link from 'next/link';
import { submitCustomOrderInquiry } from '@/app/actions/customOrder';

// Standalone landing page (not a tab inside the main app shell) so a QR
// code can point straight at it — e.g. /custom-order?ref=qr for a code
// printed on packaging or a flyer. `ref` is stored with the inquiry so
// replies can be traced back to which code drove them.
export default async function CustomOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const ref = typeof params.ref === 'string' ? params.ref : undefined;
  const submitted = params.submitted === '1';

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans">
      <div className="max-w-lg px-6 py-16 mx-auto space-y-8">
        <div className="space-y-3 text-center">
          <Link href="/" className="text-xs font-mono uppercase tracking-wide text-slate-500 hover:text-slate-300">
            ← Back to Ai One
          </Link>
          <h1 className="text-2xl font-bold text-white">Custom Order Inquiry</h1>
          <p className="text-sm text-slate-400">
            Tell us what you need — a custom apparel run, a bespoke print, or something outside the standard catalog —
            and we&apos;ll follow up directly.
          </p>
          {ref && (
            <span className="inline-block px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide text-slate-400 border rounded border-slate-700 bg-slate-900/80">
              Source: {ref}
            </span>
          )}
        </div>

        {submitted ? (
          <div className="p-6 space-y-2 text-center border rounded-xl bg-slate-900/80 border-slate-800">
            <p className="text-sm font-semibold text-white">Inquiry received.</p>
            <p className="text-xs text-slate-400">We&apos;ll be in touch at the email you provided.</p>
          </div>
        ) : (
          <form action={submitCustomOrderInquiry} className="p-6 space-y-4 border rounded-xl bg-slate-900/80 border-slate-800">
            {ref && <input type="hidden" name="ref" value={ref} />}
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wide text-slate-500">Name</label>
              <input
                type="text"
                name="name"
                required
                className="w-full p-3 text-sm border rounded-lg bg-slate-950 border-slate-800 text-slate-200 focus:outline-none focus:border-white/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wide text-slate-500">Email</label>
              <input
                type="email"
                name="email"
                required
                className="w-full p-3 text-sm border rounded-lg bg-slate-950 border-slate-800 text-slate-200 focus:outline-none focus:border-white/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wide text-slate-500">What do you need?</label>
              <textarea
                name="details"
                required
                rows={4}
                className="w-full p-3 text-sm border rounded-lg resize-none bg-slate-950 border-slate-800 text-slate-200 focus:outline-none focus:border-white/50"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 text-xs font-bold uppercase tracking-wide transition-all rounded-lg bg-white hover:bg-neutral-200 text-slate-950"
            >
              Submit Inquiry
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
