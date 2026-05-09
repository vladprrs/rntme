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
      errorName: error instanceof Error ? error.name : typeof error,
    };

    if (info.componentStack) {
      record.componentStack = info.componentStack;
    }

    this.props.store.set(`/runtime/renderErrors/${this.props.scope}`, record);
    console.error('[rntme] UI renderer failed', record);
  }

  override componentDidUpdate(prevProps: RendererErrorBoundaryProps): void {
    if (prevProps.identity !== this.props.identity && this.state.hasError) {
      this.setState({ hasError: false });
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
