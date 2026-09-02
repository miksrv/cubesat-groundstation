import React from 'react'

export const Badge: React.FC<{ label?: React.ReactNode; className?: string }> = ({ label }) => (
    <span data-testid='badge'>{label}</span>
)

export const Button: React.FC<
    React.ButtonHTMLAttributes<HTMLButtonElement> & { label?: string; mode?: string; size?: string }
> = ({ label, children, mode: _mode, size: _size, ...props }) => (
    <button
        type='button'
        {...props}
    >
        {label ?? children}
    </button>
)

export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = (props) => (
    <div
        data-testid='skeleton'
        {...props}
    />
)

export const Container: React.FC<{
    title?: string
    children?: React.ReactNode
    className?: string
    action?: React.ReactNode
    footer?: React.ReactNode
}> = ({ title, children, className, action, footer }) => (
    <div className={className}>
        {(title || action) && (
            <div>
                {title && <h3>{title}</h3>}
                {action}
            </div>
        )}
        {children}
        {footer}
    </div>
)

export const Spinner: React.FC<{ className?: string }> = () => <div data-testid='spinner' />

export const cn = (...args: unknown[]) => args.filter(Boolean).join(' ')
