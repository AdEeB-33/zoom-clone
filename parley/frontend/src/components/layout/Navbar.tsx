"use client";

import { Settings } from "lucide-react";
import Link from "next/link";
import { Flag } from "@/components/brand/Flag";
import { Wordmark } from "@/components/brand/Logo";
import { Popover } from "@/components/ui/Popover";
import type { User } from "@/lib/types";

const SETTINGS = ["Audio and video", "Notifications", "Calendar connections"];

/** Top bar. Settings and the account menu are placeholders, as the brief asks. */
export function Navbar({ user, loading }: { user: User | null; loading: boolean }) {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="rounded-md">
          <Wordmark />
        </Link>

        <nav aria-label="Account" className="flex items-center gap-1">
          <Popover
            label="Settings"
            trigger={<Settings className="size-5" aria-hidden />}
            triggerClassName="grid size-10 place-items-center rounded-lg hover:bg-ink/8"
          >
            <p className="font-medium">Settings</p>
            <ul className="mt-2 flex flex-col gap-1 text-slate">
              {SETTINGS.map((setting) => (
                <li key={setting}>{setting}</li>
              ))}
            </ul>
            <p className="mt-3 border-t border-line pt-3 text-sm text-slate">
              Settings are not part of this build yet.
            </p>
          </Popover>

          {loading && <span className="mx-2 block h-5 w-28 animate-pulse rounded bg-line" />}

          {user && (
            <Popover
              label="Your account"
              trigger={
                <>
                  <Flag name={user.name} className="w-7" />
                  <span className="hidden font-medium sm:inline">{user.name}</span>
                </>
              }
              triggerClassName="flex h-10 items-center gap-2.5 rounded-lg px-2 hover:bg-ink/8"
            >
              <div className="flex items-center gap-3">
                <Flag name={user.name} className="w-10" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{user.name}</p>
                  <p className="truncate text-sm text-slate">{user.email}</p>
                </div>
              </div>
              <p className="mt-3 border-t border-line pt-3 text-sm text-slate">
                You are signed in as the sample user. Profiles and sign-in are not part of this
                build yet.
              </p>
            </Popover>
          )}
        </nav>
      </div>
    </header>
  );
}
