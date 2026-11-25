import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md flex flex-col items-center">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            IntelliBooks
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Sign in to access your contract review workspace
          </p>
        </div>
        <SignIn
          fallbackRedirectUrl="/dashboard"
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "shadow-md rounded-xl border border-slate-200",
            },
          }}
        />
      </div>
    </main>
  );
}
