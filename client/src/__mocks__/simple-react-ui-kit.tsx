import React from 'react'

export const Badge: React.FC<{ label?: React.ReactNode; className?: string }> = ({ label }) => (
    <span data-testid='badge'>{label}</span>
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
}> = ({ title, children, className }) => (
    <div className={className}>
        {title && <h3>{title}</h3>}
        {children}
    </div>
)

export const Spinner: React.FC<{ className?: string }> = () => <div data-testid='spinner' />

export const cn = (...args: unknown[]) => args.filter(Boolean).join(' ')
