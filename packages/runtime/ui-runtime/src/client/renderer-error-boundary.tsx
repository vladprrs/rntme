import * as React from 'react';
import type { StateStore } from '@json-render/core';

export type RendererErrorScope = 'layout' | 'screen';

export type RenderErrorRecord = {
  scope: RendererErrorScope;
  identity: string;
  message: 'Renderer failed';
  errorName: string;
  componentStack?: string;
};

type RendererErrorBoundaryProps = {
  scope: RendererErrorScope;
  identity: string;
  store: StateStore;
  fallbackId: string;
  children: React.ReactNode;
};

type RendererErrorBoundaryState = {
  hasError: boolean;
};

function sanitizeErrorName(error: unknown): string {
  const raw = error instanceof Error ? error.name : typeof error;
  const trimmed = raw.trim();
  if (!trimmed) return 'UnknownError';
  return /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(trimmed) ? trimmed : 'UnknownError';
}

export class RendererErrorBoundary extends React.Component<
  RendererErrorBoundaryProps,
  RendererErrorBoundaryState
> {
  override state: RendererErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RendererErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    const record: RenderErrorRecord = {
      scope: this.props.scope,
      identity: this.props.identity,
      message: 'Renderer failed',
      errorName: sanitizeErrorName(error),
    };

    if (info.componentStack) {
      record.componentStack = info.componentStack;
    }

    this.props.store.set(`/runtime/renderErrors/${this.props.scope}`, record);
    console.error('[rntme] UI renderer failed', record);
  }

  override componentDidUpdate(prevProps: RendererErrorBoundaryProps): void {
    if (prevProps.identity !== this.props.identity && this.state.hasError) {
      this.clearCurrentRecord(prevProps.identity);
      this.setState({ hasError: false });
    }
  }

  override componentWillUnmount(): void {
    if (this.state.hasError) {
      this.clearCurrentRecord(this.props.identity);
    }
  }

  private clearCurrentRecord(identity: string): void {
    const path = `/runtime/renderErrors/${this.props.scope}`;
    const current = this.props.store.get(path) as Partial<RenderErrorRecord> | undefined;
    if (current?.identity === identity) {
      this.props.store.set(path, undefined);
    }
  }

  override render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const label =
      this.props.scope === 'screen'
        ? 'This screen failed to render.'
        : 'This layout failed to render.';

    return React.createElement(
      'div',
      {
        id: this.props.fallbackId,
        role: 'alert',
        'data-rntme-error-scope': this.props.scope,
        style: { border: '1px solid #b91c1c', padding: 16, background: '#fef2f2' },
      },
      React.createElement('strong', null, label),
      React.createElement(
        'p',
        null,
        this.props.scope === 'screen'
          ? 'Navigate to another route or reload after the screen is fixed.'
          : 'Reload after the layout is fixed, or navigate to a route with another layout.',
      ),
    );
  }
}
