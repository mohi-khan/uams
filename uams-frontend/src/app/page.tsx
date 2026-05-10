import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex flex-col">

      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">U</span>
          </div>
          <span className="font-bold text-gray-900 text-lg">UAMS</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors px-4 py-2"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Register University
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <span className="inline-block bg-indigo-50 text-indigo-600 text-xs font-semibold px-3 py-1 rounded-full mb-6 tracking-wide uppercase">
          University Academic Management System
        </span>
        <h1 className="text-5xl font-bold text-gray-900 leading-tight max-w-3xl mb-6">
          Manage your university
          <span className="text-indigo-600"> academics </span>
          in one place
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mb-10 leading-relaxed">
          Assignments, quizzes, grading, and student performance — all digitized
          and accessible for every role in your institution.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/register"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors text-sm"
          >
            Register your University
          </Link>
          <Link
            href="/login"
            className="border border-gray-300 hover:border-indigo-400 hover:text-indigo-600 text-gray-700 font-semibold px-8 py-3 rounded-lg transition-colors text-sm"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Feature cards */}
      <section className="max-w-5xl mx-auto w-full px-6 pb-24 grid grid-cols-1 sm:grid-cols-3 gap-6">
        {FEATURES.map((f) => (
          <div key={f.title} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center mb-4 text-xl">
              {f.icon}
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-400 py-6 border-t border-gray-100">
        © {new Date().getFullYear()} UAMS · University Academic Management System
      </footer>

    </main>
  )
}

const FEATURES = [
  {
    icon: '📝',
    title: 'Assignments',
    description: 'Teachers create and review assignments. Students submit and track feedback in real time.',
  },
  {
    icon: '🎯',
    title: 'Quizzes & Grading',
    description: 'Auto-graded quizzes with instant results. Flexible grading schemes per course.',
  },
  {
    icon: '📊',
    title: 'Results & Transcripts',
    description: 'GPA calculation, result publication, and downloadable transcripts for every student.',
  },
]
