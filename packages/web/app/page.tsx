import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-8">Welcome to Mini Games!</h1>
        <div className="flex justify-center gap-4">
          <Link href="/login" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Login
          </Link>
          <Link href="/signup" className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
            Sign Up
          </Link>
        </div>
      </div>
    </main>
  );
}
