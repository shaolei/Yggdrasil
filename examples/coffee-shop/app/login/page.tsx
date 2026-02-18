import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/");

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-2xl font-bold text-coffee-800">Sign in</h1>
      <LoginForm />
      <p className="mt-4 text-center text-sm text-stone-600">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-coffee-600 hover:underline">
          Register
        </Link>
      </p>
    </div>
  );
}
