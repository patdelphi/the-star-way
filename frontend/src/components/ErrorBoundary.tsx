/**
 * ErrorBoundary.tsx
 * 程序说明：捕获 React 渲染异常，避免单个页面状态异常导致整站白屏。
 */
import { Component, type ErrorInfo, type ReactNode } from "react"

type ErrorBoundaryProps = {
  children: ReactNode
  title: string
  description: string
  actionLabel: string
}

type ErrorBoundaryState = {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("React render error", error, info)
  }

  private handleReload = () => {
    this.setState({ hasError: false })
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="rounded-lg border border-error/30 bg-error/10 px-4 py-5 text-sm text-error">
        <h2 className="text-base font-semibold">{this.props.title}</h2>
        <p className="mt-2 text-error/80">{this.props.description}</p>
        <button
          type="button"
          className="mt-4 rounded-md bg-error px-3 py-2 text-sm font-medium text-white hover:bg-error/90"
          onClick={this.handleReload}
        >
          {this.props.actionLabel}
        </button>
      </div>
    )
  }
}
