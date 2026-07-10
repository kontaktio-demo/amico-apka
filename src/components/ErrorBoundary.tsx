import React from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface State {
  error: Error | null
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('AMICO – błąd widoku:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-[60vh] place-items-center p-6">
          <div className="card card-pad max-w-md text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-red-500/10 text-red-400">
              <AlertTriangle size={24} />
            </div>
            <h2 className="text-[18px] font-display font-semibold text-ink">Coś poszło nie tak</h2>
            <p className="mt-1 text-[13.5px] text-stone-500">
              Wystąpił błąd w tym widoku. Twoje dane są bezpieczne. Odśwież stronę lub wróć do pulpitu.
            </p>
            <pre className="mt-3 max-h-28 overflow-auto rounded-lg bg-stone-50 p-2 text-left text-[11px] text-stone-400">
              {this.state.error.message}
            </pre>
            <div className="mt-4 flex justify-center gap-2">
              <button className="btn-outline" onClick={() => this.setState({ error: null })}>
                <RotateCcw size={16} /> Spróbuj ponownie
              </button>
              <a className="btn-primary" href="#/" onClick={() => setTimeout(() => location.reload(), 50)}>
                Pulpit
              </a>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
