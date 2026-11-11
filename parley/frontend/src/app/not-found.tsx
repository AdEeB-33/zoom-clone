import Link from "next/link";
import { Wordmark } from "@/components/brand/Logo";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-6">
      <Wordmark />
      <h1 className="text-display text-4xl">This page does not exist.</h1>
      <p className="text-slate">
        The address may be mistyped. Meeting links look like /join/ followed by ten digits.
      </p>
      <Link href="/" className="font-medium underline underline-offset-4">
        Go to your meetings
      </Link>
    </main>
  );
}
