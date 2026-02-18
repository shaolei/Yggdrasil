"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";

export function Nav({ session }: { session: Session | null }) {
  const role = session?.user?.role ?? "customer";
  return (
    <nav className="border-b border-coffee-200 bg-white shadow-xs">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-bold text-coffee-800">
          Coffee Shop
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-coffee-700 hover:text-coffee-900">
            Menu
          </Link>
          <Link href="/cart" className="text-coffee-700 hover:text-coffee-900">
            Cart
          </Link>
          {session ? (
            <>
              <Link href="/orders" className="text-coffee-700 hover:text-coffee-900">
                Orders
              </Link>
              {role === "barista" && (
                <Link href="/barista" className="text-coffee-700 hover:text-coffee-900">
                  Barista
                </Link>
              )}
              {role === "owner" && (
                <Link href="/owner" className="text-coffee-700 hover:text-coffee-900">
                  Panel
                </Link>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded bg-coffee-600 px-3 py-1 text-sm text-white hover:bg-coffee-700"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-coffee-700 hover:text-coffee-900">
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded bg-coffee-600 px-3 py-1 text-sm text-white hover:bg-coffee-700"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
